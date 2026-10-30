// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! subtitles.js — 💬 字幕（SRT/VTT）（trk169）
   外部字幕ファイル（SRT／WebVTT）を解析して、再生位置に合わせた表示に渡す。
   ・優先順：手で選んだファイル → フォルダの同名 .srt/.vtt（相乗り）。
     埋め込み字幕トラックはブラウザ制約で読めないことが多いので対象外＝外部ファイル優先。
   ・表示は DOM オーバーレイ（映像は canvas に描くため、ネイティブ <track> は画面に出ない）。
     画中画（PiP）だけは <track> がそのまま見えるので、同じ内容の WebVTT を付けておく。
   ・手で選んだ字幕と遅延調整は localStorage（trk_subs_v1）に曲キー単位で保存する。
     上限（1曲 512KB・合計 1MB）を超えたら古い順に追い出す。
   ・字幕は端末から出さない（読むだけ・送信なし）。元ファイルへの書き戻しもしない。
   ・表示の同期は media-player-mode.js と video-max.js（currentTexts を毎フレーム呼ぶ）。
   読み込み順：lyrics.js → subtitles.js（純関数の集まりなので依存は window.Trk だけ）
   ============================================================================ */
(() => {
"use strict";

const SUBS_KEY = "trk_subs_v1";
const MAX_TEXT_CHARS = 500_000;      /* 1つの字幕ファイルの読み込み上限 */
const MAX_CUES = 5000;               /* キュー数の上限（異常ファイル対策） */
const MAX_CUE_TEXT = 500;            /* 1キューの文字数の上限 */
const MAX_CUE_LINES = 4;             /* 1キューの行数の上限 */
const MAX_ENTRY_BYTES = 512 * 1024;  /* 手で選んだ字幕：1曲ぶん */
const MAX_STORE_BYTES = 1024 * 1024; /* 手で選んだ字幕：合計 */
const MAX_OFFSET_MS = 300_000;       /* 遅延調整の範囲（±5分） */

function clampOffset(ms) {
  const n = Math.round(Number(ms));
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_OFFSET_MS, Math.max(-MAX_OFFSET_MS, n));
}

/* 時刻 "HH:MM:SS.mmm" / "HH:MM:SS,mmm"（SRT のカンマ）/ "MM:SS.mmm"（VTT の短縮形）→ 秒。ダメなら null */
function stampSeconds(s) {
  const m = /^(\d{1,2}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(String(s).trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1].slice(0, -1)) : 0;
  const mins = Number(m[2]), secs = Number(m[3]);
  const frac = Number(String(m[4]).padEnd(3, "0"));
  if (h > 99 || mins > 59 || secs > 59) return null;
  return h * 3600 + mins * 60 + secs + frac / 1000;
}

/* キュー本文のそうじ：{\an8} 等のASS装飾と <i> 等のHTML風タグを落とし、行を詰める */
function cleanCueText(lines) {
  const out = [];
  for (const raw of lines) {
    const s = String(raw).replace(/\{[^}]*\}/g, "").replace(/<[^>]+>/g, "").trim();
    if (s) out.push(s.slice(0, MAX_CUE_TEXT));
    if (out.length >= MAX_CUE_LINES) break;
  }
  return out.join("\n");
}

/* SRT／WebVTT のテキスト → { cues:[{start,end,text}] }（start の昇順）。読めなければ null。
   両形式の違い（ヘッダ・番号行・カンマ/ドット・VTT のキューIDや position 指定）は
   「空行で区切られた塊から " --> " を含む行を探す」1つの走査で吸収する。
   WEBVTT の NOTE・STYLE 塊は時刻行が無いので自然に飛ばされる。 */
function parseSubtitles(src) {
  const text = String(src == null ? "" : src).replace(/^\uFEFF/, "").slice(0, MAX_TEXT_CHARS);
  if (!text.trim()) return null;
  const cues = [];
  for (const block of text.split(/\r\n\r\n|\n\n|\r\r/)) {
    if (!block.trim()) continue;
    const lines = block.split(/\r\n|\n|\r/);
    let ti = -1;
    for (let i = 0; i < lines.length && i < 3; i++) if (lines[i].includes("-->")) { ti = i; break; }
    if (ti < 0) continue;
    const tm = /^(\S+)\s*-->\s*(\S+)/.exec(lines[ti].trim());
    if (!tm) continue;
    const start = stampSeconds(tm[1]);
    let end = stampSeconds(tm[2]);
    if (start == null || end == null) continue;
    if (end < start) end = start;
    const body = cleanCueText(lines.slice(ti + 1));
    if (!body) continue;
    cues.push({ start, end, text: body });
    if (cues.length >= MAX_CUES) break;
  }
  if (!cues.length) return null;
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return { cues };
}

