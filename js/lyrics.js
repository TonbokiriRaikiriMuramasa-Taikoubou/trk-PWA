// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! lyrics.js — 🎤 歌詞（trk166）
   LRC 同期歌詞のパーサと、曲ごとの歌詞の解決（優先順：手で選んだ歌詞 →
   フォルダの同名 .lrc → 埋め込みタグ USLT/SYLT/©lyr/LYRICS）。
   ・歌詞は端末から出さない（読むだけ・送信なし）。元ファイルへの書き戻しもしない。
   ・手で選んだ歌詞は localStorage（trk_lyrics_v1）に曲キー単位で小さく保存する。
     上限（1曲 256KB・合計 512KB）を超えたら古い順に追い出す。
   ・表示の同期（ハイライト・スクロール）は media-player-mode.js が担当する。
   ============================================================================ */
(() => {
"use strict";

const LYRICS_KEY = "trk_lyrics_v1";
const MAX_TEXT_CHARS = 100_000;      /* 1つの歌詞テキストの上限（これ以上は切って読む） */
const MAX_LINES = 1000;              /* 表示する行の上限 */
const MAX_STAMPS_PER_LINE = 50;      /* 1行に詰められた時刻タグの上限（異常ファイル対策） */
const MAX_ENTRY_BYTES = 256 * 1024;  /* 手で選んだ歌詞：1曲ぶん */
const MAX_STORE_BYTES = 512 * 1024;  /* 手で選んだ歌詞：合計 */

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;   /* [mm:ss.xx] [mm:ss] [mm:ss.xxx] [mm:ss:xx] */
const INLINE_TAG = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;          /* 拡張LRCの単語タイミング（行単位に丸める） */
const META_TAGS = { ti:"title", ar:"artist", al:"album", by:"credits", re:"player", ve:"version" };

/* 小数部の桁数で単位を決める：1桁=1/10秒、2桁=1/100秒、3桁=1/1000秒 */
function fractionSeconds(digits) {
  if (!digits) return 0;
  const n = Number(digits);
  if (!Number.isFinite(n)) return 0;
  return digits.length === 1 ? n / 10 : digits.length === 2 ? n / 100 : n / 1000;
}

/* LRC テキスト → { synced, lines:[{t,text}], meta, offsetMs }。
   時刻タグが1つもなければ synced:false の素のテキスト（t は null）。
   [offset:±N] はミリ秒。仕様どおり「+ で早く表示」＝時刻から引く。 */
function parseLrc(src) {
  const text = String(src == null ? "" : src).replace(/^\uFEFF/, "").slice(0, MAX_TEXT_CHARS);
  const meta = {};
  let offsetMs = 0, synced = false;
  const lines = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const s = String(raw).trim();
    if (!s) continue;
    TIME_TAG.lastIndex = 0;
    const stamps = [];
    let m;
    while ((m = TIME_TAG.exec(s)) !== null && stamps.length < MAX_STAMPS_PER_LINE) {
      const mins = Number(m[1]), secs = Number(m[2]);
      if (mins <= 599 && secs <= 59) stamps.push(mins * 60 + secs + fractionSeconds(m[3]));
    }
    if (stamps.length) {
      synced = true;
      const body = s.slice(s.lastIndexOf("]") + 1).replace(INLINE_TAG, " ").trim();
      for (const t of stamps) lines.push({ t, text: body });
      continue;
    }
    const metaMatch = /^\[([a-zA-Z#]+):([^]*)\]$/.exec(s);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase(), value = metaMatch[2].trim();
      if (key === "offset") { const n = Number(value); if (Number.isFinite(n)) offsetMs = n; continue; }
      /* 知っているIDタグ（ti/ar/al/by/re/ve）だけメタとして消費する。
         知らない [Intro:soft] などは歌詞の一部分かもしれないので、そのまま行として残す */
      if (META_TAGS[key]) { meta[META_TAGS[key]] = value.slice(0, 200); continue; }
    }
    lines.push({ t: null, text: s.replace(INLINE_TAG, " ").trim() });
  }
  if (synced) {
    const offset = offsetMs / 1000;
    const timed = [];
    for (const l of lines) if (l.t !== null) timed.push({ t: Math.max(0, l.t - offset), text: l.text });
    timed.sort((a, b) => a.t - b.t);  /* 時刻タグの順不同・複数行にまたがる重複にも耐える */
    return { synced: true, lines: timed.slice(0, MAX_LINES), meta, offsetMs };
  }
  return { synced: false, lines: lines.slice(0, MAX_LINES), meta, offsetMs: 0 };
}

/* 再生位置（秒）に対して「いま歌っている行」の index。まだ1行目より前なら -1。
   lines は t の昇順（parseLrc / normalizeLyrics の出力）。 */
function activeLineIndex(lines, seconds) {
  if (!Array.isArray(lines) || !lines.length || !Number.isFinite(seconds)) return -1;
  let lo = 0, hi = lines.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = Number(lines[mid] && lines[mid].t);
    if (Number.isFinite(t) && t <= seconds) { found = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return found;
}

/* いろいろな形の歌詞を1つの形にそろえる。
   受け付ける形：LRC 文字列 ／ { text }（USLT・©lyr・Vorbis LYRICS。中身が LRC のこともある）／
   { lines:[{t,text}] }（SYLT の同期歌詞・t は秒） */
function normalizeLyrics(source) {
  if (source == null) return null;
  if (typeof source === "string" || typeof source.text === "string") {
    const parsed = parseLrc(typeof source === "string" ? source : source.text);
    return parsed.lines.length ? parsed : null;
  }
  if (Array.isArray(source.lines) && source.lines.length) {
    const lines = source.lines
      .filter(l => l && Number.isFinite(l.t) && typeof l.text === "string")
      .map(l => ({ t: Math.max(0, Number(l.t)), text: l.text }))
      .sort((a, b) => a.t - b.t)
      .slice(0, MAX_LINES);
    return lines.length ? { synced: true, lines, meta: {}, offsetMs: 0 } : null;
  }
  return null;
}

/* ---------- 手で選んだ歌詞の保存（localStorage・曲キー単位） ---------- */
function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(LYRICS_KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch (_) { return {}; }
}
function writeStore(store) {
  try { localStorage.setItem(LYRICS_KEY, JSON.stringify(store)); return true; }
  catch (_) { return false; }           /* 容量不足・プライベートモード → 保存できなくても再生は続く */
}
function manualLyrics(songKey) {
  if (!songKey) return null;
  const entry = readStore()[String(songKey)];
  return entry && typeof entry.text === "string" && entry.text ? entry : null;
}
function saveManualLyrics(songKey, text, name) {
  if (!songKey || typeof text !== "string" || !text.trim()) return false;
  const store = readStore();
  store[String(songKey)] = { text: text.slice(0, MAX_ENTRY_BYTES), name: String(name || "").slice(0, 120), addedAt: Date.now() };
  let bytes = JSON.stringify(store).length;
  if (bytes > MAX_STORE_BYTES) {        /* 合計の上限を超えたら、古い曲から追い出す（今の曲は残す） */
    const keys = Object.keys(store).sort((a, b) => (store[a].addedAt || 0) - (store[b].addedAt || 0));
    for (const k of keys) {
      if (bytes <= MAX_STORE_BYTES) break;
      if (k === String(songKey)) continue;
      delete store[k];
      bytes = JSON.stringify(store).length;
    }
  }
  return writeStore(store);
}
function clearManualLyrics(songKey) {
  if (!songKey) return;
  const store = readStore();
  if (String(songKey) in store) { delete store[String(songKey)]; writeStore(store); }
}

/* ---------- 曲の歌詞を解決する（優先順：手動 → フォルダの .lrc → 埋め込みタグ） ----------
   戻り値は normalizeLyrics の形 + { source:"manual"|"folder"|"embedded", name }。なければ null。 */
async function resolveLyrics(song) {
  if (!song) return null;
  const manual = manualLyrics(song.key);
  if (manual) {
    const parsed = normalizeLyrics(manual.text);
    if (parsed) return Object.assign(parsed, { source: "manual", name: manual.name || "" });
  }
  const lrc = song.lyricsFile;
  if (lrc && typeof lrc.text === "function" && Number(lrc.size) <= MAX_ENTRY_BYTES) {
    try {
      const parsed = normalizeLyrics(await lrc.text());
      if (parsed) return Object.assign(parsed, { source: "folder", name: lrc.name || "" });
    } catch (_) {}
  }
  const api = window.Trk.media && window.Trk.media.audioArt;
  if (api && typeof api.extractLyrics === "function" && song.file) {
    try {
      const parsed = normalizeLyrics(await api.extractLyrics(song.file));
      if (parsed) return Object.assign(parsed, { source: "embedded", name: "" });
    } catch (_) {}
  }
  return null;
}

/* 歌詞ファイルを選ぶ入口（media-player-mode.js から）。大きすぎ／読めない／空は error で返す */
async function readLyricsFile(file) {
  if (!file || typeof file.text !== "function") return { error: "unreadable" };
  if (Number(file.size) > MAX_ENTRY_BYTES) return { error: "tooBig" };
  try {
    const text = await file.text();
    const parsed = normalizeLyrics(text);
    return parsed ? { ok: parsed, text } : { error: "empty" };
  } catch (_) { return { error: "unreadable" }; }
}

window.Trk = window.Trk || {};
window.Trk.lyrics = Object.freeze({
  parseLrc, activeLineIndex, normalizeLyrics, resolveLyrics, readLyricsFile,
  manualLyrics, saveManualLyrics, clearManualLyrics, LYRICS_KEY,
  limits: Object.freeze({ textChars: MAX_TEXT_CHARS, lines: MAX_LINES, stampsPerLine: MAX_STAMPS_PER_LINE, entryBytes: MAX_ENTRY_BYTES, storeBytes: MAX_STORE_BYTES })
});
})();
/* ✅ lyrics.js 完了 */