/* 再生位置（秒）にいま重なっているキューの本文（表示順・最大4件）。cues は start 昇順。
   二分探索で「最後に始まったキュー」を探し、そこから少しだけ戻る（60fps の描画ループでも軽い） */
function activeCues(cues, seconds) {
  if (!Array.isArray(cues) || !cues.length || !Number.isFinite(seconds)) return [];
  let lo = 0, hi = cues.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= seconds) { idx = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  const out = [];
  for (let i = idx; i >= 0 && out.length < MAX_CUE_LINES; i--) {
    if (cues[i].end >= seconds) out.unshift(cues[i].text);
    if (seconds - cues[i].start > 30) break;   /* 長く重なる異常キューを延々さかのぼらない */
  }
  return out;
}

const vttStamp = t => {
  t = Math.max(0, Number(t) || 0);
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60);
  let ms = Math.round((t - Math.floor(t)) * 1000); if (ms > 999) ms = 999;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

/* cues → WebVTT テキスト（<track>＝画中画用）。offsetMs > 0 で字幕を遅く表示する（時刻に足す） */
function toVtt(cues, offsetMs = 0) {
  const off = clampOffset(offsetMs) / 1000;
  let out = "WEBVTT\n\n";
  for (const c of cues || []) out += `${vttStamp(c.start + off)} --> ${vttStamp(c.end + off)}\n${c.text}\n\n`;
  return out;
}

/* ---------- 手で選んだ字幕・遅延の保存（localStorage・曲キー単位。lyrics.js と同じ形） ---------- */
function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(SUBS_KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch (_) { return {}; }
}
function writeStore(store) {
  try { localStorage.setItem(SUBS_KEY, JSON.stringify(store)); return true; }
  catch (_) { return false; }           /* 容量不足・プライベートモード → 保存できなくても再生は続く */
}
function manualSubs(songKey) {
  if (!songKey) return null;
  const entry = readStore()[String(songKey)];
  return entry && typeof entry.text === "string" && entry.text ? entry : null;
}
function subsOffset(songKey) {
  if (!songKey) return 0;
  const entry = readStore()[String(songKey)];
  return entry ? clampOffset(entry.offsetMs) : 0;
}
function saveManualSubs(songKey, text, name, offsetMs = 0) {
  if (!songKey || typeof text !== "string" || !text.trim()) return false;
  const store = readStore();
  store[String(songKey)] = { text: text.slice(0, MAX_ENTRY_BYTES), name: String(name || "").slice(0, 120), offsetMs: clampOffset(offsetMs), addedAt: Date.now() };
  return evictAndWrite(store, songKey);
}
/* 遅延だけ保存する（フォルダの .srt/.vtt を使う曲でも遅延調整は残せる。text は入っていない） */
function saveSubsOffset(songKey, offsetMs) {
  if (!songKey) return false;
  const store = readStore();
  const prev = store[String(songKey)] || {};
  store[String(songKey)] = { ...prev, offsetMs: clampOffset(offsetMs), addedAt: prev.addedAt || Date.now() };
  return evictAndWrite(store, songKey);
}
function evictAndWrite(store, songKey) {
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
function clearManualSubs(songKey) {
  if (!songKey) return;
  const store = readStore();
  if (String(songKey) in store) { delete store[String(songKey)]; writeStore(store); }
}

/* ---------- 曲の字幕を解決する（優先順：手動 → フォルダの .srt/.vtt） ----------
   戻り値は { cues, source:"manual"|"folder", name, offsetMs }。なければ null。 */
async function resolveSubs(song) {
  if (!song) return null;
  const offsetMs = subsOffset(song.key);
  const manual = manualSubs(song.key);
  if (manual) {
    const parsed = parseSubtitles(manual.text);
    if (parsed) return { cues: parsed.cues, source: "manual", name: manual.name || "", offsetMs };
  }
  const side = song.subsFile;
  if (side && typeof side.text === "function" && Number(side.size) <= MAX_ENTRY_BYTES) {
    try {
      const parsed = parseSubtitles(await side.text());
      if (parsed) return { cues: parsed.cues, source: "folder", name: side.name || "", offsetMs };
    } catch (_) {}
  }
  return null;
}

/* 字幕ファイルを選ぶ入口（media-player-mode.js から）。大きすぎ／読めない／空は error で返す */
async function readSubsFile(file) {
  if (!file || typeof file.text !== "function") return { error: "unreadable" };
  if (Number(file.size) > MAX_ENTRY_BYTES) return { error: "tooBig" };
  try {
    const text = await file.text();
    const parsed = parseSubtitles(text);
    return parsed ? { ok: parsed, text } : { error: "empty" };
  } catch (_) { return { error: "unreadable" }; }
}

/* ---------- いま表示する字幕（表示側が毎フレーム引く窓口） ----------
   media-player-mode.js が読み込み後に setCurrent で入れ、オーバーレイと video-max が
   currentTexts(再生位置) を呼ぶ。逆再生中などは pauseOverlay(true) で止める（時計が違うため）。 */
let current = null;      /* { cues, offsetMs, on } */
let paused = false;
function setCurrent(data, on = true) {
  current = data && Array.isArray(data.cues) && data.cues.length
    ? { cues: data.cues, offsetMs: clampOffset(data.offsetMs), on: on !== false }
    : null;
  return !!current;
}
function setOn(on) { if (current) current.on = on !== false; return !!(current && current.on); }
function pauseOverlay(v) { paused = !!v; }
function currentTexts(seconds) {
  if (!current || !current.on || paused || !Number.isFinite(seconds)) return [];
  /* offsetMs > 0 ＝字幕を遅く表示＝キューの時刻が後ろへずれる＝再生位置からは引く */
  return activeCues(current.cues, Math.max(0, seconds - current.offsetMs / 1000));
}

/* ---------- 📌 画中画用のネイティブ <track>（同じ内容を WebVTT にして付ける） ----------
   映像は canvas に描いて表示するので、通常の画面では <track> は見えない（オーバーレイが見せる）。
   PiP の窓だけはビデオ要素そのものが出るので、そこで字幕が付く。1本だけ管理する（付け直すときは古いのを消す） */
let trackUrl = null;
function attachTrack(video, cues, offsetMs, label) {
  detachTrack(video);
  if (!video || !Array.isArray(cues) || !cues.length) return false;
  try {
    trackUrl = URL.createObjectURL(new Blob([toVtt(cues, offsetMs)], { type: "text/vtt" }));
    const t = document.createElement("track");
    t.kind = "subtitles"; t.srclang = "und";
    t.label = String(label || "subtitles").slice(0, 80);
    t.src = trackUrl;
    t.dataset.trkSubs = "1";
    video.append(t);
    const tt = video.textTracks;
    if (tt && tt.length) { try { tt[tt.length - 1].mode = "showing"; } catch (_) {} }
    return true;
  } catch (_) { detachTrack(video); return false; }
}
function detachTrack(video) {
  if (video) {
    try {
      const old = video.querySelectorAll ? video.querySelectorAll("track[data-trk-subs]") : [];
      for (const t of Array.from(old)) t.remove();
    } catch (_) {}
  }
  if (trackUrl) { try { URL.revokeObjectURL(trackUrl); } catch (_) {} trackUrl = null; }
}

window.Trk = window.Trk || {};
window.Trk.subtitles = Object.freeze({
  parseSubtitles, stampSeconds, activeCues, toVtt, clampOffset,
  resolveSubs, readSubsFile,
  manualSubs, saveManualSubs, clearManualSubs, subsOffset, saveSubsOffset,
  setCurrent, setOn, pauseOverlay, currentTexts, attachTrack, detachTrack,
  SUBS_KEY,
  limits: Object.freeze({ textChars: MAX_TEXT_CHARS, cues: MAX_CUES, cueText: MAX_CUE_TEXT, cueLines: MAX_CUE_LINES, entryBytes: MAX_ENTRY_BYTES, storeBytes: MAX_STORE_BYTES, offsetMs: MAX_OFFSET_MS })
});
})();
/* ✅ subtitles.js 完了 */
