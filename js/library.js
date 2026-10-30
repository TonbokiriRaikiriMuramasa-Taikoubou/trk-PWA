(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：選曲画面 ============
   曲リスト・フォルダ・プレビュー・曲ごとの設定・称号表示
   ▶ AUTO の切り替え・📻 ラジオ（次の曲へ自動で進む）・🎲 シードを探す道具
   文章は i18n.js にあります。 */
"use strict";

const MEDIA_EXT = ["mp4", "m4a", "m4b", "mp3", "ogg", "oga", "opus", "wav", "webm", "flac", "aac", "mov", "mkv", "mpg", "mpeg", "mpe", "m2v", "m2ts", "mid", "midi"];   /* 🔖 m4b（オーディオブック）も曲として扱う（trk170）
   🎞 trk195：.mkv（Matroska）と .mpg（MPEG-PS）を一覧・フォルダーの取り込みに加えた。
   ただし「取り込める＝再生できる」ではありません。中身のコーデックがブラウザーに無ければ再生は失敗するので、
   そのときは media.js が理由（例：MPEG-2 映像・AC3 音声）を出します。 */
const LIB_MAX = 3000, LIB_SHOW = 300, ADDED_MAX = 50, CHART_SUFFIX = ".shadow-taiko.json"; /* ADDED_MAX はセッション内リストのみ */
const MEDIA_KEEP_BYTES_1G = 1024 ** 3, MEDIA_KEEP_BYTES_5G = 5 * 1024 ** 3;
const TRK_PUBLIC_PAGE_URL = "https://freegame-mugen.jp/puzzle/game_15772.html";
const TRK_OLD_PROJECT_URL = "https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk";
const TRK_OLD_GAME_GUIDE_NOTE = "非営利の紹介プレイリスト。音源は同梱しません。公式の入手先からどうぞ。";
function mediaKeepCapBytes() {
  return core.settings.mediaKeepLimit === "unlimited" ? Infinity
    : core.settings.mediaKeepLimit === "5g" ? MEDIA_KEEP_BYTES_5G : MEDIA_KEEP_BYTES_1G;
}
function mediaKeepCapLabel() {
  return tr(core.settings.mediaKeepLimit === "unlimited" ? "mediaKeepLimitUnlimited"
    : core.settings.mediaKeepLimit === "5g" ? "mediaKeepLimit5" : "mediaKeepLimit1");
}
function formatMediaBytes(value) {
  const n = Math.max(0, Number(value) || 0);
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KiB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  return `${(n / 1024 ** 3).toFixed(2)} GiB`;
}
const LIB_DEPTH = 8;                        /* 📤 共有は「一気に全部」が売りなので、フォルダの深さも広く歩く（旧 6） */
const SHARED_MAX = 150;                     /* 💾 端末に残す共有の曲の上限（空き容量を守るため） */
const SHARED_BYTES = 300 * 1024 * 1024, SHARED_MB = Math.round(SHARED_BYTES / 1048576);
const canPickDir = "showDirectoryPicker" in window && window.isSecureContext && window.self === window.top;
const libKV = core.idbStore("shadow_taiko_library", "kv");
/* 旧 shadow_taiko_songs のレコードは size を持たない場合がある。Blobのサイズを使い、主キー(key)で置換分を差し引く。
   version/indexは増やさず、既存データをそのまま扱います（既存版から開いたタブにも配慮）。 */
function storedMediaSize(rec) {
  const n = rec && Number.isFinite(rec.size) ? rec.size : rec && rec.file && Number.isFinite(rec.file.size) ? rec.file.size : 0;
  return n >= 0 ? n : 0;
}
const songDB = core.idbStore("shadow_taiko_songs", "files", { sizeKey:"size", sizeOf:storedMediaSize, idKey:"key" });
/* 💾 共有した曲を端末に残すときの保存先（新しいキー。既存の保存キーは変えていません） */
const sharedDB = core.idbStore("shadow_taiko_shared", "files");
/* 📄参照のみの保存（1.0.6）：曲本体なしでもリロード後に“あったこと”を残す。保存棚の容量とは別枠。 */
const songRefDB = core.idbStore("shadow_taiko_song_refs", "refs", { idKey: "key" });
let ghostSongs = [];

/* ---------- ▶ AUTO・📻 ラジオの切り替え ---------- */
core.settings.radio = !!core.prefs.radio;
const RADIO_WAIT = 5;   // 次の曲までの秒数
const autoBtn = el("button"); autoBtn.type = "button"; autoBtn.id = "autoToggle";
const radioBtn = el("button"); radioBtn.type = "button"; radioBtn.id = "radioToggle";
const toggleHint = el("div", "hint");
(() => {
  const picker = core.$("modePicker");
  const old = picker.querySelector('[data-playmode="auto"]'); if (old) old.remove();   // 古い index.html 用
  picker.after(autoBtn, radioBtn, toggleHint);
})();
function syncToggles() {
  autoBtn.textContent = tr(core.settings.autoPlay ? "autoOn" : "autoOff");
  radioBtn.textContent = tr(core.settings.radio ? "radioOn" : "radioOff");
  for (const [b, onFlag] of [[autoBtn, core.settings.autoPlay], [radioBtn, core.settings.radio]]) {
    b.classList.toggle("selected", onFlag); b.setAttribute("aria-pressed", String(onFlag));
  }
  toggleHint.textContent = `${tr("autoHint")} ${tr("radioHint")}`;
}
autoBtn.addEventListener("click", () => { core.settings.autoPlay = !core.settings.autoPlay; core.saveUserPrefs(); syncToggles(); core.emit("options"); });
radioBtn.addEventListener("click", () => { core.settings.radio = !core.settings.radio; core.saveUserPrefs(); syncToggles(); if (!core.settings.radio) cancelRadio(); core.emit("options"); });
on("language", syncToggles);
syncToggles();

/* ---------- 曲ごとの設定（BPM・オフセット・Seed・プレビュー位置・最近のシード） ---------- */
const SONG_PREFS_KEY = "shadow_taiko_song_prefs_v1";
let songPrefs = { byFp:{}, keyFp:{} };
try {
  const raw = JSON.parse(localStorage.getItem(SONG_PREFS_KEY));
  if (raw && typeof raw === "object") songPrefs = { byFp:raw.byFp || {}, keyFp:raw.keyFp || {} };
} catch (_) {}
function saveSongPrefsStore() { try { localStorage.setItem(SONG_PREFS_KEY, JSON.stringify(songPrefs)); } catch (_) {} }

/* main.js（BPM・オフセット・Seedの入力）から呼ばれる */
function saveSongPrefs() {
  if (!core.fingerprint) return false;
  const bpm = Number(core.$("bpm").value), offset = Number(core.$("offset").value) || 0, prev = songPrefs.byFp[core.fingerprint] || {};
  songPrefs.byFp[core.fingerprint] = { ...prev, bpm:bpm >= 60 && bpm <= 300 ? bpm : prev.bpm,
    offset:Math.max(-5000, Math.min(5000, offset)), seed:core.$("seed").value.slice(0, 32), t:Date.now() };
  saveSongPrefsStore();
  core.setStatus("songPrefsStatus", "songPrefsSaved");
  return true;
}

/* ---------- 🎲 シードを探す道具 ---------- */
const seedTools = el("div", "miniActions"); seedTools.style.alignItems = "center";
core.$("songPrefsStatus").after(seedTools);
function setSeed(s) {
  if (core.phase !== "title") return;
  core.$("seed").value = s;
  core.$("seed").dispatchEvent(new Event("input"));    // main.js が保存と譜面の作り直しをします
}
function renderSeedTools() {
  seedTools.textContent = "";
  const roll = el("button", "", tr("seedRoll")); roll.type = "button";
  roll.addEventListener("click", () => setSeed(String(100000 + Math.floor(Math.random() * 900000))));
  seedTools.append(roll);
  const seeds = (core.fingerprint && songPrefs.byFp[core.fingerprint] && songPrefs.byFp[core.fingerprint].seeds) || [];
  if (!seeds.length) return;
  seedTools.append(el("span", "hint", tr("seedRecent")));
  for (const s of seeds) {
    const b = el("button", s === core.$("seed").value.trim() ? "selected" : "", s); b.type = "button";
    b.addEventListener("click", () => setSeed(s));
    seedTools.append(b);
  }
}
on("beforePlay", () => {
  const s = core.$("seed").value.trim(); if (!core.fingerprint || !s) return;
  const sp = songPrefs.byFp[core.fingerprint] ||= {};
  sp.seeds = [s, ...(sp.seeds || []).filter(x => x !== s)].slice(0, 8);
  saveSongPrefsStore(); renderSeedTools();
});
on("chart", renderSeedTools);
on("language", renderSeedTools);

/* ---------- 曲リストの中身 ---------- */
let folderSongs = [], addedSongs = [], savedSongs = [], packSongs = [], libHandle = null, libView = [];
let savedMediaLoadFailed = false, mediaKeepRenderToken = 0;
/* 🎓 任意同梱デモ。小さな manifest で存在確認し、MP3は選択時だけ同一オリジンから読みます。 */
const FIRST_SPARK_KEY = "builtin:first-spark-tutorial-v1";
const FIRST_SPARK_MAX_BYTES = 2 * 1024 * 1024;
const FIRST_SPARK_MANIFEST = "./assets/optional-demo-audio/manifest.json";
const FIRST_SPARK_ASSET = "./assets/optional-demo-audio/first-spark-tutorial.mp3";
/* 🎼 手づくりのデモ譜面（初級・中級・上級）。同じフォルダーに入る任意の同梱物で、
   ファイルが無ければ自動生成に戻ります。達人・RUSH は置いていないので今までどおりSeedから作ります。
   名前はここで決め打ち（manifest 経由でパスを変えない）＋ shadow-taiko-chart の項目検証を通します。 */
const FIRST_SPARK_CHART_DIR = "./assets/optional-demo-audio/";
const FIRST_SPARK_CHART_DIFFS = ["easy", "normal", "hard"];
const firstSparkChartFile = diff => `first-spark-tutorial.${diff}.json`;
let builtInSongs = [];
let firstSparkFilePromise = null;
let firstSparkChartMap = {};      /* 難易度 → URL（manifest.charts === false のときは空） */
let firstSparkChartCache = new Map();   /* 難易度 → 読んだ譜面データ（null = このビルドに無い） */
let songSelectToken = 0;
/* 譜面を1回だけ読みに行って覚える。404は「同梱していない」、その他の失敗は次回もう一度試す */
async function firstSparkChartData(diff) {
  const url = firstSparkChartMap[diff];
  if (!url) return null;
  if (firstSparkChartCache.has(diff)) return firstSparkChartCache.get(diff);
  try {
    const response = await fetch(url, { credentials:"same-origin" });
    if (response.status === 404) { firstSparkChartCache.set(diff, null); return null; }
    if (!response.ok) return null;
    const declared = Number(response.headers.get("Content-Length") || 0);
    if (declared > window.Trk.media.CHART_FILE_MAX) return null;
    const text = await response.text();
    if (!text.length || text.length > window.Trk.media.CHART_FILE_MAX) return null;
    const data = JSON.parse(text);
    firstSparkChartCache.set(diff, data);
    return data;
  } catch (_) { return null; }   /* 通信・JSONの失敗は自動生成で遊ぶ（デモを止めない） */
}
/* 同梱の FIRST SPARK（任意の音源フォルダ optional-demo-audio/）を、あれば曲リストへ入れる。
   ガイドの「30秒デモ」ボタンは trk140 で外した。曲そのものは残す（フォルダごと消せば曲も消える）。 */
async function initOptionalTutorialDemo() {
  try {
    const response = await fetch(FIRST_SPARK_MANIFEST, { credentials:"same-origin" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest || manifest.version !== 1 || manifest.enabled !== true || manifest.file !== "first-spark-tutorial.mp3") return;
    /* manifest.charts === false なら音源だけ同梱した構成（譜面は自動生成） */
    firstSparkChartMap = manifest.charts === false ? {} :
      Object.fromEntries(FIRST_SPARK_CHART_DIFFS.map(d => [d, FIRST_SPARK_CHART_DIR + firstSparkChartFile(d)]));
    const firstSpark = {
      key:FIRST_SPARK_KEY, source:"builtin", file:null, fileName:"FIRST_SPARK_Tutorial_30s.mp3",
      title:"FIRST SPARK — Tutorial", base:"FIRST SPARK — Tutorial", artist:"trk!", size:0, bpm:128, offset:0,
      charter:Object.keys(firstSparkChartMap).length ? "trk!" : "", builtinDemo:true
    };
    builtInSongs = [firstSpark, ...builtInSongs.filter(song => song.key !== FIRST_SPARK_KEY)];
    renderLib();
  } catch (_) { /* no manifest = intentional lightweight build or an offline optional asset */ }
}
/* 🎵 trk's OST Vol.1 のオリジナル曲。音源はポータブルZIPに含めず、現在確認できる公開配布先がないため
   アプリから配布URLを案内しない。trk! は実行時に外部へ取りに行かない（プライバシー方針）。
   下の同梱経路は、音源を意図的に同梱する配布／試験ビルドだけが TRK_OST_MANIFEST_INCLUDED=true
   にして使う（AGENT_OST と同じ印）。既定では manifest の404要求すらしない。
   スコアはソース資料として tools/ost-scores/（JSON＋ABC）にも残す。 */
const TRK_OST_MANIFEST_INCLUDED = false;
const TRK_OST_SONG_DIR = "./assets/optional-ost-audio/";
const TRK_OST_SONG_MANIFEST = "./assets/optional-ost-audio/manifest.json";
const TRK_OST_SONG_KEY_PREFIX = "builtin:trk-ost-song:";
const TRK_OST_SONG_MAX_BYTES = 2 * 1024 * 1024;
const trkOstSongUrls = new Map();   /* key → 音源の URL */
/* trk189：分離前（trk184以前）の builtin:trk-ost-song: 参照だけを一度掃除する。
   曲やプレイリスト自体は消さない。任意同梱ビルド（TRK_OST_MANIFEST_INCLUDED=true）では
   掃除も印付けもしない。セーフモードでも掃除しない。削除予定日：2027-01-16（docs/MIGRATIONS.md）。 */
function trkOstLegacyCleanOnce() {
  const s = core.settings;
  if (TRK_OST_MANIFEST_INCLUDED || s.trkOstLegacyClean1 === 1 || (window.TrkSafeMode && window.TrkSafeMode())) return false;
  const p = s.playlists.find(p => p.id === TRK_OST_ID);
  const keep = key => typeof key !== "string" || !key.startsWith(TRK_OST_SONG_KEY_PREFIX);
  if (p && Array.isArray(p.songs)) p.songs = p.songs.filter(keep);
  if (Array.isArray(s.trkOstSeenKeys)) s.trkOstSeenKeys = s.trkOstSeenKeys.filter(keep);
  s.trkOstLegacyClean1 = 1;
  core.saveUserPrefs();
  return true;
}
async function initTrkOstSongs() {
  if (!TRK_OST_MANIFEST_INCLUDED) return;   /* 既定ビルドは同梱OSTが無いので404要求もしない */
  try {
    const response = await fetch(TRK_OST_SONG_MANIFEST, { credentials:"same-origin" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest || manifest.version !== 1 || manifest.enabled !== true || !Array.isArray(manifest.tracks)) return;
    const songs = manifest.tracks.slice(0, 20).filter(t => t && /^[\w-]{1,32}$/.test(String(t.key)) && /^[\w.-]{1,80}\.mp3$/.test(String(t.file)))
      .map(t => {
        const key = TRK_OST_SONG_KEY_PREFIX + t.key, title = String(t.title || t.key).trim().slice(0, 120) || t.key;
        trkOstSongUrls.set(key, TRK_OST_SONG_DIR + t.file);
        const bpm = Number(t.bpm) > 0 ? Number(t.bpm) : 0;
        const offset = Number.isFinite(Number(t.offset)) ? Number(t.offset) : 0;
        return { key, source:"builtin", file:null, fileName:t.file, title, base:title,
          artist:String(t.artist || "trk!").trim().slice(0, 120) || "trk!", size:0, bpm, offset, charter:"", license:"" };
      });
    if (!songs.length) return;
    builtInSongs = [...builtInSongs.filter(song => !song.key.startsWith(TRK_OST_SONG_KEY_PREFIX)), ...songs];
    appendTrkOstSongs(songs.map(song => song.key));
    renderLib();
  } catch (_) { /* no manifest = intentional lightweight build or an offline optional asset */ }
}
/* 未見のキーだけプレイリストへ足す。利用者が外した曲（見た印あり）は戻さない。消したリストは作り直さない。 */
function appendTrkOstSongs(keys) {
  const p = core.settings.playlists.find(p => p.id === TRK_OST_ID);
  if (!p || !Array.isArray(p.songs)) return false;
  const seen = new Set(core.settings.trkOstSeenKeys || []);
  let changed = false;
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (!p.songs.includes(k)) p.songs.push(k);
    changed = true;
  }
  if (changed) { core.settings.trkOstSeenKeys = [...seen]; core.saveUserPrefs(); }
  return changed;
}
/* 🎵 公式OSTパック（music-library の trk-ost-vol1.stpack）を入れたら、trk's OST Vol.1 の
   リストへその曲をつなぐ（レビュー (b)）。パックIDは custom.js の packIdentityFromManifest と
   同じ算出（名前|作者のハッシュ）。キーは pack:<パックID>/<曲ID>。未見のキーだけ足すので、
   利用者が外した曲はパックを入れ直しても戻らない。パックを消すと曲実体は消え、キーは残るが
   再導入で同じキーに戻る。外部通信はしない（端末内のパックだけを見る）。 */
const TRK_OST_PACK_NAME = "trk's OST Vol.1";
const TRK_OST_PACK_AUTHOR = "TRMTKB";
const TRK_OST_PACK_SONG_IDS = ["s01", "s02", "s03", "s04", "s05"];
function trkOstPackId() {
  try { return "p" + core.hashString(`${TRK_OST_PACK_NAME}|${TRK_OST_PACK_AUTHOR}`).toString(36); } catch (_) { return ""; }
}
function syncTrkOstPackSongs() {
  const pid = trkOstPackId();
  if (!pid || !Array.isArray(packSongs) || !packSongs.length) return false;
  const keys = TRK_OST_PACK_SONG_IDS.map(id => `pack:${pid}/${id}`)
    .filter(k => packSongs.some(song => song && song.key === k));
  if (!keys.length) return false;
  return appendTrkOstSongs(keys);
}
async function materializeTrkOstSong(it) {
  const url = trkOstSongUrls.get(it.key);
  if (!url) throw new Error("trk-ost-song-unknown");
  const response = await fetch(url, { credentials:"same-origin" });
  if (!response.ok) { const error = new Error("trk-ost-song-unavailable"); error.code = response.status === 404 ? "not-found" : "http-error"; throw error; }
  const declared = Number(response.headers.get("Content-Length") || 0);
  if (declared > TRK_OST_SONG_MAX_BYTES) throw new Error("trk-ost-song-too-large");
  const blob = await response.blob();
  if (!blob.size || blob.size > TRK_OST_SONG_MAX_BYTES) throw new Error("trk-ost-song-size-invalid");
  const file = new File([blob], it.fileName, { type:"audio/mpeg" });
  const ready = { ...it, file, size:file.size };
  const idx = builtInSongs.findIndex(song => song.key === it.key);
  if (idx >= 0) builtInSongs[idx] = ready;
  renderLib();
  return ready;
}
/* 🎼 trk Agent's OST Vol.1 — 手続き生成の10曲（tools/make-trk-ost.mjs）。
   音源とマニフェストは assets/trk-ost/（Git外）。公開コード側の AGENT_OST_MANIFEST_INCLUDED が false の間は、manifestを取りに行かない。
   有効なビルドではmanifestの曲を登録し、音源は選んだときに読む（materializeAgentOst）。消したら trkRemoved に印が残る（🐔 の ♻ で戻せる）。 */
const AGENT_OST_ID = "trk-agent-ost-v1";
const AGENT_OST_CAT = "trk:agent-ost";
const AGENT_OST_NAME = "trk Agent's OST Vol.1";   /* 名前は24文字まで（plSanitize） */
const AGENT_OST_DIR = "./assets/trk-ost/";
/* 公開リポジトリには音源／manifestを同梱しない。配布ビルドに任意OSTを含めるときだけ true にする。 */
const AGENT_OST_MANIFEST_INCLUDED = false;
const AGENT_OST_MAX_BYTES = 4 * 1024 * 1024;   /* 1曲 約0.9〜1MB。上限は余裕を見た値 */
const AGENT_OST_KEY_PREFIX = "builtin:trk-agent-ost:";
const agentOstUrls = new Map();                 /* key → 音源の URL */
/* 古い名前（Orig.）で保存されていても、起動時に正しい名前へ直す（音源の有無に関係なく） */
function renameAgentOstPlaylist() {
  const p = core.settings.playlists.find(x => x.id === AGENT_OST_ID || x.cat === AGENT_OST_CAT);
  if (p && p.name !== AGENT_OST_NAME) { p.name = AGENT_OST_NAME; core.saveUserPrefs(); }
}
async function initAgentOstTracks() {
  try { renameAgentOstPlaylist(); } catch (_) {}
  if (!AGENT_OST_MANIFEST_INCLUDED) return;   /* GitHub Pages等の既定ビルドはoptional資産が無いので404要求もしない */
  try {
    const response = await fetch(AGENT_OST_DIR + "manifest.json", { credentials:"same-origin" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest || manifest.version !== 1 || manifest.enabled !== true || !Array.isArray(manifest.tracks)) return;
    const songs = manifest.tracks.slice(0, 20).filter(t => t && /^[\w-]{1,32}$/.test(String(t.key)) && /^[\w.-]{1,80}\.wav$/.test(String(t.file)))
      .map(t => {
        const key = AGENT_OST_KEY_PREFIX + t.key, title = String(t.title || t.key).trim().slice(0, 120) || t.key;
        agentOstUrls.set(key, AGENT_OST_DIR + t.file);
        return { key, source:"builtin", file:null, fileName:t.file, title, base:title, artist:"trk Agent", size:0, bpm:0, offset:0, charter:"", license:"", trkOnly:AGENT_OST_ID };
      });
    if (!songs.length) return;
    builtInSongs = [...builtInSongs.filter(song => !song.key.startsWith(AGENT_OST_KEY_PREFIX)), ...songs];
    ensureAgentOstPlaylist(songs.map(song => song.key));   /* フォルダ（🐔）を先に作る。描き直しは後 */
    renderLib();
  } catch (_) { /* 無ければ何もしない（音源は Git の外にある） */ }
}
function ensureAgentOstPlaylist(keys) {
  ensureTrkFolder();
  const exist = core.settings.playlists.find(p => p.id === AGENT_OST_ID);
  if (exist) {
    if (exist.cat === AGENT_OST_CAT && exist.name !== AGENT_OST_NAME) { exist.name = AGENT_OST_NAME; core.saveUserPrefs(); }
    return false;
  }
  if (trkIsRemoved(AGENT_OST_ID)) return false;
  const p = plSanitize({ id:AGENT_OST_ID, name:AGENT_OST_NAME, icon:"\uD83C\uDFBC", color:"none",
    folder:TRK_FOLDER_ID, tags:["trk", "OST", "Agent"], wish:[], songs:keys.slice(), cat:AGENT_OST_CAT, createdAt:Date.now() });
  if (!p) return false;
  core.settings.playlists.push(p);
  core.saveUserPrefs();
  return true;
}
async function materializeAgentOst(it) {
  const url = agentOstUrls.get(it.key);
  if (!url) throw new Error("agent-ost-unknown");
  const response = await fetch(url, { credentials:"same-origin" });
  if (!response.ok) { const error = new Error("agent-ost-unavailable"); error.code = response.status === 404 ? "not-found" : "http-error"; throw error; }
  const declared = Number(response.headers.get("Content-Length") || 0);
  if (declared > AGENT_OST_MAX_BYTES) throw new Error("agent-ost-too-large");
  const blob = await response.blob();
  if (!blob.size || blob.size > AGENT_OST_MAX_BYTES) throw new Error("agent-ost-size-invalid");
  const file = new File([blob], it.fileName, { type:"audio/wav" });
  const ready = { ...it, file, size:file.size };
  const idx = builtInSongs.findIndex(song => song.key === it.key);
  if (idx >= 0) builtInSongs[idx] = ready;
  renderLib();
  return ready;
}

/* 📤 ミュージックフォルダを共有（許可は1回。中身のリストをぜんぶ取り込む）まわりの状態 */
let sharedSongs = [];        /* 💾 端末に残してある共有の曲（リロード後も残る） */
let libShared = false;       /* いまの libHandle が「📤 共有」でもらったものか（📁 開く と区別するため） */
let shareRemembered = false; /* 共有の許可を覚えているか（まだつながっていなくても 🚫 を出せるように） */
let folderAccessPersisted = false; /* trk194: 起動した時点で許可が生きていた（＝ブラウザーが「常に許可」を覚えている） */
let folderAccessSession = false;   /* trk194: この起動の中で許可した（「今回だけ」かもしれないので言い方を変える） */
let folderAutoArmed = false;       /* trk194: 最初のタップで許可を確認する待ち合わせが動いているか */
let folderLastPermission = "";     /* trk197: 直近の queryPermission の答え（denied のときは理由と直し方を出す） */
let lastScan = [];           /* 直近のスキャン結果（💾 をあとからオンにしたときに使う） */
let libAllKeys = new Set();  /* いまのライブラリの曲キー（🐔 階層などの件数表示に使う。renderLib が更新） */
let dirInputMode = "open";   /* フォールバックの <input webkitdirectory> を 📁/📤 のどちらが開いたか */
/* 📤 trk208：共有フォルダーの登録簿。trk207 までは1本だけ（libKV の "share"）だったのを、
   音楽も動画も**いくつでも**覚えられるようにした（{ id, name, kind:"music"|"video", handle, addedAt }）。
   ⚠ ハンドルは IndexedDB に構造化複製でそのまま入る。曲も動画も端末の外へは送らない（読むだけ）。 */
let sharedFolders = [];
let sharedLabels = [];     /* 登録簿と同じ順番のフォルダー名（同名フォルダーは「名前 (2)」になる・表示用） */
let sharedPendingName = "";   /* trk210：まだ許可が要る先頭のフォルダー名（🔓 の文面を「その1本」に向ける） */
/* 🧩 アドオン（js/addons.js）が足した曲。setAddonSongs() で入れ替わります */
let addonSongs = [];
function setAddonSongs(list) {
  addonSongs = Array.isArray(list) ? list.slice(0, LIB_MAX) : [];
  renderLib();
}
/* 一覧の材料。同じ曲（同じ key）が 📁フォルダ・💾共有・📄追加 で重なったときは1件だけ出します
   （共有を端末に残すと、同じ曲がフォルダ側と端末側の両方に居るため） */
const allSongs = () => {
  const out = [], seen = new Set();
  /* 今開いているタブで選んだ一時ファイルを優先し、同じキーの保存済みコピーは保存棚タブから管理する。ghostは最後（生きた実体が優先） */
  for (const it of [...builtInSongs, ...folderSongs, ...sharedSongs, ...addedSongs, ...savedSongs, ...ghostSongs]) {
    if (!it || seen.has(it.key)) continue;
    seen.add(it.key); out.push(it);
  }
  return [...out, ...packSongs, ...addonSongs];
};
function addedItem(file, video, addedAt, flags = {}) {
  const base = core.baseName(file.name);
  /* addedAt＝追加日時。sessionOnly は本体をこのタブのメモリーでだけ参照、stored は IndexedDB に明示保存済み */
  return { key:`${file.size}|${base}`, source:"file", file, title:base, base, size:file.size, video:!!video,
    sessionOnly:flags.sessionOnly === true, stored:flags.stored === true,
    addedAt: Number(addedAt) > 0 ? Number(addedAt) : 0 };
}
function ghostItem(ref){
  return { key: ref.key, source: ref.source || "file", file: null, title: ref.base || "", base: ref.base || "", size: ref.size||0, video: !!ref.video, dir: ref.dir||"", addedAt: ref.addedAt||0, ghost:true, sessionOnly:false, stored:false };
}
async function loadGhostSongs(){
  try{
    const recs = await songRefDB.all();
    ghostSongs = (Array.isArray(recs)?recs:[]).filter(r=>r&&r.key).sort((a,b)=>(b.addedAt||0)-(a.addedAt||0)).map(ghostItem);
  }catch(e){ ghostSongs=[]; }
  return ghostSongs;
}
/* 🗂 trk201：参照（📄）を残すのは「曲ファイルを追加したもの」だけ。
   フォルダーの曲は**フォルダー自体**を覚えているので、起動のたびに最大3000件を1件ずつ
   保存し直すのは重いだけで、フォルダーを替えたときに古い参照が残る原因にもなっていた。 */
async function rememberSongRef(it){
  if(!it||!it.key) return;
  if(it.source==="builtin"||it.source==="pack") return;
  if(it.source==="folder") return;   /* フォルダー曲は保存しない（trk201） */
  if(it.ghost) return;
  const ref = { key: it.key, name: (it.file&&it.file.name)||it.base||it.title||"", base: it.base||core.baseName((it.file&&it.file.name)||it.title||""), size: Number(it.size||(it.file&&it.file.size)||0)||0, video: !!it.video, dir: it.dir||"", addedAt: it.addedAt||Date.now(), source: it.source||"file" };
  try{ await songRefDB.put(ref.key, ref); }catch(_){}
  if(!ghostSongs.some(g=>g.key===ref.key)){
    ghostSongs.push(ghostItem(ref));
    ghostSongs.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
  }
}
async function rememberRefsForList(list){
  if(!Array.isArray(list)||!list.length) return;
  for(const it of list) await rememberSongRef(it);
}
/* 🗂 trk201：以前の版が保存した「フォルダー曲の参照」を掃除する（一回限り・docs/MIGRATIONS.md）。
   消すのは参照のレコードだけで、曲・プレイリスト・保存棚には触らない。
   戻り値＝消した件数（0 なら何もしなかった）。 */
async function pruneFolderRefsOnce(force){
  try{
    const s = core.settings;
    if(!force && s.trkFolderRefsPrune1 === 1) return 0;
    const recs = await songRefDB.all();
    const stale = (Array.isArray(recs)?recs:[]).filter(r => r && r.source === "folder");
    for(const r of stale){ try{ await songRefDB.del(r.key); }catch(_){} }
    if(stale.length){ ghostSongs = ghostSongs.filter(g => g.source !== "folder"); }
    if(!force){ s.trkFolderRefsPrune1 = 1; core.saveUserPrefs(); }
    return stale.length;
  }catch(_){ return 0; }
}
async function clearGhostSongs(){
  try{ const keys = await songRefDB.keys(); for(const k of keys) await songRefDB.del(k); }catch(_){}
  ghostSongs=[];
  renderLib();
  plToast(tr("ghostCleared"));
}
function isGhost(it){ return !!(it && it.ghost); }
function ghostStatsText(){
  const total = ghostSongs.length;
  const liveKeys = new Set([...builtInSongs, ...folderSongs, ...sharedSongs, ...addedSongs, ...savedSongs].map(s=>s.key));
  const need = ghostSongs.filter(g=>!liveKeys.has(g.key)).length;
  if(!total) return tr("ghostStatsNoGhost",{count:0});
  if(need===0) return tr("ghostStatsNoGhost",{count:total});
  return tr("ghostStats",{count:total, ghosts:need});
}
function syncGhostUI(){
  const elStat = document.getElementById("ghostStats");
  if(elStat) elStat.textContent = ghostStatsText();
  const btnRelink = document.getElementById("ghostRelinkBtn");
  if(btnRelink) btnRelink.disabled = ghostSongs.length===0;
  const btnClear = document.getElementById("ghostClearBtn");
  if(btnClear) btnClear.disabled = ghostSongs.length===0;
}
async function ghostRelinkAll(){
  const inp = el("input"); inp.type="file"; inp.multiple=true; inp.accept = MEDIA_EXT.map(e=>"."+e).join(",") + "," + VIDEO_EXT.map(e=>"."+e).join(",");
  inp.addEventListener("change", async()=>{
    const files = Array.from(inp.files||[]);
    if(!files.length) return;
    /* 参照（ref）は消さない：次回リロード後もまた📄参照として残すため。動画だった参照は動画として選び直す */
    await addRelinkFiles(files);
    await loadGhostSongs();
    syncGhostUI();
    renderLib();
    core.setStatus("ghostStatus","ghostRelinked",{name: files.length>1 ? `${files.length} files` : files[0].name});
  });
  inp.click();
}
/* 選び直したファイルを、参照が動画なら動画の経路へ、それ以外は曲の経路へ渡す */
async function addRelinkFiles(files, ghost = null){
  const isVid = f => { const key = `${f.size}|${core.baseName(f.name)}`; const g = ghost && ghost.key === key ? ghost : ghostSongs.find(x => x.key === key); return g ? !!g.video : false; };
  const vids = files.filter(isVid), songs = files.filter(f => !isVid(f));
  if (songs.length) await addSongFiles(songs);
  if (vids.length) await addVideoFiles(vids);
}
async function setupGhostPanel(){
  const btnRelink = document.getElementById("ghostRelinkBtn");
  if(btnRelink) btnRelink.addEventListener("click", ()=>ghostRelinkAll());
  const btnClear = document.getElementById("ghostClearBtn");
  if(btnClear) btnClear.addEventListener("click", async()=>{
    const total = ghostSongs.length;
    if(!total) return;
    if(!confirm(tr("ghostClearConfirm",{count:total}))) return;
    await clearGhostSongs();
    syncGhostUI();
    core.setStatus("ghostStatus","ghostCleared");
  });
  syncGhostUI();
}
async function relinkGhost(ghost){
  const inp = el("input"); inp.type="file"; inp.multiple=true; inp.accept = MEDIA_EXT.map(e=>"."+e).join(",") + "," + VIDEO_EXT.map(e=>"."+e).join(",");
  inp.addEventListener("change", async()=>{
    const files = Array.from(inp.files||[]);
    if(!files.length) return;
    /* 参照（ref）は消さない（次回もまた📄参照として残る）。生きた実体ができれば一覧の重複排除で参照行は隠れる */
    await addRelinkFiles(files, ghost);
    renderLib();
    if(files.length===1) plToast(tr("ghostRelinked",{name:files[0].name}));
  });
  inp.click();
}
function forgetGhost(it){
  songRefDB.del(it.key).catch(()=>{});
  ghostSongs = ghostSongs.filter(g=>g.key!==it.key);
  renderLib();
  plToast(tr("ghostForgotten",{name:it.base||it.title}));
}

function packItem(s) {
  const ext = core.extOf(s.audio), file = new File([s.audioBlob], `${core.safeName(s.title)}.${ext}`, { type:s.audioBlob.type || "" });
  return { key:`pack:${s.key}`, source:"pack", file, title:s.title, base:core.baseName(file.name), size:file.size,
    artist:s.artist, charter:s.charter, license:s.license, bpm:s.bpm, offset:s.offset, previewStart:s.previewStart,
    bgBlob:s.bgBlob, chartBlobs:s.chartBlobs, packName:s.packName };
}
function srcLabel(s) {
  if (s && s.ghost) return tr("srcGhost");
  if (s.source === "pack") return `${tr("srcPack")} · ${s.packName || ""}`;
  if (s.source === "file") return tr(s.stored ? "srcStored" : s.sessionOnly ? "srcSessionFile" : "srcFile");
  if (s.source === "builtin") return tr("srcBuiltin");
  return s.dir || tr("srcFolder");
}
let mediaKeepQueue = Promise.resolve(), mediaKeepBusy = false;
function mediaKeepSerialize(task) {
  const next = mediaKeepQueue.then(task, task);
  mediaKeepQueue = next.catch(() => {});
  return next;
}
function mediaKeepConfirm(key, vars) {
  try { return typeof window.confirm === "function" && window.confirm(tr(key, vars)); } catch (_) { return false; }
}
function mediaKeepUsageBytes() { return savedSongs.reduce((sum, it) => sum + Math.max(0, Number(it.size || (it.file && it.file.size)) || 0), 0); }
function mediaKeepOverCapNoticeOnce() {
  if (savedMediaLoadFailed || core.settings.mediaKeepOverCapNotice1 === 1) return false;
  const used = mediaKeepUsageBytes(), cap = mediaKeepCapBytes();
  if (!Number.isFinite(cap) || used <= cap) return false;
  const vars = { used:formatMediaBytes(used), limit:mediaKeepCapLabel() };
  core.settings.mediaKeepOverCapNotice1 = 1;
  core.saveUserPrefs();
  try { core.setStatus("libStatus", "mediaKeepOverCapNotice", vars); } catch (_) {}
  try { plToast(tr("mediaKeepOverCapNotice", vars)); } catch (_) {}
  return true;
}
function syncMediaKeepLimitUI() {
  const select = core.$("mediaKeepLimit");
  const allowed = ["1g", "5g", "unlimited"];
  if (!allowed.includes(core.settings.mediaKeepLimit)) core.settings.mediaKeepLimit = "1g";
  if (select) select.value = core.settings.mediaKeepLimit;
  const warning = core.$("mediaKeepLimitWarning");
  if (warning) warning.hidden = core.settings.mediaKeepLimit !== "unlimited";
}
function syncMediaKeepCurrentButton() {
  const wrap = core.$("mediaKeepCurrentActions"), button = core.$("mediaKeepCurrentBtn");
  if (!wrap || !button) return;
  const it = core.currentSong, canSave = !!(it && it.source === "file" && it.sessionOnly);
  wrap.hidden = !canSave;
  if (!canSave) return;
  const updating = savedSongs.some(song => song.key === it.key);
  const label = tr(updating ? "mediaKeepUpdate" : "mediaKeepSave");
  button.textContent = label;
  button.disabled = savedMediaLoadFailed;
  button.setAttribute("aria-label", `${label}: ${it.file && it.file.name || it.title || ""}`);
}
async function renderMediaKeep() {
  syncMediaKeepLimitUI();
  const count = savedSongs.length, used = mediaKeepUsageBytes(), cap = mediaKeepCapBytes();
  const stats = core.$("mediaKeepStats");
  if (stats) {
    if (savedMediaLoadFailed) stats.textContent = tr("mediaKeepLoadFailed");
    else stats.textContent = tr(Number.isFinite(cap) && used > cap ? "mediaKeepStatsOver" : "mediaKeepStats", {
      count, used:formatMediaBytes(used), limit:mediaKeepCapLabel()
    });
  }
  const clear = core.$("mediaKeepClearBtn");
  if (clear) clear.disabled = savedMediaLoadFailed || mediaKeepBusy || count === 0;
  const review = core.$("mediaKeepReviewBtn");
  if (review) review.disabled = savedMediaLoadFailed || count === 0;
  const quotaLine = core.$("mediaKeepQuota");
  if (!quotaLine) return;
  const token = ++mediaKeepRenderToken;
  const storage = typeof navigator !== "undefined" ? navigator.storage : null;
  if (!storage || typeof storage.estimate !== "function") { quotaLine.textContent = tr("mediaKeepQuotaUnavailable"); return; }
  try {
    const estimate = await storage.estimate();
    if (token !== mediaKeepRenderToken) return;
    if (Number.isFinite(estimate && estimate.usage) && Number.isFinite(estimate && estimate.quota))
      quotaLine.textContent = tr("mediaKeepQuota", { used:formatMediaBytes(estimate.usage), quota:formatMediaBytes(estimate.quota) });
    else quotaLine.textContent = tr("mediaKeepQuotaUnavailable");
  } catch (_) {
    if (token === mediaKeepRenderToken) quotaLine.textContent = tr("mediaKeepQuotaUnavailable");
  }
}
function reloadSavedMedia() {
  return songDB.all().then(recs => {
    savedSongs = (Array.isArray(recs) ? recs : []).filter(r => r && r.file)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .map(r => addedItem(r.file instanceof File ? r.file : new File([r.file], r.name || "song", { type:r.file.type || "" }), r.video, r.addedAt, { stored:true }));
    savedMediaLoadFailed = false;
    return savedSongs;
  }).catch(error => { savedMediaLoadFailed = true; throw error; });
}
async function keepAddedMedia(it) {
  if (!it || it.source !== "file" || !it.sessionOnly || !it.file || savedMediaLoadFailed) return false;
  return mediaKeepSerialize(async () => {
    if (!it.file || typeof it.file.size !== "number" || !Number.isFinite(it.file.size) || it.file.size < 0) {
      core.setStatus("libStatus", "mediaKeepSaveFailed"); core.setStatus("mediaKeepStatus", "mediaKeepSaveFailed"); return false;
    }
    const existing = savedSongs.find(x => x.key === it.key);
    const oldSize = existing ? Math.max(0, Number(existing.size || (existing.file && existing.file.size)) || 0) : 0;
    /* estimate() is only an estimate shared with every other app datum on this origin. If tight, ask before trying;
       IndexedDB still makes the final decision and a failed write leaves the session copy untouched. */
    try {
      const storage = typeof navigator !== "undefined" ? navigator.storage : null;
      if (storage && typeof storage.estimate === "function") {
        const estimate = await storage.estimate();
        if (Number.isFinite(estimate && estimate.usage) && Number.isFinite(estimate && estimate.quota)) {
          const available = Math.max(0, estimate.quota - estimate.usage + oldSize);
          if (it.file.size > available && !mediaKeepConfirm("mediaKeepQuotaAsk", {
            size:formatMediaBytes(it.file.size), available:formatMediaBytes(available)
          })) return false;
        }
      }
    } catch (_) { /* estimateが使えない環境では IndexedDB の保存結果に任せる */ }
    const limit = mediaKeepCapBytes();
    const record = { key:it.key, file:it.file, name:it.file.name || it.base, addedAt:it.addedAt || Date.now(), video:!!it.video, size:it.file.size };
    try {
      const ok = await songDB.putIf(it.key, record, usage => {
        const projected = Math.max(0, usage.stored - usage.replacing) + it.file.size;
        return Number.isFinite(projected) && projected <= limit;
      });
      if (!ok) {
        const vars = { limit:mediaKeepCapLabel() };
        core.setStatus("libStatus", "mediaKeepCapReached", vars); core.setStatus("mediaKeepStatus", "mediaKeepCapReached", vars);
        await reloadSavedMedia(); void renderMediaKeep(); renderLib(); syncMediaKeepCurrentButton(); return false;
      }
      savedSongs = [addedItem(it.file, it.video, record.addedAt, { stored:true }), ...savedSongs.filter(x => x.key !== it.key)];
      addedSongs = addedSongs.filter(x => x.key !== it.key);   // 明示保存後は一時コピーを棚のレコードへ置き換える
      savedMediaLoadFailed = false;
      core.setStatus("libStatus", "mediaKeepSaved", { name:it.file.name || it.base });
      core.setStatus("mediaKeepStatus", "mediaKeepSaved", { name:it.file.name || it.base });
      renderLib(); void renderMediaKeep(); syncMediaKeepCurrentButton();
      return true;
    } catch (error) {
      console.warn("Could not keep media in this browser", error);
      core.setStatus("libStatus", "mediaKeepSaveFailed"); core.setStatus("mediaKeepStatus", "mediaKeepSaveFailed");
      try { await reloadSavedMedia(); } catch (_) {}
      void renderMediaKeep(); renderLib(); syncMediaKeepCurrentButton(); return false;
    }
  });
}
async function deleteSavedMedia(it) {
  if (!it || !savedSongs.some(x => x.key === it.key)) return false;
  if (!mediaKeepConfirm("mediaKeepDeleteOneConfirm", { name:it.file && it.file.name || it.title })) return false;
  return mediaKeepSerialize(async () => {
    mediaKeepBusy = true; void renderMediaKeep();
    try {
      await songDB.del(it.key);
      savedSongs = savedSongs.filter(x => x.key !== it.key);
      core.setStatus("mediaKeepStatus", "mediaKeepDeleteDone", { name:it.file && it.file.name || it.title });
      renderLib(); void renderMediaKeep(); syncMediaKeepCurrentButton(); return true;
    } catch (error) {
      console.warn("Could not delete kept media", error);
      core.setStatus("mediaKeepStatus", "mediaKeepDeleteFailed");
      try { await reloadSavedMedia(); } catch (_) {}
      renderLib(); void renderMediaKeep(); syncMediaKeepCurrentButton(); return false;
    } finally { mediaKeepBusy = false; void renderMediaKeep(); }
  });
}
async function clearSavedMedia() {
  const count = savedSongs.length, used = mediaKeepUsageBytes();
  if (!count || savedMediaLoadFailed || !mediaKeepConfirm("mediaKeepClearConfirm", { count, size:formatMediaBytes(used) })) return false;
  return mediaKeepSerialize(async () => {
    mediaKeepBusy = true; void renderMediaKeep();
    try {
      await Promise.all(savedSongs.map(it => songDB.del(it.key)));
      savedSongs = [];
      core.setStatus("mediaKeepStatus", "mediaKeepClearDone", { count });
      renderLib(); void renderMediaKeep(); syncMediaKeepCurrentButton(); return true;
    } catch (error) {
      console.warn("Could not clear kept media", error);
      core.setStatus("mediaKeepStatus", "mediaKeepDeleteFailed");
      try { await reloadSavedMedia(); } catch (_) {}
      renderLib(); void renderMediaKeep(); syncMediaKeepCurrentButton(); return false;
    } finally { mediaKeepBusy = false; void renderMediaKeep(); }
  });
}
/* 記録の要約（称号は modes.js の titleString で計算） */
function songInfo(it, idx) {
  const fp = songPrefs.keyFp[it.key];
  const r = (fp && window.Trk.play.records[fp]) || idx[`${it.size}|${it.base}`];
  if (!r) return null;
  let best = 0;
  for (const c of Object.values(r.charts || {})) {
    for (const slot of [c, c.truck, c.orbit, c.stage, c.catch]) if (slot && slot.best) best = Math.max(best, Number(slot.best.score) || 0);
  }
  const plays = window.Trk.play.PLAY_KEYS.reduce((a, k) => a + (r[k] || 0), 0);
  return { plays, best, title:window.Trk.modes.titleString(r), last:r.lastPlayed || 0 };
}

/* ============ 📚 曲のタブ（曲の入り口ごとに自動でできる棚） ============
   ・「すべて」＋ パックごと ＋ フォルダーごと ＋ 追加した曲 ＋ 公認
   ・パックを入れると、そのパックのタブが自動で増える（新しい曲を探しやすく）
   ・サブフォルダは、いちばん上の階層でまとめる（例：Album/A/01.mp3 → 「Album」のタブ）
   ・選んだタブは settings.libTab に残る。消えたタブは「すべて」を表示（設定は残すので、
     パックを入れ直すと、またそのタブが選ばれた状態に戻る） */
Object.assign(TEXT.ja, {
  libTabAll:"すべて", libTabFiles:"追加した曲", libTabKept:"保存棚", libTabVerified:"公認", libTabPackNone:"曲パック", libTabFolderTop:"フォルダ（直下）", libTabAddon:"アドオン", libTabDemo:"デモ曲",
  srcBuiltin:"trk! 同梱デモ",
  libTabGo:"この棚に {n}曲", libTabEmpty:"このタブには曲がありません。ほかのタブを見てみてください。",
  libFavEmpty:"このフォルダは空です。上の ⭐1軍／⭐2軍／🧊フリーズ／📤元お気に入り で切り替えるか、曲の ☆ でこのフォルダに入れられます。",
  libTabAlbums:"アルバム", libTabArtists:"アーティスト", libNoTagsGroup:"タグなし", libGroupCount:"{n}曲", libGroupTagsLoading:"🏷 タグを読み込み中…（読み終わると並べ直します）",
  libTabSmart:"スマート", libSmartRecent:"🕒 最近再生", libSmartTop:"🔥 よく再生", libSmartAdded:"➕ 最近追加"
});
Object.assign(TEXT.en, {
  libTabAll:"All", libTabFiles:"Added", libTabKept:"Saved shelf", libTabVerified:"Verified", libTabPackNone:"Song pack", libTabFolderTop:"Folder (top level)", libTabAddon:"Add-on", libTabDemo:"Demo track",
  srcBuiltin:"Bundled trk! demo",
  libTabGo:"{n} songs in this shelf", libTabEmpty:"No songs in this tab. Try another tab.",
  libFavEmpty:"This folder is empty. Switch with the ⭐1st / ⭐2nd / 🧊Frozen / 📤Former chips above, or press ☆ on a song to add it here.",
  libTabAlbums:"Albums", libTabArtists:"Artists", libNoTagsGroup:"No tags", libGroupCount:"{n} songs", libGroupTagsLoading:"🏷 Reading tags… (the list re-sorts when they arrive)",
  libTabSmart:"Smart", libSmartRecent:"🕒 Recently played", libSmartTop:"🔥 Most played", libSmartAdded:"➕ Recently added"
});
Object.assign(TEXT.zh, {
  libTabAll:"全部", libTabFiles:"已添加", libTabKept:"已保存", libTabVerified:"认证", libTabPackNone:"歌曲包", libTabFolderTop:"文件夹（顶层）", libTabAddon:"插件", libTabDemo:"演示曲",
  srcBuiltin:"trk! 内置演示曲",
  libTabGo:"这个架子有 {n} 首", libTabEmpty:"此标签内没有歌曲。请看看其他标签。",
  libFavEmpty:"此文件夹为空。请用上方的 ⭐一军／⭐二军／🧊冻结／📤原收藏 切换，或点歌曲的 ☆ 加入此文件夹。",
  libTabAlbums:"专辑", libTabArtists:"艺术家", libNoTagsGroup:"无标签", libGroupCount:"{n} 首", libGroupTagsLoading:"🏷 正在读取标签…（读完后会重新排序）",
  libTabSmart:"智能", libSmartRecent:"🕒 最近播放", libSmartTop:"🔥 常播放", libSmartAdded:"➕ 最近添加"
});
Object.assign(TEXT.ko, {
  libTabAll:"전체", libTabFiles:"추가한 곡", libTabKept:"저장 선반", libTabVerified:"공인", libTabPackNone:"곡 팩", libTabFolderTop:"폴더 (최상위)", libTabAddon:"애드온", libTabDemo:"데모 곡",
  srcBuiltin:"trk! 내장 데모",
  libTabGo:"이 선반에 {n}곡", libTabEmpty:"이 탭에는 곡이 없습니다. 다른 탭을 봐 주세요.",
  libFavEmpty:"이 폴더는 비어 있습니다. 위의 ⭐1군／⭐2군／🧊동결／📤원래 즐겨찾기로 바꾸거나, 곡의 ☆로 이 폴더에 넣을 수 있습니다.",
  libTabAlbums:"앨범", libTabArtists:"아티스트", libNoTagsGroup:"태그 없음", libGroupCount:"{n}곡", libGroupTagsLoading:"🏷 태그 읽는 중…(다 읽으면 다시 정렬합니다)",
  libTabSmart:"스마트", libSmartRecent:"🕒 최근 재생", libSmartTop:"🔥 자주 재생", libSmartAdded:"➕ 최근 추가"
});
Object.assign(TEXT.ja, {
  plNewTab:"📁 新規プレイリスト", plDefaultName:"プレイリスト{n}", plGlobalTitle:"📚 プレイリスト",
  plSettings:"プレイリストの設定", plName:"名前", plIcon:"アイコン（空で自動）", plIconPh:"🎧 / 🧊 / 🔒 / 楽2 など",
  plColor:"色", plColorNone:"標準の色",
  plFrozenCheck:"🧊 フリーズ（曲の追加を防ぐ）", plLockedCheck:"🔒 ロック（削除を防ぐ）",
  plSongsNow:"現在 {n} 曲", plSave:"💾 保存", plDelete:"🗑 このプレイリストを削除",
  plDeleted:"🗑 プレイリストを削除しました（曲はライブラリに残ります）", plTabClosed:"📂 タブを閉じました（プレイリストは残っています）", plCreated:"📁 {name} を作成しました",
  plLockedNo:"🔒 ロック中は削除できません（長押しの設定で 🔒 を外してください）",
  libProfileBtn:"🎶 曲のプロフィール（編集・プレイリストへの追加）",
  plFrozenNo:"🧊 {name} はフリーズ中です（追加できません）",
  plDelOne:"中クリック1回で削除する", plDelThree:"同じタブを3回中クリックして削除する",
  plDelModeHint:"🗑 プレイリストを消しても、曲はライブラリに残ります。スマホでは長押し →「🗑 このプレイリストを削除」からも消せます。",
  plDelCount:"あと {n} 回の中クリックで削除（やめるときはそのまま）",
  plAdded:"➕ {name} へ追加しました", plRemovedFrom:"➖ {name} から外しました",
  plProfileTitle:"🎶 曲のプロフィール", plTitle:"タイトル（上書き）", plArtist:"アーティスト", plAlbum:"アルバム", plComposer:"作曲者",
  plMatchMemo:"カタログ照合メモ（キャラ名など）", plMatchMemoPh:"例：Suguri",
  plMatchMemoNote:"例：BELIEVE のメモに「Suguri」と入れると、「Suguri - BELIEVE」にも照合します。曲名かメモ部分の片方だけが合う場合も候補にします。表示される曲名は BELIEVE のままです。",
  plInLists:"プレイリストに入れる", plProfileSave:"💾 保存", plProfileSaved:"🎶 曲のプロフィールを保存しました",
  plTabHint:"このプレイリストは空です。曲を長押し →「プレイリストに入れる」、または曲をタブへドラッグして追加できます。"
});
Object.assign(TEXT.en, {
  plNewTab:"📁 New playlist", plDefaultName:"Playlist {n}", plGlobalTitle:"📚 Playlists",
  plSettings:"Playlist settings", plName:"Name", plIcon:"Icon (blank = auto)", plIconPh:"🎧 / 🧊 / 🔒 / P2…",
  plColor:"Color", plColorNone:"Default color",
  plFrozenCheck:"🧊 Freeze (blocks adding songs)", plLockedCheck:"🔒 Lock (blocks deleting)",
  plSongsNow:"{n} songs", plSave:"💾 Save", plDelete:"🗑 Delete this playlist",
  plDeleted:"🗑 Playlist deleted (songs stay in your library)", plTabClosed:"📂 Tab closed (playlist kept)", plCreated:"📁 Created {name}",
  plLockedNo:"🔒 Locked — can't delete (uncheck 🔒 in long-press settings)",
  libProfileBtn:"🎶 Song profile (edit · add to playlist)",
  plFrozenNo:"🧊 {name} is frozen (can't add songs)",
  plDelOne:"Middle-click once to delete", plDelThree:"Middle-click the same tab 3 times to delete",
  plDelModeHint:"🗑 Deleting a playlist never removes the songs. On touch screens, use long-press → “🗑 Delete this playlist”.",
  plDelCount:"{n} more middle-clicks to delete (just stop to cancel)",
  plAdded:"➕ Added to {name}", plRemovedFrom:"➖ Removed from {name}",
  plProfileTitle:"🎶 Song profile", plTitle:"Title (override)", plArtist:"Artist", plAlbum:"Album", plComposer:"Composer",
  plMatchMemo:"Catalog match hint (character, etc.)", plMatchMemoPh:"e.g. Suguri",
  plMatchMemoNote:"For example, adding “Suguri” to “BELIEVE” also matches “Suguri - BELIEVE”. Either the title or memo side can match on its own; the displayed title stays BELIEVE.",
  plInLists:"Add to playlists", plProfileSave:"💾 Save", plProfileSaved:"🎶 Song profile saved",
  plTabHint:"This playlist is empty. Long-press a song → “Add to playlists”, or drag a song onto the tab."
});
Object.assign(TEXT.zh, {
  plNewTab:"📁 新建播放列表", plDefaultName:"播放列表{n}", plGlobalTitle:"📚 播放列表",
  plSettings:"播放列表设置", plName:"名称", plIcon:"图标（留空＝自动）", plIconPh:"🎧 / 🧊 / 🔒 / 表2…",
  plColor:"颜色", plColorNone:"默认颜色",
  plFrozenCheck:"🧊 冻结（防止添加歌曲）", plLockedCheck:"🔒 锁定（防止删除）",
  plSongsNow:"当前 {n} 首", plSave:"💾 保存", plDelete:"🗑 删除此播放列表",
  plDeleted:"🗑 已删除播放列表（歌曲仍保留在库中）", plTabClosed:"📂 已关闭标签（播放列表保留）", plCreated:"📁 已创建 {name}",
  plLockedNo:"🔒 锁定中无法删除（请在长按设置中取消 🔒）",
  libProfileBtn:"🎶 歌曲资料（编辑·加入播放列表）",
  plFrozenNo:"🧊 {name} 已冻结（无法添加歌曲）",
  plDelOne:"中键点击1次即删除", plDelThree:"同一标签中键点击3次才删除",
  plDelModeHint:"🗑 删除播放列表不会删除歌曲。触屏设备请长按 →「🗑 删除此播放列表」。",
  plDelCount:"再中键点击 {n} 次即删除（松手即取消）",
  plAdded:"➕ 已添加到 {name}", plRemovedFrom:"➖ 已从 {name} 移除",
  plProfileTitle:"🎶 歌曲资料", plTitle:"标题（覆盖）", plArtist:"艺术家", plAlbum:"专辑", plComposer:"作曲者",
  plMatchMemo:"目录匹配备注（角色等）", plMatchMemoPh:"例如：Suguri",
  plMatchMemoNote:"例如，给 BELIEVE 填写“Suguri”也会匹配“Suguri - BELIEVE”。曲名或备注任一部分匹配即可；显示的曲名仍是 BELIEVE。",
  plInLists:"加入播放列表", plProfileSave:"💾 保存", plProfileSaved:"🎶 歌曲资料已保存",
  plTabHint:"此播放列表为空。长按歌曲 →「加入播放列表」，或将歌曲拖到标签上即可添加。"
});
Object.assign(TEXT.ko, {
  plNewTab:"📁 새 재생목록", plDefaultName:"재생목록 {n}", plGlobalTitle:"📚 재생목록",
  plSettings:"재생목록 설정", plName:"이름", plIcon:"아이콘(비우면 자동)", plIconPh:"🎧 / 🧊 / 🔒 / 플2…",
  plColor:"색", plColorNone:"기본 색",
  plFrozenCheck:"🧊 프리즈(곡 추가 막기)", plLockedCheck:"🔒 잠금(삭제 막기)",
  plSongsNow:"현재 {n}곡", plSave:"💾 저장", plDelete:"🗑 이 재생목록 삭제",
  plDeleted:"🗑 재생목록을 삭제했습니다(곡은 라이브러리에 남습니다)", plTabClosed:"📂 탭을 닫았습니다(재생목록은 유지)", plCreated:"📁 {name}을(를) 만들었습니다",
  plLockedNo:"🔒 잠금 중에는 삭제할 수 없어요(길게 누른 설정에서 🔒를 해제하세요)",
  libProfileBtn:"🎶 곡 프로필 (편집·재생목록에 추가)",
  plFrozenNo:"🧊 {name}은(는) 프리즈 중입니다(추가할 수 없어요)",
  plDelOne:"가운데 클릭 1회로 삭제", plDelThree:"같은 탭을 3번 가운데 클릭해 삭제",
  plDelModeHint:"🗑 재생목록을 지워도 곡은 라이브러리에 남습니다. 터치 화면에서는 길게 누르기 → '🗑 이 재생목록 삭제'를 사용하세요.",
  plDelCount:"{n}번 더 가운데 클릭하면 삭제됩니다(멈추면 취소)",
  plAdded:"➕ {name}에 추가했어요", plRemovedFrom:"➖ {name}에서 뺐어요",
  plProfileTitle:"🎶 곡 프로필", plTitle:"제목(덮어쓰기)", plArtist:"아티스트", plAlbum:"앨범", plComposer:"작곡가",
  plMatchMemo:"카탈로그 매칭 메모(캐릭터 등)", plMatchMemoPh:"예: Suguri",
  plMatchMemoNote:"예를 들어 BELIEVE의 메모에 “Suguri”를 쓰면 “Suguri - BELIEVE”와도 매칭돼요. 곡명이나 메모 중 한쪽만 맞아도 후보가 되며, 표시되는 곡명은 BELIEVE 그대로예요.",
  plInLists:"재생목록에 넣기", plProfileSave:"💾 저장", plProfileSaved:"🎶 곡 프로필을 저장했어요",
  plTabHint:"이 재생목록은 비어 있어요. 곡을 길게 눌러 '재생목록에 넣기'하거나, 곡을 탭으로 드래그해 넣을 수 있어요."
});
Object.assign(TEXT.ja, {
  plShare:"📤 共有", plShareTitle:"📤 プレイリストを共有",
  plShareRule:"📄 楽曲ファイルは含みません（譜面も入りません）。9曲以上＋すべての曲をクリアか視聴済みなら共有できます（AUTO・📻ラジオ・倍速も視聴と数えます。AUTO視聴だけの曲には ▶AUTO が付きます・隠せません）",
  plShareNeed9:"⚠ 9曲以上で共有できます（いま {n} 曲）",
  plShareUnplayed:"⚠ 未クリア・未視聴の曲があります：{list}",
  plShareReady:"✅ 共有できます（{n} 曲・全曲プレイ済み）",
  plShareScore:"スコアを載せる", plShareBadges:"モードの称号（🥁🚛など）を載せる",
  plShareComment:"ひとことコメント（140字まで）",
  plShareSourceNote:"入手先の説明（例：□□さんのBOOTH）",
  plShareSourceUrl:"入手先リンク（https:// から）",
  plShareExport:"📤 ファイルに書き出し", plShareCopy:"📋 テキストをコピー",
  plShareExported:"📤 書き出しました", plShareCopied:"📋 コピーしました",
  plShareTextHead:"trk!プレイリスト",
  plImport:"📥 共有プレイリストを読み込む", plImportTitle:"📥 共有プレイリスト",
  plImportTooBig:"❌ ファイルが大きすぎます（共有プレイリストは{n}MBまで）",
  plImportBad:"❌ trk!の共有プレイリストではありません",
  plImportFound:"ライブラリに {n}／{m} 曲ありました",
  plImportTake:"📁 ある {n} 曲をプレイリストに取り込む",
  plImportTaken:"📁 取り込みました（{name}）",
  plLinkOpen:"🔗 入手先を開く", plLinkCancel:"やめる",
  plLinkWarn:"このリンクはプレイリストの作成者が設定したものです。trk!はリンク先の内容を保証しません。",
  plAutoMark:"▶AUTO",
  plBackupTitle:"💾 プレイリストのバックアップ", plBackupHint:"プレイリストとフォルダをまとめて保存・復元できます。曲ファイル自体は含みません。",
  plBackupExport:"📤 すべてのプレイリストを書き出し", plBackupImport:"📥 プレイリストのバックアップを読み込む",
  plBackupExported:"📤 書き出しました（{n}件）", plBackupTooBig:"❌ ファイルが大きすぎます（バックアップは{n}MBまで）",
  plBackupBad:"❌ プレイリストのバックアップではありません", plBackupEmpty:"保存するプレイリストがありません",
  plBackupImportTitle:"📥 プレイリストの復元", plBackupImportConfirm:"{pl}件のプレイリスト・{fld}件のフォルダが含まれています。既にあるリストは消えません（IDが重なったものは別名で追加されます）。",
  plBackupImportTake:"📥 この内容で追加する", plBackupImported:"📥 {added}件のプレイリスト・{folders}件のフォルダを追加しました（いま合計{n}件）"
});
Object.assign(TEXT.en, {
  plShare:"📤 Share", plShareTitle:"📤 Share this playlist",
  plShareRule:"📄 No song files (or charts) are included. You can share once you have 9+ songs and have cleared or listened to every one (AUTO, 📻 radio and speed changes count as listening; songs only heard via AUTO always get a ▶AUTO mark you can't hide).",
  plShareNeed9:"⚠ Sharing needs 9+ songs (you have {n})",
  plShareUnplayed:"⚠ Some songs are neither cleared nor listened to: {list}",
  plShareReady:"✅ Ready to share ({n} songs, all played)",
  plShareScore:"Include scores", plShareBadges:"Include mode titles (🥁🚛…)",
  plShareComment:"A short comment (up to 140 chars)",
  plShareSourceNote:"Where to get the songs (e.g. ○○'s BOOTH)",
  plShareSourceUrl:"Acquisition link (starts with https://)",
  plShareExport:"📤 Export as file", plShareCopy:"📋 Copy as text",
  plShareExported:"📤 Exported", plShareCopied:"📋 Copied",
  plShareTextHead:"trk! playlist",
  plImport:"📥 Load a shared playlist", plImportTitle:"📥 Shared playlist",
  plImportTooBig:"❌ This file is too large (shared playlists are up to {n} MB)",
  plImportBad:"❌ Not a trk! shared playlist",
  plImportFound:"{n} of {m} songs are in your library",
  plImportTake:"📁 Import the {n} found songs as a playlist",
  plImportTaken:"📁 Imported ({name})",
  plLinkOpen:"🔗 Open the link", plLinkCancel:"Cancel",
  plLinkWarn:"This link was set by the playlist's author. trk! cannot guarantee its content.",
  plAutoMark:"▶AUTO",
  plBackupTitle:"💾 Playlist backup", plBackupHint:"Save and restore all playlists and folders. No song files are included.",
  plBackupExport:"📤 Export all playlists", plBackupImport:"📥 Import playlist backup",
  plBackupExported:"📤 Exported ({n} playlists)", plBackupTooBig:"❌ File too large (backup up to {n} MB)",
  plBackupBad:"❌ Not a playlist backup", plBackupEmpty:"No playlists to save",
  plBackupImportTitle:"📥 Restore playlists", plBackupImportConfirm:"Contains {pl} playlists and {fld} folders. Existing lists will be kept (duplicates get a new ID).",
  plBackupImportTake:"📥 Add these", plBackupImported:"📥 Added {added} playlists and {folders} folders (now {n} total)"
});
Object.assign(TEXT.zh, {
  plShare:"📤 共享", plShareTitle:"📤 共享此播放列表",
  plShareRule:"📄 不包含歌曲文件（也不含谱面）。拥有9曲以上且每首都已通关或收听过即可共享（AUTO、📻电台、倍速也算收听。仅用AUTO收听的歌曲会带上无法隐藏的 ▶AUTO 标记）",
  plShareNeed9:"⚠ 需要9曲以上才能共享（当前 {n} 曲）",
  plShareUnplayed:"⚠ 有未通关且未收听的歌曲：{list}",
  plShareReady:"✅ 可以共享（{n} 曲·全部播放过）",
  plShareScore:"附上分数", plShareBadges:"附上模式称号（🥁🚛等）",
  plShareComment:"一句话评论（最多140字）",
  plShareSourceNote:"入手说明（例：○○的BOOTH）",
  plShareSourceUrl:"入手链接（https:// 开头）",
  plShareExport:"📤 导出为文件", plShareCopy:"📋 复制为文本",
  plShareExported:"📤 已导出", plShareCopied:"📋 已复制",
  plShareTextHead:"trk!播放列表",
  plImport:"📥 读取共享播放列表", plImportTitle:"📥 共享播放列表",
  plImportTooBig:"❌ 文件过大（共享播放列表最多 {n} MB）",
  plImportBad:"❌ 不是trk!的共享播放列表",
  plImportFound:"库中有 {n}／{m} 曲",
  plImportTake:"📁 将找到的 {n} 曲导入为播放列表",
  plImportTaken:"📁 已导入（{name}）",
  plLinkOpen:"🔗 打开链接", plLinkCancel:"取消",
  plLinkWarn:"此链接由播放列表作者设置，trk!不保证其内容安全。",
  plAutoMark:"▶AUTO",
  plBackupTitle:"💾 播放列表备份", plBackupHint:"可批量保存／还原播放列表与文件夹，不含歌曲文件。",
  plBackupExport:"📤 导出全部播放列表", plBackupImport:"📥 导入播放列表备份",
  plBackupExported:"📤 已导出（{n}个）", plBackupTooBig:"❌ 文件过大（备份最多 {n} MB）",
  plBackupBad:"❌ 不是播放列表备份", plBackupEmpty:"没有可保存的播放列表",
  plBackupImportTitle:"📥 还原播放列表", plBackupImportConfirm:"包含 {pl} 个播放列表、{fld} 个文件夹。现有列表不会被删除（ID 重复的会自动改名追加）。",
  plBackupImportTake:"📥 按此内容追加", plBackupImported:"📥 已追加 {added} 个播放列表、{folders} 个文件夹（现共 {n} 个）"
});
Object.assign(TEXT.ko, {
  plShare:"📤 공유", plShareTitle:"📤 재생목록 공유",
  plShareRule:"📄 곡 파일(채보 포함)은 담기지 않아요. 9곡 이상이고 모든 곡을 클리어했거나 들었으면 공유할 수 있어요(AUTO·📻라디오·배속도 시청으로 셉니다. AUTO로만 들은 곡에는 숨길 수 없는 ▶AUTO 표시가 붙어요).",
  plShareNeed9:"⚠ 9곡 이상부터 공유할 수 있어요(현재 {n}곡)",
  plShareUnplayed:"⚠ 클리어하지도 듣지도 않은 곡이 있어요: {list}",
  plShareReady:"✅ 공유할 수 있어요({n}곡·전곡 플레이함)",
  plShareScore:"점수 실기", plShareBadges:"모드 칭호(🥁🚛 등) 실기",
  plShareComment:"한줄 코멘트(140자까지)",
  plShareSourceNote:"입수처 설명(예: ○○님의 BOOTH)",
  plShareSourceUrl:"입수처 링크(https:// 로 시작)",
  plShareExport:"📤 파일로 내보내기", plShareCopy:"📋 텍스트 복사",
  plShareExported:"📤 내보냈어요", plShareCopied:"📋 복사했어요",
  plShareTextHead:"trk! 재생목록",
  plImport:"📥 공유 재생목록 불러오기", plImportTitle:"📥 공유 재생목록",
  plImportTooBig:"❌ 파일이 너무 커요 (공유 재생목록은 {n}MB까지)",
  plImportBad:"❌ trk! 공유 재생목록이 아니에요",
  plImportFound:"라이브러리에 {n}／{m}곡이 있어요",
  plImportTake:"📁 있는 {n}곡을 재생목록으로 가져오기",
  plImportTaken:"📁 가져왔어요({name})",
  plLinkOpen:"🔗 링크 열기", plLinkCancel:"취소",
  plLinkWarn:"이 링크는 재생목록 만든 사람이 설정한 것이에요. trk!는 내용을 보증하지 않아요.",
  plAutoMark:"▶AUTO",
  plBackupTitle:"💾 재생목록 백업", plBackupHint:"재생목록과 폴더를 한 번에 저장·복원해요. 곡 파일은 포함되지 않아요.",
  plBackupExport:"📤 모든 재생목록 내보내기", plBackupImport:"📥 재생목록 백업 불러오기",
  plBackupExported:"📤 내보냈어요({n}개)", plBackupTooBig:"❌ 파일이 너무 커요(백업은 {n}MB까지)",
  plBackupBad:"❌ 재생목록 백업이 아니에요", plBackupEmpty:"저장할 재생목록이 없어요",
  plBackupImportTitle:"📥 재생목록 복원", plBackupImportConfirm:"{pl}개 재생목록·{fld}개 폴더가 들어 있어요. 기존 목록은 지워지지 않아요(ID가 겹치면 새 ID로 추가돼요).",
  plBackupImportTake:"📥 이 내용으로 추가", plBackupImported:"📥 {added}개 재생목록·{folders}개 폴더를 추가했어요(지금 총 {n}개)"
});
Object.assign(TEXT.ja, {
  plNewFolder:"📁 新規フォルダ", plDefaultFolderName:"フォルダ", plFolderSettings:"フォルダの設定",
  plFolderOf:"入れ物", trkCopiedToFolder:"「{name}」を複製して入れました（元のリストは 🐔 に残ります）", plFolderRoot:"（なし・並びのトップ）",
  plFolderDel:"🗑 このフォルダを削除（中身は消えません）",
  plFolderLimit:"📁 フォルダは{n}個までです。使っていないフォルダを消すと作れます",
  plFolderCreated:"📁 フォルダ「{name}」を作成しました", plFolderDeleted:"🗑 フォルダを削除しました（中身は上の階層へ）",
  fldTabHint:"このフォルダは空です。プレイリストの長押し → 設定の「入れ物」で、このフォルダへ移動できます。",
  plTags:"タグ（検索用）", plTagsPh:"esports 名場面 …（スペース区切り・5個まで）",
  plProfileUrl:"入手先リンク（https://・共有に添付）", plLinkBad:"❌ リンクは https:// ではじめてください",
  plCatalogBtn:"🛒 公式カタログ", plCatalogTitle:"🛒 公式カタログ（音源は同梱しません）",
  plCatalogHint:"プレイリストの「欲しい曲リスト」を取り込めます。音源ファイルは一切同梱されません。公式の入手先から自分で入手して 📁 Musicフォルダ に入れると、同じ曲名の曲が自動でプレイリストに加わります（未入手の曲は薄く表示されます）。",
  plCatalogTake:"📥 取り込む（{n}曲）", plCatalogTaken:"📥 取り込みました（{name}）。曲を入手してMusicフォルダに入れると自動で追加されます",
  plCatalogDup:"すでに取り込んでいます（{name}）",
  plWishHead:"📡 まだ持っていない曲（{n}）— 公式から入手して Music フォルダに入れると、次に開いたときに黒くなって遊べます",
  plWishTag:"未入手", plGuideTitle:"📥 このプレイリストの入手先",
  plWishHint:"🛒 {have}/{total} 曲を入手済み。灰色はまだ持っていない曲です（タップで公式の入手先）。Music フォルダに入れると黒くなります。",
  plWishOpen:"公式の入手先を開く", plWishNoLink:"この曲の入手先リンクはありません。公式ストアなどで入手して Music フォルダに入れてください。",
  plAuthorTools:"👥 投稿者ツール（共有プレイリストをたくさん受け取る人向け）",
  tabSettingsBtn:"⚙ このタブの設定",
  plAuthorNamePh:"例：たぬき（共有ファイルに添わる名前）",
  plAuthorBtn:"👥 投稿者（検索・ブロック・お気に入り）", plAuthorTitle:"👥 投稿者",
  plAuthorSearchPh:"🔍 投稿者名でしぼりこむ", plAuthorOnly:"⭐を付けた投稿者だけ表示する",
  plAuthorFavAdd:"⭐ お気に入り投稿者にする", plAuthorFavDel:"☆ お気に入りから外す",
  plAuthorBlock:"🚫 この投稿者をブロック（プレイリストを隠します）", plAuthorUnblock:"🚫 ブロックを解除",
  plAuthorNone:"投稿者の付いたプレイリストはまだありません。共有プレイリストを読み込むと「👤 投稿者」付きで入ります。",
  plAuthorHidden:"🚫 非表示 {n} 件（ブロック中または絞り込み中）", plAuthorBy:"投稿者",
  plAuthorBlockedView:"ブロック中の投稿者です",
  trkPlaylistTitle:"🐔 trk's playlist", trkPlaylistHint:"ゲーム音楽の紹介プレイリスト（非営利・音源は同梱しません。公式の入手先からどうぞ）",
  trkPlaylistToggle:"🐔 trk's playlist タブを表示", trkPlaylistNote:"右端に出るゲーム音楽の紹介タブです。OFFで隠せます。リストは下の「プレイリストを選択」から必要なものだけ追加できます。",
  trkMusicFolderHint:"Musicフォルダ内に「trk」フォルダを自分で作り、曲をまとめておくと整理しやすくなります。下のボタンで選ぶと、ライブラリの読み込み先がそのフォルダに切り替わり、中だけを読み込みます（trk!はフォルダ作成・曲の移動をせず読み取りのみ。Music全体に戻すときは通常のフォルダ選択でMusicを選び直してください）。",
  trkMusicFolderBtn:"📂 Music内のtrkフォルダを読み込む",
  trkOpen:"🐔 開く", trkAdded:"🐔 trk's playlist を追加しました（{n}曲）— 右端のタブをどうぞ",
  trkDup:"🐔 trk's playlist はすでに入っています", trkShow:"🐔 trk's playlist を表示", trkHide:"🐔 trk's playlist を非表示",
  trkPanelTitle:"🐔 trk's playlist", trkPanelHint:"ゲーム音楽の紹介（非営利・音源なし）。下の「プレイリストを選択」から、必要なリストだけを追加します。",
  trkPickHint:"選んだリストだけを追加します。消したリストもここから戻せます。カタログの曲は音源を含みません。",
  trkPickLabel:"プレイリストを選択", trkPickAdd:"選んだリストを追加", trkPickAdded:"追加済み",
  trkPickOk:"追加しました", trkPickFail:"追加できません。プレイリストまたはフォルダーの上限を確認してください。", trkPickOriginals:"trk オリジナル",
  trkListShow:"👁 曲画面の一覧に出す", trkListHide:"🗑 曲画面の一覧から隠す",
  trkListShown:"👁 {name} を曲画面の一覧に出しました", trkListHidden:"🗑 {name} を曲画面の一覧から隠しました",
  trkListNote:"🗑 は曲画面の「プレイリストに入れる」から隠すだけです（リストは消えません）。📋 は中身をそのままに、編集できるコピーを作ります。",
  trkCopyBtn:"📋 編集できるコピーを作る", trkCopyDone:"📋 編集できるコピーを作りました：{name}",
  trkCopyFail:"プレイリストは{n}本までです。使っていないものを消すと作れます", trkCopySuffix:"（コピー）",
  plInListsHidden:"🐔 trk が追加したリスト（{n}件）は、⚙ 設定 → 🐔 trk's playlist の 👁 でこの一覧に出せます。",
  trkFixedNotice:"🐔 trk のリストは、曲画面の「プレイリストに入れる」に出さなくなりました。編集したいときは ⚙ → 🐔 trk's playlist の 📋 でコピーを作れます。",
  trkCatalogBtn:"🐔 trk's playlist", trkCatalogTitle:"🐔 trk's playlist（非営利の紹介プレイリスト）",
  trkCatalogHint:"最初の10曲はSAM Free Music — 100% Orange Juice! で出会える曲です。東方・ブルアカ・アークナイツも収録！音源は同梱しません。（著作権は放棄されていません）",
  trkTab:"🐔 trk's playlist",
  trkTabNameLabel:"タブの表示名", trkTabNameFull:"trk's playlist", trkTabNameShort:"trk's", trkTabNameIcon:"🐔（アイコンのみ）",
  trkTabNameNote:"🐔 のアイコンと色は固定です。タブの名前はこの3つから選べます（タップ＝中身、長押し＝階層）。",
  trkMenuTitle:"🐔 階層（Vol 一覧）", trkMenuHint:"タブの長押しで開く 🐔 trk's playlist の中身です。Vol やシリーズを選べます。名前と色は変えられません。",
  trkMenuOpenFolder:"フォルダを開く", trkMenuOpenList:"プレイリストを開く", trkOpenItem:"開く", trkMoveUp:"上へ", trkMoveDown:"下へ",
  trkOrderEmpty:"（まだプレイリストがありません。上の「プレイリストを選択」から追加できます）",
  trkOrderAbcOff:"🔤 ABC順がオンのため、手動の ↑↓ は無効です。",
  trkSortAbc:"🔤 ABC順に並べる", trkSortAbcHint:"オフのときは下のリストの ↑↓ で自由に並べ替えできます。長押しで開く 🐔 の階層にも反映されます。",
  trkClassicTitle:"🎻 trk classic", trkClassicHint:"クラシック名盤100選（版権切れの名演をMusopenのPublic Domain録音で紹介）",
  trkClassicToggle:"🎻 trk classic タブを表示", trkClassicNote:"右端に出るクラシックの紹介タブです。OFFで隠せます。リストは同じ設定の「プレイリストを選択」から追加できます。",
  trkClassicAdded:"🎻 trk classic を追加しました（{n}曲）— 右端のタブをどうぞ",
  trkClassicDup:"🎻 trk classic はすでに入っています", trkClassicShow:"🎻 trk classic を表示", trkClassicHide:"🎻 trk classic を非表示",
  trkClassicPanelTitle:"🎻 trk classic", trkClassicPanelHint:"クラシック名盤（版権切れ・音源なし）。Princess Tutuでも聴ける名曲も収録。",
  trkClassicBtn:"🎻 trk classic", trkClassicTab:"🎻 trk classic"
});
Object.assign(TEXT.en, {
  plNewFolder:"📁 New folder", plDefaultFolderName:"Folder", plFolderSettings:"Folder settings",
  plFolderOf:"Location", trkCopiedToFolder:"Copied \"{name}\" into the folder (the original stays in 🐔)", plFolderRoot:"(none — top level)",
  plFolderDel:"🗑 Delete this folder (contents are kept)",
  plFolderLimit:"📁 Up to {n} folders. Delete one you no longer use to make room",
  plFolderCreated:"📁 Folder “{name}” created", plFolderDeleted:"🗑 Folder deleted (contents moved up)",
  fldTabHint:"This folder is empty. Move playlists here from their long-press settings (“Location”).",
  plTags:"Tags (for search)", plTagsPh:"esports highlights … (space-separated, up to 5)",
  plProfileUrl:"Source link (https://, attached when shared)", plLinkBad:"❌ Links must start with https://",
  plCatalogBtn:"🛒 Official catalog", plCatalogTitle:"🛒 Official catalog (no audio bundled)",
  plCatalogHint:"Import curated playlists as a “wanted songs” list. No audio files are included. Get the music from the official sources, drop it into your 📁 Music folder, and matching songs join the playlist automatically (missing songs appear dimmed).",
  plCatalogTake:"📥 Import ({n} songs)", plCatalogTaken:"📥 Imported ({name}). Add the music to your Music folder and it joins automatically.",
  plCatalogDup:"Already imported ({name})",
  plWishHead:"📡 Not in your library yet ({n}) — get them from the official source and drop them into your Music folder; they turn black (playable) next time you open this tab",
  plWishTag:"missing", plGuideTitle:"📥 How to get this music",
  plWishHint:"🛒 {have}/{total} collected. Grey rows are the ones you do not have yet — tap one for its official source. Add the audio to your Music folder and it turns black.",
  plWishOpen:"Open the official source", plWishNoLink:"No source link for this track yet. Get it from an official store and put it in your Music folder.",
  plAuthorTools:"👥 Author tools (for people who receive lots of shared playlists)",
  tabSettingsBtn:"⚙ Tab settings",
  plAuthorNamePh:"e.g. tanuki (name attached to your shared files)",
  plAuthorBtn:"👥 Authors (search / block / favorites)", plAuthorTitle:"👥 Authors",
  plAuthorSearchPh:"🔍 Filter by author name", plAuthorOnly:"Show only favorite authors",
  plAuthorFavAdd:"⭐ Mark as favorite author", plAuthorFavDel:"☆ Remove from favorites",
  plAuthorBlock:"🚫 Block this author (hides their playlists)", plAuthorUnblock:"🚫 Unblock",
  plAuthorNone:"No playlists with an author yet. Imported shared playlists carry a “👤 author”.",
  plAuthorHidden:"🚫 {n} hidden (blocked or filtered out)", plAuthorBy:"Author",
  plAuthorBlockedView:"This author is blocked",
  trkPlaylistTitle:"🐔 trk's playlist", trkPlaylistHint:"A curated game-music intro playlist (non-commercial, no audio bundled — get it from official sources).",
  trkPlaylistToggle:"Show 🐔 trk's playlist tab", trkPlaylistNote:"Game-music intro tab at the far right. Turn off to hide. Add only the lists you need with “Choose a playlist” below.",
  trkMusicFolderHint:"Create a trk folder inside Music yourself and put the tracks you want there. Choosing it below switches the active library folder to trk and scans only it; select Music again in the regular folder picker to switch back. trk! only reads files—it never creates folders or moves tracks.",
  trkMusicFolderBtn:"📂 Choose the trk folder in Music",
  trkOpen:"🐔 Open", trkAdded:"Added 🐔 trk's playlist ({n} songs) — find it at the far right",
  trkDup:"🐔 trk's playlist is already there", trkShow:"Show 🐔 trk's playlist", trkHide:"Hide 🐔 trk's playlist",
  trkPanelTitle:"🐔 trk's playlist", trkPanelHint:"Game-music intro (non-commercial, no audio). Add only the lists you need with “Choose a playlist” below.",
  trkPickHint:"Add only the playlists you choose. Deleted lists can be re-added here. Catalog lists do not include audio files.",
  trkPickLabel:"Choose a playlist", trkPickAdd:"Add selected playlist", trkPickAdded:"Added",
  trkPickOk:"Playlist added", trkPickFail:"Could not add it. Check the playlist and folder limits.", trkPickOriginals:"trk originals",
  trkListShow:"👁 Show in the song list", trkListHide:"🗑 Hide from the song list",
  trkListShown:"👁 {name} is shown in the song list", trkListHidden:"🗑 {name} is hidden from the song list",
  trkListNote:"🗑 only hides the list from “Add to playlists” in the song screen (nothing is deleted). 📋 makes an editable copy with the same songs.",
  trkCopyBtn:"📋 Make an editable copy", trkCopyDone:"📋 Made an editable copy: {name}",
  trkCopyFail:"Up to {n} playlists. Delete one you no longer use to make room", trkCopySuffix:" (copy)",
  plInListsHidden:"{n} list(s) added by trk are hidden here. Show them from ⚙ Settings → 🐔 trk's playlist with 👁.",
  trkFixedNotice:"🐔 trk lists no longer appear under “Add to playlists”. To edit one, open ⚙ → 🐔 trk's playlist and press 📋 for an editable copy.",
  trkCatalogBtn:"🐔 trk's playlist", trkCatalogTitle:"🐔 trk's playlist (non-commercial intro)",
  trkCatalogHint:"First 10 are SAM Free Music — tracks from 100% Orange Juice! Touhou, Blue Archive, Arknights and more inside! No audio bundled. (Copyright not waived.)",
  trkTab:"🐔 trk's playlist",
  trkTabNameLabel:"Tab label", trkTabNameFull:"trk's playlist", trkTabNameShort:"trk's", trkTabNameIcon:"🐔 (icon only)",
  trkTabNameNote:"The 🐔 icon and color are fixed. Choose one of these three labels (tap = songs, long-press = hierarchy).",
  trkMenuTitle:"🐔 Hierarchy (Vol list)", trkMenuHint:"Opened by long-pressing 🐔 trk's playlist. Pick a Vol or series here. Name and color are fixed.",
  trkMenuOpenFolder:"Open folder", trkMenuOpenList:"Open playlist", trkOpenItem:"Open", trkMoveUp:"Move up", trkMoveDown:"Move down",
  trkOrderEmpty:"(No playlists yet. Add one with “Choose a playlist” above.)",
  trkOrderAbcOff:"🔤 Manual ↑↓ is disabled while ABC order is on.",
  trkSortAbc:"🔤 Sort A–Z", trkSortAbcHint:"When off, use ↑↓ in the list below to arrange freely. It also applies to the 🐔 hierarchy opened by long-press.",
  trkClassicTitle:"🎻 trk classic", trkClassicHint:"100 Classical masterpieces (public-domain recordings via Musopen)",
  trkClassicToggle:"Show 🎻 trk classic tab", trkClassicNote:"Classical intro tab at the far right. Turn off to hide. Add the list with “Choose a playlist” in the same settings.",
  trkClassicAdded:"Added 🎻 trk classic ({n} songs) — find it at the far right",
  trkClassicDup:"🎻 trk classic is already there", trkClassicShow:"Show 🎻 trk classic", trkClassicHide:"Hide 🎻 trk classic",
  trkClassicPanelTitle:"🎻 trk classic", trkClassicPanelHint:"Classical favourites (public-domain, no audio). Gems from Princess Tutu too.",
  trkClassicBtn:"🎻 trk classic", trkClassicTab:"🎻 trk classic"
});
Object.assign(TEXT.zh, {
  plNewFolder:"📁 新建文件夹", plDefaultFolderName:"文件夹", plFolderSettings:"文件夹设置",
  plFolderOf:"所属位置", trkCopiedToFolder:"已将「{name}」复制到文件夹（原列表保留在 🐔 中）", plFolderRoot:"（无·顶层）",
  plFolderDel:"🗑 删除此文件夹（内容不会消失）",
  plFolderLimit:"📁 最多 {n} 个文件夹。删除不用的文件夹后即可创建",
  plFolderCreated:"📁 已创建文件夹「{name}」", plFolderDeleted:"🗑 已删除文件夹（内容移到上一层）",
  fldTabHint:"此文件夹为空。在播放列表的长按设置「所属位置」中即可移入。",
  plTags:"标签（搜索用）", plTagsPh:"esports 名场面 …（空格分隔·最多5个）",
  plProfileUrl:"入手链接（https://·共享时附带）", plLinkBad:"❌ 链接必须以 https:// 开头",
  plCatalogBtn:"🛒 官方目录", plCatalogTitle:"🛒 官方目录（不包含音源）",
  plCatalogHint:"导入精选播放列表的“想要的歌曲”清单。不包含任何音频文件。请从官方渠道自行获取音乐并放入 📁 Music文件夹，同名歌曲会自动加入播放列表（未获取的歌曲会以浅色显示）。",
  plCatalogTake:"📥 导入（{n}曲）", plCatalogTaken:"📥 已导入（{name}）。把音乐放进Music文件夹后会自动加入。",
  plCatalogDup:"已经导入过了（{name}）",
  plWishHead:"📡 尚未拥有的曲目（{n}）— 从官方获取并放入 Music 文件夹后，下次打开即会变为黑色（可游玩）",
  plWishTag:"未入库", plGuideTitle:"📥 这个播放列表的获取方式",
  plWishHint:"🛒 已入手 {have}/{total} 首。灰色表示尚未拥有（点击可打开官方获取页面）。放入 Music 文件夹后即会变黑。",
  plWishOpen:"打开官方获取页面", plWishNoLink:"此曲暂无获取链接。请从官方商店获取后放入 Music 文件夹。",
  plAuthorTools:"👥 投稿者工具（适合接收大量共享播放列表的人）",
  tabSettingsBtn:"⚙ 此标签的设置",
  plAuthorNamePh:"例如：狸猫（会附在你共享的文件上）",
  plAuthorBtn:"👥 投稿者（搜索／屏蔽／收藏）", plAuthorTitle:"👥 投稿者",
  plAuthorSearchPh:"🔍 按投稿者名筛选", plAuthorOnly:"只显示收藏的投稿者",
  plAuthorFavAdd:"⭐ 收藏该投稿者", plAuthorFavDel:"☆ 取消收藏",
  plAuthorBlock:"🚫 屏蔽该投稿者（隐藏其播放列表）", plAuthorUnblock:"🚫 取消屏蔽",
  plAuthorNone:"还没有带投稿者的播放列表。读入共享播放列表时会带上「👤 投稿者」。",
  plAuthorHidden:"🚫 已隐藏 {n} 件（屏蔽中或筛选中）", plAuthorBy:"投稿者",
  plAuthorBlockedView:"该投稿者已被屏蔽",
  trkPlaylistTitle:"🐔 trk's playlist", trkPlaylistHint:"游戏音乐介绍播放列表（非营利、不含音源，请从官方渠道获取）。",
  trkPlaylistToggle:"显示 🐔 trk's playlist 标签", trkPlaylistNote:"位于最右侧的游戏音乐介绍标签。关闭可隐藏。用下面的「选择歌单」只添加需要的歌单。",
  trkMusicFolderHint:"请在 Music 文件夹内手动新建 trk 文件夹并放入想听的音乐。点击下方按钮会把当前曲库切换到 trk，只扫描其中内容；要切回整个 Music，请在常规文件夹选择中重新选择 Music。trk! 只读取，不会创建文件夹或移动歌曲。",
  trkMusicFolderBtn:"📂 选择 Music 内的 trk 文件夹",
  trkOpen:"🐔 打开", trkAdded:"已添加 🐔 trk's playlist（{n}首）— 请到最右侧查看",
  trkDup:"🐔 trk's playlist 已在列表中", trkShow:"显示 🐔 trk's playlist", trkHide:"隐藏 🐔 trk's playlist",
  trkPanelTitle:"🐔 trk's playlist", trkPanelHint:"游戏音乐介绍（非营利、不含音源）。用下面的「选择歌单」只添加需要的歌单。",
  trkPickHint:"只添加选中的歌单。已删除的歌单也可在此重新添加。目录不包含音频文件。",
  trkPickLabel:"选择歌单", trkPickAdd:"添加所选歌单", trkPickAdded:"已添加",
  trkPickOk:"已添加歌单", trkPickFail:"无法添加。请检查歌单或文件夹数量上限。", trkPickOriginals:"trk 原创",
  trkListShow:"👁 在歌曲画面中显示", trkListHide:"🗑 从歌曲画面中隐藏",
  trkListShown:"👁 已在歌曲画面中显示 {name}", trkListHidden:"🗑 已从歌曲画面中隐藏 {name}",
  trkListNote:"🗑 只是把歌单从歌曲画面的「加入播放列表」中隐藏（不会删除歌单）。📋 会保留内容，创建一个可编辑的副本。",
  trkCopyBtn:"📋 创建可编辑的副本", trkCopyDone:"📋 已创建可编辑的副本：{name}",
  trkCopyFail:"最多 {n} 个歌单。删除不用的歌单后即可创建", trkCopySuffix:"（副本）",
  plInListsHidden:"trk 添加的 {n} 个歌单在此不显示。可在 ⚙ 设置 → 🐔 trk's playlist 中用 👁 显示。",
  trkFixedNotice:"🐔 trk 的歌单已不再显示在歌曲画面的「加入播放列表」中。想编辑时，请在 ⚙ → 🐔 trk's playlist 按 📋 创建副本。",
  trkCatalogBtn:"🐔 trk's playlist", trkCatalogTitle:"🐔 trk's playlist（非营利介绍）",
  trkCatalogHint:"前10首是SAM Free Music — 在100% Orange Juice! 中相遇的曲目。东方、碧蓝档案、明日方舟也有收录！不含音源。（版权未放弃）",
  trkTab:"🐔 trk's playlist",
  trkTabNameLabel:"标签显示名", trkTabNameFull:"trk's playlist", trkTabNameShort:"trk's", trkTabNameIcon:"🐔（仅图标）",
  trkTabNameNote:"🐔 图标与颜色固定。名称可从这3种中选择（点击＝内容，长按＝层级）。",
  trkMenuTitle:"🐔 层级（Vol 列表）", trkMenuHint:"长按 🐔 trk's playlist 打开的内容。可选择 Vol 或系列。名称与颜色不可更改。",
  trkMenuOpenFolder:"打开文件夹", trkMenuOpenList:"打开歌单", trkOpenItem:"打开", trkMoveUp:"上移", trkMoveDown:"下移",
  trkOrderEmpty:"（还没有播放列表。可用上面的「选择歌单」添加）",
  trkOrderAbcOff:"🔤 ABC顺序开启时，手动 ↑↓ 无效。",
  trkSortAbc:"🔤 按ABC顺序排列", trkSortAbcHint:"关闭时可用下方列表的 ↑↓ 自由排序。长按打开的 🐔 层级也会同步。",
  trkClassicTitle:"🎻 trk classic", trkClassicHint:"经典名盘100首（通过Musopen公共领域录音介绍）",
  trkClassicToggle:"显示 🎻 trk classic 标签", trkClassicNote:"位于最右侧的经典介绍标签。关闭可隐藏。歌单可在同一设置中用「选择歌单」添加。",
  trkClassicAdded:"已添加 🎻 trk classic（{n}首）— 请到最右侧查看",
  trkClassicDup:"🎻 trk classic 已在列表中", trkClassicShow:"显示 🎻 trk classic", trkClassicHide:"隐藏 🎻 trk classic",
  trkClassicPanelTitle:"🎻 trk classic", trkClassicPanelHint:"经典名盘（公共领域、不含音源）。",
  trkClassicBtn:"🎻 trk classic", trkClassicTab:"🎻 trk classic"
});
Object.assign(TEXT.ko, {
  plNewFolder:"📁 새 폴더", plDefaultFolderName:"폴더", plFolderSettings:"폴더 설정",
  plFolderOf:"소속", trkCopiedToFolder:"\"{name}\"을(를) 복제해서 넣었어요（원래 목록은 🐔에 남아요）", plFolderRoot:"(없음·최상위)",
  plFolderDel:"🗑 이 폴더 삭제(내용은 지워지지 않아요)",
  plFolderLimit:"📁 폴더는 {n}개까지예요. 쓰지 않는 폴더를 지우면 만들 수 있어요",
  plFolderCreated:"📁 폴더 '{name}'을(를) 만들었어요", plFolderDeleted:"🗑 폴더를 삭제했어요(내용은 위 계층으로)",
  fldTabHint:"이 폴더는 비어 있어요. 재생목록 길게 누른 설정의 '소속'에서 이 폴더로 옮길 수 있어요.",
  plTags:"태그(검색용)", plTagsPh:"esports 명장면 …(공백 구분·최대 5개)",
  plProfileUrl:"입수처 링크(https://·공유 시 첨부)", plLinkBad:"❌ 링크는 https:// 로 시작해야 해요",
  plCatalogBtn:"🛒 공식 카탈로그", plCatalogTitle:"🛒 공식 카탈로그 (음원 미포함)",
  plCatalogHint:"엄선 플레이리스트를 '원하는 곡 목록'으로 가져와요. 오디오 파일은 하나도 포함되지 않아요. 공식 입수처에서 직접 구해 📁 Music 폴더에 넣으면 같은 제목의 곡이 자동으로 플레이리스트에 들어와요 (미입수 곡은 연하게 표시돼요).",
  plCatalogTake:"📥 가져오기 ({n}곡)", plCatalogTaken:"📥 가져왔어요 ({name}). 음악을 Music 폴더에 넣으면 자동으로 추가돼요.",
  plCatalogDup:"이미 가져왔어요 ({name})",
  plWishHead:"📡 아직 없는 곡 ({n}곡) — 공식 입수처에서 구해 Music 폴더에 넣으면 다음에 열 때 검게 변해 플레이할 수 있어요",
  plWishTag:"미입수", plGuideTitle:"📥 이 플레이리스트 입수처",
  plWishHint:"🛒 {have}/{total}곡 보유 중. 회색은 아직 없는 곡이에요(탭하면 공식 입수처가 열려요). Music 폴더에 넣으면 검게 변해요.",
  plWishOpen:"공식 입수처 열기", plWishNoLink:"이 곡의 입수처 링크가 아직 없어요. 공식 스토어에서 구해 Music 폴더에 넣어 주세요.",
  plAuthorTools:"👥 올린이 도구(공유 플레이리스트를 많이 받는 사람용)",
  tabSettingsBtn:"⚙ 이 탭 설정",
  plAuthorNamePh:"예: 너구리(공유 파일에 붙는 이름)",
  plAuthorBtn:"👥 올린이(검색·차단·즐겨찾기)", plAuthorTitle:"👥 올린이",
  plAuthorSearchPh:"🔍 올린이 이름으로 찾기", plAuthorOnly:"⭐ 즐겨찾기 올린이만 보기",
  plAuthorFavAdd:"⭐ 즐겨찾기 올린이로 등록", plAuthorFavDel:"☆ 즐겨찾기에서 빼기",
  plAuthorBlock:"🚫 이 올린이 차단(플레이리스트 숨김)", plAuthorUnblock:"🚫 차단 해제",
  plAuthorNone:"올린이가 붙은 플레이리스트가 아직 없어요. 공유 플레이리스트를 가져오면 '👤 올린이'가 붙어요.",
  plAuthorHidden:"🚫 숨김 {n}건(차단 중 또는 필터 중)", plAuthorBy:"올린이",
  plAuthorBlockedView:"차단 중인 올린이예요",
  trkPlaylistTitle:"🐔 trk's playlist", trkPlaylistHint:"게임 음악 소개 플레이리스트(비영리·음원 미포함, 공식 입수처에서 받아 주세요).",
  trkPlaylistToggle:"🐔 trk's playlist 탭 표시", trkPlaylistNote:"맨 오른쪽에 나타나는 게임 음악 소개 탭이에요. 끄면 숨길 수 있고, 목록은 아래 「재생목록 선택」에서 필요한 것만 추가해요.",
  trkMusicFolderHint:"Music 폴더 안에 trk 폴더를 직접 만들고 곡을 넣어 주세요. 아래 버튼으로 선택하면 라이브러리 폴더가 trk로 바뀌어 그 안만 읽어요. Music 전체로 돌아가려면 일반 폴더 선택에서 Music을 다시 선택하세요. trk!는 폴더를 만들거나 곡을 옮기지 않고 읽기만 해요.",
  trkMusicFolderBtn:"📂 Music 안의 trk 폴더 선택",
  trkOpen:"🐔 열기", trkAdded:"🐔 trk's playlist를 추가했어요({n}곡) — 맨 오른쪽 탭을 확인해 주세요",
  trkDup:"🐔 trk's playlist는 이미 있어요", trkShow:"🐔 trk's playlist 표시", trkHide:"🐔 trk's playlist 숨기기",
  trkPanelTitle:"🐔 trk's playlist", trkPanelHint:"게임 음악 소개(비영리·음원 없음). 아래 「재생목록 선택」에서 필요한 목록만 추가해요.",
  trkPickHint:"선택한 재생목록만 추가합니다. 삭제한 목록도 여기에서 다시 추가할 수 있습니다. 카탈로그에는 음원 파일이 없습니다.",
  trkPickLabel:"재생목록 선택", trkPickAdd:"선택한 목록 추가", trkPickAdded:"추가됨",
  trkPickOk:"재생목록을 추가했습니다", trkPickFail:"추가할 수 없습니다. 재생목록과 폴더의 한도를 확인하세요.", trkPickOriginals:"trk 오리지널",
  trkListShow:"👁 곡 화면 목록에 표시", trkListHide:"🗑 곡 화면 목록에서 숨기기",
  trkListShown:"👁 {name}을(를) 곡 화면 목록에 표시했어요", trkListHidden:"🗑 {name}을(를) 곡 화면 목록에서 숨겼어요",
  trkListNote:"🗑은 곡 화면의 「재생목록에 넣기」에서 숨기기만 해요(목록은 지워지지 않아요). 📋은 내용을 그대로 둔 채 편집할 수 있는 복사본을 만들어요.",
  trkCopyBtn:"📋 편집할 수 있는 복사본 만들기", trkCopyDone:"📋 편집할 수 있는 복사본을 만들었어요: {name}",
  trkCopyFail:"재생목록은 {n}개까지예요. 쓰지 않는 것을 지우면 만들 수 있어요", trkCopySuffix:" (복사)",
  plInListsHidden:"trk가 추가한 목록 {n}개는 여기에 표시하지 않아요. ⚙ 설정 → 🐔 trk's playlist의 👁로 표시할 수 있어요.",
  trkFixedNotice:"🐔 trk 목록은 곡 화면의 「재생목록에 넣기」에 나오지 않아요. 편집하려면 ⚙ → 🐔 trk's playlist에서 📋로 복사본을 만드세요.",
  trkCatalogBtn:"🐔 trk's playlist", trkCatalogTitle:"🐔 trk's playlist(비영리 소개 플레이리스트)",
  trkCatalogHint:"처음 10곡은 SAM Free Music — 100% Orange Juice! 에서 만난 곡들이에요. 동방·블루 아카이브·명일방주도 들어 있어요! 음원은 들어 있지 않아요. (저작권 포기 아님)",
  trkTab:"🐔 trk's playlist",
  trkTabNameLabel:"탭 표시 이름", trkTabNameFull:"trk's playlist", trkTabNameShort:"trk's", trkTabNameIcon:"🐔(아이콘만)",
  trkTabNameNote:"🐔 아이콘과 색은 고정이에요. 탭 이름은 이 3가지 중에서 고를 수 있어요(탭＝내용, 길게 누르기＝계층).",
  trkMenuTitle:"🐔 계층(Vol 목록)", trkMenuHint:"탭을 길게 눌러 여는 🐔 trk's playlist 내용이에요. Vol이나 시리즈를 고를 수 있어요. 이름과 색은 바꿀 수 없어요.",
  trkMenuOpenFolder:"폴더 열기", trkMenuOpenList:"플레이리스트 열기", trkOpenItem:"열기", trkMoveUp:"위로", trkMoveDown:"아래로",
  trkOrderEmpty:"(아직 재생목록이 없어요. 위의 「재생목록 선택」에서 추가할 수 있어요)",
  trkOrderAbcOff:"🔤 ABC순이 켜져 있어서 수동 ↑↓는 사용할 수 없어요.",
  trkSortAbc:"🔤 ABC순으로 정렬", trkSortAbcHint:"끄면 아래 목록의 ↑↓로 자유롭게 정렬할 수 있어요. 길게 눌러 여는 🐔 계층에도 반영돼요.",
  trkClassicTitle:"🎻 trk classic", trkClassicHint:"클래식 명반 100곡(공공 영역 음원은 Musopen으로 소개)",
  trkClassicToggle:"🎻 trk classic 탭 표시", trkClassicNote:"맨 오른쪽에 나타나는 클래식 소개 탭이에요. 끄면 숨길 수 있고, 목록은 같은 설정의 「재생목록 선택」에서 추가해요.",
  trkClassicAdded:"🎻 trk classic를 추가했어요({n}곡) — 맨 오른쪽 탭을 확인해 주세요",
  trkClassicDup:"🎻 trk classic는 이미 있어요", trkClassicShow:"🎻 trk classic 표시", trkClassicHide:"🎻 trk classic 숨기기",
  trkClassicPanelTitle:"🎻 trk classic", trkClassicPanelHint:"클래식 명반(공공 영역·음원 없음).",
  trkClassicBtn:"🎻 trk classic", trkClassicTab:"🎻 trk classic"
});

/* 🎹 Touhou MIDI: only local files are synthesized; no game audio or extractor is bundled. */
Object.assign(TEXT.ja, {
  midiRendering:"選択したコード音色プロフィールでMIDIを準備中…", midiRenderingProgress:"選択したコード音色プロフィールでMIDIを準備中…{p}%", midiLoaded:"選択したコード音色プロフィールでMIDIを再生します（実サンプルなし・元ファイルは変更しません）。",
  midiTooLarge:"MIDIファイルが大きすぎます（上限8MB）。", midiTooLong:"MIDIが10分を超えるため再生を中止しました。",
  midiUnsupported:"このMIDIの時間形式（SMPTE）は未対応です。", midiFormatUnsupported:"SMF 0/1以外の形式には対応していません。", midiTooComplex:"イベント数またはトラック数が多すぎるため、安全に再生できません。", midiTooDense:"MIDIが長い、または同時に鳴る音が多すぎるため再生できません（変換の処理量が上限を超えました）。", midiError:"MIDIを読めません。標準MIDIファイル（SMF）か確認してください。",
  touhouCatalogNote:"TouhouThemeDB（Unlicense）のコミュニティ索引を使用。東方Project本体は{groups}グループ・{tracks} release ID（体験版・重複/編曲IDを含む）。手元の .mid/.midi は再生できますが、全曲にMIDIがあるわけではありません。正規に入手した自分のゲームから抽出し、ゲームデータや抽出物を再配布しないでください。thtk の上流 COPYING は二条件のBSD系文面ですが、Touhou Patch CenterのガイドではBGMアーカイブ抽出に非対応と明記されています。別ツールTouhou Music Room（GPL-3.0-or-later、追加許可あり）はWindows作品の音声を抽出しますが、MIDIは出力しません。ゲーム音源・抽出ツールは同梱しません。",
  zunOtherCatalogNote:"ここはSeihou、Torte Le Magic、Uwabami Breakers、神魔討綺伝など、TouhouThemeDBに関連作品として載る東方Project外の6作品（{groups}グループ・{tracks} release ID）。正史Touhouとは別枠です。コミュニティ索引は権利許諾を示しません。音源は同梱しません。",
  touhouPlaylistGuide:"手元のMIDIを再生。ID名（th06_05.mid）はカタログ曲名で表示。Music Roomは音声抽出用（MIDI非対応）。音源なし。",
  touhouThemeDbSnapshot:"TouhouThemeDB固定データ（Unlicense）",
  zunOtherPlaylistGuide:"東方Project外の関連作品です。手元のMIDIのみ再生。音源・抽出物の同梱や再配布はしません。",
  touhouToolkitDocs:"thtkガイド（BGMアーカイブ抽出は非対応）", touhouToolkitLicense:"thtk COPYING（ライセンス条件）",
  touhouMusicRoom:"Touhou Music Room 外部ツール", touhouMusicRoomLicense:"Touhou Music Room LICENSE（GPL-3.0-or-later・追加許可）"
});
Object.assign(TEXT.en, {
  midiRendering:"Preparing MIDI with the selected code-generated timbre profile…", midiRenderingProgress:"Preparing MIDI with the selected code-generated timbre profile… {p}%", midiLoaded:"MIDI rendered with the selected procedural timbre (no samples; the original file is unchanged).",
  midiTooLarge:"MIDI file is too large (8 MB maximum).", midiTooLong:"Playback stopped: this MIDI is longer than 10 minutes.",
  midiUnsupported:"This MIDI timing mode (SMPTE) is not supported.", midiFormatUnsupported:"Only Standard MIDI File type 0/1 is supported.", midiTooComplex:"This MIDI has too many events or tracks to render safely.", midiTooDense:"This MIDI is too long or has too many notes sounding at once to render safely (over the processing limit).", midiError:"Could not read this file. Please check that it is a Standard MIDI File (SMF).",
  touhouCatalogNote:"Community-maintained Japanese title data from TouhouThemeDB (Unlicense): {groups} Touhou Project groups and {tracks} release IDs, including demos and duplicate/arranged entries. Local .mid/.midi files can be played, but not every track has MIDI. Extract only from a game you lawfully obtained; do not redistribute game data or rips. thtk's upstream COPYING has two-condition BSD-style terms, but the Touhou Patch Center guide says it cannot extract BGM archives. Touhou Music Room (GPL-3.0-or-later, additional permission) extracts game audio on Windows, not MIDI. No game audio or extractor is bundled.",
  zunOtherCatalogNote:"This separate section has {groups} associated games outside Touhou Project ({tracks} release IDs), as listed by TouhouThemeDB. It is not part of the Touhou Project canon. The community index grants no rights. No audio is bundled.",
  touhouPlaylistGuide:"Local MIDI only; ID filenames show catalogue titles. Music Room exports audio, not MIDI. No audio is bundled.",
  touhouThemeDbSnapshot:"TouhouThemeDB pinned snapshot (Unlicense)",
  zunOtherPlaylistGuide:"Not Touhou Project canon. Local MIDI only; no game audio bundled.",
  touhouToolkitDocs:"thtk guide (BGM archive extraction unsupported)", touhouToolkitLicense:"thtk COPYING (license terms)",
  touhouMusicRoom:"Touhou Music Room (external tool)", touhouMusicRoomLicense:"Touhou Music Room LICENSE (GPL-3.0-or-later + additional permission)"
});
Object.assign(TEXT.zh, {
  midiRendering:"正在用所选代码音色配置准备MIDI…", midiRenderingProgress:"正在用所选代码音色配置准备MIDI…{p}%", midiLoaded:"已用所选代码合成音色渲染MIDI（不含采样，不会修改原文件）。",
  midiTooLarge:"MIDI文件过大（上限8 MB）。", midiTooLong:"MIDI超过10分钟，已停止播放。",
  midiUnsupported:"暂不支持此MIDI时间格式（SMPTE）。", midiFormatUnsupported:"仅支持标准MIDI文件类型0/1。", midiTooComplex:"MIDI事件或音轨过多，无法安全渲染。", midiTooDense:"MIDI过长或同时发声的音符过多，超出可安全渲染的处理量上限。", midiError:"无法读取文件，请确认它是标准MIDI文件（SMF）。",
  touhouCatalogNote:"日文曲名来自TouhouThemeDB（Unlicense，社区维护）：东方Project本体共{groups}组、{tracks}个release ID，含体验版及重复/改编条目。可播放本地.mid/.midi，但并非每首曲目都有MIDI。仅从自己合法取得的游戏中提取；请勿再分发游戏数据或提取物。thtk上游COPYING为BSD双条件风格条款，但Touhou Patch Center指南说明它不能提取BGM档案。Touhou Music Room（GPL-3.0-or-later，含附加许可）可在Windows提取游戏音频，不输出MIDI。不附带游戏音源或提取工具。",
  zunOtherCatalogNote:"此处单独列出TouhouThemeDB收录的{groups}组、{tracks}个东方式Project外相关游戏。它们不属于东方Project正史；社区索引不授予任何权利。不附带音源。",
  touhouPlaylistGuide:"仅播放本地MIDI；ID文件名显示曲名。Music Room提取音频，不输出MIDI；无音源。",
  touhouThemeDbSnapshot:"TouhouThemeDB固定数据（Unlicense）",
  zunOtherPlaylistGuide:"东方Project外的相关作品。仅播放本地MIDI；不附带或再分发音源/游戏提取物。",
  touhouToolkitDocs:"thtk指南（不支持提取BGM档案）", touhouToolkitLicense:"thtk COPYING（许可条款）",
  touhouMusicRoom:"Touhou Music Room外部工具", touhouMusicRoomLicense:"Touhou Music Room LICENSE（GPL-3.0-or-later，附加许可）"
});
Object.assign(TEXT.ko, {
  midiRendering:"선택한 코드 생성 음색 프로필로 MIDI 준비 중…", midiRenderingProgress:"선택한 코드 생성 음색 프로필로 MIDI 준비 중… {p}%", midiLoaded:"선택한 절차 생성 음색으로 MIDI를 렌더링했습니다 (샘플 없음, 원본 파일은 그대로예요).",
  midiTooLarge:"MIDI 파일이 너무 큽니다 (최대 8MB).", midiTooLong:"MIDI가 10분을 넘어 재생을 중단했어요.",
  midiUnsupported:"이 MIDI 시간 형식(SMPTE)은 지원하지 않아요.", midiFormatUnsupported:"표준 MIDI 파일 형식 0/1만 지원해요.", midiTooComplex:"이 MIDI는 이벤트나 트랙이 너무 많아 안전하게 렌더링할 수 없어요.", midiTooDense:"MIDI가 너무 길거나 동시에 울리는 음이 너무 많아 안전하게 렌더링할 수 없어요 (처리량 상한 초과).", midiError:"파일을 읽을 수 없어요. 표준 MIDI 파일(SMF)인지 확인해 주세요.",
  touhouCatalogNote:"TouhouThemeDB(Unlicense)의 커뮤니티 일본어 곡명 색인: 동방 Project 본편 {groups}개 그룹, {tracks}개 release ID(체험판·중복/편곡 포함). 로컬 .mid/.midi는 재생하지만 모든 곡에 MIDI가 있는 것은 아니에요. 정식 취득한 본인 게임에서 추출하고 게임 데이터/추출물은 재배포하지 마세요. thtk의 upstream COPYING은 BSD 2조건 계열이지만 Touhou Patch Center 안내에 따르면 BGM 아카이브는 추출할 수 없어요. Touhou Music Room(GPL-3.0-or-later, 추가 허가 있음)은 Windows 게임 음원을 추출하지만 MIDI는 출력하지 않아요. 게임 음원/추출 도구는 포함하지 않아요.",
  zunOtherCatalogNote:"TouhouThemeDB가 관련 작품으로 분류한 동방 Project 외 게임 {groups}개 그룹, {tracks}개 release ID를 별도 표시해요. 동방 Project 정사가 아니며, 커뮤니티 색인은 권리를 허가하지 않아요. 음원은 포함하지 않아요.",
  touhouPlaylistGuide:"로컬 MIDI만 재생하며 ID 파일명은 곡명으로 표시해요. Music Room은 음원을 추출하지만 MIDI는 출력하지 않아요.",
  touhouThemeDbSnapshot:"TouhouThemeDB 고정 데이터 (Unlicense)",
  zunOtherPlaylistGuide:"동방 Project 정사가 아니에요. 로컬 MIDI만 재생; 게임 음원 미포함.",
  touhouToolkitDocs:"thtk 안내 (BGM 아카이브 추출 미지원)", touhouToolkitLicense:"thtk COPYING (라이선스 조건)",
  touhouMusicRoom:"Touhou Music Room 외부 도구", touhouMusicRoomLicense:"Touhou Music Room LICENSE (GPL-3.0-or-later, 추가 허가)"
});

/* 📄 プレイリストの入手先ガイド（公式カタログ由来）と、消した trk の自動リストを戻すボタン。
   ガイドは保存データに key と日本語の控え（note）を持ち、表示は key から今の言語で引く
   （英中韓のUIに日本語の注記が出ないように）。権利の書き方は4言語で同じ強さにそろえる。 */
Object.assign(TEXT.ja, {
  plGuideIntro:"非営利の紹介プレイリスト。音源は同梱しません。",
  plGuideGameVol1:"非営利の紹介プレイリスト。音源は同梱しません。作品の案内や配布状況は夢現の作品ページをご確認ください。",
  plGuideClassic:"版権切れの名演をMusopenの公開録音で紹介。音源は同梱しません。",
  plGuideTrkOst:"🎵 trk's OST Vol.1の公開ダウンロード先は現在確認できません。FIRST SPARKは同梱され、端末に取り込んだOSTパックの曲もここに並びます。",
  plGuideBlueArchive:"NexTone.Link／Apple Music公式案内。音源なし。購入・サブスクは利用許諾ではありません。",
  plGuideBlueArchiveMika:"メモロビ2曲（mora／You’re My Princessは配信未確認で作曲家Xの1分投稿へ）、kiss angel（Short未収録）、Aria（韓国語2曲＋Global本編MV、英語名は英語歌唱ではない）、日本語3曲＋MV。地域差あり。音源・映像なし。配信・公開は読込用ファイルや二次利用許諾を保証しません。",
  plGuideLolCsVerified:"公式SoundCloudアルバム（音源なし）。Creator-Safe対象（Riot公式Playlistと照合済み）。配信・購入は二次利用許諾ではありません。",
  plGuideLolCsPartial:"公式SoundCloudアルバム（音源なし）。一部の曲はCreator-Safe対象（Riot公式Playlistと照合済み）、残りはPlaylistに見当たらない・要確認。配信・購入は二次利用許諾ではありません。",
  plGuideLolCsUnverified:"公式SoundCloudアルバム（音源なし）。Creator-Safe対象かは未照合。配信・購入は二次利用許諾ではありません。",
  plGuideRiotLinksVerified:"公式リンク集（音源なし）。全曲がCreator-Safe対象（Riot公式のCreator-Safeプレイリストと照合済み）。配信・購入は二次利用許諾ではありません。",
  plGuideRiotLinksPartial:"公式リンク集（音源なし）。一部の曲はCreator-Safe対象（Riot公式Playlistと照合済み）、残りはPlaylistに見当たらない・要確認。配信・購入は二次利用許諾ではありません。",
  plGuideRiotLinksAbsent:"公式リンク集（音源なし）。Riot公式のCreator-Safeプレイリストに見当たらない曲です（Creator-Safe対象外・要確認）。配信・購入は二次利用許諾ではありません。",
  plGuideLolPopular:"公式SoundCloud人気曲ページ（音源なし）。一部だけCreator-Safe対象、共同制作曲などは対象外・要確認。配信・購入は二次利用許諾ではありません。",
  plGuideRiotLinks:"公式リンク集。配信・購入は二次利用許諾ではありません。Creator-Safeの対象と条件を要確認。",
  plGuideGakumasInst:"公式Driveで配布確認済み。DOWNLOAD規約はファン動画向けの限定条件で、全用途の許諾ではありません。",
  plGuideGakumasDisco:"公式ディスコグラフィ掲載曲。現行Driveで未確認の曲も含みます（配布不可の断定ではありません）。",
  plGuideGakumasLegacy:"DOWNLOAD規約はファン動画向け限定。全用途の許諾ではありません。Drive未掲載は配布不可の証明ではありません。",
  plGuideGenshin:"Apple Music公式配信への案内です。サブスク・購入は二次利用許諾ではありません。",
  plGuideFruitbat:"公式ゲーム案内のみ。個別曲の公式配信先・使用許諾は未確認です。",
  plGuideArknights:"Monster-Siren公式の曲／OSTページです。音源は同梱せず、リンクは利用許諾ではありません。",
  plGuideEndfield:"公式Spotify個別曲・アルバムページとffm.to配信一覧への案内（音源なし）。配信・購入は二次利用許諾ではありません。利用前は公式二次創作ガイドラインを確認してください。",
  plGuideNcs:"NCS公式サイトの各曲ページへの案内（音源なし）。クレジット表記などの条件は各曲ページで確認してください。",
  plGuideMacleod:"incompetech公式ページへの案内（音源なし）。CC BY 4.0のクレジット表記など、条件は公式ページで確認してください。",
  plOfficialLink:"公式リンク",
  trkRestoreBtn:"♻ 消したtrkのリストを戻す（{n}件）",
  trkRestoreHint:"消したリストは、上の「プレイリストを選択」で同じものを選び直すと戻ります（曲そのものは消えません）。",
  trkRestored:"♻ 消したリストを{n}件戻しました"
});
Object.assign(TEXT.en, {
  plGuideIntro:"A non-commercial introduction playlist. No audio is included.",
  plGuideGameVol1:"A non-commercial introduction playlist. No audio is included. See the Free Game Mugen project page for trk! information and current availability.",
  plGuideClassic:"Public-domain masterpieces introduced through Musopen's public recordings. No audio is included.",
  plGuideTrkOst:"🎵 A verified public download page for trk's OST Vol.1 is not currently available. FIRST SPARK is bundled; songs from an OST pack you imported on this device also appear here.",
  plGuideBlueArchive:"Official NexTone.Link / Apple Music pages. No audio included. Buying or subscribing is not a license to use.",
  plGuideBlueArchiveMika:"Two Memorial Lobby tracks (mora / You’re My Princess links to composer EmoCosine's 1-min X post as official streaming is unconfirmed as of Oct 2026), kiss angel (Short omitted), Aria (2 KR songs + Global MV; English titles != English vocals), and 3 JP songs + MV. Apple Music CN/UK/JP links vary by region. No media included; not a reuse license or importable file guarantee.",
  plGuideLolCsVerified:"Official SoundCloud album (no audio included). Creator-Safe: matched against Riot's official Creator-Safe Playlist. Streaming or buying is not a license to reuse.",
  plGuideLolCsPartial:"Official SoundCloud album (no audio included). Some songs are Creator-Safe (matched against Riot's official Creator-Safe Playlist); the rest were not found in it, so check them. Streaming or buying is not a license to reuse.",
  plGuideLolCsUnverified:"Official SoundCloud album (no audio included). Creator-Safe status not yet matched. Streaming or buying is not a license to reuse.",
  plGuideRiotLinksVerified:"Official links only (no audio included). Every song is Creator-Safe (matched against Riot's official Creator-Safe playlists). Streaming or buying is not a license to reuse.",
  plGuideRiotLinksPartial:"Official links only (no audio included). Some songs are Creator-Safe (matched against Riot's official Creator-Safe Playlist); the rest were not found in it, so check them. Streaming or buying is not a license to reuse.",
  plGuideRiotLinksAbsent:"Official links only (no audio included). These songs were not found in Riot's official Creator-Safe playlists (outside Creator-Safe or unconfirmed). Streaming or buying is not a license to reuse.",
  plGuideLolPopular:"Official SoundCloud popular-tracks page (no audio included). Only some songs are Creator-Safe (matched against Riot's official Creator-Safe Playlist); collaboration songs and the rest were not found in it (outside Creator-Safe or unconfirmed). Streaming or buying is not a license to reuse.",
  plGuideRiotLinks:"Official links only. Streaming or buying is not a license to reuse. Check Creator-Safe eligibility and conditions.",
  plGuideGakumasInst:"Confirmed on the official Drive. The DOWNLOAD terms are limited to fan videos and are not a license for every use.",
  plGuideGakumasDisco:"Songs from the official discography. Some are not found on the current Drive (this does not mean they cannot be distributed).",
  plGuideGakumasLegacy:"The DOWNLOAD terms are limited to fan videos, not a license for every use. A song missing from the Drive does not prove it cannot be distributed.",
  plGuideGenshin:"Links to the official Apple Music releases. Subscribing or buying is not a license to reuse.",
  plGuideFruitbat:"Official game page only. Per-song official sources and usage permissions are unconfirmed.",
  plGuideArknights:"Official Monster-Siren song / OST pages. No audio is included, and the links are not a license to use.",
  plGuideEndfield:"Links to official Spotify song / album pages and ffm.to listings (no audio included). Streaming or buying is not a license to reuse. Check the official fan-content guidelines before use.",
  plGuideNcs:"Links to each song's page on the official NCS site (no audio included). Check credit and other conditions on each song page.",
  plGuideMacleod:"Links to the official incompetech pages (no audio included). Check the conditions, such as CC BY 4.0 credit, on the official pages.",
  plOfficialLink:"Official link",
  trkRestoreBtn:"♻ Restore deleted trk lists ({n})",
  trkRestoreHint:"To bring back a deleted list, pick the same one again in “Choose a playlist” above (the songs themselves are kept).",
  trkRestored:"♻ Restored {n} deleted list(s)"
});
Object.assign(TEXT.zh, {
  plGuideIntro:"非营利的介绍歌单。不附带音源。",
  plGuideGameVol1:"非营利介绍歌单。不附带音源。有关 trk! 的介绍和当前发布信息，请查看 Free Game Mugen 作品页面。",
  plGuideClassic:"通过Musopen的公开录音介绍版权已过期的名曲。不附带音源。",
  plGuideTrkOst:"🎵 目前无法确认 trk's OST Vol.1 的公开下载页面。此处包含随附的 FIRST SPARK，以及你已导入本设备的 OST 资源包曲目。", 
  plGuideBlueArchive:"NexTone.Link／Apple Music官方页面。不含音源。购买或订阅并不等于使用许可。",
  plGuideBlueArchiveMika:"纪念大厅两曲（mora／You’re My Princess截至2026年10月官方发行未确认，指向作曲家X的1分钟试听）、kiss angel（Short未收录）、Aria（韩语歌两首＋全球MV，英文名不代表英语演唱）及日语歌三首＋MV。Apple Music中／英／日商店等存在地区差异。不附带音视频，公开或购买不保证可导入文件或二次使用许可。",
  plGuideLolCsVerified:"官方SoundCloud专辑（不含音源）。属于Creator-Safe（已与Riot官方Creator-Safe歌单核对）。播放或购买不等于二次使用许可。",
  plGuideLolCsPartial:"官方SoundCloud专辑（不含音源）。部分曲目属于Creator-Safe（已与Riot官方Creator-Safe歌单核对），其余未在歌单中找到，请先确认。播放或购买不等于二次使用许可。",
  plGuideLolCsUnverified:"官方SoundCloud专辑（不含音源）。是否属于Creator-Safe尚未核对。播放或购买不等于二次使用许可。",
  plGuideRiotLinksVerified:"官方链接合集（不含音源）。全部曲目属于Creator-Safe（已与Riot官方Creator-Safe歌单核对）。播放或购买不等于二次使用许可。",
  plGuideRiotLinksPartial:"官方链接合集（不含音源）。部分曲目属于Creator-Safe（已与Riot官方Creator-Safe歌单核对），其余未在歌单中找到，请先确认。播放或购买不等于二次使用许可。",
  plGuideRiotLinksAbsent:"官方链接合集（不含音源）。这些曲目未在Riot官方Creator-Safe歌单中找到（不属于Creator-Safe或尚待确认）。播放或购买不等于二次使用许可。",
  plGuideLolPopular:"官方SoundCloud热门曲目页面（不含音源）。仅部分曲目属于Creator-Safe（已与Riot官方Creator-Safe歌单核对），合作曲目等其余曲目未在歌单中找到（不属于Creator-Safe或尚待确认）。播放或购买不等于二次使用许可。",
  plGuideRiotLinks:"官方链接合集。播放或购买不等于二次使用许可。请确认是否属于Creator-Safe及其条件。",
  plGuideGakumasInst:"已在官方Drive确认发布。DOWNLOAD条款仅限粉丝视频，并非所有用途的许可。",
  plGuideGakumasDisco:"官方唱片目录中的曲目。包含当前Drive中未确认的曲目（并不断定不可分发）。",
  plGuideGakumasLegacy:"DOWNLOAD条款仅限粉丝视频，并非所有用途的许可。Drive未收录并不证明不可分发。",
  plGuideGenshin:"指向Apple Music官方发行的链接。订阅或购买不等于二次使用许可。",
  plGuideFruitbat:"仅为官方游戏介绍页面。各曲目的官方发行渠道与使用许可尚未确认。",
  plGuideArknights:"Monster-Siren官方曲目／OST页面。不附带音源，链接并不等于使用许可。",
  plGuideEndfield:"指向官方Spotify单曲／专辑页面与ffm.to发行列表（不含音源）。播放或购买不等于二次使用许可。使用前请确认官方二次创作指南。",
  plGuideNcs:"指向NCS官网的各曲目页面（不含音源）。署名等条件请在各曲目页面确认。",
  plGuideMacleod:"指向incompetech官方页面（不含音源）。CC BY 4.0署名等条件请在官方页面确认。",
  plOfficialLink:"官方链接",
  trkRestoreBtn:"♻ 恢复已删除的trk歌单（{n}个）",
  trkRestoreHint:"要恢复已删除的歌单，请在上面的「选择歌单」中再次选择同一个（歌曲本身不会被删除）。",
  trkRestored:"♻ 已恢复{n}个已删除的歌单"
});
Object.assign(TEXT.ko, {
  plGuideIntro:"비영리 소개 플레이리스트예요. 음원은 포함하지 않아요.",
  plGuideGameVol1:"비영리 소개 플레이리스트예요. 음원은 포함하지 않아요. trk! 정보와 현재 배포 상황은 Free Game Mugen 작품 페이지에서 확인하세요.",
  plGuideClassic:"저작권이 만료된 명곡을 Musopen의 공개 녹음으로 소개해요. 음원은 포함하지 않아요.",
  plGuideTrkOst:"🎵 trk's OST Vol.1의 공개 다운로드 페이지를 현재 확인할 수 없습니다. 기본 포함된 FIRST SPARK와 이 기기에 직접 가져온 OST 팩의 곡이 여기에 표시됩니다.",
  plGuideBlueArchive:"NexTone.Link／Apple Music 공식 안내. 음원 없음. 구매·구독은 이용 허락이 아니에요.",
  plGuideBlueArchiveMika:"메모리얼 로비 2곡(mora / You’re My Princess는 2026년 10월 기준 공식 음원 발매 미확인으로 작곡가 X의 1분 게시물로 안내), kiss angel(Short 제외), Aria(한국어 2곡+글로벌 MV, 영어 제목은 영어 가창 의미 아님), 일본어 3곡+MV. Apple Music 중·영·일 스토어 등 지역별 조건 상이. 미디어 미포함, 공개·구매는 가져올 파일이나 재이용 허가를 보장하지 않아요.",
  plGuideLolCsVerified:"공식 SoundCloud 앨범(음원 없음). Creator-Safe 대상(Riot 공식 Creator-Safe 플레이리스트와 대조 완료). 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideLolCsPartial:"공식 SoundCloud 앨범(음원 없음). 일부 곡은 Creator-Safe 대상(Riot 공식 Creator-Safe 플레이리스트와 대조 완료)이고, 나머지는 플레이리스트에서 찾지 못했으니 확인이 필요해요. 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideLolCsUnverified:"공식 SoundCloud 앨범(음원 없음). Creator-Safe 대상인지 아직 대조하지 않았어요. 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideRiotLinksVerified:"공식 링크 모음(음원 없음). 모든 곡이 Creator-Safe 대상이에요(Riot 공식 Creator-Safe 플레이리스트와 대조 완료). 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideRiotLinksPartial:"공식 링크 모음(음원 없음). 일부 곡은 Creator-Safe 대상(Riot 공식 Creator-Safe 플레이리스트와 대조 완료)이고, 나머지는 플레이리스트에서 찾지 못했으니 확인이 필요해요. 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideRiotLinksAbsent:"공식 링크 모음(음원 없음). Riot 공식 Creator-Safe 플레이리스트에서 찾지 못한 곡이에요(Creator-Safe 대상이 아니거나 확인이 필요해요). 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideLolPopular:"공식 SoundCloud 인기곡 페이지(음원 없음). 일부 곡만 Creator-Safe 대상(Riot 공식 Creator-Safe 플레이리스트와 대조 완료)이고, 공동 제작곡 등 나머지는 플레이리스트에서 찾지 못했어요(Creator-Safe 대상이 아니거나 확인이 필요해요). 스트리밍·구매는 2차 이용 허락이 아니에요.",
  plGuideRiotLinks:"공식 링크 모음. 스트리밍·구매는 2차 이용 허락이 아니에요. Creator-Safe 대상 여부와 조건을 확인하세요.",
  plGuideGakumasInst:"공식 Drive에서 배포를 확인했어요. DOWNLOAD 규약은 팬 영상용 한정 조건이며 모든 용도의 허락이 아니에요.",
  plGuideGakumasDisco:"공식 디스코그래피 수록곡이에요. 현재 Drive에서 확인되지 않은 곡도 있어요(배포 불가라고 단정하지 않아요).",
  plGuideGakumasLegacy:"DOWNLOAD 규약은 팬 영상용 한정이며 모든 용도의 허락이 아니에요. Drive에 없다고 해서 배포 불가라는 증거는 아니에요.",
  plGuideGenshin:"Apple Music 공식 배포로 안내해요. 구독·구매는 2차 이용 허락이 아니에요.",
  plGuideFruitbat:"공식 게임 안내만 있어요. 곡별 공식 배포처와 사용 허락은 확인하지 않았어요.",
  plGuideArknights:"Monster-Siren 공식 곡／OST 페이지예요. 음원은 포함하지 않으며 링크는 이용 허락이 아니에요.",
  plGuideEndfield:"공식 Spotify 곡·앨범 페이지와 ffm.to 배포 목록으로 안내해요(음원 없음). 스트리밍·구매는 2차 이용 허락이 아니에요. 이용 전에 공식 2차 창작 가이드라인을 확인하세요.",
  plGuideNcs:"NCS 공식 사이트의 곡별 페이지로 안내해요(음원 없음). 크레딧 표기 등 조건은 곡별 페이지에서 확인하세요.",
  plGuideMacleod:"incompetech 공식 페이지로 안내해요(음원 없음). CC BY 4.0 크레딧 표기 등 조건은 공식 페이지에서 확인하세요.",
  plOfficialLink:"공식 링크",
  trkRestoreBtn:"♻ 삭제한 trk 목록 되돌리기 ({n}개)",
  trkRestoreHint:"삭제한 목록은 위의 「재생목록 선택」에서 같은 것을 다시 고르면 돌아와요(곡 자체는 지워지지 않아요).",
  trkRestored:"♻ 삭제한 목록 {n}개를 되돌렸어요"
});


const libFolderSeg = it => String(it.dir || "").split("/")[0].trim();
/* ✔公認の判定は verified.js の窓口から（読み込まれていなければ、公認タブは作りません） */
const libIsVerified = it => {
  const v = window.TrkVerified;
  return !!(v && typeof v.verifyOf === "function" && v.verifyOf(it));
};
const libPackKey = it => it.packId || it.packName || "";
/* 曲 → タブのID（同じ曲でも、入り口が違えば別のタブ） */
function libTabIdOf(it) {
  if (it.source === "pack") return "pack:" + libPackKey(it);
  if (it.source === "file") return "file";
  if (it.source === "builtin") return "builtin";
  const seg = libFolderSeg(it);
  return seg ? "folder:" + seg : "folder";
}
/* ⭐ お気に入り（js/favs.js）。いま選んでいるフォルダの曲を数える。
   any＝1軍／2軍／🧊フリーズのどれかに入っている曲の数（⭐タブを出すかの判断に使う） */
function libFavKeys(all) {
  const F = window.TrkFavs;
  if (!F) return { n:0, any:0, group:"main" };
  const g = F.activeOf("song");
  let n = 0, any = 0;
  for (const it of all) {
    if (F.inGroup("song", g, it.key)) n++;
    if (F.has("song", it.key)) any++;
  }
  return { n, any, group:g };
}
/* ⭐ お気に入りタブ（trk215）。**どのフォルダかに1曲でも入っていれば出す**。
   1.1.4 までは「いま選んでいるフォルダの曲数」で出し入れしていたので、空の2軍／フリーズを
   選んだだけでタブが消え、お気に入りが無くなったように見えた（戻る道も無かった）。
   いま見ているタブが ⭐ なら、1曲も無くても出す（選んだ直後に消えない）。 */
function libFavTab(all) {
  if (!window.TrkFavs) return null;
  const fav = libFavKeys(all);
  if (!fav.any && !fav.n && core.settings.libTab !== "fav") return null;
  return { id:"fav", icon:"⭐", label:tr("favTab"), n:fav.n };
}
/* タブの一覧（順番：すべて → ⭐お気に入り → プレイリスト → パック／アドオン／フォルダー → デモ曲 → 追加した曲 → 公認） */
function libTabsOf(all) {
  const tabs = [{ id:"all", icon:"📚", label:tr("libTabAll"), n:all.filter(x => !x.trkOnly).length }];
  const favTab = libFavTab(all);
  if (favTab) tabs.push(favTab);
  /* ⚡ スマート棚（trk172）：再生履歴（🎮 リザルト・🎧 プレーヤー）か追加日時の材料があれば出す。
     中身は renderLib の libSmartSections（最近再生／よく再生／最近追加）。曲数はセクションに出る曲の延べではなく「材料を持つ曲」 */
  {
    const anyPlayed = Object.keys(PLAYED).length > 0;
    const anyRecs = !!(window.Trk.play && window.Trk.play.records && Object.keys(window.Trk.play.records).length);
    let nSmart = 0;
    if (anyPlayed || anyRecs || all.some(it => it.addedAt > 0)) {
      const idx = anyRecs ? plRecordsIdx() : {};
      for (const it of all) {
        if (it.trkOnly) continue;
        const p = PLAYED[it.key];
        if ((p && (p.last > 0 || (p.manual || 0) + (p.auto || 0) + (p.media || 0) > 0)) || it.addedAt > 0 || songInfo(it, idx)) nSmart++;
      }
    }
    if (nSmart) tabs.push({ id:"smart", icon:"⚡", label:tr("libTabSmart"), n:nSmart });
  }
  const plKeys = new Set(all.map(x => x.key));
  /* 📁 フォルダ（中のプレイリストの曲をぜんぶ）。🐔 trk's playlist は右端に表示名つきで出すので、ここでは出さない */
  for (const f of core.settings.plFolders) if (!f.parent && f.id !== TRK_FOLDER_ID) tabs.push({ id:"fld:" + f.id, icon: f.icon || "📁", label: f.name, n: [...plFolderUnionKeys(f.id)].filter(k => plKeys.has(k)).length, fld: f });
  for (const p of core.settings.playlists) if (!p.folder && plVisible(p) && p.id !== "trk-playlist" && p.id !== "trk-classic") tabs.push({ id:"pl:" + p.id, icon: plIcon(p), label: p.name, n: plCount(p, plKeys), pl: p });   /* 🎧 フォルダに入っていないプレイリスト（👥投稿者で絞る。🐔🎻は右端に出すため除外） */
  if (core.settings.libTab.startsWith("pl:")) {   /* フォルダの中のプレイリストを見ているときは、そのタブも出す（戻れるように） */
    const cp = plById(core.settings.libTab.slice(3));
    if (cp && cp.folder && plVisible(cp) && !tabs.some(t => t.id === core.settings.libTab)) tabs.push({ id:"pl:" + cp.id, icon: plIcon(cp), label: cp.name, n: plCount(cp, plKeys), pl: cp, nested: true });
  }
  if (core.settings.libTab.startsWith("fld:")) {   /* サブフォルダ（🐔 の中や、🎭 棚など）を見ているときは、そのタブも出す（戻れるように）。
     親フォルダがトップでなければ既存のタブに無いので、ここで出す。見なくなったら消える（ブラウザのタブに近い） */
    const cf = plFolderById(core.settings.libTab.slice(4));
    if (cf && cf.parent && !tabs.some(t => t.id === core.settings.libTab)) tabs.push({ id: "fld:" + cf.id, icon: cf.icon || "📁", label: cf.name, n: [...plFolderUnionKeys(cf.id)].filter(k => plKeys.has(k)).length, fld: cf, nested: true });
  }
  /* 📂 開いたフォルダ内プレイリストのタブは残す（settings.libOpenTabs に永続化）。
     いま見ているフォルダ内プレイリストも記録し、閉じるまではタブ帯に残す＝ブラウザのタブに近い */
  const openIds = Array.isArray(core.settings.libOpenTabs) ? core.settings.libOpenTabs : [];
  let openChanged = false;
  if (core.settings.libTab.startsWith("pl:")) {
    const ap = plById(core.settings.libTab.slice(3));
    if (ap && ap.folder && !openIds.includes(ap.id)) { openIds.push(ap.id); openChanged = true; }
  }
  for (const oid of openIds) {
    if (tabs.some(t => t.id === "pl:" + oid)) continue;
    const op = plById(oid);
    if (op && op.folder && plVisible(op)) tabs.push({ id:"pl:" + oid, icon: plIcon(op), label: op.name, n: plCount(op, plKeys), pl: op, nested: true });
  }
  if (openChanged) { core.settings.libOpenTabs = openIds.slice(); core.saveUserPrefs(); }
  const packs = new Map(), folders = new Map(), addons = new Map();
  const savedKeySet = new Set(savedSongs.map(it => it.key));
  let nFiles = 0, nKept = 0, nBuiltins = 0;
  for (const it of all) {
    if (it.source === "builtin") nBuiltins++;
    else if (it.source === "pack") {
      const key = libPackKey(it), t = packs.get(key) || { id:"pack:" + key, icon:"📦", label:it.packName || tr("libTabPackNone"), n:0 };
      t.n++; packs.set(key, t);
    } else if (it.source === "addon") {
      const key = it.addonId || "", t = addons.get(key) || { id:"addon:" + key, icon:"🧩", label:it.addonName || tr("libTabAddon"), n:0 };
      t.n++; addons.set(key, t);
    } else if (it.source === "file") { nFiles++; if (savedKeySet.has(it.key)) nKept++; }
    else {
      const seg = libFolderSeg(it), t = folders.get(seg) || { id:seg ? "folder:" + seg : "folder", icon:"📁", label:seg || tr("libTabFolderTop"), n:0 };
      t.n++; folders.set(seg, t);
    }
  }
  for (const t of packs.values()) tabs.push(t);
  for (const t of addons.values()) tabs.push(t);          // 🧩 アドオンが足した曲
  for (const t of folders.values()) tabs.push(t);
  /* 💿 アルバム／🎤 アーティストの棚（trk171）：アルバム名／アーティスト名を持つ曲が1つでもあれば出す。
     棚の中はぜんぶの曲（グループの無い曲は「タグなし」グループ＝最後）。曲数は棚に出る曲ぜんぶ */
  {
    let nAlbum = 0, nArtist = 0;
    for (const it of all) {
      if (it.trkOnly) continue;
      const d = songDisplayMeta(it);
      if (d.album) nAlbum++;
      if (d.artist) nArtist++;
    }
    const shelfN = all.filter(x => !x.trkOnly).length;
    if (nAlbum) tabs.push({ id:"albums", icon:"💿", label:tr("libTabAlbums"), n:shelfN });
    if (nArtist) tabs.push({ id:"artists", icon:"🎤", label:tr("libTabArtists"), n:shelfN });
  }
  /* 🎓 デモ曲は独立タブにせず「trk's OST Vol.1」プレイリストへ（一番下に出す。中クリックで消せる） */
  if (nFiles) tabs.push({ id:"file", icon:"📄", label:tr("libTabFiles"), n:nFiles });
  if (nKept) tabs.push({ id:"kept", icon:"💾", label:tr("libTabKept"), n:nKept });
  const nv = all.filter(it => it.source === "pack" && libIsVerified(it)).length;
  if (nv) tabs.push({ id:"verified", icon:"✔", label:tr("libTabVerified"), n:nv });
  // 🐔 trk's playlist — フォルダを右端に1つ。長押しで中の Vol（階層）が開く。場所を取らずに沢山収容
  const trkFolder = core.settings.plFolders.find(f => f.id === TRK_FOLDER_ID);
  if (trkFolder && core.settings.trkPlaylist !== false) {
    const keys = plFolderUnionKeys(TRK_FOLDER_ID);
    const n = [...keys].filter(k => plKeys.has(k)).length;
    /* 表示名は設定の3種類（full=trk's playlist／short=trk's／icon=文字なし）。アイコンは 🐔 固定 */
    if (!tabs.some(x => x.id === "fld:" + TRK_FOLDER_ID)) tabs.push({ id:"fld:" + TRK_FOLDER_ID, icon: TRK_TAB_ICON, label: trkTabLabel(), n, fld: trkFolder, trk: true });
  } else if (core.settings.trkPlaylist !== false || core.settings.trkClassic !== false) {
    /* フォルダがまだ無いとき、または 🐔 タブを隠しているときのフォールバック（旧来の2タブ）。
       ⚠ 🎻 trk classic だけを表示しているときも、ここで1つタブを出す＝クラシックが行き止まりにならない */

    if (core.settings.trkPlaylist !== false) {
      const tp = core.settings.playlists.find(p => p.id === "trk-playlist");
      if (tp && plVisible(tp) && !tabs.some(x => x.id === "pl:trk-playlist")) tabs.push({ id:"pl:trk-playlist", icon: TRK_TAB_ICON, label: trkTabLabel(), n: plCount(tp, plKeys), pl: tp, trk: true });
    }
    if (core.settings.trkClassic !== false) {
      const tc = core.settings.playlists.find(p => p.id === "trk-classic");
      if (tc && plVisible(tc) && !tabs.some(x => x.id === "pl:trk-classic")) tabs.push({ id:"pl:trk-classic", icon: plIcon(tc), label: tc.name, n: plCount(tc, plKeys), pl: tc });
    }
  }
  return tabs;
}
function libTabMatch(it, id) {
  if (it.trkOnly && id !== "pl:" + it.trkOnly) return false;   /* 🎼 trk Agent's OST：その Vol を開いたときだけ */
  if (!id || id === "all") return true;
  if (id === "fav") { const F = window.TrkFavs; return !!(F && F.inGroup("song", F.activeOf("song"), it.key)); }
  if (id.startsWith("pl:")) { const p = plById(id.slice(3)); return !!p && p.songs.includes(it.key); }
  if (id.startsWith("fld:")) return plFolderUnionKeys(id.slice(4)).has(it.key);   /* 📁 フォルダ＝中のプレイリストの曲ぜんぶ */
  if (id === "file") return it.source === "file";
  if (id === "kept") return it.source === "file" && savedSongs.some(song => song.key === it.key);
  if (id === "builtin") return it.source === "builtin";
  if (id === "verified") return it.source === "pack" && libIsVerified(it);
  if (id.startsWith("pack:")) return it.source === "pack" && "pack:" + libPackKey(it) === id;
  if (id.startsWith("addon:")) return it.source === "addon" && "addon:" + (it.addonId || "") === id;
  if (id.startsWith("folder:")) return it.source === "folder" && libFolderSeg(it) === id.slice(7);
  if (id === "folder") return it.source === "folder" && !libFolderSeg(it);
  if (id === "albums" || id === "artists") return true;   /* 💿🎤 グループ棚はぜんぶの曲を見せる（trk171・グループの無い曲は「タグなし」へ） */
  if (id === "smart") return true;   /* ⚡ スマート棚もぜんぶの曲から材料を集める（セクション側で絞る・trk172） */
  return true;
}

/* ---------- 🎧 プレイリスト（ユーザー定義の曲タブ） ----------
   ・保存は settings.playlists（shadow_taiko_preferences_v2）。曲のキーだけを持つ参照リストなので、
     プレイリストを消しても曲はライブラリに残ります（整合性を保つ・既定の挙動）
   ・🧊フリーズ＝曲の追加を防ぐ ／ 🔒ロック＝タブの削除を防ぐ（両方ならアイコンは 🧩）
     アイコンと色は自由に設定できるので、🧊今だけ／🔒あ／楽2（色で状態を示す）といった使い方ができます
   ・操作：タブの長押し＝設定（PC・スマホ共通）／タブの中クリック＝削除（📚すべての中クリック＝新規作成。
     削除は設定で「3回」モードに変えられる）／タブ帯の右端の「＋」＝新規作成
   ・曲のプロフィール（上書きタイトル・アーティスト・アルバム・作曲者）は、localStorage の
     shadow_taiko_songmeta_v1 に別枠で保存（曲の長押しから編集） */
const PL_COLORS = { none:"", aqua:"#0e6e6e", green:"#1d6b3c", amber:"#8a5a12", red:"#8a2b35",
  purple:"#5b2d8e", blue:"#1f4f8f", pink:"#8e2d64", gray:"#4a4f5a" };
const SONG_META_KEY = "shadow_taiko_songmeta_v1";
const SONG_META_MAX = 3000;   /* 🛡 曲プロフィールの上限（共有プレイリストの取り込みで増えても、ここで頭打ち） */
function songMetaClean(raw) {   /* 1件ぶんの検証：文字列だけ・長さ上限・入手先は https のみ */
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, n] of [["title", 120], ["artist", 100], ["album", 100], ["composer", 100], ["matchHint", 80]]) {
    if (typeof raw[k] === "string" && raw[k].trim()) out[k] = raw[k].trim().slice(0, n);
  }
  const url = typeof raw.srcUrl === "string" ? raw.srcUrl.trim() : "";
  if (url && /^https:\/\/\S+$/i.test(url)) out.srcUrl = url.slice(0, 300);   /* javascript: などは捨てる */
  return Object.keys(out).length ? out : null;
}
function songMetaCleanAll(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const k of Object.keys(obj).slice(0, SONG_META_MAX)) {
    if (typeof k !== "string" || k.length > 128) continue;
    const m = songMetaClean(obj[k]);
    if (m) out[k] = m;
  }
  return out;
}
let SONG_META = songMetaCleanAll((() => { try { return JSON.parse(localStorage.getItem(SONG_META_KEY)) || {}; } catch (_) { return {}; } })());
function songMetaSave() {
  if (Object.keys(SONG_META).length > SONG_META_MAX) SONG_META = songMetaCleanAll(SONG_META);
  try { localStorage.setItem(SONG_META_KEY, JSON.stringify(SONG_META)); } catch (_) {}
}
function metaOf(key) { const m = SONG_META[key]; return (m && typeof m === "object") ? m : null; }
/* A local Touhou MIDI file is often named by its stable ThemeDB ID (th06_15.mid).
   Keep the filename and metadata untouched, but show the community title anywhere the song appears. */
function touhouCatalogTitle(it) {
  const data = window.Trk && window.Trk.touhouThemeData;
  if (!data || !it) return "";
  const raw = String(it.base || it.title || (it.file && it.file.name) || "").trim();
  const id = raw.replace(/\.[a-z0-9]{1,5}$/i, "").toLowerCase();
  if (!/^(?:th\d+[a-z0-9]*|mcd|zsw|sh\d+|tmgc|alcostg|touki|thmj)_[a-z0-9_]+$/i.test(id)) return "";
  const seen = new Set();
  let key = id;
  const hasTitle = value => Object.prototype.hasOwnProperty.call(data.titles || {}, value);
  while (!hasTitle(key) && data.redirects && data.redirects[key] && !seen.has(key)) {
    seen.add(key);
    key = data.redirects[key];
  }
  return hasTitle(key) ? data.titles[key] : "";
}
/* 表示名の優先順：🎶 ユーザー設定名 → 🏷 埋め込みタグ（trk167）→ カタログ曲名 → 元ファイル名。
   ⚠ 表示と検索・並び替えだけ。カタログ照合のキー（plWish系）はファイル名側のまま＝タグは照合に影響しない */
function songDisplayTitle(it, meta = metaOf(it && it.key) || {}) {
  return meta.title || songTagField(it, "title") || touhouCatalogTitle(it) || (it && it.title) || "";
}

/* 保存されていたプレイリスト1つの検証（読み込み時に全部に通す） */
/* 📁 プレイリストフォルダ（ネスト可・深さは3階層まで） */
/* 📁 フォルダの上限（core.js の読み込み上限と同じ値・40）。trk の固定棚（🐔・Classic・BA・LoL・東方・Touhou関連・Arknights・学マス・Endfield・🎭）で10個使うので、
   利用者のぶんを十分に残す。上限に達したら**作るときに知らせ**、起動時に黙って切り捨てない（trk129：旧上限13では、利用者のフォルダが4個以上あると
   🎭棚が末尾から切り捨てられ、中のキャラクターテーマ4リストがトップへ落ちていた）。 */
const PL_FOLDER_MAX = 40;
function plFolderRoom(n = 1) { return (core.settings.plFolders || []).length + n <= PL_FOLDER_MAX; }
/* 📁 上限を超えたときの整理。trk の固定棚（id が `trk` で始まるもの）は自動で作られる棚なので先に残し、
   利用者のフォルダを**後の順から**落とす（trk129：上限13のとき、配列の末尾に足された 🎭棚が毎回落ちていた）。 */
function plFolderTrim(list) {
  if (!Array.isArray(list) || list.length <= PL_FOLDER_MAX) return list;
  const fixed = list.filter(f => String(f.id).startsWith("trk")), rest = list.filter(f => !String(f.id).startsWith("trk"));
  return fixed.concat(rest).slice(0, PL_FOLDER_MAX);
}
function plFolderSanitize(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  return { id: raw.id.slice(0, 24), name: String(raw.name || "").trim().slice(0, 24) || "Folder",
    icon: typeof raw.icon === "string" ? raw.icon.slice(0, 4) : "",
    color: /^[a-z]{3,12}$/.test(raw.color || "") && PL_COLORS[raw.color] != null ? raw.color : "none",
    parent: typeof raw.parent === "string" ? raw.parent.slice(0, 24) : "",
    createdAt: (typeof raw.createdAt === "number" && raw.createdAt > 0 && raw.createdAt < 9e15) ? raw.createdAt : 0 };
}
function plFolderById(id) { return core.settings.plFolders.find(f => f.id === id) || null; }
function plDepthOfFolder(id) {   /* 深さ（トップ=0）。循環データでも止まる */
  let d = 0, cur = plFolderById(id); const seen = new Set();
  while (cur && cur.parent && !seen.has(cur.id)) { seen.add(cur.id); d++; cur = plFolderById(cur.parent); }
  return d;
}
function plIsDescendantFolder(id, ancestorId) {   /* id が ancestorId の中（子孫）なら真。循環データでも止まる */
  let cur = plFolderById(id); const seen = new Set();
  while (cur && cur.parent && !seen.has(cur.id)) { seen.add(cur.id); if (cur.parent === ancestorId) return true; cur = plFolderById(cur.parent); }
  return false;
}
function plFolderUnionKeys(fldId, out = new Set(), seen = new Set()) {   /* フォルダの中の曲（子フォルダも再帰） */
  if (seen.has(fldId)) return out; seen.add(fldId);
  for (const p of core.settings.playlists) if (p.folder === fldId && plVisible(p)) for (const k of p.songs) out.add(k);   /* 👥 ブロック中の投稿者は数えない */
  for (const f of core.settings.plFolders) if (f.parent === fldId) plFolderUnionKeys(f.id, out, seen);
  return out;
}
function plFolderContext() {   /* いま見ている場所のフォルダ（新規作成の初期値） */
  if (core.settings.libTab.startsWith("fld:")) { const f = plFolderById(core.settings.libTab.slice(4)); return f ? f.id : ""; }
  if (core.settings.libTab.startsWith("pl:")) { const p = plById(core.settings.libTab.slice(3)); return (p && p.folder) || ""; }
  return "";
}
/* 曲名の照合キー（plNormTitle／plTitleKeys／plSongMatchKeys／plWishTitleKeys）は js/title-match.js にある */
function plWishMatch(w, byTitle) {
  for (const k of plWishTitleKeys(w)) {
    const cands = (byTitle.get(k) || []).filter(it => plWishMediaMatches(w, it));
    if (!cands || !cands.length) continue;
    if (cands.length === 1) return cands[0];
    const al = plNormTitle(w.al), ar = plNormTitle(w.ar);   /* 同名が複数ならアルバム→アーティストで当たりをつける */
    if (al) { const hit = cands.find(it => plNormTitle((metaOf(it.key) || {}).album) === al); if (hit) return hit; }
    if (ar) { const hit = cands.find(it => plNormTitle((metaOf(it.key) || {}).artist || it.artist) === ar); if (hit) return hit; }
    return cands[0];
  }
  /* 装飾付きファイル名は最後の救済。複数キーをまとめて一意か確認し、先着を選ばない。
     byクレジットはカタログのartistを含むキーだけが当たり、未知の版名は残る。 */
  const decorated = new Set();
  for (const key of plWishDecoratedKeys(w)) for (const it of byTitle.get(key) || []) if (plWishMediaMatches(w, it)) decorated.add(it);
  return decorated.size === 1 ? decorated.values().next().value : null;
}
function plSyncWishes(p, byTitle) {
  let ch = false;
  for (const w of p.wish) {
    const it = plWishMatch(w, byTitle);
    if (it && !p.songs.includes(it.key)) { p.songs.push(it.key); ch = true; }
  }
  return ch;
}
/* 🛒 「集める棚」＝ wish（カタログの曲リスト）つきプレイリスト、またはそれを含むフォルダ。
   カタログ順のまま [{w, it}] を返す（it＝もう持っている曲。まだの曲は it:null＝灰色で出す）。
   Music フォルダに入れると plSyncWishes が照合して songs に入り、次に開いたとき黒くなる。 */
function plWishFolderIds(fid) {
  const ids = new Set([fid]);
  for (const f of core.settings.plFolders) if (f.id !== fid && plIsDescendantFolder(f.id, fid)) ids.add(f.id);
  return ids;
}
function plCollectionEntries(tabId, byTitle) {
  const out = [], seen = new Set();
  const take = list => {
    for (const p of list) {
      if (!p || !p.wish || !p.wish.length) continue;
      for (const w of p.wish) {
        const key = plTitleKeys(w.t)[0] + "|" + plNormTitle(w.al) + "|" + plNormTitle(w.ar);
        if (seen.has(key)) continue;   /* Vol やシリーズをまたいで同じ曲があっても1回だけ */
        seen.add(key);
        out.push({ w, it: plWishMatch(w, byTitle) });
      }
    }
  };
  if (tabId.startsWith("pl:")) { const p = plById(tabId.slice(3)); if (p) take([p]); }
  else if (tabId.startsWith("fld:")) {
    const ids = plWishFolderIds(tabId.slice(4));
    take(trkOrderedPlaylists(core.settings.playlists.filter(p => ids.has(p.folder) && plVisible(p))));
  }
  return out;
}
/* 📡 まだ持っていない曲の行（灰色）。タップで公式の入手先を開く（リンクが無ければ案内） */
function plWishRow(w) {
  const r = el("button", "libRow plWishRow"); r.type = "button";
  /* ⚠ el(tag, cls, text) は文字を1つしか取らない。入れ子は append で組む
     （以前は "[object HTMLSpanElement]" と表示されていた） */
  const left = el("span", "libLeft");
  left.append(el("span", "libName", "🛒 " + w.t),
    el("span", "libSub", [w.ar, w.al, tr("plWishTag")].filter(Boolean).join(" · ")));
  r.append(left, el("i", "libTag", w.u ? "🔗" : "📡"));
  r.title = w.u ? tr("plWishOpen") : tr("plWishNoLink");
  r.setAttribute("aria-label", w.t + " — " + r.title);
  r.addEventListener("click", () => { if (w.u) plOpenLink(w.u); else plToast(tr("plWishNoLink")); });
  return r;
}



function plSanitize(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  const songs = [];
  if (Array.isArray(raw.songs)) for (const k of raw.songs) {
    if (typeof k === "string" && k.length <= 128 && !songs.includes(k)) songs.push(k);
    if (songs.length >= 1000) break;
  }
  return { id: raw.id.slice(0, 24), name: String(raw.name || "").trim().slice(0, 24) || "Playlist",
    icon: typeof raw.icon === "string" ? raw.icon.slice(0, 4) : "",
    color: /^[a-z]{3,12}$/.test(raw.color || "") && PL_COLORS[raw.color] != null ? raw.color : "none",
    frozen: !!raw.frozen, locked: !!raw.locked, songs,
    folder: typeof raw.folder === "string" ? raw.folder.slice(0, 24) : "",
    tags: (Array.isArray(raw.tags) ? raw.tags : []).filter(t => typeof t === "string").map(t => t.trim().slice(0, 16)).filter(Boolean).slice(0, 5),
    wish: (Array.isArray(raw.wish) ? raw.wish : []).filter(w => w && typeof w === "object" && w.t).slice(0, 100).map(w => {
      const out = { t: String(w.t).trim().slice(0, 120), al: String(w.al || "").trim().slice(0, 80), ar: String(w.ar || "").trim().slice(0, 80),
        u: /^https:\/\/\S+$/i.test(w.u || "") ? String(w.u).slice(0, 300) : "" };
      if (Array.isArray(w.matchAliases)) {
        const aliases = [...new Set(w.matchAliases.filter(a => typeof a === "string").map(a => a.trim().slice(0, 120)).filter(Boolean))].slice(0, 8);
        if (aliases.length) out.matchAliases = aliases;
      }
      if (w.matchMedia === "audio" || w.matchMedia === "video") out.matchMedia = w.matchMedia;
      return out;
    }),   /* 🛒 未入手の欲しい曲 */
    guide: (raw.guide && typeof raw.guide === "object") ? plGuideSanitize(raw.guide) : null,   /* 📄 入手先ガイド（trkCatalogGuide の近く） */
    cat: typeof raw.cat === "string" && /^[a-z0-9:-]{1,40}$/i.test(raw.cat) ? raw.cat : "",
    by: typeof raw.by === "string" ? raw.by.trim().slice(0, 24) : "",   /* 👤 投稿者（共有プレイリスト由来） */
    createdAt: (typeof raw.createdAt === "number" && raw.createdAt > 0 && raw.createdAt < 9e15) ? raw.createdAt : 0 };
}
const TRK_PLAYLIST_ID = "trk-playlist";
const TRK_FOLDER_ID = "trk";
const TRK_CLASSIC_ID = "trk-classic";
const TRK_OST_ID = "trk-ost-v1";   /* 🎓 オリジナル曲リスト（チュートリアルのデモ曲もここに入る。タブは一番下） */
const TRK_LIST_MAX = 200;          /* 🐔 プレイリストの上限（plTighten と同じ） */
/* 🐔 trk's playlist ＝ 右端のタブ（実体は trk フォルダ）。
   ・名前（タブの文字）は settings.trkTabName の3種類から選ぶ。空文字＝🐔 のアイコンだけ
   ・アイコン（🐔）と色（標準）とフォルダ名は固定＝利用者は変えられない（plFolderMenu も開かせない）
   ・長押しはプロフィール編集ではなく「階層（Vol 一覧）を開く」に固定する（plTrkMenu） */
const TRK_TAB_ICON = "🐔";
const TRK_FOLDER_NAME = "trk's playlist";
/* 許可リストは core.js の TRK_ENUM_VALUES.trkTabName（設定Importでも同じものを使う） */
const TRK_TAB_NAME_MODES = (typeof TRK_ENUM_VALUES === "object" && core.TRK_ENUM_VALUES && Array.isArray(core.TRK_ENUM_VALUES.trkTabName))
  ? core.TRK_ENUM_VALUES.trkTabName : ["full", "short", "icon"];
function trkNameMode() {
  const v = core.settings.trkTabName;
  return (v === "short" || v === "icon") ? v : "full";
}
function trkTabLabel() {   /* タブに出す文字（"icon" のときは空＝アイコンだけ） */
  const m = trkNameMode();
  if (m === "icon") return "";
  try { return tr(m === "short" ? "trkTabNameShort" : "trkTabNameFull"); } catch (_) { return m === "short" ? "trk's" : TRK_FOLDER_NAME; }
}
function trkCatalog() {   /* 🛒 カタログ本体（catalog.js の const。⚠ window には載らないので、素の名前で読む） */
  try { return (typeof TRK_CATALOG !== "undefined" && Array.isArray(TRK_CATALOG)) ? TRK_CATALOG : []; } catch (_) { return []; }
}
function trkFolderNormalize() {   /* 保存データ側も固定名・固定アイコン・色なしにそろえる（旧名の 🐔 二重表示も直る） */
  const f = core.settings.plFolders.find(x => x.id === TRK_FOLDER_ID);
  if (!f) return null;
  let ch = false;
  if (f.name !== TRK_FOLDER_NAME) { f.name = TRK_FOLDER_NAME; ch = true; }
  if (f.icon !== TRK_TAB_ICON) { f.icon = TRK_TAB_ICON; ch = true; }
  if (f.color !== "none") { f.color = "none"; ch = true; }
  if (f.parent) { f.parent = ""; ch = true; }
  if (ch) core.saveUserPrefs();
  return f;
}
function ensureTrkSubfolder(id, name, icon, parent) {
  let f = core.settings.plFolders.find(x => x.id === id);
  if (f) return f;
  f = plFolderSanitize({ id, name, icon, color: "none", parent: parent || TRK_FOLDER_ID });
  if (!f) return null;
  core.settings.plFolders.push(f);
  core.saveUserPrefs();
  return f;
}
/* 🐔 の下に置く固定の棚。ensureTrkFolder() がいっせいに作り、カタログから1本だけ作るときは
   そのリストに要る棚だけを作る（trk217）。 */
const TRK_SHELVES = [
  { id: "trk-classic", name: "Classic", icon: "🎻" },
  { id: "trk-ba", name: "Blue Archive", icon: "🎮" },
  { id: "trk-lol", name: "League of Legends", icon: "⚔️" },
  { id: "trk-touhou", name: "Touhou", icon: "⛩️" },
  { id: "trk-touhou-other", name: "Related games (not Touhou)", icon: "🪐" },
  { id: "trk-arknights", name: "Arknights", icon: "🎮" },
  { id: "trk-gakumas", name: "Gakum@s", icon: "🎤" },
  { id: "trk-endfield", name: "Endfield", icon: "🛰️" },
  { id: "trk-endfield-character", name: "Endfield Character Theme", icon: "🎭", parent: "trk-endfield" },   /* 🎭 キャラクターテーマ曲の棚（trk128） */
];
function ensureTrkFolder() {
  let f = core.settings.plFolders.find(x => x.id === TRK_FOLDER_ID);
  if (!f) {
    f = plFolderSanitize({ id: TRK_FOLDER_ID, name: TRK_FOLDER_NAME, icon: TRK_TAB_ICON, color: "none", parent: "" });
    if (f) { core.settings.plFolders.push(f); core.saveUserPrefs(); }
  }
  /* 🐔 trk217：カタログから1本だけ作るときは、棚は 🐔 だけ。シリーズの棚は要るときに作る */
  if (trkSelectedFoldersOnly) return f;
  for (const sh of TRK_SHELVES) ensureTrkSubfolder(sh.id, sh.name, sh.icon, sh.parent);
  trkFolderNormalize();   /* 旧データの「🐔 trk's playlist」もここで固定名に直す */
  return core.settings.plFolders.find(x => x.id === TRK_FOLDER_ID) || f || null;
}
function trkWishFromTrack(tt) {
  const cleanText = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  const rawUrl = typeof tt.u === "string" ? tt.u : "";
  const wish = { t: cleanText(tt.t, 120), al: cleanText(tt.al, 80), ar: cleanText(tt.ar, 80),
    u: /^https:\/\/\S+$/i.test(rawUrl) ? rawUrl.slice(0, 300) : "" };
  if (Array.isArray(tt.matchAliases)) {
    const aliases = [...new Set(tt.matchAliases.filter(alias => typeof alias === "string")
      .map(alias => alias.trim().slice(0, 120)).filter(Boolean))].slice(0, 8);
    if (aliases.length) wish.matchAliases = aliases;
  }
  if (tt.matchMedia === "audio" || tt.matchMedia === "video") wish.matchMedia = tt.matchMedia;
  return wish;
}
function trkWishesFromCatalog() {
  const cat = trkCatalog();
  const out = [];
  for (const s of cat) {
    if (s.id === "classical") continue; // 🎻 classicは別枠 trk classicへ
    for (const pl of (s.playlists || [])) {
      for (const tt of (pl.songs || [])) {
        out.push(trkWishFromTrack(tt));
        if (out.length >= 100) return out;
      }
      if (out.length >= 100) return out;
    }
    if (out.length >= 100) return out;
  }
  return out;
}
function trkClassicWishesFromCatalog() {
  const cat = trkCatalog();
  const out = [];
  for (const s of cat) {
    if (s.id !== "classical") continue;
    for (const pl of (s.playlists || [])) {
      for (const tt of (pl.songs || [])) {
        out.push(trkWishFromTrack(tt));
        if (out.length >= 100) return out;
      }
      if (out.length >= 100) return out;
    }
    if (out.length >= 100) return out;
  }
  return out;
}
/* チュートリアル完了時に Game Vol.1／Classic Vol.1 を自動で作るか。false＝作らない（手動の作成・♻ の戻しは使える） */
const TRK_AUTO_GAME_CLASSIC = false;
/* 🐔 trk217：設定のリスト選択（カタログ）から1本だけ作るときに立てる。
   この間の ensureTrkFolder() は 🐔 の棚だけを用意し、シリーズの棚（🎮 ブルアカ…）をまとめて作らない
   （trk-apk の apkTrkSelectedFoldersOnly と同じ考え方）。 */
let trkSelectedFoldersOnly = false;
function ensureTrkPlaylist(opts) {
  const o = opts || {};
  const doToast = o.toast !== false;
  const go = !!o.go;
  if (core.settings.trkPlaylist === false) return false;
  if (trkIsRemoved(TRK_PLAYLIST_ID)) return false;   /* 🗑 利用者が消したものは作り直さない（⚙で戻せる） */
  if (core.settings.playlists.some(function(p){ return p.id === TRK_PLAYLIST_ID; })) return false;
  ensureTrkFolder();
  const wishes = trkWishesFromCatalog();
  if (!wishes.length) return false;
  const p = plSanitize({ id: TRK_PLAYLIST_ID, name: "Game Vol.1", icon: "\uD83D\uDC14", color: "none", folder: TRK_FOLDER_ID, tags: ["Game","Vol.1"], wish: wishes, songs: [], guide: trkGuide("plGuideGameVol1", TRK_PUBLIC_PAGE_URL), cat: "trk:all", createdAt: Date.now() });
  if (!p) return false;
  core.settings.playlists.push(p);
  core.saveUserPrefs();
  if (doToast) try { plToast(tr("trkAdded", { n: wishes.length })); } catch(_){}
  if (go) { core.settings.libTab = "pl:" + TRK_PLAYLIST_ID; core.saveUserPrefs(); try { renderLib(); } catch(_){} }
  return true;
}
function ensureTrkClassicPlaylist(opts) {
  const o = opts || {};
  const doToast = o.toast !== false;
  const go = !!o.go;
  if (core.settings.trkClassic === false) return false;
  if (trkIsRemoved(TRK_CLASSIC_ID)) return false;   /* 🗑 利用者が消したものは作り直さない（⚙で戻せる） */
  if (core.settings.playlists.some(function(p){ return p.id === TRK_CLASSIC_ID; })) return false;
  ensureTrkFolder();
  const wishes = trkClassicWishesFromCatalog();
  if (!wishes.length) return false;
  const p = plSanitize({ id: TRK_CLASSIC_ID, name: "Classic Vol.1", icon: "\uD83C\uDFBB", color: "none", folder: "trk-classic", tags: ["Classic","Vol.1"], wish: wishes, songs: [], guide: trkGuide("plGuideClassic", "https://musopen.org/"), cat: "trk:classic", createdAt: Date.now() });
  if (!p) return false;
  core.settings.playlists.push(p);
  core.saveUserPrefs();
  if (doToast) try { plToast(tr("trkClassicAdded", { n: wishes.length })); } catch(_){}
  if (go) { core.settings.libTab = "pl:" + TRK_CLASSIC_ID; core.saveUserPrefs(); try { renderLib(); } catch(_){} }
  return true;
}
/* 🎓 trk's OST Vol.1 — オリジナル曲とチュートリアルのデモ曲をまとめるプレイリスト。
   🐔 trk's playlist の中（Game Vol.1 の下）に置く。開いたタブは libOpenTabs で残るため
   行き止まりにならず、削除はタブの ⚙（長押し）設定から行える（曲はライブラリに残る）。
   消したら settings.trkRemoved に印が残り、次の起動でも作り直さない（🐔 の設定の ♻ で戻せる）。 */
const TRK_OST_CAT = "trk:ost";   /* 作成・移行済みの印。これが付いたら、利用者が動かした場所を守る */
const TRK_OST_GUIDE_URL = "";
const TRK_OLD_OST_GUIDE_URL = "https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library/releases";
const TRK_OLD_OST_GUIDE_NOTE = "🎵 trk's OST Vol.1は別配布です。music-libraryのReleasesから.stpackをダウンロードし、「📂 パックを選ぶ」で読み込むと曲が並びます（端末内に保存・自動通信なし・CC BY 4.0）。";
function ensureTrkOstPlaylist(opts) {
  const o = opts || {};
  const doToast = o.toast !== false;
  const exist = core.settings.playlists.find(p => p.id === TRK_OST_ID);
  if (exist) {
    /* 旧版（trk112）が最上位に作ったものだけ、一度だけ trk フォルダへ移す。trk113 までは毎回戻していたので、
       印（cat）が無いものは一度だけ見直し、以後は移動・削除をそのまま守る。 */
    if (exist.cat !== TRK_OST_CAT) {
      if (!exist.folder) { ensureTrkFolder(); exist.folder = TRK_FOLDER_ID; }
      exist.cat = TRK_OST_CAT;
      core.saveUserPrefs();
    }
    /* trk185: 別配布の案内が無い既存リストへガイドを足す（利用者が付けたガイドは触らない） */
    if (!exist.guide) { exist.guide = trkGuide("plGuideTrkOst", TRK_OST_GUIDE_URL); core.saveUserPrefs(); }
    try { syncTrkOstPackSongs(); } catch (_) {}   /* 公式OSTパック導入済みなら曲もつなぐ */
    return false;
  }
  if (trkIsRemoved(TRK_OST_ID)) return false;
  ensureTrkFolder();
  const p = plSanitize({ id: TRK_OST_ID, name: "trk's OST Vol.1", icon: "\uD83C\uDF93", color: "none",
    folder: TRK_FOLDER_ID, tags: ["trk", "OST"], wish: [], songs: [FIRST_SPARK_KEY],
    guide: trkGuide("plGuideTrkOst", TRK_OST_GUIDE_URL), cat: TRK_OST_CAT, createdAt: Date.now() });
  if (!p) return false;
  core.settings.playlists.push(p);
  core.saveUserPrefs();
  try { syncTrkOstPackSongs(); } catch (_) {}   /* 公式OSTパック導入済みなら曲もつなぐ */
  if (doToast) try { plToast(tr("trkAdded", { n: p.songs.length })); } catch(_){}
  return true;
}
window.TrkEnsureTrkPlaylist = ensureTrkPlaylist;
window.TrkTrkPlaylistId = TRK_PLAYLIST_ID;
window.TrkEnsureTrkClassicPlaylist = ensureTrkClassicPlaylist;
window.TrkClassicId = TRK_CLASSIC_ID;
/* 🌐 trk114 より前に作った Game Vol.1／Classic Vol.1／旧 Vol.1 のガイドに、表示用の key を足す（URL はそのまま）。
   カタログ由来のリストは ensureTrkDistributionPlaylists の更新で key が付く。 */
function trkGuideBackfill() {
  let changed = false;
  for (const p of core.settings.playlists) {
    if (!p.guide || p.guide.key) continue;
    const key = p.id === TRK_PLAYLIST_ID ? "plGuideGameVol1" : p.id === TRK_CLASSIC_ID ? "plGuideClassic"
      : /^trk-(?:ba|touhou|arknights)-v1$/.test(p.id) && /^trk:[a-z]+$/.test(p.cat || "") ? "plGuideIntro" : "";
    if (!key) continue;
    p.guide = trkGuide(key, p.guide.url);
    changed = true;
  }
  if (changed) core.saveUserPrefs();
}
function trkOrderedPlaylists(list) {
  if (core.settings.trkSortABC) return list.slice().sort((a,b) => a.name.localeCompare(b.name, 'ja'));
  const order = core.settings.playlistOrder || [];
  if (!order.length) return list.slice().sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
  const idx = new Map(order.map((id,i)=>[id,i]));
  return list.slice().sort((a,b) => {
    const ai = idx.has(a.id) ? idx.get(a.id) : 1e9;
    const bi = idx.has(b.id) ? idx.get(b.id) : 1e9;
    if (ai !== bi) return ai - bi;
    return (a.createdAt||0)-(b.createdAt||0);
  });
}
/* ↕ 並べ替え：見えている並び（peers＝その画面で隣に並ぶプレイリストのID、表示順）の中で隣と入れ替える。
   playlistOrder は全体で1本なので、まず🐔の今の表示順を全部書き出し（未登録分も含む）、その中で2件の位置を交換する。
   🐔の階層メニューはフォルダごとのグループで並ぶので、「全体の隣」と入れ替えると画面が変わらない（空振り）。
   消えたプレイリストのID（削除済み）もここで落とし、入れ替え相手にならないようにする（trk130）。 */
function trkMovePlaylist(id, dir, peers) {
  const exist = new Set(core.settings.playlists.map(p => p.id));
  const inTrk = trkFolderIdSet();
  const ids = trkOrderedPlaylists(core.settings.playlists.filter(p => inTrk.has(p.folder))).map(p => p.id);
  const group = (Array.isArray(peers) && peers.length ? peers : ids).filter(x => exist.has(x));
  const gi = group.indexOf(id), other = gi < 0 ? undefined : group[gi + dir];
  if (other === undefined) return;
  const a = ids.indexOf(id), b = ids.indexOf(other);
  if (a < 0 || b < 0) return;
  [ids[a], ids[b]] = [ids[b], ids[a]];
  const rest = (core.settings.playlistOrder || []).filter(x => exist.has(x) && !ids.includes(x));
  core.settings.playlistOrder = ids.concat(rest).slice(0, 200);
  core.saveUserPrefs();
  renderLib();
  try { if (typeof renderTrkSettings === "function") renderTrkSettings(); } catch(_){}
}
/* ↕ ボタンの有効・無効（ABC順のとき、並びの端のとき） */
function trkMoveButtonsState(up, down, i, n) {
  const abc = !!core.settings.trkSortABC;
  up.disabled = abc || i <= 0; down.disabled = abc || i >= n - 1;
  if (abc) { up.style.opacity = ".45"; down.style.opacity = ".45"; }
}
window.ensureTrkDistributionPlaylists = ensureTrkDistributionPlaylists;

function trkWishesForSeries(seriesId) {
  const cat = trkCatalog();
  const out = [];
  for (const s of cat) {
    if (s.id !== seriesId) continue;
    for (const pl of (s.playlists || [])) {
      for (const tt of (pl.songs || [])) {
        out.push(trkWishFromTrack(tt));
      }
    }
  }
  return out;
}
function trkCatalogGuide(s, pl, forDistributionPlaylist = false) {
  const isGakumasInstrument = s.id === "gakumas" && pl && (pl.id === "gm-inst" || pl.id === "gm-inst2");
  const isGakumasDiscography = s.id === "gakumas" && pl && pl.id === "gm-releases";
  const isTouhou = s.id === "touhou";
  const key = s.id === "bluearchive" && pl && pl.id === "ba-mika" ? "plGuideBlueArchiveMika"
    : s.id === "bluearchive" && pl && pl.sourceUrl ? "plGuideBlueArchive"
    : (s.id === "lol" || s.id === "valorant" || s.id === "riot-games") && pl ? (Object.prototype.hasOwnProperty.call(RIOT_GUIDE_KEYS, pl.creatorSafe) ? RIOT_GUIDE_KEYS[pl.creatorSafe] : "plGuideRiotLinks")
      : isGakumasInstrument ? "plGuideGakumasInst"
        : isGakumasDiscography ? "plGuideGakumasDisco"
          : isTouhou ? "touhouPlaylistGuide"
            : s.id === "zun-other" ? "zunOtherPlaylistGuide"
              : s.id === "valorant" ? "plGuideRiotLinks"
                : s.id === "genshin" ? "plGuideGenshin"
                  : s.id === "oj" || s.id === "samfree" ? "plGuideFruitbat"
                    : s.id === "arknights" ? "plGuideArknights"
                      : s.id === "endfield" ? "plGuideEndfield"
                        : s.id === "classical" ? "plGuideClassic"
                          : s.id === "ncs" ? "plGuideNcs"
                            : s.id === "macleod" ? "plGuideMacleod"
                              : forDistributionPlaylist ? "plGuideIntro" : "";
  /* 鍵の無いシリーズ（MODで足したもの等）は、従来どおりカタログの説明文を控えに使う */
  const note = key ? plGuideJa(key) : (s.note || "");
  /* GakumasはDrive置場と規約ページを分離。VALORANTの設定ガイドはCreator-Safeへ直接案内。 */
  const guideUrl = isTouhou
    ? "https://github.com/DTM9025/musicroom/releases/latest"
    : (s.id === "gakumas" || s.id === "valorant")
      ? (s.url || "")
      : (pl && pl.sourceUrl) || s.url || TRK_PUBLIC_PAGE_URL;
  return plGuideSanitize({ note, url: guideUrl, key });
}
/* 📄 入手先ガイドの検証（plSanitize と trkCatalogGuide の共通）。key は表示時に今の言語で引くための辞書キーで、
   許可するのは plGuide…／touhouPlaylistGuide／zunOtherPlaylistGuide だけ。note は日本語の控え
   （旧版・設定の書き出し用。表示は key が優先）。同じ形に通すので、起動ごとの比較で無駄な書き直しが起きない。
   ⚠ check-repo は trkCatalogGuide〜plTighten を切り出して vm で動かすので、ガイドの部品はこの範囲に置く。 */
function plGuideSanitize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const guide = { note: String(raw.note || "").trim().slice(0, 160),
    url: /^https:\/\/\S+$/i.test(raw.url || "") ? String(raw.url).slice(0, 300) : "" };
  if (typeof raw.key === "string" && /^(?:plGuide[A-Za-z0-9]{1,40}|touhouPlaylistGuide|zunOtherPlaylistGuide)$/.test(raw.key)) guide.key = raw.key;
  return guide;
}
function plGuideJa(key) {
  return (typeof TEXT !== "undefined" && TEXT.ja && typeof TEXT.ja[key] === "string") ? TEXT.ja[key] : "";
}
function trkGuide(key, url) { return plGuideSanitize({ note: plGuideJa(key), url, key }); }
function repairDefaultTrkGuideLinks() {
  let changed = false;
  const game = core.settings.playlists.find(p => p.id === TRK_PLAYLIST_ID);
  if (game && game.guide && game.guide.key === "plGuideGameVol1" && game.guide.url === TRK_OLD_PROJECT_URL &&
      game.guide.note === TRK_OLD_GAME_GUIDE_NOTE) {
    game.guide = trkGuide("plGuideGameVol1", TRK_PUBLIC_PAGE_URL);
    changed = true;
  }
  const ost = core.settings.playlists.find(p => p.id === TRK_OST_ID);
  if (ost && ost.guide && ost.guide.key === "plGuideTrkOst" && ost.guide.url === TRK_OLD_OST_GUIDE_URL &&
      ost.guide.note === TRK_OLD_OST_GUIDE_NOTE) {
    ost.guide = trkGuide("plGuideTrkOst", TRK_OST_GUIDE_URL);
    changed = true;
  }
  if (changed) core.saveUserPrefs();
  return changed;
}
/* LoL・VALORANT・LoL関連ゲーム（riot-games）は catalog.js の LOL_CREATOR_SAFE／VAL_CREATOR_SAFE／RIOT_GAMES_CREATOR_SAFE
   （プレイリストごとの Creator-Safe 照合状態）から文言を選ぶ。照合していないものを「対象」と書かない。表に無い状態は公式リンク集の文言（要確認）にする。 */
const RIOT_GUIDE_KEYS = Object.freeze({ verified: "plGuideLolCsVerified", partial: "plGuideLolCsPartial",
  unverified: "plGuideLolCsUnverified", "links-verified": "plGuideRiotLinksVerified", "links-partial": "plGuideRiotLinksPartial",
  "links-absent": "plGuideRiotLinksAbsent", mixed: "plGuideLolPopular" });
/* 🗑 消した trk の自動リストの印（settings.trkRemoved。IDの配列）。印のあるIDは起動時に作り直さない。
   🐔 の設定の「♻ 消したリストを戻す」か、Game Vol.1／Classic Vol.1 の「開く」ボタンで印を外す。 */
function trkIsRemoved(id) {
  const list = core.settings.trkRemoved;
  return Array.isArray(list) && list.includes(id);
}
/* 🎭 Endfieldのキャラクターテーマ曲（trk128）：カタログの4リストはネスト棚に作り、既存取り込みもそこに移す。 */
const ENDFIELD_CHARACTER_FOLDER = "trk-endfield-character";
const ENDFIELD_CHARACTER_PL = new Set(["ef-blurring", "ef-ashen", "ef-floaty", "ef-makers"]);
/* 🛰️ 初号指令OSTの旧既定名（trk110〜trk128）。削除予定日：2027-01-14（docs/MIGRATIONS.md）。
   保存名は plSanitize が24文字に切るので、フル名と切れた形の両方を持つ。
   切れた形はVol.1とVol.2で同じ（「初号指令 (上/下) ― Zeroth Direct」・「Endfield — Zeroth Direct」）だが、
   照合はIDごとに別々の表なので取り違えない。利用者が自分で付けた名前はここに無いので触らない（trk129）。 */
const ENDFIELD_FIRSTORDER_OLD_NAMES = Object.freeze({
  "ef-firstorder": ["Endfield — 初号指令 OST",
    "Endfield — Zeroth Directive OST Vol.1（初号指令・上）", "Endfield — Zeroth Direct",
    "初号指令 (上) ― Zeroth Directive Original Soundtrack Vol.1", "初号指令 (上) ― Zeroth Direct"],
  "ef-firstorder2": ["Endfield — Zeroth Directive OST Vol.2（初号指令・下）", "Endfield — Zeroth Direct",
    "初号指令 (下) ― Zeroth Directive Original Soundtrack Vol.2", "初号指令 (下) ― Zeroth Direct"]
});
/* 🪽 ミカの旧3リスト（trk157〜158）を1つの「聖園ミカ」（trk-ba-mika）へ統合する。削除予定日：2027-01-14（docs/MIGRATIONS.md）。 */
const BA_MIKA_LEGACY_PL = Object.freeze({
  ids: ["trk-ba-mika-kiss", "trk-ba-mika-aria", "trk-ba-mika-vocals"],
  cats: ["trk:bluearchive:ba-mika-kiss", "trk:bluearchive:ba-mika-aria", "trk:bluearchive:ba-mika-vocals",
    "bluearchive:ba-mika-kiss", "bluearchive:ba-mika-aria", "bluearchive:ba-mika-vocals"],
  names: ["ミカ — kiss angel", "ミカ — Aria to the Star", "ミカ — ソロ＆参加曲"],
  tags: [
    JSON.stringify(["Blue Archive", "Mika", "CN", "PV", "Vocal"]),
    JSON.stringify(["Blue Archive", "Mika", "KR", "Musical", "PV"]),
    JSON.stringify(["Blue Archive", "Mika", "JP", "Vocal", "PV"])
  ]
});
/* 🛰️ Endfield整頓（trk128・一回限り）：公式リストを「初号指令OST 上下を最上 → 公式アルバム6作をリリース順」に並べ直し、
   キャラクターテーマ曲4リスト（Blurring・ASHEN REMAINS・The Floaty Envelope・MAKER'S LUV）を
   ネスト棚 trk-endfield-character（「Endfield Character Theme」）へ動かす。
   settings.trkEndfieldTidy1 が付いたら以後は利用者の並び・配置を守る（二度と触らない）。
   名前・アイコン・タグ・所持曲は触らない（既定の旧名からの改名は上のセーフリフレッシュが担当）。
   削除予定日：2027-01-14（docs/MIGRATIONS.md）。 */
function trkEndfieldTidyOnce() {
  const s = core.settings;
  if (s.trkEndfieldTidy1) return;
  const series = trkCatalog().find(x => x.id === "endfield");
  if (!series || !(series.playlists || []).length) return;   /* カタログが無い起動では印をつけない */
  const want = series.playlists.map(pl => "trk-" + pl.id);   /* 新しいカタログ順 */
  const wantSet = new Set(want);
  const ordered = want.map(id => s.playlists.find(p => p.id === id)).filter(Boolean);
  if (!ordered.length) return;                               /* 整える対象がまだ無い */
  let changed = false;
  /* ① キャラクターテーマ → ネスト棚（まだ既定場所 trk-endfield にあるものだけ） */
  for (const p of ordered) {
    if (ENDFIELD_CHARACTER_PL.has(p.id.slice(4)) && p.folder === "trk-endfield") { p.folder = ENDFIELD_CHARACTER_FOLDER; changed = true; }
  }
  /* ② 配列順（Endfieldタブのチップ行）を、最初のEndfield位置に新しい順で置き直す */
  const curSeq = s.playlists.filter(p => wantSet.has(p.id));
  if (curSeq.length !== ordered.length || curSeq.some((p, i) => p.id !== ordered[i].id)) {
    const first = s.playlists.findIndex(p => wantSet.has(p.id));
    const rest = s.playlists.filter(p => !wantSet.has(p.id));
    s.playlists = rest.slice(0, first).concat(ordered, rest.slice(first));
    changed = true;
  }
  /* ③ 手動並べ替え（playlistOrder）があれば、その中のEndfield部分だけ新しい順に入れ替える */
  if (Array.isArray(s.playlistOrder) && s.playlistOrder.length) {
    const curSub = s.playlistOrder.filter(id => wantSet.has(id));
    if (curSub.length && curSub.some((id, i) => id !== ordered[i].id)) {
      const out = [];
      let done = false;
      for (const id of s.playlistOrder) {
        if (wantSet.has(id)) { if (!done) { for (const p of ordered) out.push(p.id); done = true; } }
        else out.push(id);
      }
      if (!done) for (const p of ordered) out.push(p.id);
      s.playlistOrder = out.slice(0, 200);
      changed = true;
    }
  }
  /* ④ 既定の並べ（createdAt）でも同じ順になるようにする（trkOrderedPlaylists用） */
  const base = Math.min(Date.now(), ...ordered.map(p => p.createdAt || 0));
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].createdAt !== base + i) { ordered[i].createdAt = base + i; changed = true; }
  }
  s.trkEndfieldTidy1 = 1;
  if (changed) core.saveUserPrefs();
}
/* 🎭 棚の戻し（trk129・一回限り）：trk128 のフォルダ上限13は、利用者が自分のフォルダを4個以上持っていると、
   配列の末尾に足された 🎭棚（trk-endfield-character）を起動のたびに切り捨て、そのとき中にあったキャラクターテーマ4リストを
   トップ（入れ物なし）へ落としていた。起動のたびに棚を作り直すので、`trkEndfieldTidy1` が付いた後は元に戻らず、
   利用者のフォルダも末尾から消えていた（消えたフォルダ自体は戻せない）。
   上限を40にしても、すでに落ちた配置は戻らないので、**こわれた形のときだけ**動かし直す:
   ①trk128 の整頓を通っている（＝この壊れ方が作られうる）②キャラクターテーマのリストが残っている
   ③そのどれもがどこにも入っていない（folder が空。利用者が自分で置いたものは触らない）
   ④🎭棚が空。当てはまれば棚を作り直して戻す。印（settings.trkEndfieldTidy2）が付いたら以後は二度と触らない。
   削除予定日：2027-01-14（docs/MIGRATIONS.md）。 */
function trkEndfieldShelfRestoreOnce() {
  const s = core.settings;
  if (!s || s.trkEndfieldTidy2 || !s.trkEndfieldTidy1) return;
  s.trkEndfieldTidy2 = 1;   /* 見た結果にかかわらず印を残す（利用者が後から動かした配置を勝手に戻さない） */
  const listOf = id => (Array.isArray(s.playlists) ? s.playlists.find(p => p.id === "trk-" + id) : null);
  const found = [...ENDFIELD_CHARACTER_PL].map(listOf).filter(Boolean);
  const fellToTop = found.length > 0 && found.every(p => p.folder === "" && p.cat === "trk:endfield:" + p.id.slice(4));
  const shelfEmpty = !(s.playlists || []).some(p => p.folder === ENDFIELD_CHARACTER_FOLDER);
  if (fellToTop && shelfEmpty && Array.isArray(s.plFolders)) {
    if (!s.plFolders.some(f => f.id === ENDFIELD_CHARACTER_FOLDER)) {
      s.plFolders.push({ id: ENDFIELD_CHARACTER_FOLDER, name: "Endfield Character Theme", icon: "🎭", color: "none", parent: "trk-endfield", createdAt: 0 });
    }
    for (const p of found) p.folder = ENDFIELD_CHARACTER_FOLDER;
  }
  core.saveUserPrefs();
}
/* 🐔 trk217：カタログのリストを「作る」のと「既にある物を最新に保つ」のを分ける。
   create:false＝作らない（起動時はこちら。旧データの移行・曲目の更新だけ行う）。
   create:true ＝まだ無いものも作る（設定のリスト選択から1本だけ作るとき）。 */
const TRK_SERIES_FOLDER = { bluearchive: "trk-ba", lol: "trk-lol", touhou: "trk-touhou", "zun-other": "trk-touhou-other", arknights: "trk-arknights", gakumas: "trk-gakumas", endfield: "trk-endfield" };
/* 🐔 そのシリーズのリストを入れる棚（🎭 Endfield のキャラクターテーマだけは別の棚） */
function trkShelfFor(seriesId, playlistId) {
  if (seriesId === "endfield" && ENDFIELD_CHARACTER_PL.has(playlistId)) return ENDFIELD_CHARACTER_FOLDER;
  return TRK_SERIES_FOLDER[seriesId] || "";
}
function ensureTrkDistributionPlaylists(opts) {
  const create = !opts || opts.create !== false;
  ensureTrkFolder();
  const cat = trkCatalog();
  let changed = false;
  for (const s of cat) {
    /* Only these series are auto-created under trk. Manually imported catalog entries
       from all other series still get safe metadata refreshes below. */
    const seriesFolder = TRK_SERIES_FOLDER[s.id] || "";
    for (const pl of (s.playlists || [])) {
      /* 🎭 Endfield のキャラクターテーマ曲4リストはネスト棚へ（trk128） */
      const folder = (s.id === "endfield" && ENDFIELD_CHARACTER_PL.has(pl.id)) ? ENDFIELD_CHARACTER_FOLDER : seriesFolder;   /* trkShelfFor と同じ規則 */
      const baseId = "trk-" + pl.id;
      const wishes = (pl.songs || []).map(trkWishFromTrack);
      const sourceCats = new Set([s.id + ":" + pl.id, "trk:" + s.id + ":" + pl.id,
        ...(s.id === "bluearchive" && pl.id === "ba-mika" ? BA_MIKA_LEGACY_PL.cats : [])]);
      const guide = trkCatalogGuide(s, pl);
      if (s.id === "bluearchive" && pl.id === "ba-mika") {
        const legacyMika = core.settings.playlists.filter(p => BA_MIKA_LEGACY_PL.ids.includes(p.id));
        if (legacyMika.length) {
          const target = core.settings.playlists.find(p => p.id === baseId) || legacyMika[0];
          const mergedSongs = [...new Set([target, ...legacyMika].flatMap(p => Array.isArray(p.songs) ? p.songs : []))];
          const customName = [target, ...legacyMika].map(p => p.name).find(n => n && n !== pl.name && !BA_MIKA_LEGACY_PL.names.includes(n));
          const customIcon = [target, ...legacyMika].map(p => p.icon).find(ic => ic && ic !== (pl.icon || s.icon));
          const customColor = [target, ...legacyMika].map(p => p.color).find(c => c && c !== (pl.color || s.color));
          const customFolder = [target, ...legacyMika].map(p => p.folder).find(f => f !== undefined && f !== folder);
          const customTags = [target, ...legacyMika].map(p => p.tags).find(t => Array.isArray(t) &&
            JSON.stringify(t) !== JSON.stringify((pl.tags || []).slice(0, 5)) && !BA_MIKA_LEGACY_PL.tags.includes(JSON.stringify(t)));
          target.id = baseId;
          target.cat = "trk:" + s.id + ":" + pl.id;
          target.name = customName || pl.name;
          target.icon = customIcon || pl.icon || s.icon;
          target.color = customColor || pl.color || s.color;
          if (customFolder !== undefined) target.folder = customFolder;
          target.tags = customTags ? customTags.slice(0, 5) : (pl.tags || []).slice(0, 5);
          if (legacyMika.some(p => p.frozen)) target.frozen = true;
          if (legacyMika.some(p => p.locked)) target.locked = true;
          target.songs = mergedSongs;
          target.wish = wishes;
          target.guide = guide;
          core.settings.playlists = core.settings.playlists.filter(p => p === target || !BA_MIKA_LEGACY_PL.ids.includes(p.id));
          if (typeof core.settings.libTab === "string" && BA_MIKA_LEGACY_PL.ids.includes(core.settings.libTab.slice(3))) core.settings.libTab = "pl:" + baseId;
          if (Array.isArray(core.settings.libOpenTabs)) core.settings.libOpenTabs = [...new Set(core.settings.libOpenTabs.map(id => BA_MIKA_LEGACY_PL.ids.includes(id) ? baseId : id))];
          if (Array.isArray(core.settings.playlistOrder)) core.settings.playlistOrder = [...new Set(core.settings.playlistOrder.map(id => BA_MIKA_LEGACY_PL.ids.includes(id) ? baseId : id))];
          if (Array.isArray(core.settings.trkRemoved)) core.settings.trkRemoved = core.settings.trkRemoved.filter(id => !BA_MIKA_LEGACY_PL.ids.includes(id));
          changed = true;
        } else if (Array.isArray(core.settings.trkRemoved) && BA_MIKA_LEGACY_PL.ids.some(id => core.settings.trkRemoved.includes(id))) {
          const allThreeRemoved = BA_MIKA_LEGACY_PL.ids.every(id => core.settings.trkRemoved.includes(id));
          core.settings.trkRemoved = core.settings.trkRemoved.filter(id => !BA_MIKA_LEGACY_PL.ids.includes(id));
          if (allThreeRemoved && !core.settings.trkRemoved.includes(baseId)) core.settings.trkRemoved.push(baseId);
          changed = true;
        }
      }
      /* Refresh catalog-owned wish/guide fields only. Never replace owned songs or
         user-edited name, icon, or tags. */
      for (const imported of core.settings.playlists) {
        /* Classic Vol.1 は複数のカタログを集めた保存済みwishなので、通常のcat更新を通らない。
           同じ曲の別名だけを補う。曲順・所持曲・ユーザー編集・凍結状態には触らない。 */
        if (s.id === "classical" && imported.cat === "trk:classic") {
          for (const old of (imported.wish || [])) {
            const fresh = wishes.find(w => w.t === old.t && w.al === old.al && w.ar === old.ar);
            if (fresh && fresh.matchAliases && JSON.stringify(old.matchAliases) !== JSON.stringify(fresh.matchAliases)) {
              old.matchAliases = fresh.matchAliases.slice(); changed = true;
            }
          }
        }
        if (!sourceCats.has(imported.cat)) continue;
        if (JSON.stringify(imported.wish) !== JSON.stringify(wishes)) { imported.wish = wishes; changed = true; }
        if (JSON.stringify(imported.guide || null) !== JSON.stringify(guide)) { imported.guide = guide; changed = true; }
        if (s.id === "bluearchive" && pl.id === "ba-mika" && BA_MIKA_LEGACY_PL.names.includes(imported.name)) { imported.name = pl.name; changed = true; }
        if (s.id === "lol" && pl.id === "lol-svi" && imported.name === "Sessions: Vi 厳選") { imported.name = pl.name; changed = true; }
        if (s.id === "valorant" && pl.id === "val-themes" && imported.name === "VALORANT テーマ厳選") { imported.name = pl.name; changed = true; }
        if (s.id === "gakumas" && pl.id === "gm-inst" && imported.name === "学マス インスト厳選 — キャラ別 Vol.1") { imported.name = pl.name; changed = true; }
        if (s.id === "gakumas" && pl.id === "gm-inst2" && imported.name === "学マス インスト厳選 — キャラ別 Vol.2") { imported.name = pl.name; changed = true; }
      }
      const existing = core.settings.playlists.find(p => p.id === baseId);
      if (existing) {
        /* 🛤️ Lone Trail の旧3曲版を、同じ公式カタログ項目の10曲版へ更新する。
           cat が一致する公式項目だけ更新し、所持曲・名前・アイコン・タグのユーザー変更は守る。 */
        if (pl.id === "ak-lonetrail" && existing.cat === "trk:" + s.id + ":" + pl.id) {
          if (JSON.stringify(existing.wish) !== JSON.stringify(wishes)) { existing.wish = wishes; changed = true; }
          if (existing.name === "アークナイツ — Lone Trail") { existing.name = pl.name; changed = true; }
          if (existing.icon === "🛤️") { existing.icon = pl.icon || s.icon; changed = true; }
          if (JSON.stringify(existing.tags) === JSON.stringify(["Game","Arknights","MSR","Lone Trail"])) {
            existing.tags = (pl.tags || []).slice(0,5); changed = true;
          }
        }
        /* 🌋 So Long, Adele の旧3曲紹介版を、公式OST全9曲へ更新する。 */
        if (pl.id === "ak-solongadele" && existing.cat === "trk:" + s.id + ":" + pl.id) {
          if (JSON.stringify(existing.wish) !== JSON.stringify(wishes)) { existing.wish = wishes; changed = true; }
        }
        /* 🩹 旧カタログの「痕」は、永続IDを保ったまま「墟」へ更新する。 */
        if (pl.id === "ak-hen" && existing.cat === "trk:" + s.id + ":" + pl.id) {
          if (JSON.stringify(existing.wish) !== JSON.stringify(wishes)) { existing.wish = wishes; changed = true; }
          if (existing.name === "アークナイツ — 痕") { existing.name = pl.name; changed = true; }
          if (existing.icon === "🩹") { existing.icon = pl.icon || s.icon; changed = true; }
          if (JSON.stringify(existing.tags) === JSON.stringify(["Game","Arknights","MSR","痕"])) {
            existing.tags = (pl.tags || []).slice(0,5); changed = true;
          }
        }
        /* 🛰️ 初号指令OSTの旧既定名（4パート紹介版・trk110のフル名・trk128の長い名＝保存は24文字切り）を、
           trk129の24文字に収まる名（「初号指令 (上) ZD OST Vol.1」）へ更新する。trk128の名は保存時に切れて
           「初号指令 (上) ― Zeroth Direct」になっているため、切れた形も照合する（Vol.1とVol.2で同じ文字列になるので、
           置き換え先はIDごとに決める）。wish と guide は上の共通処理で更新済み。所持曲とユーザー変更は守る。 */
        if (pl.id === "ef-firstorder" && existing.cat === "trk:" + s.id + ":" + pl.id) {
          if (ENDFIELD_FIRSTORDER_OLD_NAMES["ef-firstorder"].includes(existing.name)) { existing.name = pl.name; changed = true; }
          if (JSON.stringify(existing.tags) === JSON.stringify(["Game","Endfield","Metal Scar Radio","First Order"])) {
            existing.tags = (pl.tags || []).slice(0,5); changed = true;
          }
        }
        /* 🛰️ Vol.2 も同じ（IDごとに別々の新名へ置かれる）。 */
        if (pl.id === "ef-firstorder2" && existing.cat === "trk:" + s.id + ":" + pl.id) {
          if (ENDFIELD_FIRSTORDER_OLD_NAMES["ef-firstorder2"].includes(existing.name)) { existing.name = pl.name; changed = true; }
        }
        continue;
      }
      if (!folder || !wishes.length) continue;
      if (!create) continue;   /* 🐔 trk217：起動時は作らない（ピッカーから選んだリストだけ作る） */
      // respect 100 limit per Vol, split if needed into Vol.1 / Vol.2 etc.
      const total = wishes.length;
      const vols = Math.ceil(total / 100) || 1;
      for (let v = 0; v < vols; v++) {
        const vid = vols === 1 ? baseId : baseId + "-v" + (v+1);
        if (core.settings.playlists.some(p => p.id === vid)) continue;
        if (trkIsRemoved(vid)) continue;   /* 🗑 利用者が消したリストは作り直さない */
        const slice = wishes.slice(v*100, (v+1)*100);
        const vTag = vols === 1 ? [] : ["Vol."+(v+1)];
        const vName = vols === 1 ? pl.name : pl.name + " Vol." + (v+1);
        const p = plSanitize({ id: vid, name: vName, icon: pl.icon || s.icon, color: pl.color || s.color, folder, tags: (pl.tags || []).concat(vTag).slice(0,5), wish: slice, songs: [], guide: trkCatalogGuide(s, pl, true), cat: "trk:" + s.id + ":" + pl.id, createdAt: Date.now() + v });
        if (p) { core.settings.playlists.push(p); changed = true; }
      }
    }
  }
  /* Migrate the previous one-list Gakumas import to the current catalog without replacing
     its owned songs, custom name/icon/tags or playlist identity. */
  const gakumas = cat.find(s => s.id === "gakumas");
  const legacyGakumas = core.settings.playlists.find(p => p.id === "trk-gakumas-v1" && p.cat === "trk:gakumas");
  if (gakumas && legacyGakumas) {
    const wishes = trkWishesForSeries("gakumas").slice(0, 100);
    const guide = trkGuide("plGuideGakumasLegacy", gakumas.url);
    if (JSON.stringify(legacyGakumas.wish) !== JSON.stringify(wishes)) { legacyGakumas.wish = wishes; changed = true; }
    if (JSON.stringify(legacyGakumas.guide || null) !== JSON.stringify(guide)) { legacyGakumas.guide = guide; changed = true; }
  }
  // legacy: ensure old 4 generic still migrate if missing (for existing users)
  const legacy = create ? [
    { id: "trk-ba-v1", folder: "trk-ba", series: "bluearchive" },
    { id: "trk-touhou-v1", folder: "trk-touhou", series: "touhou" },
    { id: "trk-arknights-v1", folder: "trk-arknights", series: "arknights" },
    { id: "trk-gakumas-v1", folder: "trk-gakumas", series: "gakumas" },
  ] : [];
  for (const d of legacy) {
    if (core.settings.playlists.some(p => p.id === d.id)) continue;
    if (trkIsRemoved(d.id)) continue;
    const s = cat.find(x=> x.id===d.series);
    if (!s) continue;
    // if new per-PL already cover, skip legacy creation
    if (s.playlists && s.playlists.some(pl=> core.settings.playlists.some(p=> p.id==="trk-"+pl.id))) continue;
    const wishesAll = trkWishesForSeries(d.series);
    if (!wishesAll.length) continue;
    const slice = wishesAll.slice(0,100);
    const p = plSanitize({ id: d.id, name: s.name + " Vol.1", icon: s.icon, color: s.color, folder: d.folder, tags: ["Game", s.name, "Vol.1"], wish: slice, songs: [], guide: trkGuide("plGuideIntro", s.url || TRK_PUBLIC_PAGE_URL), cat: "trk:" + d.series, createdAt: Date.now() });
    if (p) { core.settings.playlists.push(p); changed = true; }
  }
  trkEndfieldTidyOnce();   /* 🛰️ 初回起動だけ：初号指令を最上へ・リリース順・キャラクターテーマを棚へ（その後利用者の並びを守る） */
  trkEndfieldShelfRestoreOnce();   /* 🎭 一回限り：上限13のときに棚から落ちたキャラクターテーマ4リストを、こわれた形のときだけ棚へ戻す */
  if (changed) core.saveUserPrefs();
}
(function plTighten() {
  core.settings.playlists = (core.settings.playlists || []).map(plSanitize).filter(Boolean).slice(0, 200);
  core.settings.plFolders = plFolderTrim((core.settings.plFolders || []).map(plFolderSanitize).filter(Boolean));   /* 上限は作るときに確かめる（固定棚を末尾から捨てない） */
  const fids = new Set(core.settings.plFolders.map(f => f.id));
  for (const p of core.settings.playlists) if (p.folder && !fids.has(p.folder)) p.folder = "";
  for (const f of core.settings.plFolders) if (f.parent && (!fids.has(f.parent) || f.parent === f.id)) f.parent = "";
  for (const f of core.settings.plFolders) if (plIsDescendantFolder(f.id, f.id)) f.parent = "";   /* 循環を断つ */
  try { trkFolderNormalize(); } catch (_) {}   /* 🐔 名前・アイコン・色は固定（旧データもここでそろう） */
})();

function plById(id) { return core.settings.playlists.find(p => p.id === id) || null; }
function plIcon(p) { if (p.icon) return p.icon; if (p.frozen && p.locked) return "🧩"; if (p.frozen) return "🧊"; if (p.locked) return "🔒"; return "🎧"; }
function plCount(p, keySet) { let n = 0; for (const k of p.songs) if (keySet.has(k)) n++; return n; }

let plToastTimer = 0, plDragKey = "";
function plToast(msg) {
  let t = document.querySelector(".plToast");
  if (!t) { t = el("div", "plToast"); document.body.append(t); }
  t.textContent = msg; t.classList.add("on");
  clearTimeout(plToastTimer);
  plToastTimer = setTimeout(() => t.classList.remove("on"), 2400);
}

/* 長押し（PCのマウス押しっぱなし ＋ スマホ）。開いたあとの click は1回だけ止める */
let plSuppressUntil = 0, plLastPointer = "mouse";
function plSuppressClick() { return Date.now() < plSuppressUntil; }
function onLongPress(elm, open) {
  let t = 0, sx = 0, sy = 0;
  elm.addEventListener("pointerdown", e => {
    plLastPointer = e.pointerType || "mouse";
    if (e.pointerType === "mouse" && e.button !== 0) return;
    sx = e.clientX; sy = e.clientY;
    clearTimeout(t);
    t = setTimeout(() => { t = 0; plSuppressUntil = Date.now() + 700; open(); }, 480);
  });
  const cancel = () => { clearTimeout(t); t = 0; };
  elm.addEventListener("pointerup", cancel);
  elm.addEventListener("pointercancel", cancel);
  elm.addEventListener("pointermove", e => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  elm.addEventListener("contextmenu", e => { if (plLastPointer === "touch") e.preventDefault(); });   /* スマホ長押しのメニュー防止 */
}

/* 中央に出す小さいダイアログ（プレイリスト設定・曲プロフィールで使う） */
function plDialog(title) {
  document.querySelectorAll(".plOverlay").forEach(x => x.remove());
  const ov = el("div", "plOverlay"), card = el("div", "plCard");
  const esc = e => { if (e.key === "Escape") close(); };
  const close = () => { document.removeEventListener("keydown", esc); ov.remove(); };
  document.addEventListener("keydown", esc);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  card.append(el("b", "plCardTitle", title));
  ov.append(card); document.body.append(ov);
  return { card, close };
}
function plRow(labelText, node) { const r = el("label", "plRow"); r.append(el("span", "plRowLabel", labelText), node); return r; }

/* 色の見本（クリックで選ぶ。box.value に選んだキーが入る） */
function plColorSwatches(initial) {
  const box = el("div", "plSwatches");
  box.value = PL_COLORS[initial] != null ? initial : "none";
  for (const [key, hex] of Object.entries(PL_COLORS)) {
    const s = el("button", "plSwatch" + (key === box.value ? " on" : "")); s.type = "button";
    s.title = key === "none" ? tr("plColorNone") : key;
    if (hex) s.style.background = hex; else s.textContent = "✕";
    s.addEventListener("click", () => {
      box.value = key;
      box.querySelectorAll(".plSwatch").forEach(x => x.classList.remove("on"));
      s.classList.add("on");
    });
    box.append(s);
  }
  return box;
}

/* 📁 新規プレイリスト */
function plCreate() {
  const d = plDialog(tr("plNewTab"));
  const name = el("input", "plInput"); name.type = "text"; name.maxLength = 24; name.value = tr("plDefaultName", { n: core.settings.playlists.length + 1 });
  const icon = el("input", "plInput"); icon.type = "text"; icon.maxLength = 4; icon.placeholder = tr("plIconPh");
  const color = plColorSwatches("none");
  const save = el("button", "plBtn", tr("plSave")); save.type = "button";
  save.addEventListener("click", () => {
    const p = plSanitize({ id: "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.value || tr("plDefaultName", { n: core.settings.playlists.length + 1 }), icon: icon.value, color: color.value, frozen: false, locked: false, folder: plFolderContext(), createdAt: Date.now(), songs: [] });
    core.settings.playlists.push(p); core.saveUserPrefs();
    core.settings.libTab = "pl:" + p.id;
    d.close(); renderLib();
    plToast(tr("plCreated", { name: p.name }));
  });
  d.card.append(plRow(tr("plName"), name), plRow(tr("plIcon"), icon), plRow(tr("plColor"), color), save);
  name.focus(); name.select();
}

/* 📄 入手先ガイドの表示文：key があれば今の言語で引き、無ければ保存した控え（note）をそのまま出す */
function plGuideText(guide) {
  if (!guide) return "";
  if (guide.key && TEXT.ja && typeof TEXT.ja[guide.key] === "string") return tr(guide.key);
  return guide.note || "";
}
/* プレイリスト1つの設定（タブの長押しで開く） */
function plMenu(p) {
  const d = plDialog(tr("plSettings") + "：" + p.name);
  const name = el("input", "plInput"); name.type = "text"; name.maxLength = 24; name.value = p.name;
  const icon = el("input", "plInput"); icon.type = "text"; icon.maxLength = 4; icon.value = p.icon; icon.placeholder = tr("plIconPh");
  const color = plColorSwatches(p.color);
  const fldSel = el("select", "plInput");
  fldSel.append(new Option(tr("plFolderRoot"), ""));
  for (const f of core.settings.plFolders) fldSel.append(new Option("　".repeat(plDepthOfFolder(f.id)) + (f.icon || "📁") + " " + f.name, f.id));
  fldSel.value = p.folder && core.settings.plFolders.some(f => f.id === p.folder) ? p.folder : "";
  const tags = el("input", "plInput"); tags.type = "text"; tags.maxLength = 80; tags.value = (p.tags || []).join(" "); tags.placeholder = tr("plTagsPh");
  const fz = el("input"); fz.type = "checkbox"; fz.checked = !!p.frozen;
  const lk = el("input"); lk.type = "checkbox"; lk.checked = !!p.locked;
  const save = el("button", "plBtn", tr("plSave")); save.type = "button";
  save.addEventListener("click", () => {
    /* 🐔 の中（trk のリスト）を別の入れ物へ入れるときは、移動せず複製する。元のリストは 🐔 に残る。
       複製は利用者のリストになる（カタログとの紐づけ・自動更新は付けない）。入れ物は1つに限らず、複製で何か所にも置ける */
    if (fldSel.value !== (p.folder || "") && plIsTrkManaged(p)) {
      const copy = plSanitize({ id: "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.value || p.name, icon: icon.value, color: color.value, frozen: false, locked: false,
        songs: p.songs.slice(), wish: p.wish ? p.wish.slice() : [], guide: p.guide || null, folder: fldSel.value,
        tags: tags.value.split(/[\s、，,]+/).map(x => x.trim().slice(0, 16)).filter(Boolean).slice(0, 5), createdAt: Date.now() });
      if (!copy) return;
      core.settings.playlists.push(copy); core.saveUserPrefs(); d.close(); renderLib();
      plToast(tr("trkCopiedToFolder", { name: copy.name }));
      return;
    }
    const t = plSanitize({ id: p.id, name: name.value || p.name, icon: icon.value, color: color.value, frozen: fz.checked, locked: lk.checked,
      songs: p.songs, wish: p.wish, guide: p.guide, cat: p.cat, by: p.by, createdAt: p.createdAt,
      folder: fldSel.value, tags: tags.value.split(/[\s、，,]+/).map(x => x.trim().slice(0, 16)).filter(Boolean).slice(0, 5) });
    if (t) Object.assign(p, t);   /* 同じオブジェクトを直す（タブのIDは不変） */
    core.saveUserPrefs(); d.close(); renderLib();
  });
  const share = el("button", "plBtn", tr("plShare")); share.type = "button";
  share.addEventListener("click", () => { d.close(); plShare(p); });
  const del = el("button", "plBtnDanger", tr("plDelete")); del.type = "button";
  del.disabled = !!p.locked; del.title = p.locked ? tr("plLockedNo") : "";
  del.addEventListener("click", () => plDelete(p, d.close));
  lk.addEventListener("change", () => { del.disabled = lk.checked; del.title = lk.checked ? tr("plLockedNo") : ""; });
  const guideNote = plGuideText(p.guide);
  if (p.guide && (guideNote || p.guide.url)) {   /* 🛒 公式カタログから取り込んだ入手先 */
    d.card.append(el("div", "plSep"), el("b", "plCardTitle", tr("plGuideTitle")));
    if (guideNote) d.card.append(el("div", "plHint", "📄 " + guideNote));
    if (p.guide.url) {
      const gb = el("button", "plBtn", tr("plLinkOpen")); gb.type = "button";
      gb.addEventListener("click", () => plOpenLink(p.guide.url));
      d.card.append(gb);
    }
  }
  d.card.append(plRow(tr("plName"), name), plRow(tr("plIcon"), icon), plRow(tr("plColor"), color),
    plRow(tr("plFolderOf"), fldSel), plRow(tr("plTags"), tags),
    plRow(tr("plFrozenCheck"), fz), plRow(tr("plLockedCheck"), lk),
    el("div", "plHint", tr("plSongsNow", { n: p.songs.length })),
    save, share, del);
  name.focus(); name.select();
}

/* 📁 フォルダの新規作成 */
function plFolderCreate(defaultParent = "") {
  const d = plDialog(tr("plNewFolder"));
  const name = el("input", "plInput"); name.type = "text"; name.maxLength = 24; name.value = tr("plDefaultFolderName");
  const icon = el("input", "plInput"); icon.type = "text"; icon.maxLength = 4; icon.placeholder = tr("plIconPh");
  const color = plColorSwatches("none");
  const save = el("button", "plBtn", tr("plSave")); save.type = "button";
  save.addEventListener("click", () => {
    /* 📁 上限に達していたら作らずに知らせる（黙って作って次の起動で切り捨てない） */
    if (!plFolderRoom()) { plToast(tr("plFolderLimit", { n: PL_FOLDER_MAX })); return; }
    const f = plFolderSanitize({ id: "fl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.value || tr("plDefaultFolderName"), icon: icon.value, color: color.value,
      parent: plFolderById(defaultParent) ? defaultParent : "", createdAt: Date.now() });
    core.settings.plFolders.push(f); core.saveUserPrefs();
    d.close(); renderLib();
    plToast(tr("plFolderCreated", { name: f.name }));
  });
  d.card.append(plRow(tr("plName"), name), plRow(tr("plIcon"), icon), plRow(tr("plColor"), color), save);
  name.focus(); name.select();
}

/* 📁 フォルダの設定（フォルダタブの長押し） */
function plFolderMenu(f) {
  /* 🐔 trk's playlist 自体は名前・アイコン・色が固定。フォルダ設定は出さず、階層（Vol 一覧）を開く */
  if (f && f.id === TRK_FOLDER_ID) { plTrkMenu(); return; }
  const d = plDialog(tr("plFolderSettings") + "：" + f.name);
  const name = el("input", "plInput"); name.type = "text"; name.maxLength = 24; name.value = f.name;
  const icon = el("input", "plInput"); icon.type = "text"; icon.maxLength = 4; icon.value = f.icon; icon.placeholder = tr("plIconPh");
  const color = plColorSwatches(f.color);
  const parent = el("select", "plInput");
  parent.append(new Option(tr("plFolderRoot"), ""));
  for (const x of core.settings.plFolders) {
    if (x.id === f.id || plIsDescendantFolder(x.id, f.id) || plDepthOfFolder(x.id) >= 3) continue;   /* 自分と子孫・深すぎは選べない */
    parent.append(new Option("　".repeat(plDepthOfFolder(x.id)) + (x.icon || "📁") + " " + x.name, x.id));
  }
  parent.value = f.parent && core.settings.plFolders.some(x => x.id === f.parent) ? f.parent : "";
  const save = el("button", "plBtn", tr("plSave")); save.type = "button";
  save.addEventListener("click", () => {
    const t = plFolderSanitize({ id: f.id, name: name.value || f.name, icon: icon.value, color: color.value, parent: parent.value, createdAt: f.createdAt });
    if (t) Object.assign(f, t);
    core.saveUserPrefs(); d.close(); renderLib();
  });
  const del = el("button", "plBtnDanger", tr("plFolderDel")); del.type = "button";
  del.addEventListener("click", () => plFolderDelete(f, d.close));
  d.card.append(plRow(tr("plName"), name), plRow(tr("plIcon"), icon), plRow(tr("plColor"), color),
    plRow(tr("plFolderOf"), parent), save, del);
  // 🐔 trk folder special: show inner playlists (Game Vol.1, Classic Vol.1, BlueArchive etc.) for quick open
  if (f.id === TRK_FOLDER_ID || f.id === "trk-classic" || f.id === "trk-ba" || f.id === "trk-touhou" || f.id === "trk-arknights" || f.id === "trk-gakumas" || f.id === "trk-endfield" || f.id === "trk-endfield-character") {
    const innerIds = f.id === TRK_FOLDER_ID ? [TRK_FOLDER_ID, "trk-classic", "trk-ba", "trk-touhou", "trk-arknights", "trk-gakumas", "trk-endfield", "trk-endfield-character"]
      : f.id === "trk-endfield" ? ["trk-endfield", "trk-endfield-character"] : [f.id];
    const allInner = core.settings.playlists.filter(p => innerIds.includes(p.folder) || (f.id===TRK_FOLDER_ID && core.settings.plFolders.some(ff=> innerIds.includes(ff.id) && ff.id===p.folder)) );
    if (allInner.length) {
      d.card.append(el("div", "plSep"));
      d.card.append(el("b", "plCardTitle", tr("plFolderContents") || "中のプレイリスト"));
      const ordered = trkOrderedPlaylists(allInner), peers = ordered.map(x => x.id);
      for (const [i, p] of ordered.entries()) {
        const row = el("div"); row.style.cssText = "display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap";
        const open = el("button", "plBtn", (p.icon||"🎧")+" "+p.name+" ("+plCount(p, new Set((window.__libAll||[]).map(x=>x.key)))+")"); open.type="button";
        open.addEventListener("click", () => { d.close(); core.settings.libTab="pl:"+p.id; renderLib(); });
        const up = el("button", "plBtn small", "↑"); up.type="button"; up.title="上へ";
        const down = el("button", "plBtn small", "↓"); down.type="button"; down.title="下へ";
        trkMoveButtonsState(up, down, i, ordered.length);
        /* 並べ替えたら表示を作り直す（この画面は中身を描き直す仕組みを持たないので、メニューを開き直す） */
        up.addEventListener("click", () => { trkMovePlaylist(p.id, -1, peers); plFolderMenu(f); });
        down.addEventListener("click", () => { trkMovePlaylist(p.id, 1, peers); plFolderMenu(f); });
        row.append(open, up, down);
        d.card.append(row);
      }
      if (core.settings.trkSortABC) d.card.append(el("div", "plHint", "🔤 ABC順がオンのため、手動並べ替えは無効です。設定でオフにしてください。"));
    }
  }
  name.focus(); name.select();
}

/* 🐔 trk's playlist の階層（タブの長押しで開く）
   ・長押しの動作を「プロフィールを弄る」から「階層（Vol 一覧）を開く」へ固定するための画面
   ・名前と色は固定なので、ここには編集欄を出さない（plFolderMenu も trk フォルダでは開かせない）
   ・各 Vol は 開く／↑↓（自由並べ替え）／⚙（そのプレイリストの設定） */
function plTrkMenu() {
  trkFolderNormalize();
  const d = plDialog(tr("trkMenuTitle"));
  d.card.append(el("div", "plHint", tr("trkMenuHint")));
  const keys = (libAllKeys instanceof Set) ? libAllKeys : new Set();
  const listBox = el("div", "plTrkList");
  const rowOf = (p, i, list) => {   /* list＝同じグループ（フォルダ）の表示順。↕はこの中でだけ動く */
    const peers = list.map(x => x.id);
    const row = el("div", "plTrkRow");
    const open = el("button", "plBtn", (p.icon || "🎧") + " " + p.name + "（" + plCount(p, keys) + "）"); open.type = "button";
    open.title = tr("trkMenuOpenFolder");   /* 名前を押すと、その Vol のフォルダを開く（既定の動作） */
    open.addEventListener("click", () => { d.close(); core.settings.libTab = "fld:" + (p.folder || TRK_FOLDER_ID); core.saveUserPrefs(); renderLib(); });
    const check = el("button", "plBtn small plTrkCheck", "✓"); check.type = "button"; check.title = tr("trkMenuOpenList"); check.setAttribute("aria-label", tr("trkMenuOpenList") + " " + p.name);
    check.addEventListener("click", () => { d.close(); core.settings.libTab = "pl:" + p.id; core.saveUserPrefs(); renderLib(); });   /* ✓＝プレイリストの詳細 */
    const up = el("button", "plBtn small", "↑"); up.type = "button"; up.title = tr("trkMoveUp"); up.setAttribute("aria-label", tr("trkMoveUp") + " " + p.name);
    const down = el("button", "plBtn small", "↓"); down.type = "button"; down.title = tr("trkMoveDown"); down.setAttribute("aria-label", tr("trkMoveDown") + " " + p.name);
    trkMoveButtonsState(up, down, i, list.length);
    up.addEventListener("click", () => { trkMovePlaylist(p.id, -1, peers); paint(); });
    down.addEventListener("click", () => { trkMovePlaylist(p.id, 1, peers); paint(); });
    const gear = el("button", "plBtn small", "⚙"); gear.type = "button"; gear.title = tr("plSettings"); gear.setAttribute("aria-label", tr("plSettings") + " " + p.name);
    gear.addEventListener("click", () => plMenu(p));   /* plDialog が古いダイアログを閉じるので、そのまま開き替える */
    row.append(open, up, down, check, gear);
    return row;
  };
  /* 見出しのタイトルを押すと、そのフォルダを開く（既定の動作）。中の Vol は常に並べる */
  const groupHead = f => {
    const head = el("div", "plTrkGroup");
    const title = el("button", "plTrkTitle", (f.icon || "📁") + " " + (f.id === TRK_FOLDER_ID ? (trkTabLabel() || tr("trkTabNameFull")) : f.name));
    title.type = "button"; title.title = tr("trkMenuOpenFolder");
    title.addEventListener("click", () => { d.close(); core.settings.libTab = "fld:" + f.id; core.saveUserPrefs(); renderLib(); });
    head.append(title);
    const fo = el("button", "plBtn small", tr("trkMenuOpenFolder")); fo.type = "button";
    fo.addEventListener("click", () => { d.close(); core.settings.libTab = "fld:" + f.id; core.saveUserPrefs(); renderLib(); });
    head.append(fo);
    return head;
  };
  /* フォルダの中の Vol（と一段深い棚）を並べる */
  const folderBlock = (f, depth) => {
    const wrap = el("div", "plTrkBlock");
    wrap.append(el("div", "plSep"), groupHead(f));
    const body = el("div", "plTrkBody");
    if (depth) body.style.marginLeft = (depth * 14) + "px";
    trkOrderedPlaylists(core.settings.playlists.filter(p => plVisible(p) && p.folder === f.id)).forEach((p, i, list) => body.append(rowOf(p, i, list)));
    for (const g of core.settings.plFolders.filter(x => x.parent === f.id)) body.append(folderBlock(g, depth + 1));
    wrap.append(body);
    return wrap;
  };
  const paint = () => {
    listBox.replaceChildren();
    const direct = core.settings.playlists.filter(p => plVisible(p) && p.folder === TRK_FOLDER_ID);
    const subs = core.settings.plFolders.filter(f => f.parent === TRK_FOLDER_ID);
    if (!direct.length && !subs.length) { listBox.append(el("div", "plHint", tr("trkOrderEmpty"))); return; }
    if (direct.length) {   /* 🐔 直下の Vol（Agent など）は、いつも並べる */
      listBox.append(groupHead({ id: TRK_FOLDER_ID, icon: TRK_TAB_ICON }));
      trkOrderedPlaylists(direct).forEach((p, i, list) => listBox.append(rowOf(p, i, list)));
    }
    for (const f of subs) listBox.append(folderBlock(f, 0));   /* 🎻 Classic・🎮 Blue Archive… は ▸ で開く */
    if (core.settings.trkSortABC) listBox.append(el("div", "plHint", tr("trkOrderAbcOff")));
  };
  d.card.append(listBox);
  paint();
}

/* 🗑 フォルダの削除（中身は消さない。子は上の階層へ） */
function plFolderDelete(f, onClose) {
  core.settings.plFolders = core.settings.plFolders.filter(x => x !== f);
  for (const p of core.settings.playlists) if (p.folder === f.id) p.folder = f.parent;
  for (const x of core.settings.plFolders) if (x.parent === f.id) x.parent = f.parent;
  if (core.settings.libTab === "fld:" + f.id) core.settings.libTab = f.parent ? "fld:" + f.parent : "all";
  core.saveUserPrefs();
  if (onClose) onClose();
  renderLib();
  plToast(tr("plFolderDeleted"));
}

/* 🗑 削除（曲はライブラリに残る。🔒中は断る） */
/* 🗑 trk が自動で作るリスト（ID が trk- で始まる）を消したら印を残し、次の起動で作り直さない。
   利用者のリスト（pl…）やカタログから手で取り込んだリストには印を付けない。 */
const TRK_AUTO_ID = /^trk-[A-Za-z0-9_-]{1,40}$/;
function trkMarkRemoved(id) {
  if (!TRK_AUTO_ID.test(id)) return;
  const list = Array.isArray(core.settings.trkRemoved) ? core.settings.trkRemoved.filter(x => x !== id) : [];
  list.push(id);
  core.settings.trkRemoved = list.slice(-200);
}
function trkUnmarkRemoved(id) {
  if (Array.isArray(core.settings.trkRemoved)) core.settings.trkRemoved = core.settings.trkRemoved.filter(x => x !== id);
}
/* ♻ 印をすべて外して、自動のリストを作り直す（Game Vol.1／Classic は 🐔／🎻 の表示がオンのときだけ）。
   戻した数（印の付いていたIDのうち、作り直せたもの）を返す */
function trkRestoreRemoved() {
  const removed = new Set(Array.isArray(core.settings.trkRemoved) ? core.settings.trkRemoved : []);
  core.settings.trkRemoved = [];
  core.saveUserPrefs();
  try { ensureTrkPlaylist({ toast: false }); } catch (_) {}
  try { ensureTrkClassicPlaylist({ toast: false }); } catch (_) {}
  try { ensureTrkOstPlaylist({ toast: false }); } catch (_) {}
  try { ensureTrkDistributionPlaylists(); } catch (_) {}
  core.saveUserPrefs();
  return core.settings.playlists.filter(p => removed.has(p.id)).length;
}
function plDelete(p, onClose) {
  if (p.locked) { plToast(tr("plLockedNo")); return; }
  core.settings.playlists = core.settings.playlists.filter(x => x !== p);
  trkMarkRemoved(p.id);
  if (Array.isArray(core.settings.trkListed)) core.settings.trkListed = core.settings.trkListed.filter(id => id !== p.id);   /* 👁 の記録も消す */
  core.settings.libOpenTabs = (Array.isArray(core.settings.libOpenTabs) ? core.settings.libOpenTabs : []).filter(x => x !== p.id);
  if (core.settings.libTab === "pl:" + p.id) core.settings.libTab = "all";
  core.saveUserPrefs();
  if (onClose) onClose();
  renderLib();
  try { syncTrkUI(); } catch (_) {}   /* 🐔 の設定（♻ の件数・並び順の一覧）も今の状態に */
  plToast(tr("plDeleted"));
}
/* 📂 フォルダ内プレイリストのタブを閉じる（プレイリスト本体は消さない）。中クリックで使う */
function plCloseOpenTab(p) {
  const had = (core.settings.libOpenTabs || []).includes(p.id) || core.settings.libTab === "pl:" + p.id;
  core.settings.libOpenTabs = (Array.isArray(core.settings.libOpenTabs) ? core.settings.libOpenTabs : []).filter(x => x !== p.id);
  if (core.settings.libTab === "pl:" + p.id) core.settings.libTab = "all";
  core.saveUserPrefs();
  renderLib();
  if (had) plToast(tr("plTabClosed"));
}

/* 中クリックでの削除（設定で「同じタブ3回」モードにできる） */
let plDelArm = { id: "", n: 0, t: 0 };
function plDeleteGesture(p, btn) {
  if (p.locked) { plToast(tr("plLockedNo")); return; }
  if (core.settings.playlistDelMode === "three") {
    const now = Date.now();
    if (plDelArm.id !== p.id || now - plDelArm.t > 1600) plDelArm = { id: p.id, n: 0, t: now };
    plDelArm.n++; plDelArm.t = now;
    if (plDelArm.n < 3) {
      btn.classList.add("plArm");
      setTimeout(() => btn.classList.remove("plArm"), 1600);
      plToast(tr("plDelCount", { n: 3 - plDelArm.n }));
      return;
    }
  }
  plDelete(p);
}

/* 📚すべて／自動タブの長押し＝プレイリスト全体の設定 */
/* ---------- 🛒 公式カタログ（音源は同梱しない。公式の入手先を案内するだけ） ---------- */
function plCatalogFolder(s) {   /* シリーズのフォルダ（親カテゴリ → シリーズ。無ければ作る） */
  let parent = core.settings.plFolders.find(f => !f.parent && f.name === s.catName);
  /* 📁 上限に達していたらフォルダを作らず、入りきらないリストはフォルダなし（並びのトップ）に置く（トーストで知らせる） */
  if (!parent && !plFolderRoom(2)) { plToast(tr("plFolderLimit", { n: PL_FOLDER_MAX })); return ""; }
  if (!parent) { parent = plFolderSanitize({ id: "fl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: s.catName, icon: s.catIcon || "🎮", color: "none", parent: "", createdAt: Date.now() }); core.settings.plFolders.push(parent); }
  let fld = core.settings.plFolders.find(f => f.parent === parent.id && f.name === s.name);
  if (!fld && !plFolderRoom()) { plToast(tr("plFolderLimit", { n: PL_FOLDER_MAX })); return ""; }
  if (!fld) { fld = plFolderSanitize({ id: "fl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: s.name, icon: s.icon, color: s.color, parent: parent.id, createdAt: Date.now() }); core.settings.plFolders.push(fld); }
  return fld.id;
}
function plCatalogMenu() {
  const d = plDialog(tr("plCatalogTitle"));
  d.card.append(el("div", "plHint", tr("plCatalogHint")));
  const cat = trkCatalog();
  if (!cat.length) d.card.append(el("div", "plSep"), el("div", "plHint", tr("plImportBad")));
  for (const s of cat) {
    d.card.append(el("div", "plSep"), el("b", "plCardTitle", `${s.icon} ${s.name}`));
    const aliasIds = new Set((s.playlists || []).flatMap(pl => (pl.songs || []).flatMap(song => song.matchAliases || [])));
    const releaseGroups = new Set([...aliasIds].map(id => id.slice(0, id.lastIndexOf("_"))).filter(Boolean));
    const counts = { tracks: aliasIds.size, groups: releaseGroups.size };
    const note = s.id === "touhou" ? tr("touhouCatalogNote", counts)
      : s.id === "zun-other" ? tr("zunOtherCatalogNote", counts) : s.note;
    if (note) d.card.append(el("div", "plHint", "📄 " + note));
    if (s.id === "touhou") {
      for (const [label, url] of [
        [tr("touhouThemeDbSnapshot"), "https://github.com/thpatch/TouhouThemeDB/tree/e70e6451cf2e44d75564c09aa7c5a9cc09982692"],
        [tr("touhouMusicRoom"), "https://github.com/DTM9025/musicroom/releases/latest"],
        [tr("touhouMusicRoomLicense"), "https://github.com/DTM9025/musicroom/blob/master/LICENSE.md"],
        [tr("touhouToolkitDocs"), "https://www.thpatch.net/wiki/Touhou_Patch_Center:THTK"],
        [tr("touhouToolkitLicense"), "https://github.com/thpatch/thtk/blob/master/COPYING"]
      ]) {
        const b = el("button", "plBtn", label); b.type = "button";
        b.addEventListener("click", () => plOpenLink(url));
        d.card.append(b);
      }
    }
    if (s.url) {
      const b = el("button", "plBtn", tr("plLinkOpen")); b.type = "button";
      b.addEventListener("click", () => plOpenLink(s.url));
      d.card.append(b);
    }
    for (const pl of s.playlists) {
      const row = el("div"); row.style.cssText = "display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap";
      const btn = el("button", "plBtn", tr("plCatalogTake", { n: pl.songs.length })); btn.type = "button";
      btn.addEventListener("click", () => { d.close(); plCatalogTake(s, pl); });
      row.append(el("span", "", `${pl.icon} ${pl.name}`));
      if (pl.sourceUrl) {
        const source = el("button", "plBtn", "🔗 " + (pl.sourceLabel || tr("plOfficialLink"))); source.type = "button";
        source.addEventListener("click", () => plOpenLink(pl.sourceUrl));
        row.append(source);
      }
      row.append(btn);
      d.card.append(row);
    }
  }
}
function plCatalogTake(s, pl) {
  const cat = s.id + ":" + pl.id;
  if (core.settings.playlists.some(p => p.cat === cat)) { plToast(tr("plCatalogDup", { name: pl.name })); return; }
  const fldId = plCatalogFolder(s);
  const p = plSanitize({ id: "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: pl.name, icon: pl.icon, color: pl.color, frozen: false, locked: false, folder: fldId, tags: pl.tags,
    cat, wish: pl.songs, guide: trkCatalogGuide(s, pl), songs: [] });
  p.createdAt = Date.now();
  core.settings.playlists.push(p); core.saveUserPrefs();
  core.settings.libTab = "pl:" + p.id;
  renderLib();
  plToast(tr("plCatalogTaken", { name: p.name }));
}

/* ---------- 👥 投稿者ツール（初期オフ。共有プレイリストをたくさん受け取る人向け） ---------- */
function plVisible(p) {   /* 🚫ブロック中／⭐絞り込み中の投稿者のプレイリストは隠す（自分のには投稿者がない＝隠れない） */
  if (!core.settings.plAuthorTools || !p || !p.by) return true;
  if (core.settings.plAuthorBlock.includes(p.by)) return false;
  if (core.settings.plAuthorOnly && !core.settings.plAuthorFav.includes(p.by)) return false;
  return true;
}
function plAuthorMenu() {
  const d = plDialog(tr("plAuthorTitle"));
  const search = el("input", "plInput"); search.type = "text"; search.maxLength = 24; search.placeholder = tr("plAuthorSearchPh");
  const only = el("input"); only.type = "checkbox"; only.checked = core.settings.plAuthorOnly === true;
  only.addEventListener("change", () => { core.settings.plAuthorOnly = only.checked; core.saveUserPrefs(); render(); renderLib(); });
  const list = el("div", "plShareList");
  const hint = el("div", "plHint", "");
  const render = () => {
    list.textContent = "";
    const q = search.value.trim().toLowerCase();
    const authors = new Map();
    for (const p of core.settings.playlists) if (p.by) { if (!authors.has(p.by)) authors.set(p.by, []); authors.get(p.by).push(p); }
    for (const n of core.settings.plAuthorBlock) if (!authors.has(n)) authors.set(n, []);   /* プレイリストが無くなってもブロック解除できるように */
    const names = [...authors.keys()].filter(n => !q || n.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b));
    if (!names.length) { list.append(el("div", "libEmpty", tr("plAuthorNone"))); hint.textContent = ""; return; }
    let hidden = 0;
    for (const name of names) {
      const pls = authors.get(name);
      const blocked = core.settings.plAuthorBlock.includes(name), fav = core.settings.plAuthorFav.includes(name);
      const row = el("div", "plShareRow" + (blocked ? " miss" : ""));
      row.append(el("b", "", "👤 " + name));
      const fb = el("button", "plLinkMini" + (fav ? " on" : "")); fb.type = "button"; fb.title = tr(fav ? "plAuthorFavDel" : "plAuthorFavAdd"); fb.textContent = fav ? "⭐" : "☆";
      fb.addEventListener("click", () => {
        core.settings.plAuthorFav = fav ? core.settings.plAuthorFav.filter(x => x !== name) : [...core.settings.plAuthorFav, name].slice(0, 100);
        core.saveUserPrefs(); render(); renderLib();
      });
      const bb = el("button", "plLinkMini" + (blocked ? " on" : "")); bb.type = "button"; bb.title = tr(blocked ? "plAuthorUnblock" : "plAuthorBlock"); bb.textContent = "🚫";
      bb.addEventListener("click", () => {
        core.settings.plAuthorBlock = blocked ? core.settings.plAuthorBlock.filter(x => x !== name) : [...core.settings.plAuthorBlock, name].slice(0, 100);
        core.saveUserPrefs(); render(); renderLib();
      });
      row.append(fb, bb);
      list.append(row);
      const vis = pls.filter(plVisible);
      hidden += pls.length - vis.length;
      if (vis.length) {
        const chips = el("div", "plAuthorChips");
        for (const p of vis) {
          const c = el("button", "skinChip", `${plIcon(p)} ${p.name}（${p.songs.length}）`); c.type = "button";
          c.addEventListener("click", () => { core.settings.libTab = "pl:" + p.id; core.saveUserPrefs(); d.close(); renderLib(); });
          chips.append(c);
        }
        list.append(chips);
      }
    }
    hint.textContent = hidden ? tr("plAuthorHidden", { n: hidden }) : "";
  };
  search.addEventListener("input", render);
  d.card.append(search, plRow(tr("plAuthorOnly"), only), el("div", "plSep"), list, hint);
  render();
}

function plGlobalMenu() {
  const d = plDialog(tr("plGlobalTitle"));
  const make = el("button", "plBtn", tr("plNewTab")); make.type = "button";
  make.addEventListener("click", () => { d.close(); plCreate(); });
  const imp = el("button", "plBtn", tr("plImport")); imp.type = "button";
  imp.addEventListener("click", () => { d.close(); plImportPick(); });
  const mkfld = el("button", "plBtn", tr("plNewFolder")); mkfld.type = "button";
  mkfld.addEventListener("click", () => { d.close(); plFolderCreate(plFolderContext()); });
  // 💾 プレイリストのバックアップ（1.0.5）：全リストの書き出し／読み込み（曲ファイルは含まない）
  const backupExp = el("button", "plBtn", tr("plBackupExport")); backupExp.type = "button";
  backupExp.addEventListener("click", () => { d.close(); playlistsExport(); });
  const backupImp = el("button", "plBtn", tr("plBackupImport")); backupImp.type = "button";
  backupImp.addEventListener("click", () => { d.close(); playlistsImportPick(); });
  // 🐔 trk's playlist と 🛒公式カタログを分け、未取り込みの公式ソースも選べるようにする。
  const trkb = el("button", "plBtn", tr("trkCatalogBtn")); trkb.type = "button";
  trkb.addEventListener("click", () => {
    d.close();
    trkUnmarkRemoved(TRK_PLAYLIST_ID);   /* 自分で開く＝消した印は外す */
    const created = ensureTrkPlaylist({ toast: true });
    if (!created && core.settings.playlists.some(function(p){ return p.id === TRK_PLAYLIST_ID; })) {
      // 既にあるならそのタブへ
      core.settings.libTab = "pl:" + TRK_PLAYLIST_ID; core.saveUserPrefs(); renderLib();
      plToast(tr("trkDup"));
    } else if (!created) {
      // まだ無くて作れなかった（カタログが無い等）は従来のカタログを表示
      plCatalogMenu();
      return;
    } else {
      core.settings.libTab = "pl:" + TRK_PLAYLIST_ID; core.saveUserPrefs(); renderLib();
    }
  });
  const catb = el("button", "plBtn", tr("plCatalogBtn")); catb.type = "button";
  catb.addEventListener("click", () => { d.close(); plCatalogMenu(); });
  const one = el("input"); one.type = "radio"; one.name = "plDelMode"; one.checked = core.settings.playlistDelMode !== "three";
  const three = el("input"); three.type = "radio"; three.name = "plDelMode"; three.checked = core.settings.playlistDelMode === "three";
  const saveMode = () => { core.settings.playlistDelMode = three.checked ? "three" : "one"; core.saveUserPrefs(); };
  one.addEventListener("change", saveMode); three.addEventListener("change", saveMode);
  /* 👥 投稿者ツール（初期オフ。共有プレイリストをたくさん受け取る人向け。基本のUIに出さない） */
  const at = el("input"); at.type = "checkbox"; at.checked = core.settings.plAuthorTools === true;
  const an = el("input", "plInput"); an.type = "text"; an.maxLength = 24; an.placeholder = tr("plAuthorNamePh"); an.value = core.settings.plAuthorName || "";
  an.addEventListener("change", () => { core.settings.plAuthorName = an.value.trim().slice(0, 24); core.saveUserPrefs(); });
  const nameRow = plRow(tr("plAuthorBy"), an); nameRow.hidden = !core.settings.plAuthorTools;
  const abtn = el("button", "plBtn", tr("plAuthorBtn")); abtn.type = "button"; abtn.hidden = !core.settings.plAuthorTools;
  abtn.addEventListener("click", () => { d.close(); plAuthorMenu(); });
  at.addEventListener("change", () => { core.settings.plAuthorTools = at.checked; core.saveUserPrefs(); nameRow.hidden = !at.checked; abtn.hidden = !at.checked; renderLib(); });
  /* 👥 投稿者ツールの行は開発者表示（devView）の中 */
  const authorBox = el("div", "devOnly"); authorBox.append(el("div", "plSep"), plRow(tr("plAuthorTools"), at), nameRow, abtn);
  d.card.append(make, imp, mkfld, el("div", "plSep"), el("div", "plHint", tr("plBackupTitle")), el("div", "plHint", tr("plBackupHint")), backupExp, backupImp, el("div", "plSep"), trkb, catb, el("div", "plSep"),
    plRow(tr("plDelOne"), one), plRow(tr("plDelThree"), three),
    el("div", "plHint", tr("plDelModeHint")),
    authorBox);
}

/* 曲の追加・取り外し（🧊フリーズ中は断る） */
function plAddSong(p, key) {
  if (p.frozen) { plToast(tr("plFrozenNo", { name: p.name })); return false; }
  if (p.songs.includes(key)) return true;
  p.songs.push(key); core.saveUserPrefs();
  plToast(tr("plAdded", { name: p.name }));
  return true;
}
function plRemoveSong(p, key) {
  if (p.frozen) { plToast(tr("plFrozenNo", { name: p.name })); return false; }
  p.songs = p.songs.filter(k => k !== key); core.saveUserPrefs();
  plToast(tr("plRemovedFrom", { name: p.name }));
  return true;
}

/* 🎶 曲のプロフィール（曲の長押し）。情報の編集と、プレイリストへの追加・取り外し */
function songProfile(it) {
  const m = metaOf(it.key) || {};
  const d = plDialog(tr("plProfileTitle"));
  const f = {};
  for (const [id, key] of [["title", "plTitle"], ["artist", "plArtist"], ["album", "plAlbum"], ["composer", "plComposer"], ["srcUrl", "plProfileUrl"]]) {
    const inp = el("input", "plInput"); inp.type = "text"; inp.maxLength = id === "srcUrl" ? 300 : 100; inp.value = m[id] || "";
    if (id === "title") inp.placeholder = songDisplayTitle(it, m);
    f[id] = inp;
    d.card.append(plRow(tr(key), inp));
  }
  const matchMemo = el("textarea", "plInput"); matchMemo.rows = 2; matchMemo.maxLength = 80;
  matchMemo.value = m.matchHint || ""; matchMemo.placeholder = tr("plMatchMemoPh");
  matchMemo.style.cssText = "min-height:4em;resize:vertical";
  matchMemo.setAttribute("aria-describedby", "plMatchMemoHelp");
  f.matchHint = matchMemo;
  const matchMemoRow = plRow(tr("plMatchMemo"), matchMemo);
  const matchMemoHelp = el("div", "plHint", tr("plMatchMemoNote")); matchMemoHelp.id = "plMatchMemoHelp";
  d.card.append(matchMemoRow, matchMemoHelp);
  /* 🐔 trk218：trk が追加した（配布の）リストは、初期状態ではここに出さない（並ぶと圧迫するため）。
     出すかどうかは ⚙ → 🐔 trk's playlist の 👁 で選ぶ。利用者のリストはいつも出す。 */
  const shownLists = core.settings.playlists.filter(trkListShown);
  const hiddenLists = core.settings.playlists.length - shownLists.length;
  if (shownLists.length || hiddenLists) {
    d.card.append(el("div", "plSep"), el("b", "plCardTitle", tr("plInLists")));
    for (const p of shownLists) {
      const c = el("input"); c.type = "checkbox"; c.checked = p.songs.includes(it.key); c.disabled = !!p.frozen;
      c.addEventListener("change", () => {
        const n = p.songs.length;
        if (c.checked) { if (!plAddSong(p, it.key)) c.checked = false; }
        else { if (!plRemoveSong(p, it.key)) c.checked = true; }
        if (p.songs.length !== n) renderLib();
      });
      const r = plRow(plIcon(p) + " " + p.name, c);
      if (p.frozen) r.classList.add("plRowDim");
      d.card.append(r);
    }
    if (hiddenLists) d.card.append(el("div", "plHint", tr("plInListsHidden", { n: hiddenLists })));
  }
  const save = el("button", "plBtn", tr("plProfileSave")); save.type = "button";
  save.addEventListener("click", () => {
    const nm = {}; let any = false;
    for (const id of ["title", "artist", "album", "composer", "matchHint", "srcUrl"]) {
      let v = f[id].value.trim().slice(0, id === "srcUrl" ? 300 : id === "matchHint" ? 80 : 100);
      if (id === "srcUrl" && v && !/^https:\/\//i.test(v) && /^[a-z0-9.-]+\//i.test(v)) v = "https://" + v;   /* https:// を補う */
      if (id === "srcUrl" && v && !/^https:\/\/\S+$/i.test(v)) { plToast(tr("plLinkBad")); return; }
      if (v) { nm[id] = v; any = true; }
    }
    if (any) SONG_META[it.key] = nm; else delete SONG_META[it.key];
    songMetaSave();
    d.close(); renderLib(); renderBanner();
    plToast(tr("plProfileSaved"));
  });
  d.card.append(el("div", "plSep"), save);
}

/* ---------- 📤 プレイリストの共有（trk-playlist v1） ----------
   ・楽曲ファイル・譜面は含まない（曲名などの見出しと、プレイの証明だけ）
   ・マリオメーカー方式：9曲以上＋すべての曲をクリアか視聴済みでないと書き出せない。
     AUTO・📻ラジオ・倍速も「視聴」として数えるが、AUTO視聴だけの曲には ▶AUTO が必ず付く（隠せない）
   ・リンクは https:// 限定。開く前に確認ダイアログ（作成者が設定したもので、trk!は内容を保証しない） */
const PL_SHARE_MIN = 9;
const PLAYED_KEY = "shadow_taiko_played_v1";
let PLAYED = {};
try { PLAYED = JSON.parse(localStorage.getItem(PLAYED_KEY)) || {}; } catch (_) { PLAYED = {}; }
if (!PLAYED || typeof PLAYED !== "object" || Array.isArray(PLAYED)) PLAYED = {};
function playedSave() { try { localStorage.setItem(PLAYED_KEY, JSON.stringify(PLAYED)); } catch (_) {} }
function notePlayed(key, auto) {   /* リザルトまで行った曲＝クリア or 視聴の証明 */
  if (!key) return;
  const e = (PLAYED[key] ||= { last: 0, auto: 0, manual: 0 });
  e.last = Date.now();
  if (auto) e.auto++; else e.manual++;
  playedSave();
}
/* 🎧 メディアプレーヤーで「ちゃんと聴いた」回数（trk172）。⚡スマート棚（最近再生・よく再生）の材料になるだけ。
   証明（plProof＝クリア/視聴）は auto/manual のまま＝プレーヤー再生だけでは共有プレイリストの ▶AUTO 印は付かない */
function noteMediaPlayed(key) {
  if (!key) return;
  const e = (PLAYED[key] ||= { last: 0, auto: 0, manual: 0 });
  e.last = Date.now();
  e.media = (e.media || 0) + 1;
  playedSave();
}
on("screen", id => {
  if (id !== "endScreen") return;
  if (core.currentSong && core.currentSong.key && !window.Trk.play.runShort) notePlayed(core.currentSong.key, !!core.settings.autoPlay);   /* 🕹️ ショートプレイは視聴証明にしない */
});

/* 証明：ランク対象のプレイ記録（クリア）か、視聴記録（AUTO・ラジオ・倍速でもOK） */
function plRecordsIdx() {
  const idx = {};
  for (const r of Object.values(window.Trk.play.records)) if (r && r.title != null) idx[`${r.size}|${r.title}`] = r;
  return idx;
}
function plProof(it, idx) {
  const info = songInfo(it, idx);
  const played = PLAYED[it.key];
  if (info && info.plays > 0) return { ok: true, auto: false, info };
  if (played && played.manual + played.auto > 0) return { ok: true, auto: played.manual === 0, info: null };
  return { ok: false, auto: false, info: null };
}
function plLocalSongs(p) {
  const byKey = new Map(allSongs().map(x => [x.key, x]));
  return p.songs.map(k => byKey.get(k)).filter(Boolean);   /* 端末から消えた曲は対象外 */
}
function plShareData(p, opts) {
  const idx = plRecordsIdx();
  const songs = plLocalSongs(p).map(it => {
    const m = metaOf(it.key) || {}, pr = plProof(it, idx);
    return { title: m.title || it.title, artist: m.artist || it.artist || "", album: m.album || "", composer: m.composer || "",
      srcUrl: /^https:\/\/\S+$/i.test(m.srcUrl || "") ? String(m.srcUrl).slice(0, 300) : "",   /* 曲ごとの入手先（YouTubeなど） */
      key: it.key, size: it.size || 0,
      badges: opts.badges && pr.info ? pr.info.title : "",
      best: opts.score && pr.info ? pr.info.best : 0,
      plays: pr.info ? pr.info.plays : 0,
      auto: pr.auto };   /* ▶AUTO は opts に関係なく必ず入る（記載必須） */
  });
  const src = {};
  if (opts.note) src.note = String(opts.note).slice(0, 60);
  if (opts.url && /^https:\/\/\S+$/i.test(opts.url)) src.url = String(opts.url).slice(0, 300);   /* 書き出しの境界でも https を確認 */
  return { format: "trk-playlist", version: 1, name: p.name, icon: plIcon(p), color: p.color,
    author: String(core.settings.plAuthorName || "").trim().slice(0, 24) || undefined,   /* 👤 投稿者名（受取側の👥投稿者ツールで検索・ブロックできる） */
    count: songs.length, createdAt: new Date(p.createdAt || Date.now()).toISOString(),
    comment: opts.comment || "", tags: opts.tags || [], source: (src.note || src.url) ? src : undefined, songs };
}
function plCopyText(text) {
  const done = () => plToast(tr("plShareCopied"));
  const fallback = () => {
    const ta = el("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-999px";
    document.body.append(ta); ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { fallback(); done(); });
  else { fallback(); done(); }
}
function plShareText(v) {
  const lines = [`${v.icon || "🎧"} ${tr("plShareTextHead")}「${v.name}」（${v.count}曲）`];
  if (v.author) lines.push("👤 " + v.author);   /* 👀 投稿者（共有ファイルから） */
  for (const s of v.songs.slice(0, 20)) {
    const bits = [s.title];
    if (s.badges) bits.push(s.badges);
    if (s.auto) bits.push(tr("plAutoMark"));
    else if (s.best) bits.push(s.best.toLocaleString());
    lines.push("♪ " + bits.join(" "));
    if (s.srcUrl) lines.push(s.srcUrl);   /* 曲ごとの入手先（Esports名場面集など） */
  }
  if (v.songs.length > 20) lines.push(`… +${v.songs.length - 20}`);
  if (v.comment) lines.push(`📝 ${v.comment}`);
  if (v.source && v.source.note) lines.push(`🔗 ${v.source.note}`);
  if (v.source && v.source.url) lines.push(v.source.url);
  if (v.tags && v.tags.length) lines.push(v.tags.map(t => "#" + t.replace(/[\s、，,#]/g, "")).filter(Boolean).join(" "));
  return lines.join("\n");
}
/* 共有ダイアログ（書き出し条件をその場で確認） */
function plShare(p) {
  const d = plDialog(tr("plShareTitle") + "：" + p.name);
  const comment = el("input", "plInput"); comment.type = "text"; comment.maxLength = 140; comment.placeholder = tr("plShareComment");
  const note = el("input", "plInput"); note.type = "text"; note.maxLength = 60; note.placeholder = tr("plShareSourceNote");
  const url = el("input", "plInput"); url.type = "text"; url.maxLength = 300; url.placeholder = "https://…";
  const tags = el("input", "plInput"); tags.type = "text"; tags.maxLength = 80; tags.value = (p.tags || []).join(" "); tags.placeholder = tr("plTagsPh");
  const sc = el("input"); sc.type = "checkbox"; sc.checked = true;
  const bd = el("input"); bd.type = "checkbox"; bd.checked = true;
  const status = el("div", "plHint");
  const opts = () => ({ comment: comment.value.trim().slice(0, 140), note: note.value.trim().slice(0, 60),
    url: /^https:\/\/\S+$/i.test(url.value.trim()) ? url.value.trim() : "", badges: bd.checked, score: sc.checked,
    tags: tags.value.split(/[\s、，,]+/).map(x => x.trim().slice(0, 16)).filter(Boolean).slice(0, 5) });
  const check = () => {
    const songs = plLocalSongs(p);
    if (songs.length < PL_SHARE_MIN) { status.textContent = tr("plShareNeed9", { n: songs.length }); return false; }
    const idx = plRecordsIdx();
    const unplayed = songs.filter(it => !plProof(it, idx).ok).map(it => songDisplayTitle(it));
    if (unplayed.length) {
      status.textContent = tr("plShareUnplayed", { list: unplayed.slice(0, 3).join(" / ") + (unplayed.length > 3 ? " …" : "") });
      return false;
    }
    status.textContent = tr("plShareReady", { n: songs.length });
    return true;
  };
  check();
  const exportBtn = el("button", "plBtn", tr("plShareExport")); exportBtn.type = "button";
  exportBtn.addEventListener("click", () => {
    if (!check()) return;
    const o = opts();
    core.downloadJSON(plShareData(p, o), `trk-playlist-${core.safeName(p.name)}.json`);
    p.createdAt = p.createdAt || Date.now(); p.tags = o.tags; core.saveUserPrefs();
    plToast(tr("plShareExported"));
  });
  const copyBtn = el("button", "plBtn", tr("plShareCopy")); copyBtn.type = "button";
  copyBtn.addEventListener("click", () => { if (check()) plCopyText(plShareText(plShareData(p, opts()))); });
  d.card.append(
    el("div", "plHint", tr("plShareRule")),
    plRow(tr("plShareComment"), comment),
    plRow(tr("plShareSourceNote"), note),
    plRow(tr("plShareSourceUrl"), url),
    plRow(tr("plTags"), tags),
    plRow(tr("plShareScore"), sc), plRow(tr("plShareBadges"), bd),
    status, exportBtn, copyBtn);
}

/* ---------- 📥 読み込み（ビューア → ある曲だけ取り込む） ---------- */
function plSanitizeShared(raw) {
  if (!raw || typeof raw !== "object" || raw.format !== "trk-playlist" || !Array.isArray(raw.songs)) return null;
  const songs = raw.songs.slice(0, 1000).map(s => (s && typeof s === "object") ? {
    title: String(s.title || "").trim().slice(0, 120), artist: String(s.artist || "").trim().slice(0, 100),
    album: String(s.album || "").trim().slice(0, 100), composer: String(s.composer || "").trim().slice(0, 100),
    srcUrl: /^https:\/\/\S+$/i.test(String(s.srcUrl || "")) ? String(s.srcUrl).trim().slice(0, 300) : "",
    key: typeof s.key === "string" ? s.key.slice(0, 128) : "", size: Number(s.size) || 0,
    badges: String(s.badges || "").slice(0, 40),
    best: Math.max(0, Math.floor(Number(s.best) || 0)), plays: Math.max(0, Math.floor(Number(s.plays) || 0)),
    auto: !!s.auto
  } : null).filter(s => s && s.title);
  if (!songs.length) return null;
  const note = String((raw.source && raw.source.note) || "").trim().slice(0, 60);
  const urlRaw = String((raw.source && raw.source.url) || "").trim();
  const url = /^https:\/\/\S+$/i.test(urlRaw) ? urlRaw.slice(0, 300) : "";
  return { name: String(raw.name || "Playlist").slice(0, 24), icon: String(raw.icon || "🎧").slice(0, 4),
    color: /^[a-z]{3,12}$/.test(raw.color || "") ? raw.color : "none",
    author: typeof raw.author === "string" ? raw.author.trim().slice(0, 24) : "",   /* 👤 投稿者名（任意・古い共有ファイルには無い） */
    count: songs.length, comment: String(raw.comment || "").slice(0, 140),
    tags: (Array.isArray(raw.tags) ? raw.tags : []).map(t => String(t).trim().slice(0, 16)).filter(Boolean).slice(0, 5),
    createdAt: String(raw.createdAt || "").slice(0, 30),
    source: (note || url) ? { note, url } : null, songs };
}
/* 📥 共有プレイリストの曲を、手元の曲から曲名で探す（キーが合わなかったときの救済）。段階的に:
   ① 曲名の完全一致（大きさが分かるときは大きさも合う曲を優先。今までどおり）
   ② 表記ゆれ（区切り・拡張子・トラック番号）は、カタログ照合と同じ plTitleKeys／plSongMatchKeys で探し、
      **候補が1曲に絞れたときだけ**採る。共有側に大きさがあれば大きさの一致も必須。
      plTitleKeys は「08 sometimes」から番号まで外すので、そのまま採ると別のアルバムの「01 intro」と「03 intro」を
      同じ曲として✅にしてしまう。取り違えるより❌のほうが害が小さい（trk130のレビュー指摘）。
   ③ 索引（曲名キー → 曲）は曲リストごとに1度だけ作る（WeakMap＝曲リストが捨てられれば消える）。 */
const plMatchIndexCache = new WeakMap();
function plMatchIndex(all) {
  const cached = plMatchIndexCache.get(all);
  if (cached) return cached;
  const idx = new Map();
  for (const it of all) {
    const m = metaOf(it.key) || {};
    for (const k of plSongMatchKeys(m.title || it.title, m.matchHint)) {
      const a = idx.get(k);
      if (a) { if (!a.includes(it)) a.push(it); } else idx.set(k, [it]);
    }
  }
  plMatchIndexCache.set(all, idx);
  return idx;
}
function plMatchByTitle(s, all) {
  const t = s.title.trim().toLowerCase();
  let fallback = null;
  for (const it of all) {
    if (String((metaOf(it.key) || {}).title || it.title).trim().toLowerCase() !== t) continue;
    if (!fallback) fallback = it;
    if (!s.size || !it.size || s.size === it.size) return it;
  }
  if (fallback) return fallback;
  const idx = plMatchIndex(all), hits = new Set();
  for (const k of plTitleKeys(s.title)) for (const it of idx.get(k) || []) hits.add(it);
  const list = [...hits].filter(it => !s.size || it.size === s.size);
  return list.length === 1 ? list[0] : null;
}
function plOpenLink(url) {   /* https限定＋開く前に確認（osu!の「入手先を明示」流・trk!は内容を保証しない） */
  /* 🛡 呼び出し側でも https を確かめているが、開く瞬間にもう一度通す。
     古い保存データ・手で書き換えた localStorage・将来の呼び出しが javascript: を渡しても開かない。 */
  url = core.safeHttpUrl(url);
  if (!url) return;
  const d = plDialog(tr("plLinkOpen"));
  d.card.append(el("div", "plHint", url), el("div", "plHint", tr("plLinkWarn")));
  const open = el("button", "plBtn", tr("plLinkOpen")); open.type = "button";
  open.addEventListener("click", () => { d.close(); try { const w = window.open(url, "_blank", "noopener,noreferrer"); if (w) w.opener = null; } catch (_) {} });
  const no = el("button", "plBtnDanger", tr("plLinkCancel")); no.type = "button";
  no.addEventListener("click", d.close);
  d.card.append(open, no);
}
function plViewer(v) {
  const d = plDialog(tr("plImportTitle"));
  const all = allSongs(), byKey = new Map(all.map(x => [x.key, x]));
  const matched = [];
  d.card.append(el("b", "plCardTitle", `${v.icon} ${v.name}`));
  d.card.append(el("div", "plHint", [v.createdAt ? v.createdAt.slice(0, 10) : "", tr("plSongsNow", { n: v.songs.length })].filter(Boolean).join(" · ")));
  if (v.author) {   /* 👤 投稿者（ブロック中なら 🚫 を出す。取り込むかどうかは自分で決められる） */
    const abad = core.settings.plAuthorTools && core.settings.plAuthorBlock.includes(v.author);
    d.card.append(el("div", "plHint", (abad ? "🚫 " : "👤 ") + tr("plAuthorBy") + "：" + v.author + (abad ? " ・ " + tr("plAuthorBlockedView") : "")));
  }
  if (v.comment) d.card.append(el("div", "plShareComment", "📝 " + v.comment));
  if (v.tags && v.tags.length) {
    const row = el("div", "plChipsRow");
    for (const t of v.tags) row.append(el("span", "skinChip on", "#" + t));
    d.card.append(row);
  }
  if (v.source) {
    const src = el("div", "plShareSrc");
    if (v.source.note) src.append(el("div", "plHint", "🔗 " + v.source.note));
    if (v.source.url) {
      const btn = el("button", "plBtn", tr("plLinkOpen")); btn.type = "button";
      btn.addEventListener("click", () => plOpenLink(v.source.url));
      src.append(btn, el("div", "plHint", v.source.url));
    }
    d.card.append(src);
  }
  d.card.append(el("div", "plSep"));
  const list = el("div", "plShareList");
  for (const s of v.songs) {
    const it = (s.key && byKey.get(s.key)) || plMatchByTitle(s, all);
    if (it) matched.push(it);
    const row = el("div", "plShareRow" + (it ? "" : " miss"));
    row.append(el("b", "", s.title));
    const sub = [s.artist, s.album].filter(Boolean).join(" · ");
    const marks = [s.badges, s.auto ? tr("plAutoMark") : (s.best ? s.best.toLocaleString() : "")].filter(Boolean).join(" ");
    row.append(el("div", "plHint", [sub, marks].filter(Boolean).join("　")));
    if (s.srcUrl) {
      const lb = el("button", "plLinkMini", "🔗"); lb.type = "button"; lb.title = tr("plLinkOpen");
      lb.addEventListener("click", () => plOpenLink(s.srcUrl));
      row.append(lb);
    }
    row.append(el("span", "plShareState", it ? "✅" : "❌"));
    list.append(row);
  }
  d.card.append(list);
  const take = el("button", "plBtn", tr("plImportTake", { n: matched.length })); take.type = "button";
  take.disabled = !matched.length;
  take.addEventListener("click", () => {
    const p = plSanitize({ id: "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: v.name, icon: "📥", color: v.color, frozen: false, locked: false, songs: matched.map(x => x.key), tags: v.tags, by: v.author || "" });
    p.createdAt = Date.now();
    core.settings.playlists.push(p); core.saveUserPrefs();
    core.settings.libTab = "pl:" + p.id;
    d.close(); renderLib();
    plToast(tr("plImportTaken", { name: p.name }));
  });
  d.card.append(el("div", "plSep"), el("div", "plHint", tr("plImportFound", { n: matched.length, m: v.songs.length })), take);
}
/* 🛡 共有プレイリストの大きさの上限。1000曲×長めの項目（曲名120字など）でも収まる大きさ。
   読み込む前に確かめる（巨大なファイルを f.text()／JSON.parse に渡すと、他人のファイル1つでタブが固まるため。
   設定Import 2 MiB・譜面JSON 2 MiB・スキンJSON 256 KiB と同じ形・F-34）。 */
const PLAYLIST_IMPORT_MAX = 4 * 1024 * 1024;
function plImportPick() {
  const inp = el("input"); inp.type = "file"; inp.accept = "application/json,.json";
  inp.addEventListener("change", async () => {
    const f = inp.files && inp.files[0]; inp.value = "";
    if (!f) return;
    if (typeof f.size !== "number" || !Number.isFinite(f.size) || f.size < 0 || f.size > PLAYLIST_IMPORT_MAX) {
      plToast(tr("plImportTooBig", { n: 4 })); return;
    }
    let raw = null;
    try { raw = JSON.parse(await f.text()); } catch (_) {}
    const v = plSanitizeShared(raw);
    if (!v) { plToast(tr("plImportBad")); return; }
    plViewer(v);
  });
  inp.click();
}

/* ---------- 💾 プレイリストのバックアップ（trk-playlists v1） ----------
   ・すべてのプレイリスト＋フォルダ＋並び順＋曲ごとのメモ（SONG_META）を1ファイルにまとめる
   ・曲ファイル自体は含まない。ブラウザの端末を変えても同じリストを戻せる
   ・既存の共有用 trk-playlist と混ざらないよう format/拡張子を分ける
   ・読み込み時は既存を消さずに追加。IDが重なったら新しいIDで別名追加（上書きで消さない） */
const PLAYLISTS_BACKUP_FORMAT = "trk-playlists";
const PLAYLISTS_BACKUP_VERSION = 1;
const PLAYLISTS_BACKUP_MAX = 4 * 1024 * 1024;
function playlistsExportData() {
  const playlists = (core.settings.playlists || []).map(plSanitize).filter(Boolean);
  const plFolders = (core.settings.plFolders || []).map(plFolderSanitize).filter(Boolean);
  const playlistOrder = Array.isArray(core.settings.playlistOrder) ? core.settings.playlistOrder.filter(id => typeof id === "string" && id.length <= 24) : [];
  const trkRemoved = Array.isArray(core.settings.trkRemoved) ? core.settings.trkRemoved.filter(x => typeof x === "string").slice(0, 50) : [];
  // SONG_META のうちリストに含まれる曲だけを添える（他端末で曲プロフィールの上書きを復元できる）
  const referenced = new Set();
  for (const p of playlists) for (const k of (p.songs || [])) referenced.add(k);
  const songMeta = {};
  for (const k of referenced) {
    const m = (typeof SONG_META === "object" && SONG_META) ? SONG_META[k] : null;
    if (m && typeof m === "object") songMeta[k] = m;
  }
  return {
    format: PLAYLISTS_BACKUP_FORMAT,
    version: PLAYLISTS_BACKUP_VERSION,
    app: "trk",
    savedAt: new Date().toISOString(),
    counts: { playlists: playlists.length, folders: plFolders.length },
    playlists,
    plFolders,
    playlistOrder,
    trkRemoved,
    songMeta
  };
}
function playlistsExport() {
  const data = playlistsExportData();
  if (!data.playlists.length && !data.plFolders.length) { plToast(tr("plBackupEmpty")); return; }
  const iso = new Date().toISOString().slice(0, 10);
  core.downloadJSON(data, `trk-playlists-${iso}.json`);
  plToast(tr("plBackupExported", { n: data.counts.playlists }));
}
function playlistsSanitizeBundle(raw) {
  if (!raw || typeof raw !== "object" || raw.format !== PLAYLISTS_BACKUP_FORMAT || raw.version !== PLAYLISTS_BACKUP_VERSION) return null;
  const playlists = (Array.isArray(raw.playlists) ? raw.playlists : []).map(plSanitize).filter(Boolean).slice(0, 200);
  const plFolders = (Array.isArray(raw.plFolders) ? raw.plFolders : []).map(plFolderSanitize).filter(Boolean);
  const order = Array.isArray(raw.playlistOrder) ? raw.playlistOrder.filter(id => typeof id === "string" && id.length <= 24).slice(0, 200) : [];
  // plFolderTrim で上限40に詰める（固定棚を守る）
  const trimmedFolders = typeof plFolderTrim === "function" ? plFolderTrim(plFolders) : plFolders.slice(0, 40);
  const trkRemoved = Array.isArray(raw.trkRemoved) ? raw.trkRemoved.filter(x => typeof x === "string").slice(0, 50) : [];
  let songMeta = null;
  if (raw.songMeta && typeof raw.songMeta === "object" && !Array.isArray(raw.songMeta)) {
    try { songMeta = songMetaCleanAll(raw.songMeta); } catch (_) { songMeta = null; }
  }
  if (!playlists.length && !trimmedFolders.length) return null;
  return { playlists, plFolders: trimmedFolders, playlistOrder: order, trkRemoved, songMeta };
}
function playlistsImportExecute(bundle) {
  const d = plDialog(tr("plBackupImportTitle"));
  d.card.append(el("div", "plHint", tr("plBackupImportConfirm", { pl: bundle.playlists.length, fld: bundle.plFolders.length })));
  const take = el("button", "plBtn", tr("plBackupImportTake")); take.type = "button";
  take.addEventListener("click", () => {
    const existingPlIds = new Set((core.settings.playlists || []).map(p => p.id));
    const existingFldIds = new Set((core.settings.plFolders || []).map(f => f.id));
    const fldIdMap = new Map();
    let addedFolders = 0;
    // Folders: create with collision handling
    for (const f of bundle.plFolders) {
      let cur = { ...f };
      if (existingFldIds.has(cur.id)) {
        let nid = "fl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        while (existingFldIds.has(nid) || fldIdMap.has(nid)) nid = "fl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        fldIdMap.set(f.id, nid);
        cur.id = nid;
      }
      // parent may refer to a remapped folder (if parent folder was already remapped, fix)
      if (cur.parent && fldIdMap.has(cur.parent)) cur.parent = fldIdMap.get(cur.parent);
      // also if parent not yet remapped but will be later? second pass will fix
      core.settings.plFolders.push(plFolderSanitize(cur) || cur);
      existingFldIds.add(cur.id);
      addedFolders++;
    }
    // second pass fix parent refs that point to remapped ids (for folders that were added before their parent was remapped)
    for (const f of core.settings.plFolders) {
      if (fldIdMap.has(f.parent)) f.parent = fldIdMap.get(f.parent);
    }
    // Playlists: collision handling
    const plIdMap = new Map();
    let addedPl = 0;
    for (const p of bundle.playlists) {
      if (core.settings.playlists.length >= 200) break;
      let cur = { ...p };
      if (existingPlIds.has(cur.id)) {
        let nid = "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        while (existingPlIds.has(nid)) nid = "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        plIdMap.set(p.id, nid);
        cur.id = nid;
      }
      if (cur.folder && fldIdMap.has(cur.folder)) cur.folder = fldIdMap.get(cur.folder);
      const sanitized = plSanitize(cur);
      if (!sanitized) continue;
      core.settings.playlists.push(sanitized);
      existingPlIds.add(sanitized.id);
      // map original -> new sanitized id (in case sanitized truncated)
      if (sanitized.id !== p.id && !plIdMap.has(p.id)) plIdMap.set(p.id, sanitized.id);
      addedPl++;
    }
    // playlistOrder merge: keep existing order, append new ids in bundle order
    const order = Array.isArray(core.settings.playlistOrder) ? core.settings.playlistOrder.slice() : [];
    for (const oid of bundle.playlistOrder) {
      const nid = plIdMap.get(oid) || oid;
      if (!order.includes(nid) && existingPlIds.has(nid)) order.push(nid);
    }
    for (const p of bundle.playlists) {
      const nid = plIdMap.get(p.id) || p.id;
      if (!order.includes(nid) && existingPlIds.has(nid)) order.push(nid);
    }
    core.settings.playlistOrder = order.slice(0, 200);
    // songMeta merge: keep existing, add missing
    if (bundle.songMeta && typeof bundle.songMeta === "object") {
      for (const [k, v] of Object.entries(bundle.songMeta)) {
        if (!SONG_META[k] && Object.keys(SONG_META).length < SONG_META_MAX) SONG_META[k] = v;
      }
      try { songMetaSave(); } catch (_) {}
    }
    if (bundle.trkRemoved && bundle.trkRemoved.length) {
      const cur = new Set(core.settings.trkRemoved || []);
      for (const id of bundle.trkRemoved) cur.add(id);
      core.settings.trkRemoved = [...cur].slice(0, 50);
    }
    try { core.saveUserPrefs(); } catch (_) {}
    d.close();
    try { renderLib(); } catch (_) {}
    plToast(tr("plBackupImported", { added: addedPl, folders: addedFolders, n: core.settings.playlists.length }));
  });
  const cancel = el("button", "plBtnDanger", tr("plLinkCancel")); cancel.type = "button";
  cancel.addEventListener("click", () => d.close());
  d.card.append(el("div", "plSep"), take, cancel);
}
function playlistsImportPick() {
  const inp = el("input"); inp.type = "file"; inp.accept = "application/json,.json";
  inp.addEventListener("change", async () => {
    const f = inp.files && inp.files[0]; inp.value = "";
    if (!f) return;
    if (typeof f.size !== "number" || !Number.isFinite(f.size) || f.size < 0 || f.size > PLAYLISTS_BACKUP_MAX) {
      plToast(tr("plBackupTooBig", { n: 4 })); return;
    }
    let raw = null;
    try { raw = JSON.parse(await f.text()); } catch (_) {}
    const bundle = playlistsSanitizeBundle(raw);
    if (!bundle) { plToast(tr("plBackupBad")); return; }
    playlistsImportExecute(bundle);
  });
  inp.click();
}

/* タブの設定メニュー（長押しと、タブ帯の ⚙ ボタンで同じものを開く）。🐔 は名前を変えられないので階層だけ */
function tabSettingsMenu(t) {
  if (t.trk) plTrkMenu(); else if (t.pl) plMenu(t.pl); else if (t.fld) plFolderMenu(t.fld); else plGlobalMenu();
}
/* タブ帯を描いて、いま選ばれているタブのIDを返す */
function renderLibTabs(tabs) {
  const box = core.$("libTabs");
  const active = tabs.some(t => t.id === core.settings.libTab) ? core.settings.libTab : "all";
  if (!box) return active;
  box.textContent = "";
  box.hidden = false;   /* 🎧 「＋」（新規プレイリスト）があるので、タブが1つでも帯は出す */
  /* role=tablist は「タブだけ」を子に持たせ、＋ボタンはその外に置く（入れ子の規則を守る）。
     見た目は display:contents なので、これまでと同じ並び・同じスキンのまま */
  const tabList = el("div", "libTabsList"); tabList.setAttribute("role", "tablist"); tabList.setAttribute("aria-label", tr("libTitle"));
  for (const t of tabs) {
    const b = el("button", "libTab" + (t.id === active ? " on" : "")); b.type = "button";
    b.dataset.tab = t.id;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(t.id === active));
    b.title = tr("libTabGo", { n:t.n }) + (t.pl ? (t.pl.frozen ? " · 🧊" : "") + (t.pl.locked ? " · 🔒" : "") : "");
    if (t.pl) {
      b.dataset.pl = t.pl.id;
      const c = PL_COLORS[t.pl.color];
      if (c) { b.style.background = c; b.style.borderColor = c; b.classList.add("plCol"); }
    }
    if (t.fld) {
      b.dataset.fld = t.fld.id;
      const c = PL_COLORS[t.fld.color];
      if (c) { b.style.background = c; b.style.borderColor = c; b.classList.add("plCol"); }
    }
    if (t.nested) b.classList.add("plNested");   /* フォルダの中のプレイリスト（いま見ているぶん） */
    /* 🐔 trk's playlist は表示名を短くしても、読み上げ名は「🐔 trk's playlist」のままにする */
    if (t.trk) b.setAttribute("aria-label", tr("trkTab"));
    b.append(el("span", "libTabIcon", t.icon), el("span", "libTabName", t.label), el("i", "libTabN", String(t.n)));
    b.addEventListener("click", () => {
      if (plSuppressClick()) return;
      if (t.trk) { plTrkMenu(); return; }   /* 🐔：階層（Vol 一覧）を開く。選んだ Vol は、その中で開く */
      if (core.settings.libTab === t.id) return;
      core.settings.libTab = t.id; core.saveUserPrefs(); renderLib();
    });
    b.addEventListener("mousedown", e => { if (e.button === 1) e.preventDefault(); });   /* 中クリックのオートスクロールを止める */
    b.addEventListener("auxclick", e => {
      if (e.button !== 1) return;
      if (t.id === "all") plCreate();            /* 📚すべて の中クリック＝新規プレイリスト */
      else if (t.pl && t.pl.folder) plCloseOpenTab(t.pl);   /* 📂フォルダ内プレイリストの中クリック＝タブを閉じる（本体は残す） */
      else if (t.pl) plDeleteGesture(t.pl, b);   /* プレイリストタブの中クリック＝削除 */
    });
    /* 長押し＝設定（スマホ・PC共通）。⚠ 🐔 trk's playlist だけは名前と色を変えられないので、
       プロフィール編集（plMenu／plFolderMenu）へは行かせず、階層（Vol 一覧）を開く動作に固定する */
    onLongPress(b, () => tabSettingsMenu(t));
    if (t.pl) {   /* 曲をドラッグして乗せると追加 */
      b.addEventListener("dragover", e => { e.preventDefault(); b.classList.add("dragOver"); });
      b.addEventListener("dragleave", () => b.classList.remove("dragOver"));
      b.addEventListener("drop", e => {
        e.preventDefault(); b.classList.remove("dragOver");
        const key = e.dataTransfer.getData("text/plain") || plDragKey;
        if (key) { const n = t.pl.songs.length; plAddSong(t.pl, key); if (t.pl.songs.length !== n) renderLib(); }
      });
    }
    tabList.append(b);
  }
  box.append(tabList);
  const plus = el("button", "libTab plPlus", "＋"); plus.type = "button";
  plus.title = tr("plNewTab"); plus.setAttribute("aria-label", tr("plNewTab"));
  plus.addEventListener("click", () => { if (!plSuppressClick()) plCreate(); });
  box.append(plus);
  /* ⚙ いま選んでいるタブの設定（長押しの代わり。設定 showMoreBtns で隠せる） */
  const activeTab = tabs.find(t => t.id === active);
  if (activeTab) {
    const gear = el("button", "libTab plPlus moreBtn", "⚙"); gear.type = "button";
    gear.title = tr("tabSettingsBtn"); gear.setAttribute("aria-label", tr("tabSettingsBtn"));
    gear.addEventListener("click", () => { if (!plSuppressClick()) tabSettingsMenu(activeTab); });
    box.append(gear);
  }
  return active;
}

/* ---------- 曲リストの表示 ---------- */
/* 長押しの代わりのボタン（曲の 🎶・テレビくわしいの ▶）を出すか。設定 showMoreBtns（既定は出す） */
function syncMoreBtns() {
  const on = core.settings.showMoreBtns !== false;
  document.body.classList.toggle("noMoreBtns", !on);
  const c = core.$("showMoreBtns"); if (c) c.checked = on;
}
core.$("showMoreBtns").addEventListener("change", e => {
  core.settings.showMoreBtns = e.target.checked; core.saveUserPrefs(); syncMoreBtns();
});
/* 表示の並び（かんたん／全部）と開発者表示（devView）。どちらも即時に反映（TV の映像フィルターの並びは次の読み込みで） */
function syncDisplayUi() {
  const s = core.settings;
  const sel = core.$("displayMode"); if (sel) sel.value = s.displayMode === "full" ? "full" : "simple";
  const dv = core.$("devView"); if (dv) dv.checked = s.devView === true;
  document.body.classList.toggle("noDev", s.devView !== true);
}
core.$("displayMode").addEventListener("change", e => {
  core.settings.displayMode = e.target.value === "full" ? "full" : "simple"; core.saveUserPrefs(); syncDisplayUi(); core.emit("displayMode");
});
core.$("devView").addEventListener("change", e => {
  core.settings.devView = e.target.checked; core.saveUserPrefs(); syncDisplayUi();
});

const SONG_ART_CACHE_BYTES = 12 * 1024 * 1024, SONG_ART_CACHE_ITEMS = 120, SONG_ART_DISPLAY_BYTES = 8 * 1024 * 1024;
const songArtCache = new Map();            // key -> resized Blob | null (negative entries are bounded too)
const songArtPending = new Map();
let songArtCacheBytes = 0, songArtLoadsActive = 0, songArtLoadWaiters = [];
let libArtworkObserver = null, libArtworkGeneration = 0;
const libArtworkUrls = new Set();
function songArtCacheKey(it) {
  const f = it && it.file;
  return `${it && it.key || ""}|${it && it.dir || ""}|${f && f.name || ""}|${f && f.size || it && it.size || 0}|${f && f.lastModified || 0}`;
}
function rememberSongArt(key, blob) {
  if (songArtCache.has(key)) { const old = songArtCache.get(key); if (old) songArtCacheBytes -= old.size || 0; songArtCache.delete(key); }
  if (blob && blob.size > SONG_ART_CACHE_BYTES) return;
  songArtCache.set(key, blob || null); if (blob) songArtCacheBytes += blob.size || 0;
  while (songArtCache.size > SONG_ART_CACHE_ITEMS || songArtCacheBytes > SONG_ART_CACHE_BYTES) {
    const oldest = songArtCache.keys().next().value;
    if (oldest == null) break;
    const old = songArtCache.get(oldest); if (old) songArtCacheBytes -= old.size || 0;
    songArtCache.delete(oldest);
  }
}
function cachedSongArt(key) {
  if (!songArtCache.has(key)) return undefined;
  const blob = songArtCache.get(key); songArtCache.delete(key); songArtCache.set(key, blob);
  return blob;
}
async function withSongArtSlot(fn) {
  if (songArtLoadsActive >= 2) await new Promise(resolve => songArtLoadWaiters.push(resolve));
  else songArtLoadsActive++;
  try { return await fn(); }
  finally {
    const wake = songArtLoadWaiters.shift();
    if (wake) wake();                         // hand the occupied slot directly to the next waiter
    else songArtLoadsActive--;
  }
}
function canExtractSongArt(it) {
  if (!it || !it.file) return false;
  const ext = core.extOf(it.file.name);
  if (it.video && ext !== "mp4") return false;
  return ["mp3", "m4a", "m4b", "mp4", "aac", "wav", "flac", "ogg", "oga", "opus"].includes(ext);
}
async function loadSongArtwork(it) {
  if (!it) return null;
  if (it.bgBlob) return it.bgBlob;                // 曲パックに明示された背景を一覧のサムネイルにも使う
  if (it.artBlob) return it.artBlob;
  if (!canExtractSongArt(it)) return null;
  const key = songArtCacheKey(it), cached = cachedSongArt(key);
  if (cached !== undefined) return cached;
  if (songArtPending.has(key)) return songArtPending.get(key);
  const job = withSongArtSlot(async () => {
    const api = window.Trk.media && window.Trk.media.audioArt;
    if (!api) return null;
    const raw = await api.extract(it.file);
    return raw ? await api.thumbnail(raw) : null;
  }).then(blob => { rememberSongArt(key, blob); return blob; }).catch(() => { rememberSongArt(key, null); return null; });
  songArtPending.set(key, job);
  try { return await job; } finally { if (songArtPending.get(key) === job) songArtPending.delete(key); }
}
/* ---------- 🏷 埋め込みテキストタグ（trk167）：表示だけ。元ファイルは書き換えない ----------
   サムネイルと同じタイミング（行が見えたとき・曲を選んだとき）に並行して読む。
   結果はメモリの Map だけ（リロード後は読み直す）。タグの正はファイルの中にあるので、
   別の場所に複製してファイルとズレた表示を出さない。 */
const songTags = new Map();               /* song key -> { title, artist, album, albumArtist, genre, track, trackTotal } | null */
const songTagsPending = new Map();        /* song key -> Promise（二重読み込み防止） */
function songTagsOf(it) { return (it && songTags.get(it.key)) || null; }
function songTagField(it, field) { const t = songTagsOf(it); return (t && t[field]) || ""; }
/* 表示用のまとめ（優先順：🎶 ユーザー設定 → 🏷 タグ → 曲オブジェクトの値） */
function songDisplayMeta(it) {
  const m = metaOf(it && it.key) || {}, t = songTagsOf(it);
  return { title: songDisplayTitle(it, m),
    artist: m.artist || (t && t.artist) || (it && it.artist) || "",
    album: m.album || (t && t.album) || "" };
}
/* trk191: 💬 「いまの曲」のスナップショット（アドオン API v2・trk-context/1 の材料）。
   読むだけで何も変えない。曲が無ければ null。位置と長さは呼んだ瞬間の値。
   送るかどうかはアドオン側（送る前のプレビュー）で決める＝本体は外部へ送らない。 */
function nowPlaying() {
  const it = core.currentSong;
  if (!it || typeof it !== "object") return null;
  const m = songDisplayMeta(it);
  const v = document.getElementById("video");
  const num = x => (Number.isFinite(x) ? x : 0);
  return {
    schema: "trk-now-playing/1",
    key: String(it.key || ""),
    title: String(m.title || ""), artist: String(m.artist || ""), album: String(m.album || ""),
    pack: it.source === "pack" ? String(it.packName || "") : "",
    source: srcLabel(it),
    sourceUrl: typeof it.sourceUrl === "string" ? it.sourceUrl : "",
    bpm: num(it.bpm),
    position: num(v && v.currentTime),
    duration: num(v && v.duration) || num(it.duration),
    phase: typeof core.phase === "string" ? core.phase : "",
    at: Date.now(),
  };
}
async function loadSongTags(it) {
  if (!it || !it.file || !canExtractSongArt(it)) return null;
  if (songTags.has(it.key)) return songTags.get(it.key);
  if (songTagsPending.has(it.key)) return songTagsPending.get(it.key);
  const job = withSongArtSlot(async () => {
    const api = window.Trk.media && window.Trk.media.audioArt;
    if (!api || typeof api.extractTags !== "function") return null;
    try { return await api.extractTags(it.file); } catch (_) { return null; }
  }).then(tags => {
    songTags.set(it.key, tags || null);
    if (tags) onSongTagsLoaded(it);
    return tags || null;
  }).catch(() => { songTags.set(it.key, null); return null; });
  songTagsPending.set(it.key, job);
  try { return await job; } finally { if (songTagsPending.get(it.key) === job) songTagsPending.delete(it.key); }
}
function onSongTagsLoaded(it) {
  refreshRowTags(it);                              /* 一覧の行はその場で更新（ぜんぶ描き直さない） */
  if (core.currentSong === it) renderBanner();     /* 選曲中の曲ならバナーも */
  /* 💿🎤 グループ棚を見ているときは、タグが届くたびに（250ms ためて）並び直す（trk171） */
  if (core.settings.libTab === "albums" || core.settings.libTab === "artists") libGroupRerenderSoon();
  core.emit("songTags", it);                       /* メディアプレーヤー側は queue／表示を追従させる */
}
function refreshRowTags(it) {
  const box = core.$("libList");
  if (!box || typeof box.querySelectorAll !== "function") return;
  for (const node of box.querySelectorAll(".libRow[data-song-key]")) {
    if (node.dataset.songKey !== it.key) continue;
    const name = node.querySelector(".libName"), sub = node.querySelector(".libSub");
    if (name) name.textContent = libRowNameText(it, node.__trkRowInfo || null);
    if (sub) sub.textContent = libRowSubText(it);
    return;
  }
}
function libRowNameText(it, info) {
  return (it.video ? "🎬 " : "") + songDisplayTitle(it) + (info && info.title ? " " + info.title : "");
}
function libRowSubText(it) {
  const m = metaOf(it.key) || {}, d = songDisplayMeta(it);
  return [d.artist, d.album, m.matchHint ? `${tr("plMatchMemo")}: ${m.matchHint}` : "", srcLabel(it)].filter(Boolean).join(" · ");
}
/* 💿🎤 アルバム別／アーティスト別のグループ表示＋トラック番号順（trk171・PLAYER-ROADMAP #16）
   材料は songDisplayMeta（🎶 曲プロフィール → 🏷 埋め込みタグ → カタログ）。トラック番号はタグの TRCK 等から。
   グループの無い曲（タグなし）は「タグなし」グループ＝いちばん最後。読み取りだけで書き戻し・送信はしない。 */
function libTrackNoOf(it) {
  const t = songTagsOf(it);
  return t && Number.isFinite(t.track) && t.track > 0 && t.track < 10000 ? t.track : null;
}
function libGroupKeyOf(it, mode) {
  const d = songDisplayMeta(it);
  return (mode === "artists" ? d.artist : d.album) || "";
}
function libGroupCmp(mode, fallback) {
  const byTrack = (a, b) => {
    const ta = libTrackNoOf(a.it), tb = libTrackNoOf(b.it);
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    if (ta != null && tb == null) return -1;      /* 番号あり → なし の順 */
    if (tb != null && ta == null) return 1;
    return 0;
  };
  const byName = (x, y) => String(x || "").localeCompare(String(y || ""), undefined, { numeric:true });
  return (a, b) => {
    const ga = libGroupKeyOf(a.it, mode), gb = libGroupKeyOf(b.it, mode);
    if (!ga && gb) return 1;                      /* 「タグなし」は最後 */
    if (!gb && ga) return -1;
    if (ga !== gb) return byName(ga, gb);
    if (mode === "artists") {                     /* アーティスト内はアルバム名順でまとめて */
      const aa = libGroupKeyOf(a.it, "albums"), ab = libGroupKeyOf(b.it, "albums");
      if (aa && !ab) return -1;
      if (ab && !aa) return 1;
      if (aa !== ab) return byName(aa, ab);
    }
    return byTrack(a, b) || fallback(a, b);       /* 同じグループ内はトラック番号 → 選んでいる並び順 */
  };
}
/* ⚡ スマート棚（trk172・PLAYER-ROADMAP #11）：「最近再生」「よく再生」「最近追加」の3セクション。
   材料は端末内の記録だけ＝🎮 リザルトの記録（records）・PLAYED（視聴/クリア＋🎧 プレーヤー再生）・追加日時（addedAt）。
   同じ曲が2つのセクションに出ることがある（ただの「ビュー」＝プレイリストと違って保存データを増やさない・触らない）。 */
function libSmartLast(x) {
  const p = PLAYED[x.it.key];
  return Math.max((x.info && x.info.last) || 0, (p && p.last) || 0);
}
function libSmartPlays(x) {
  /* 🎮 の回数（records と PLAYED の manual/auto は同じ出来事を数えているので、大きい方だけを採用）＋🎧 プレーヤー再生 */
  const p = PLAYED[x.it.key];
  return Math.max((x.info && x.info.plays) || 0, p ? (p.manual || 0) + (p.auto || 0) : 0) + ((p && p.media) || 0);
}
function libSmartSections(items, labeler, cap = 50) {
  const secs = [];
  const recent = items.filter(x => libSmartLast(x) > 0).sort((a, b) => libSmartLast(b) - libSmartLast(a)).slice(0, cap);
  const top = items.filter(x => libSmartPlays(x) > 0).sort((a, b) => libSmartPlays(b) - libSmartPlays(a)).slice(0, cap);
  const added = items.filter(x => x.it.addedAt > 0).sort((a, b) => b.it.addedAt - a.it.addedAt).slice(0, cap);
  if (recent.length) secs.push({ label: labeler("libSmartRecent"), rows: recent });
  if (top.length) secs.push({ label: labeler("libSmartTop"), rows: top });
  if (added.length) secs.push({ label: labeler("libSmartAdded"), rows: added });
  return secs;
}
/* ⚡ セクション見出し（💿🎤 のグループ見出しと同じ見た目・sticky） */
function libSectionHead(label, n) {
  const head = el("div", "libGroupHead");
  head.append(el("span", "libGroupName", label), el("span", "libGroupN", tr("libGroupCount", { n })));
  return head;
}
/* 📈 進捗フィルター（trk174・PLAYER-ROADMAP #15）：**表示層だけ**＝行を絞るだけで、保存データは何も触らない。
   材料は位置記憶（trk_media_positions_v1・メディアプレーヤーが 5 秒以上の再生位置を保存し、最後まで聴くと消える設計）と
   再生回数（PLAYED＝🎮 クリア/視聴＋🎧 プレーヤー計数・records）。位置が消えている＝聴き終わった可能性なので、
   「完了」は一度通して聴いた回数で見る（位置記憶だけでは完了と未聴を区別できないため）。 */
function libPositions() {
  try {
    const raw = JSON.parse(localStorage.getItem("trk_media_positions_v1")) || {};
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch (_) { return {}; }
}
function libProgressOf(x, positions) {
  const key = x.it.key;
  const pos0 = positions && typeof positions === "object" ? positions : {};   /* 表示層なので壊れた材料でも絶対に投げない */
  const fp = songPrefs.keyFp[key];   /* 位置はふつう指紋（size:duration）で保存される。選曲時に覚えた対応を引く */
  const pos = Number(pos0[key]) > 0 ? Number(pos0[key]) : (fp && Number(pos0[fp]) > 0 ? Number(pos0[fp]) : 0);
  if (pos > 0) return "progress";
  const p = PLAYED[key];
  if ((p && ((p.manual || 0) + (p.auto || 0) + (p.media || 0) > 0)) || (x.info && x.info.plays > 0)) return "done";
  return "new";
}
let songBackgroundRequest = 0;
async function applySongBackground(it) {
  const request = ++songBackgroundRequest;
  if (!it || core.currentSong !== it) return false;
  let studyCover = null;
  if (core.settings.useStudyArtwork && window.TrkStudyRoom && typeof window.TrkStudyRoom.getSongCoverBlob === "function") {
    try { studyCover = await window.TrkStudyRoom.getSongCoverBlob(it.key); } catch (_) {}
  }
  if (core.currentSong !== it || request !== songBackgroundRequest) return false;
  const blob = studyCover || it.bgBlob || it.artBlob || null;
  try { await window.Trk.media.setBackground(blob); } catch (_) {}
  if (core.currentSong !== it || request !== songBackgroundRequest) {
    if (core.currentSong && core.currentSong !== it) void applySongBackground(core.currentSong);
    return false;
  }
  return true;
}
function beginLibArtworkRender() {
  if (libArtworkObserver) { libArtworkObserver.disconnect(); libArtworkObserver = null; }
  for (const url of libArtworkUrls) { try { URL.revokeObjectURL(url); } catch (_) {} }
  libArtworkUrls.clear();
  const generation = ++libArtworkGeneration;
  if (typeof IntersectionObserver === "function") {
    const box = core.$("libList");
    libArtworkObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting && entry.intersectionRatio <= 0) continue;
        const img = entry.target, job = img.__trkSongArtJob;
        if (libArtworkObserver) libArtworkObserver.unobserve(img);
        if (job) { loadSongArtwork(job.it).then(blob => showSongArtwork(job, blob)).catch(() => {}); void loadSongTags(job.it); }   /* 🏷 タグも同じ可視タイミングで読む（trk167） */
      }
    }, { root:box, rootMargin:"140px 0px" });
  }
  return generation;
}
function showSongArtwork(job, blob) {
  if (!blob || job.generation !== libArtworkGeneration || job.img.isConnected === false || !job.img.parentNode || blob.size > SONG_ART_DISPLAY_BYTES ||
      !/^image\/(?:png|jpeg|webp)$/i.test(String(blob.type || ""))) return;
  let url = "";
  try { url = URL.createObjectURL(blob); } catch (_) { return; }
  libArtworkUrls.add(url);
  const fail = () => {
    job.img.hidden = true; job.fallback.hidden = false;
    if (libArtworkUrls.delete(url)) { try { URL.revokeObjectURL(url); } catch (_) {} }
  };
  job.img.onload = () => {
    if (job.generation !== libArtworkGeneration || job.img.isConnected === false || !job.img.parentNode) { fail(); return; }
    job.img.hidden = false; job.fallback.hidden = true;
  };
  job.img.onerror = fail;
  job.img.src = url;
}
function watchSongArtwork(img, fallback, it, generation, eager = false) {
  const job = { img, fallback, it, generation };
  img.__trkSongArtJob = job;
  if (libArtworkObserver) libArtworkObserver.observe(img);
  else if (eager) { loadSongArtwork(it).then(blob => showSongArtwork(job, blob)).catch(() => {}); void loadSongTags(it); }   /* 🏷 タグも（trk167） */
}

/* 💿🎤 グループ棚（アルバム／アーティスト）のタグ先読みと並び直し（trk171）。
   タグは普段「行が見えたとき」に読むが、グループ棚は読み終わるまで分け方を決められないので、
   見える行数ぶん（LIB_SHOW）を先に読みはじめる。1件届くごとに 250ms ためて並び直す（描き直し storm 防止）。 */
let libGroupRerenderTimer = 0;
function libGroupRerenderSoon() {
  clearTimeout(libGroupRerenderTimer);
  libGroupRerenderTimer = setTimeout(() => {
    libGroupRerenderTimer = 0;
    const t = core.settings.libTab;
    if (t === "albums" || t === "artists") renderLib();
  }, 250);
}
function libEnsureGroupTags(items) {
  let pending = 0;
  const done = () => { if (--pending === 0) libGroupRerenderSoon(); };
  for (const x of items.slice(0, LIB_SHOW)) {
    const it = x.it;
    if (!it || !it.file || songTags.has(it.key) || songTagsPending.has(it.key) || !canExtractSongArt(it)) continue;
    pending++;
    loadSongTags(it).then(done, done);
  }
}
function renderLib() {
  const artworkGeneration = beginLibArtworkRender();
  let eagerArtworkCount = 0;
  syncMoreBtns();
  syncDisplayUi();
  const box = core.$("libList"); box.textContent = "";
  const all = allSongs();
  libAllKeys = new Set(all.map(x => x.key));
  const shownN = all.filter(x => !x.trkOnly).length;   /* プレイリストの中だけの曲は数えない */
  core.$("libCount").textContent = shownN ? tr("libCount", { n:shownN }) : "";
  const byTitle = new Map();   /* 🛒 カタログ照合用（曲名の照合キー → 曲のリスト） */
  const byTitleAdd = (k, it) => { const a = byTitle.get(k); if (a) { if (!a.includes(it)) a.push(it); } else byTitle.set(k, [it]); };
  for (const it of all) {
    const m = metaOf(it.key) || {};
    for (const k of plSongMatchKeys(m.title || it.title, m.matchHint)) byTitleAdd(k, it);
  }
  {   /* Musicフォルダに「欲しい曲」が届いていたら自動でプレイリストへ（🧊フリーズ中は尊重） */
    const wishers = core.settings.playlists.filter(p => p.wish && p.wish.length && !p.frozen);
    if (wishers.length && all.length) { let ch = false; for (const p of wishers) if (plSyncWishes(p, byTitle)) ch = true; if (ch) core.saveUserPrefs(); }
  }
  const tabId = renderLibTabs(libTabsOf(all));          // タブは、曲が1つも無くても片付ける
  /* 🛒 「集める棚」（wish つきプレイリスト／それを含むフォルダ）は、曲が1つも無くても
     カタログの曲を灰色で並べる＝開いた瞬間に「これから集める棚」だと分かる（がっかりさせない） */
  const entries = plCollectionEntries(tabId, byTitle);
  if (!all.length && !entries.length) { libView = []; box.append(el("div", "libEmpty", tr("libEmptyList"))); return; }
  const scope = all.filter(it => libTabMatch(it, tabId));
  const q = core.$("libSearch").value.trim().toLowerCase(), idx = {};
  for (const r of Object.values(window.Trk.play.records)) if (r && r.title != null) idx[`${r.size}|${r.title}`] = r;
  let items = scope
    .filter(it => { if (!q) return true; const m = metaOf(it.key) || {};   /* 🎶 プロフィール情報と曲ID由来のカタログ名も検索対象 */
      return `${songDisplayTitle(it, m)} ${it.dir || ""} ${m.artist || it.artist || ""} ${m.album || ""} ${m.matchHint || ""} ${it.packName || ""}`.toLowerCase().includes(q); })
    .map(it => ({ it, info:songInfo(it, idx) }));
  /* 📈 進捗フィルター（trk174）：未聴/継続/完了で絞る（検索・タブ・グループ棚のすべてと組み合わせられる。表示層だけ） */
  const progMode = core.settings.libProgress || "all";
  if (progMode !== "all") { const pos = libPositions(); items = items.filter(x => libProgressOf(x, pos) === progMode); }
  const v = (x, k) => (x.info ? x.info[k] : 0);
  const cmp = {
    name:(a, b) => songDisplayTitle(a.it).localeCompare(songDisplayTitle(b.it), undefined, { numeric:true }),
    plays:(a, b) => v(b, "plays") - v(a, "plays"),
    recent:(a, b) => v(b, "last") - v(a, "last"),
    best:(a, b) => v(b, "best") - v(a, "best")
  }[core.settings.libSort] || (() => 0);
  items.sort(cmp);
  /* 💿🎤 グループ棚（trk171）：アルバム別／アーティスト別に並べ直し、見出し行の材料（曲数・アーティスト名）を集める */
  const grouped = tabId === "albums" || tabId === "artists";
  const groupCounts = new Map(), groupArtist = new Map();
  if (grouped) {
    items.sort(libGroupCmp(tabId, cmp));
    for (const x of items) {
      const g = libGroupKeyOf(x.it, tabId);
      groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
      if (tabId === "albums" && g && !groupArtist.has(g)) {
        const t = songTagsOf(x.it), d = songDisplayMeta(x.it);
        const ar = (t && (t.albumArtist || t.artist)) || d.artist || "";
        if (ar) groupArtist.set(g, ar);
      }
    }
    libEnsureGroupTags(items);   /* 🏷 タグの先読み（読み終わると libGroupRerenderSoon で並び直す） */
  }
  const smartSections = tabId === "smart" ? libSmartSections(items, k => tr(k)) : null;   /* ⚡ スマート棚の中身（trk172） */
  if (tabId === "fav") {
    const F = window.TrkFavs;
    if (F) {
      const bar = el("div", "favChipsRow");
      bar.append(F.chips("song", { former:true, onChange: () => renderLib() }));
      box.append(bar);
    }
  }
  if (tabId.startsWith("fld:")) {   /* 📁 フォルダの中身（子フォルダとプレイリスト）へのチップ */
    const fid = tabId.slice(4), bar = el("div", "plChipsRow");
    for (const f of core.settings.plFolders) if (f.parent === fid) {
      const c = el("button", "skinChip"); c.type = "button"; c.textContent = (f.icon || "📁") + " " + f.name;
      c.addEventListener("click", () => { core.settings.libTab = "fld:" + f.id; core.saveUserPrefs(); renderLib(); });
      bar.append(c);
    }
    for (const p of core.settings.playlists) if (p.folder === fid && plVisible(p)) {
      const c = el("button", "skinChip"); c.type = "button"; c.textContent = `${plIcon(p)} ${p.name}（${plCount(p, new Set(all.map(x => x.key)))}）`;
      c.addEventListener("click", () => { core.settings.libTab = "pl:" + p.id; core.saveUserPrefs(); renderLib(); });
      bar.append(c);
    }
    if (bar.childElementCount) box.append(bar);
  }
  /* 並び順：集める棚はカタログ順のまま（持っている＝黒／まだ＝灰色）。それ以外は今までどおり */
  const infoByKey = new Map(items.map(x => [x.it.key, x]));
  const wishHit = q ? e => e.it ? infoByKey.has(e.it.key) : `${e.w.t} ${e.w.al || ""} ${e.w.ar || ""}`.toLowerCase().includes(q) : () => true;
  const usedKeys = new Set();   /* 1曲が2つの wish に当たっても、黒い行は1回だけ */
  const shownWishes = entries.filter(wishHit).filter(e => {
    if (!e.it) return true;
    if (usedKeys.has(e.it.key)) return false;
    usedKeys.add(e.it.key);
    return true;
  });
  const rows = smartSections
    ? (() => {   /* ⚡ スマート棚（trk172）：セクション見出し行（sec）と曲の行を交互に並べる */
        const out = [];
        for (const s of smartSections) {
          out.push({ sec: s.label, n: s.rows.length });
          for (const x of s.rows) out.push({ it: x.it, info: x.info, w: null });
        }
        return out;
      })()
    : entries.length
    ? [...shownWishes.map(e => ({ it: e.it, info: e.it ? infoByKey.get(e.it.key) : null, w: e.w })),
       ...items.filter(x => !usedKeys.has(x.it.key)).map(x => ({ it: x.it, info: x.info, w: null }))]
    : items.map(x => ({ it: x.it, info: x.info, w: null }));
  {   /* libView（TV ◀▶ が進む順番）＝表示順。⚡ 同じ曲が2セクションに出ても1回だけ（trk172） */
    const seenKeys = new Set(); libView = [];
    for (const r of rows) if (r.it && !seenKeys.has(r.it.key)) { seenKeys.add(r.it.key); libView.push(r.it); }
  }
  const haveAll = usedKeys.size, totalAll = entries.length;   /* have は実際に黒くなった曲数 */
  if (totalAll && haveAll < totalAll) {
    /* 1曲も持っていないときは「集める棚」の説明、途中なら「いま何曲目まで」を出す */
    box.append(el("div", "hint plWishHint", haveAll ? tr("plWishHint", { have: haveAll, total: totalAll })
      : tr("plWishHead", { n: totalAll })));
  }
  if (!rows.length) {
    box.append(el("div", "libEmpty", tr(scope.length ? "libNoMatch" : tabId === "fav" ? "libFavEmpty" : (tabId.startsWith("pl:") ? "plTabHint" : tabId.startsWith("fld:") ? "fldTabHint" : "libTabEmpty")))); return;
  }
  /* 🪶 軽量化：初回に描く行数をへらす（行にはボタン・長押し・ドラッグの監視がたくさん付くので、
     長い棚ではここが端末いちばんの待ち時間になります）。棚自体とランダム選曲は全曲のままです */
  const libShow = (typeof TrkLite === "object" && typeof TrkLite.libRows === "function") ? TrkLite.libRows(LIB_SHOW) : LIB_SHOW;
  if (grouped && items.some(x => x.it.file && !songTags.has(x.it.key) && canExtractSongArt(x.it)))
    box.append(el("div", "hint libGroupLoadingHint", tr("libGroupTagsLoading")));   /* 🏷 タグ読み込み中（trk171） */
  let lastGroupHead = null;   /* 💿🎤 いまの見出し（グループが変わったときだけ見出し行を出す・trk171） */
  let pendingSec = null, shownRows = 0;   /* ⚡ スマート棚のセクション見出し（曲の行の直前に出す）と行数カウンタ（trk172） */
  const totalRows = smartSections ? rows.reduce((n, r) => n + (r.sec ? 0 : 1), 0) : rows.length;
  for (const row of rows) {
    if (row.sec) { pendingSec = row; continue; }
    if (shownRows >= libShow) break;
    if (pendingSec) { box.append(libSectionHead(pendingSec.sec, pendingSec.n)); pendingSec = null; }
    shownRows++;
    if (!row.it) { box.append(plWishRow(row.w)); continue; }   /* 🛒 まだ持っていない曲（灰色）＝タップで入手先 */
    if (grouped) {
      const g = libGroupKeyOf(row.it, tabId);
      if (g !== lastGroupHead) {
        lastGroupHead = g;
        const head = el("div", "libGroupHead");
        head.append(el("span", "libGroupName", (tabId === "albums" ? "💿 " : "🎤 ") + (g || tr("libNoTagsGroup"))));
        const ar = tabId === "albums" ? groupArtist.get(g) || "" : "";
        if (ar) head.append(el("span", "libGroupSub", ar));
        head.append(el("span", "libGroupN", tr("libGroupCount", { n: groupCounts.get(g) || 0 })));
        box.append(head);
      }
    }
    const { it, info } = row;
    const wrap = el("div"); wrap.style.cssText = "display:flex;gap:6px;align-items:stretch";
    const cur = core.currentSong && core.currentSong.key === it.key;
    const b = el("button", `libRow src-${it.source}` + (cur ? " cur" : "") + (it.ghost ? " ghost" : "")); b.type = "button"; b.style.flex = "1"; b.style.minWidth = "0";
    b.dataset.songKey = it.key; b.__trkRowInfo = info || null;   /* 🏷 タグが届いたら行だけその場で更新するため（trk167） */
    const left = el("span", "libLeft"), meta = el("span", "libMeta");
    const thumb = el("span", "libThumb"), thumbImg = el("img", ""), thumbFallback = el("span", "libThumbFallback", "♫");
    thumb.setAttribute("aria-hidden", "true"); thumbImg.alt = ""; thumbImg.decoding = "async"; thumbImg.hidden = true;
    thumb.append(thumbImg, thumbFallback);
    const text = el("span", "libText"), m = metaOf(it.key) || {};   /* 🎶 曲プロフィール（長押しで編集） */
    const displayTitle = songDisplayTitle(it, m);
    if(it.ghost) b.setAttribute("aria-label", displayTitle + " — " + tr("srcGhost"));
    text.append(el("span", "libName", libRowNameText(it, info)),   // 例：🎬 動画 / 曲名 🥁🐔🚚⚔🎪🚛
                el("span", "libSub", libRowSubText(it)));
    left.append(thumb, text);
    if (maybeUnplayable(it)) {
      /* 🎞 trk196：選ぶ前に「再生できない場合がある」と分かるように（理由と直し方は長押し先・説明に書いてある） */
      const warn = el("i", "libTag libWarnTag", "⚠"); warn.title = tr("libMaybeUnplayableHint");
      warn.setAttribute("aria-label", tr("libMaybeUnplayableHint")); meta.append(warn);
    }
    if (it.charts) meta.append(el("i", "libTag", "📄"));
    if (it.shared) { const st = el("i", "libTag", "📤"); st.title = tr("libKeepShared"); meta.append(st); }   /* 💾 端末に残した共有の曲 */
    if (it.source === "file" && savedSongs.some(song => song.key === it.key)) { const st = el("i", "libTag", "💾"); st.title = tr("srcStored"); meta.append(st); }
    if (it.chartBlobs && Object.keys(it.chartBlobs).length) meta.append(el("i", "libTag", "📦"));
    if (it.builtinDemo && Object.keys(firstSparkChartMap).length) meta.append(el("i", "libTag", "🎼"));   /* 🎼 trk!手づくりのデモ譜面がいっしょに入っている印 */
    if (info && info.plays) meta.append(el("i", "libTag", tr("libPlays", { n:info.plays })));
    if (info && info.best) meta.append(el("i", "libTag", info.best.toLocaleString()));
    {   /* ⭐ trk215：お気に入りのフォルダの状態を、行にも出す（📌ピン／🧊フリーズ） */
      const F = window.TrkFavs;
      if (F) {
        if (F.pinned("song", it.key)) {
          const pin = el("i", "libTag favTag", "📌");
          pin.title = tr("favPin"); pin.setAttribute("aria-label", tr("favPin"));
          meta.append(pin);
        }
        if (F.inGroup("song", "frozen", it.key)) {
          const fz = el("i", "libTag favTag", "🧊");
          fz.title = tr("favFrozenBadge"); fz.setAttribute("aria-label", tr("favFrozenBadge"));
          meta.append(fz);
        }
      }
    }
    b.append(left, meta);
    b.addEventListener("click", () => { if (!plSuppressClick()) selectSong(it); });
    b.draggable = true;   /* 🎧 プレイリストタブへドラッグして追加 */
    b.addEventListener("dragstart", e => { plDragKey = it.key; try { e.dataTransfer.setData("text/plain", it.key); e.dataTransfer.effectAllowed = "copy"; } catch (_) {} document.body.classList.add("plDragging"); });
    b.addEventListener("dragend", () => { plDragKey = ""; document.body.classList.remove("plDragging"); });
    onLongPress(b, () => songProfile(it));   /* 🎶 長押しでプロフィール＆プレイリスト */
    wrap.append(b);
    /* 🎶 長押しの代わり（見えるボタン）。設定「長押しの代わりのボタンを出す」で隠せる（body.noMoreBtns） */
    const pb = el("button", "libFav moreBtn", "🎶"); pb.type = "button";
    pb.title = tr("libProfileBtn"); pb.setAttribute("aria-label", tr("libProfileBtn") + " " + displayTitle);
    pb.addEventListener("click", e => { e.stopPropagation(); songProfile(it); });
    wrap.append(pb);
    /* ⭐ お気に入り（📌は ⋯ のメニューから） */
    const F = window.TrkFavs;
    if (F) {
      const inFav = F.has("song", it.key);
      const sb = el("button", "libFav" + (inFav ? " on" : ""), inFav ? "★" : "☆");
      sb.type = "button";
      sb.title = tr(inFav ? "favDel" : "favAdd");
      sb.setAttribute("aria-label", tr(inFav ? "favIn" : "favAdd") + " " + displayTitle);
      sb.setAttribute("aria-pressed", String(inFav));
      sb.addEventListener("click", e => {
        e.stopPropagation();
        if (inFav) { const r = F.remove("song", it.key); if (!r.ok) F.toast(F.msg(r.why, r.g)); }
        /* ⭐ trk215：いま開いているフォルダ（2軍／🧊フリーズ）に入れる。📤元お気に入りを見ているときは1軍へ */
        else {
          const g = F.activeOf("song");
          const r = F.add("song", it.key, { group:(g === "sub" || g === "frozen") ? g : "main", append:false });
          if (!r.ok) F.toast(F.msg(r.why, r.g));
        }
        renderLib();
      });
      wrap.append(sb);
      if (inFav || F.groupOf("song", it.key)) wrap.append(F.menuButton("song", it.key, "libMenu"));
    }
    if (it.source === "file" && it.sessionOnly) {
      const hasSavedCopy = savedSongs.some(song => song.key === it.key);
      const keep = el("button", "", hasSavedCopy ? "🔄" : "💾"); keep.type = "button";
      keep.title = tr(hasSavedCopy ? "mediaKeepUpdate" : "mediaKeepSave"); keep.setAttribute("aria-label", `${tr(hasSavedCopy ? "mediaKeepUpdate" : "mediaKeepSave")}: ${displayTitle}`);
      keep.disabled = savedMediaLoadFailed;
      keep.addEventListener("click", e => { e.stopPropagation(); void keepAddedMedia(it); });
      wrap.append(keep);
      const removeSession = el("button", "", "✕"); removeSession.type = "button"; removeSession.title = tr("mediaKeepRemoveSession"); removeSession.setAttribute("aria-label", `${tr("mediaKeepRemoveSession")}: ${displayTitle}`);
      removeSession.style.cssText = "padding:6px 12px;font-size:14px;border-radius:12px";
      removeSession.addEventListener("click", () => removeAdded(it));
      wrap.append(removeSession);
      if (hasSavedCopy) {
        const delSaved = el("button", "", "🗑"); delSaved.type = "button"; delSaved.title = tr("mediaKeepDeleteSaved"); delSaved.setAttribute("aria-label", `${tr("mediaKeepDeleteSaved")}: ${displayTitle}`);
        delSaved.addEventListener("click", e => { e.stopPropagation(); void deleteSavedMedia(it); });
        wrap.append(delSaved);
      }
    } else if (it.source === "file" && it.stored) {
      const delSaved = el("button", "", "🗑"); delSaved.type = "button"; delSaved.title = tr("mediaKeepDeleteSaved"); delSaved.setAttribute("aria-label", `${tr("mediaKeepDeleteSaved")}: ${displayTitle}`);
      delSaved.addEventListener("click", e => { e.stopPropagation(); void deleteSavedMedia(it); });
      wrap.append(delSaved);
    } else if (it.shared) {   /* 💾 端末に残した共有の曲は一覧から外せます */
      const del = el("button", "", "✕"); del.type = "button"; del.title = tr("libRemove"); del.setAttribute("aria-label", tr("libRemove"));
      del.style.cssText = "padding:6px 12px;font-size:14px;border-radius:12px";
      del.addEventListener("click", () => removeShared(it));
      wrap.append(del);
    } else if (it.ghost) {
      const relink = el("button", "", "📁"); relink.type = "button"; relink.title = tr("ghostRelink"); relink.setAttribute("aria-label", tr("ghostRelink")+": "+displayTitle);
      relink.addEventListener("click", e=>{ e.stopPropagation(); void relinkGhost(it); });
      wrap.append(relink);
      const forget = el("button", "", "✕"); forget.type = "button"; forget.title = tr("ghostForget"); forget.setAttribute("aria-label", tr("ghostForget")+": "+displayTitle);
      forget.style.cssText = "padding:6px 12px;font-size:14px;border-radius:12px";
      forget.addEventListener("click", ()=>forgetGhost(it));
      wrap.append(forget);
    }
    box.append(wrap);
    watchSongArtwork(thumbImg, thumbFallback, it, artworkGeneration, eagerArtworkCount++ < 24);
  }
  if (totalRows > shownRows) box.append(el("div", "hint", tr("libMore", { n:totalRows - shownRows })));
}

/* ---------- 選曲画面の曲名の欄 ---------- */
let bannerUrl = null;
const previewSetBtn = el("button", "", "");
previewSetBtn.type = "button"; previewSetBtn.hidden = true;
previewSetBtn.style.cssText = "position:absolute;top:12px;right:12px;padding:6px 12px;font-size:13px;z-index:1";
core.$("songBanner").append(previewSetBtn);
function renderBanner() {
  const b = core.$("songBanner"), s = core.currentSong;
  if (bannerUrl) { URL.revokeObjectURL(bannerUrl); bannerUrl = null; }
  b.style.backgroundImage = ""; b.classList.remove("hasImg");
  if (!s) {
    core.$("songTitleBig").textContent = tr("songNone"); core.$("songSub").textContent = tr("songNoneSub");
  } else {
    const m = metaOf(s.key) || {};   /* 🎶 曲プロフィール */
    const t = songTagsOf(s);         /* 🏷 埋め込みテキストタグ（trk167） */
    core.$("songTitleBig").textContent = songDisplayTitle(s, m);
    core.$("songSub").textContent = [m.artist || (t && t.artist) || s.artist, m.album || (t && t.album), m.composer ? `${tr("plComposer")}: ${m.composer}` : "",
      m.matchHint ? `${tr("plMatchMemo")}: ${m.matchHint}` : "", s.charter ? `${tr("chartBy")}: ${s.charter}` : "", srcLabel(s)].filter(Boolean).join(" · ");
    const art = s.bgBlob || s.artBlob || null;
    if (art) { try { bannerUrl = URL.createObjectURL(art); b.style.backgroundImage = `url("${bannerUrl}")`; b.classList.add("hasImg"); } catch (_) {} }
  }
  previewSetBtn.textContent = tr("previewSet");
  previewSetBtn.title = tr("previewSetLongPress");
  previewSetBtn.setAttribute("aria-label", `${tr("previewSet")}. ${tr("previewSetLongPress")}`);
  syncPreviewSetBtn();
  if (typeof bannerSongBtnsSync === "function") bannerSongBtnsSync();
}
function updateSpBuilder() {
  core.$("songPackBuilder").hidden = !(core.currentSong && core.videoReady);
  syncPreviewSetBtn();
}
previewSetBtn.addEventListener("click", () => {
  /* 長押し（650ms）で開始位置のバーを開いたときは、指を離した click で保存しない（trk193） */
  if (previewSetLongPressed) { previewSetLongPressed = false; return; }
  if (!core.fingerprint || !isFinite(video.currentTime)) return;
  const t = Math.round(video.currentTime * 10) / 10;
  songPrefs.byFp[core.fingerprint] = { ...(songPrefs.byFp[core.fingerprint] || {}), previewStart:t };
  saveSongPrefsStore();
  if (bannerStartPanel && !bannerStartPanel.hidden) { bannerStartRange.value = String(t); startBarSyncText(); }
  core.setStatus("songPrefsStatus", "previewSetDone", { t:core.fmtTime(t) });
});

/* ⏮ プレビュー開始位置のバー（trk193）
   ・曲名タブ右上の「⏱ ここをプレビュー開始位置にする」を長押し（650ms）すると開く
   ・つまみで「どの位置から鳴らすか」を決め、その場でプレビューを合わせられる（保存は押したときだけ）
   ・「常に最初から再生する」はアプリ全体で1つの設定（core.settings.mediaStartFromZero）。
     設定画面（🎵 サウンド）とメディアプレーヤーにも同じものがあり、どれを触っても同じ値が変わる。 */
const bannerStartPanel = el("div", "bannerStartPanel"); bannerStartPanel.hidden = true;
const bannerStartHead = el("strong", "bannerStartHead", "");
const bannerStartRange = el("input", "bannerStartRange");
bannerStartRange.type = "range"; bannerStartRange.min = "0"; bannerStartRange.max = "0"; bannerStartRange.step = "0.1";
const bannerStartTime = el("span", "bannerStartTime", "");
const bannerStartZero = el("input"); bannerStartZero.type = "checkbox"; bannerStartZero.id = "bannerStartZero";
const bannerStartZeroText = el("span", "", "");
const bannerStartZeroRow = el("label", "check bannerStartZeroRow");
bannerStartZeroRow.append(bannerStartZero, bannerStartZeroText);
const bannerStartSave = el("button", "", ""); bannerStartSave.type = "button";
const bannerStartReset = el("button", "", ""); bannerStartReset.type = "button";
const bannerStartClose = el("button", "", ""); bannerStartClose.type = "button";
const bannerStartActions = el("div", "miniActions bannerStartActions");
bannerStartActions.append(bannerStartSave, bannerStartReset, bannerStartClose);
bannerStartPanel.append(bannerStartHead, bannerStartRange, bannerStartTime, bannerStartZeroRow, bannerStartActions);
document.body.append(bannerStartPanel);   /* バナーは overflow:hidden なので、外に出して切れないようにする */
/* バーの説明文・ボタン名を今の言語でそろえる */
function startBarLabels() {
  bannerStartHead.textContent = tr("startBarTitle");
  bannerStartZeroText.textContent = tr("mediaStartFromZero");
  bannerStartSave.textContent = tr("startBarSave");
  bannerStartReset.textContent = tr("startBarReset");
  bannerStartClose.textContent = tr("startBarClose");
  bannerStartRange.setAttribute("aria-label", tr("startBarTitle"));
  bannerStartZeroRow.title = tr("mediaStartFromZeroHint");
}
function startBarSyncText() {
  const t = Number(bannerStartRange.value) || 0;
  bannerStartTime.textContent = tr("startBarAt", { t:core.fmtTime(t) }) + (core.settings.mediaStartFromZero ? " " + tr("startBarAlwaysNote") : "");
}
/* バナーの中に置くと overflow:hidden で切れるので、body に置いてボタンの真下へ出す */
function startBarPlace() {
  const r = previewSetBtn.getBoundingClientRect();
  const w = Math.min(320, Math.max(220, (window.innerWidth || 360) - 24));
  bannerStartPanel.style.width = `${w}px`;
  const left = Math.max(8, Math.min(r.right - w, (window.innerWidth || 360) - w - 8));
  const h = bannerStartPanel.offsetHeight || 0;
  let top = r.bottom + 8;
  if (h && top + h > (window.innerHeight || 640) - 8) top = Math.max(8, r.top - h - 8);   /* 下に入らなければ上へ */
  bannerStartPanel.style.left = `${Math.round(left)}px`;
  bannerStartPanel.style.top = `${Math.round(top)}px`;
}
function startBarOpen() {
  if (!core.currentSong || !core.videoReady) return;
  const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  bannerStartRange.max = String(Math.max(0, Math.round(Math.max(0, dur - 3) * 10) / 10));
  bannerStartRange.value = String(Math.min(previewStartFor(), Number(bannerStartRange.max) || 0));
  startBarLabels(); startBarSyncText();
  bannerStartPanel.hidden = false;
  syncStartZeroInputs();
  startBarPlace();
  try { bannerStartRange.focus({ preventScroll:true }); } catch (_) {}
}
function startBarClose() { bannerStartPanel.hidden = true; }
/* 外側を触る・Esc・画面が変わる・曲が変わると閉じる（開きっぱなしで迷わせない） */
document.addEventListener("pointerdown", e => {
  if (bannerStartPanel.hidden) return;
  if (bannerStartPanel.contains(e.target) || previewSetBtn.contains(e.target)) return;
  startBarClose();
}, true);
document.addEventListener("keydown", e => {
  if (bannerStartPanel.hidden || e.key !== "Escape") return;
  e.preventDefault(); e.stopPropagation();
  startBarClose();
}, true);
window.addEventListener("resize", () => { if (!bannerStartPanel.hidden) startBarPlace(); });
bannerStartRange.addEventListener("input", () => {
  const t = Number(bannerStartRange.value) || 0;
  startBarSyncText();
  if (core.videoReady) { try { video.currentTime = t; } catch (_) {} }
});
bannerStartSave.addEventListener("click", () => {
  if (!core.fingerprint) return;
  const t = Math.round((Number(bannerStartRange.value) || 0) * 10) / 10;
  songPrefs.byFp[core.fingerprint] = { ...(songPrefs.byFp[core.fingerprint] || {}), previewStart:t };
  saveSongPrefsStore();
  core.setStatus("songPrefsStatus", "startBarSaved", { t:core.fmtTime(t) });
  startBarClose();
});
bannerStartReset.addEventListener("click", () => {
  if (!core.fingerprint) return;
  const sp = songPrefs.byFp[core.fingerprint];
  if (sp) { delete sp.previewStart; if (!Object.keys(sp).length) delete songPrefs.byFp[core.fingerprint]; }
  saveSongPrefsStore();
  bannerStartRange.value = String(Math.min(previewStartFor(), Number(bannerStartRange.max) || 0));
  startBarSyncText();
  core.setStatus("songPrefsStatus", "startBarResetDone");
});
bannerStartClose.addEventListener("click", startBarClose);

/* ⏱ trk213：「ここをプレビュー開始位置にする」は、設定（📊 スペクトラム）で
   オンにしたときだけ出す。初期はオフ＝使わない人が誤って触らない。
   オン/オフが変わったら spectrum.js が window.Trk.library.syncPreviewSetBtn() を呼ぶ。 */
function previewSetShown() {
  return core.settings.previewStartShow === true && !!core.currentSong && !!core.videoReady;
}
function syncPreviewSetBtn() {
  if (!previewSetBtn) return;
  const show = previewSetShown();
  previewSetBtn.hidden = !show;
  /* 出さなくなったら、開いていた開始位置のバーも閉じる（置き去りにしない） */
  if (!show && bannerStartPanel && !bannerStartPanel.hidden) startBarClose();
}
bannerStartZero.addEventListener("change", () => { setStartFromZero(bannerStartZero.checked); startBarSyncText(); });
/* 「常に最初から再生する」を1か所で受けて、3つの置き場所（設定／メディアプレーヤー／バー）へ配る */
function setStartFromZero(on) {
  core.settings.mediaStartFromZero = on === true;
  core.saveUserPrefs();
  syncStartZeroInputs();
  if (core.settings.mediaStartFromZero && core.phase === "title" && core.videoReady) { try { video.currentTime = 0; } catch (_) {} }
}
function syncStartZeroInputs() {
  const on = core.settings.mediaStartFromZero === true;
  const box = core.$("mediaStartFromZero"); if (box) box.checked = on;
  if (bannerStartZero.checked !== on) bannerStartZero.checked = on;
  if (typeof window.TrkMediaStartZeroSync === "function") window.TrkMediaStartZeroSync(on);
}
/* 長押し（音量ボタンと同じ 650ms・12px 動いたら取りやめ） */
let previewSetPressTimer = 0, previewSetLongPressed = false, previewSetPointer = null;
let previewSetDownX = 0, previewSetDownY = 0;
function previewSetCancelPress() {
  if (previewSetPressTimer) clearTimeout(previewSetPressTimer);
  previewSetPressTimer = 0; previewSetPointer = null;
}
previewSetBtn.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  previewSetCancelPress(); previewSetLongPressed = false;
  previewSetPointer = e.pointerId; previewSetDownX = e.clientX; previewSetDownY = e.clientY;
  try { previewSetBtn.setPointerCapture(e.pointerId); } catch (_) {}
  previewSetPressTimer = setTimeout(() => { previewSetPressTimer = 0; previewSetLongPressed = true; startBarOpen(); }, 650);
});
previewSetBtn.addEventListener("pointermove", e => {
  if (previewSetPointer !== e.pointerId) return;
  if (Math.hypot(e.clientX - previewSetDownX, e.clientY - previewSetDownY) > 12) previewSetCancelPress();
});
previewSetBtn.addEventListener("pointerup", e => { if (previewSetPointer === e.pointerId) previewSetCancelPress(); });
previewSetBtn.addEventListener("pointercancel", () => previewSetCancelPress());
previewSetBtn.addEventListener("contextmenu", e => e.preventDefault());   /* 長押しで OS のメニューを出さない */

/* ---------- プレビュー再生 ---------- */
let previewPending = false, fadeRaf = 0;
function previewStartFor() {
  if (core.settings.mediaStartFromZero === true) return 0;   /* ⏮ 常に最初から再生（trk193） */
  const fp = core.fingerprint || (core.currentSong && isFinite(video.duration) ? `${core.currentSong.size}:${Math.round(video.duration * 10)}` : "");
  const sp = songPrefs.byFp[fp];
  let t = sp && typeof sp.previewStart === "number" ? sp.previewStart
        : core.currentSong && core.currentSong.previewStart != null ? core.currentSong.previewStart
        : (video.duration || 0) * 0.4;
  return Math.max(0, Math.min(t, (video.duration || 0) - 3));
}
function fadeTo(target, ms) {
  cancelAnimationFrame(fadeRaf);
  const from = video.volume, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    video.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k < 1 && core.phase === "title") fadeRaf = requestAnimationFrame(step);
  };
  fadeRaf = requestAnimationFrame(step);
}
function startPreview() {
  if (window._trkMediaPlayerMode || !core.settings.previewEnabled || core.phase !== "title" || !core.currentSong || !video.src || !isFinite(video.duration)) return;
  if (!video.paused) return;
  cancelAnimationFrame(fadeRaf);
  try { video.currentTime = previewStartFor(); } catch (_) {}
  video.volume = 0;
  video.play().then(() => fadeTo(core.settings.musicVolume * 0.8, 900)).catch(() => {});
}
function stopPreview() {
  cancelAnimationFrame(fadeRaf);
  if (core.phase === "title" && !video.paused) video.pause();
}
/* 🚪 メディアプレイヤーを抜けたあと、そのまま流し続ける（trk206）。
   位置は動かさず（＝読み込み直さない）、音量だけプレビュー相当（80%）へ静かに戻す。
   止まっている・プレビューがオフ・タイトル以外・プレイヤーを開いているときは何もしない。 */
function previewContinue() {
  if (window._trkMediaPlayerMode || core.phase !== "title" || !core.settings.previewEnabled) return false;
  if (!core.currentSong || !video.src || video.paused) return false;
  cancelAnimationFrame(fadeRaf);
  video.muted = false;   /* プレイヤーで消音していたときも、曲リストでは鳴らす（openMedia と同じ扱い） */
  fadeTo(core.settings.musicVolume * 0.8, 600);
  return true;
}
video.addEventListener("canplay", () => { if (previewPending) { previewPending = false; startPreview(); } });
video.addEventListener("ended", () => {
  if (window._trkMediaPlayerMode || core.phase !== "title" || !core.currentSong || !core.settings.previewEnabled) return;
  try { video.currentTime = previewStartFor(); } catch (_) {}
  video.play().catch(() => {});
});
on("beforePlay", () => { previewPending = false; stopPreview(); startBarClose(); });   /* trk193：開始位置バーも閉じる */
on("beforeLoad", stopPreview);
on("phase", p => { if (p !== "title") { previewPending = false; cancelAnimationFrame(fadeRaf); } });
on("screen", id => { if (id === "selectScreen" && core.phase === "title" && core.videoReady) setTimeout(startPreview, 50); if (id !== "selectScreen") startBarClose(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && core.phase === "title") stopPreview(); });
core.$("previewEnabled").addEventListener("change", e => {
  core.settings.previewEnabled = e.target.checked; core.saveUserPrefs();
  if (core.settings.previewEnabled) startPreview(); else stopPreview();
});
/* ⏮ 常に最初から再生する（trk193）。設定画面のチェックも、メディアプレーヤーやバーと同じ1つの値 */
{
  const zeroBox = core.$("mediaStartFromZero");
  if (zeroBox) zeroBox.addEventListener("change", e => setStartFromZero(e.target.checked));
}
/* ---------- ⏯ 曲名バナーをタップで一時停止（設定でON）＋ 🔊 右下の音量 ---------- */
function bannerPauseAction(st) {   /* 純粋関数（テストで確認）→ null / "pause" / "resume" / "preview" */
  if (!st.enabled || st.mediaMode || st.target) return null;
  if (st.phase === "playing") return "pause";
  if (st.phase === "paused") return "resume";
  if (st.phase === "title" && st.hasSong) return "preview";
  return null;
}
const bannerVolClamp = v => Math.max(0, Math.min(1, Number(v) || 0));
function bannerPauseSync() { core.$("songBanner").classList.toggle("tapPause", !!core.settings.bannerPause); }
core.$("bannerPause").addEventListener("change", e => {
  core.settings.bannerPause = e.target.checked; core.saveUserPrefs(); bannerPauseSync();
});
core.$("bannerPause").checked = core.settings.bannerPause;
bannerPauseSync();
core.$("songBanner").addEventListener("click", e => {
  const act = bannerPauseAction({ enabled: core.settings.bannerPause, mediaMode: window._trkMediaPlayerMode,
    target: !!e.target.closest("button, input, a, label"), phase: core.phase, hasSong: !!(core.currentSong && video.src) });
  if (act === "pause") window.Trk.play.pauseGame();
  else if (act === "resume") window.Trk.play.resumeGame();
  else if (act === "preview") { if (video.paused) video.play().catch(() => {}); else video.pause(); }   /* 選曲中のプレビュー */
});
/* 🔊 音量（設定の musicVolume と同じもの。バナーの右下の小さなつまみ） */
const bannerVolBtn = el("button", "bannerVolBtn", "🔊"); bannerVolBtn.type = "button";
const bannerVolTip = () => tr("bannerVolTip");
bannerVolBtn.title = bannerVolTip();
bannerVolBtn.setAttribute("aria-label", `${tr("musicVolume")}. ${bannerVolTip()}`);
const bannerVolSlider = el("input", "bannerVolSlider"); bannerVolSlider.type = "range";
bannerVolSlider.min = "0"; bannerVolSlider.max = "1"; bannerVolSlider.step = "0.01";
const bannerVolPanel = el("div", "bannerVolPanel"); bannerVolPanel.hidden = true;
bannerVolPanel.append(bannerVolSlider);
/* ⏯ 再生／一時停止（音量ボタンの左。同じ大きさのアイコンだけのボタン。trk126）
   ・選曲中＝プレビューの音を止める／鳴らす（プレビューを切っているときは押せません）
   ・プレイ中＝一時停止／再開（ゲームの一時停止と同じ）
   ・曲名に触れて曲を選び直すと一時停止は解除され、新しい曲のプレビューが鳴ります */
const bannerPlayBtn = el("button", "bannerPlayBtn", "▶"); bannerPlayBtn.type = "button";
const bannerMediaBar = el("div", "bannerMediaBar");
bannerMediaBar.append(bannerPlayBtn, bannerVolBtn);   /* 左＝再生／一時停止、右＝音量 */
core.$("songBanner").append(bannerVolPanel, bannerMediaBar);
let bannerVolRestore = core.settings.musicVolume > 0 ? bannerVolClamp(core.settings.musicVolume) : bannerVolClamp(core.settings.musicVolumeRestore || 0.7);
let bannerVolPressTimer = 0, bannerVolLongPressed = false, bannerVolPointer = null;
let bannerVolDownX = 0, bannerVolDownY = 0;
function bannerVolSync() {
  const volume = bannerVolClamp(core.settings.musicVolume);
  if (volume > 0) { bannerVolRestore = volume; core.rememberMusicVolume(volume); }
  bannerVolSlider.value = String(volume);
  bannerVolBtn.textContent = volume > 0 ? "🔊" : "🔇";
  bannerVolBtn.title = bannerVolTip();
  bannerVolBtn.setAttribute("aria-label", `${tr("musicVolume")}. ${bannerVolTip()}`);
}
function setBannerMusicVolume(value) {
  const volume = bannerVolClamp(value);
  if (volume > 0) { bannerVolRestore = volume; core.rememberMusicVolume(volume); }
  core.settings.musicVolume = volume;
  cancelAnimationFrame(fadeRaf);   /* プレビューのフェードインと取り合いにならないように */
  video.volume = volume;
  const sv = core.$("volume"); if (sv) sv.value = String(volume);   /* 設定画面のスライダーも合わせる */
  core.saveUserPrefs(); bannerVolSync();
}
function bannerVolLongPressAction() {
  if (core.settings.musicVolume > 0) {
    bannerVolRestore = bannerVolClamp(core.settings.musicVolume);
    core.rememberMusicVolume(bannerVolRestore);
    setBannerMusicVolume(0);
  } else {
    bannerVolRestore = bannerVolClamp(core.settings.musicVolumeRestore || bannerVolRestore || 0.7);
    setBannerMusicVolume(bannerVolRestore);
  }
}
function bannerVolCancelPress() {
  if (bannerVolPressTimer) clearTimeout(bannerVolPressTimer);
  bannerVolPressTimer = 0; bannerVolPointer = null;
}
bannerVolSync();
on("language", bannerVolSync);
bannerVolBtn.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  bannerVolCancelPress(); bannerVolLongPressed = false;
  bannerVolPointer = e.pointerId; bannerVolDownX = e.clientX; bannerVolDownY = e.clientY;
  try { bannerVolBtn.setPointerCapture(e.pointerId); } catch (_) {}
  bannerVolPressTimer = setTimeout(() => {
    bannerVolPressTimer = 0; bannerVolLongPressed = true;
    bannerVolLongPressAction();
  }, 650);
});
bannerVolBtn.addEventListener("pointermove", e => {
  if (bannerVolPointer !== e.pointerId) return;
  if (Math.hypot(e.clientX - bannerVolDownX, e.clientY - bannerVolDownY) > 12) bannerVolCancelPress();
});
bannerVolBtn.addEventListener("pointerup", e => {
  if (bannerVolPointer === e.pointerId) bannerVolCancelPress();
});
bannerVolBtn.addEventListener("pointercancel", e => {
  if (bannerVolPointer === e.pointerId) bannerVolCancelPress();
});
bannerVolBtn.addEventListener("contextmenu", e => e.preventDefault());
bannerVolBtn.addEventListener("click", e => {
  if (bannerVolLongPressed) {
    bannerVolLongPressed = false;
    e.preventDefault(); e.stopImmediatePropagation();
    return;
  }
  bannerVolPanel.hidden = !bannerVolPanel.hidden; bannerVolSync();
});
bannerVolSlider.addEventListener("input", () => setBannerMusicVolume(bannerVolSlider.value));
/* ---------- ⏯ 再生／一時停止（trk126。音量ボタンの左のアイコンだけのボタン） ---------- */
function bannerPlayAction(st) {   /* 純粋関数（検査で確認）→ null / "pause" / "resume" / "preview-pause" / "preview-play" */
  if (st.mediaMode) return null;
  if (st.phase === "playing") return "pause";
  if (st.phase === "paused") return "resume";
  if (st.phase !== "title" || !st.hasSong || !st.previewEnabled) return null;   /* 選曲中はプレビューの音を止める／鳴らす */
  return st.previewPlaying ? "preview-pause" : "preview-play";
}
function bannerPlayState() {
  return { mediaMode: !!window._trkMediaPlayerMode, phase: core.phase, hasSong: !!(core.currentSong && video.src),
    previewEnabled: !!core.settings.previewEnabled, previewPlaying: !video.paused };
}
/* 説明の文言（純粋関数・検査で確認）。押せないときは、押せない理由を言う（曲未選択／プレビューオフ） */
function bannerPlayTipKey(st, act) {
  if (act === "pause" || act === "preview-pause") return "bannerPlayPauseTip";
  if (act) return "bannerPlayResumeTip";
  if (st.mediaMode || st.phase !== "title") return "bannerPlayIdleTip";
  if (!st.hasSong) return "bannerPlayNoSongTip";
  if (!st.previewEnabled) return "bannerPlayPreviewOffTip";
  return "bannerPlayIdleTip";
}
function bannerPlaySync() {   /* アイコンと説明を「押すとどうなるか」に合わせる */
  const st = bannerPlayState();
  const act = bannerPlayAction(st);
  const showsPause = act === "pause" || act === "preview-pause";
  bannerPlayBtn.textContent = showsPause ? "⏸" : "▶";
  const tip = tr(bannerPlayTipKey(st, act));
  if (bannerPlayBtn.title !== tip) { bannerPlayBtn.title = tip; bannerPlayBtn.setAttribute("aria-label", tip); }
  bannerPlayBtn.disabled = !act;   /* 止める音がないとき（曲未選択・プレビューオフ）は押せない */
}
/* 曲を選び直したとき：一時停止を解除して鳴らし直す（「次の曲名に触れたら再生に戻る」） */
function bannerPreviewRestart() {
  if (bannerPlayAction(bannerPlayState()) !== "preview-play") return;
  startPreview();
}
bannerPlaySync();
bannerPlayBtn.addEventListener("click", () => {
  const act = bannerPlayAction(bannerPlayState());
  if (act === "pause") window.Trk.play.pauseGame();
  else if (act === "resume") window.Trk.play.resumeGame();
  else if (act === "preview-pause") { cancelAnimationFrame(fadeRaf); video.pause(); }
  else if (act === "preview-play") {   /* 止めたところから鳴らし直します（プレビューの頭には戻しません） */
    cancelAnimationFrame(fadeRaf);
    video.volume = core.settings.musicVolume * 0.8;   /* プレビューのフェードイン後の音量 */
    video.play().catch(() => {});
  }
  bannerPlaySync();
});
video.addEventListener("play", bannerPlaySync);
video.addEventListener("pause", bannerPlaySync);
video.addEventListener("ended", bannerPlaySync);
on("phase", bannerPlaySync);
on("screen", bannerPlaySync);
on("songSelected", bannerPlaySync);
on("language", bannerPlaySync);
on("settings", bannerPlaySync);
/* ◀🎲▶ バナーの右端にまとめて曲送り（TVドックの◀▶と同じ仕組み。いま開いているタブの中を送る）
   ・左端に置くと曲名の頭に重なるので、曲の操作は右端の [◀][🎲][▶] に集める
   ・🎲 は誤操作を防ぐため、既定では長押し（650ms）で変える。設定でタップだけにも、🎲 自体を隠すこともできる */
const bannerSongBar = el("div", "bannerSongBar");
const bannerPrevBtn = el("button", "bannerSongBtn", "◀"); bannerPrevBtn.type = "button";
const bannerRandomBtn = el("button", "bannerSongBtn bannerRandomBtn", "🎲"); bannerRandomBtn.type = "button";
const bannerNextBtn = el("button", "bannerSongBtn", "▶"); bannerNextBtn.type = "button";
bannerSongBar.append(bannerPrevBtn, bannerRandomBtn, bannerNextBtn);
core.$("songBanner").append(bannerSongBar);

/* 🎲 おまかせの候補：いまの一覧 ＋ 📌ピンの曲（ほかのタブにいても、必ず候補に入る） */
function randomSongPool() {
  const pool = libView.slice();
  const F = window.TrkFavs;
  if (F) {
    for (const key of F.state("song").pins) {
      if (!F.has("song", key)) continue;      /* 1軍／2軍／🧊 のピンだけ（📤元お気に入りは抽選に出さない） */
      const it = allSongs().find(x => x.key === key);
      if (it && !pool.includes(it)) pool.push(it);
    }
  }
  return pool;
}
function randomSongPick() {
  const pool = randomSongPool();
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
const bannerRandomTapMode = () => core.settings.bannerRandomTap === true;   /* タップだけで変える（初期オフ＝長押し） */

function bannerSongBtnsSync() {
  const on = core.settings.bannerSongBtns !== false && allSongs().length > 0 && core.phase === "title";
  const rand = on && core.settings.bannerRandomBtn !== false;
  bannerSongBar.hidden = !on;
  bannerPrevBtn.hidden = bannerNextBtn.hidden = !on;
  bannerRandomBtn.hidden = !rand;
  core.$("songBanner").classList.toggle("hasSongBtns", on);   /* 曲名の右側を空けて、右端のボタンと重ならないようにする */
  const t1 = tr("tvPrevSong"), t2 = tr("tvNextSong");
  for (const [b, t] of [[bannerPrevBtn, t1], [bannerNextBtn, t2]]) { b.title = t; b.setAttribute("aria-label", t); }
  const tip = tr(bannerRandomTapMode() ? "bannerRandomTapTip" : "bannerRandomHoldTip");
  if (bannerRandomBtn.title !== tip) { bannerRandomBtn.title = tip; bannerRandomBtn.setAttribute("aria-label", tip); }
}
async function bannerSongStep(dir) {
  if (core.phase !== "title") return;
  const it = dir < 0 ? prevSong() : nextSong();
  if (it) await selectSong(it);
}
async function bannerSongRandom() {
  if (core.phase !== "title") return;
  const it = randomSongPick();
  if (it) await selectSong(it);
}
bannerPrevBtn.addEventListener("click", () => bannerSongStep(-1));
bannerNextBtn.addEventListener("click", () => bannerSongStep(1));
/* 🎲：既定は長押しでおまかせ。タップだけで変える設定とキーボード操作（click の detail が 0）は、その場で変える */
let bannerRandTimer = 0, bannerRandLongPressed = false, bannerRandPointer = null, bannerRandDownX = 0, bannerRandDownY = 0;
function bannerRandCancelPress() {
  if (bannerRandTimer) clearTimeout(bannerRandTimer);
  bannerRandTimer = 0; bannerRandPointer = null;
}
bannerRandomBtn.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  bannerRandCancelPress(); bannerRandLongPressed = false;
  if (bannerRandomTapMode()) return;   /* タップだけで変える設定：クリックに任せる */
  bannerRandPointer = e.pointerId; bannerRandDownX = e.clientX; bannerRandDownY = e.clientY;
  try { bannerRandomBtn.setPointerCapture(e.pointerId); } catch (_) {}
  bannerRandTimer = setTimeout(() => {
    bannerRandTimer = 0; bannerRandLongPressed = true;
    bannerSongRandom();
  }, 650);
});
bannerRandomBtn.addEventListener("pointermove", e => {
  if (bannerRandPointer !== e.pointerId) return;
  if (Math.hypot(e.clientX - bannerRandDownX, e.clientY - bannerRandDownY) > 12) bannerRandCancelPress();
});
bannerRandomBtn.addEventListener("pointerup", e => { if (bannerRandPointer === e.pointerId) bannerRandCancelPress(); });
bannerRandomBtn.addEventListener("pointercancel", e => { if (bannerRandPointer === e.pointerId) bannerRandCancelPress(); });
bannerRandomBtn.addEventListener("contextmenu", e => e.preventDefault());
bannerRandomBtn.addEventListener("click", e => {
  if (bannerRandLongPressed) {
    bannerRandLongPressed = false;
    e.preventDefault(); e.stopImmediatePropagation();
    return;
  }
  if (e.detail === 0 || bannerRandomTapMode()) { bannerSongRandom(); return; }
  plToast(tr("bannerRandomHold"));   /* 誤操作防止：短押しでは変えず、押し方だけ案内する */
});
function bannerRandomSyncPrefs() {
  const show = core.settings.bannerRandomBtn !== false;
  core.$("bannerRandomBtn").checked = show;
  core.$("bannerRandomTap").checked = core.settings.bannerRandomTap === true;
  core.$("bannerRandomTap").disabled = !show;   /* 🎲 を隠しているときは、押し方の設定は関係ない */
}
core.$("bannerSongBtns").addEventListener("change", e => {
  core.settings.bannerSongBtns = e.target.checked; core.saveUserPrefs(); bannerSongBtnsSync();
});
core.$("bannerRandomBtn").addEventListener("change", e => {
  core.settings.bannerRandomBtn = e.target.checked; core.saveUserPrefs(); bannerRandomSyncPrefs(); bannerSongBtnsSync();
});
core.$("bannerRandomTap").addEventListener("change", e => {
  core.settings.bannerRandomTap = e.target.checked; core.saveUserPrefs(); bannerSongBtnsSync();
});
core.$("bannerSongBtns").checked = core.settings.bannerSongBtns !== false;
bannerRandomSyncPrefs();
on("settings", bannerRandomSyncPrefs);   /* 音リセットなどで設定が変わっても、開いたときに合わせる */
bannerSongBtnsSync();   /* 初回の表示あわせ（renderBanner が先に走っていた場合の保険） */


/* ---------- 曲を選ぶ ---------- */
async function materializeBuiltinSong(it) {
  if (it.source !== "builtin") return it;
  if (it.file) return it;
  if (it.key.startsWith(AGENT_OST_KEY_PREFIX)) return materializeAgentOst(it);
  if (it.key.startsWith(TRK_OST_SONG_KEY_PREFIX)) return materializeTrkOstSong(it);
  if (it.key !== FIRST_SPARK_KEY) return it;
  if (!firstSparkFilePromise) {
    firstSparkFilePromise = (async () => {
      const response = await fetch(FIRST_SPARK_ASSET, { credentials:"same-origin" });
      if (!response.ok) { const error = new Error("tutorial-audio-unavailable"); error.code = response.status === 404 ? "not-found" : "http-error"; throw error; }
      const declared = Number(response.headers.get("Content-Length") || 0);
      if (declared > FIRST_SPARK_MAX_BYTES) throw new Error("tutorial-audio-too-large");
      const blob = await response.blob();
      if (!blob.size || blob.size > FIRST_SPARK_MAX_BYTES) throw new Error("tutorial-audio-size-invalid");
      const file = new File([blob], it.fileName, { type:"audio/mpeg" });
      const ready = { ...it, file, size:file.size };
      const idx = builtInSongs.findIndex(song => song.key === FIRST_SPARK_KEY);
      if (idx >= 0) builtInSongs[idx] = ready;
      renderLib();
      return ready;
    })().catch(error => { firstSparkFilePromise = null; throw error; });
  }
  return firstSparkFilePromise;
}
async function selectSong(it) {
  if (core.phase !== "title" || !it) return;
  if (it.ghost) { void relinkGhost(it); return; }   /* 📄参照のみ（本体なし）は、選ぶと選び直しを開く */
  const selection = ++songSelectToken;
  if (it.source === "builtin" && !it.file) {
    try { it = await materializeBuiltinSong(it); }
    catch (error) {
      if (selection === songSelectToken) {
        console.error("tutorial audio load failed", error);
        if (error && error.code === "not-found") {
          builtInSongs = builtInSongs.filter(song => song.key !== it.key);
          renderLib();
        }
        core.setStatus("loadStatus", "demoSongUnavailable");
      }
      return;
    }
    if (core.phase !== "title" || selection !== songSelectToken) return;
  }
  /* trk126：一時停止のままにしない。曲名に触れたら（同じ曲でも）解除して鳴らし直す */
  if (core.currentSong && core.currentSong.key === it.key) { if (core.videoReady) bannerPreviewRestart(); return; }
  if (core.currentSong && core.currentSong !== it && core.currentSong.artBlob) delete core.currentSong.artBlob; // 選曲を離れた縮小画像は有界キャッシュだけに残す
  core.currentSong = it;
  /* 新しい曲のプレビューは読み込み後の canplay で鳴り直します（前の曲の一時停止は持ち越しません） */
  stopPreview(); renderLib(); renderBanner(); updateSpBuilder();
  core.emit("songSelected", it);
  core.emit("nowPlaying", nowPlaying());          /* trk191: 💬 アドオンへ「曲が変わった」 */
  /* 🧩 アドオンが連れてきた曲：ファイル読み込みは、アドオンに任せる（自前のプレイヤーで鳴らす） */
  if (it.source === "addon") {
    if (it.file) { /* file を持っていれば、ふつうの曲と同じ道（loadMedia）を通る */ }
    else { core.emit("addonSelect", it); renderSeedTools(); return; }
  }
  /* 埋め込み画像は再生準備と並行して読む。静止画音源では完了後にゲームの動画枠にも反映する。 */
  if (!it.bgBlob && !it.artBlob && canExtractSongArt(it)) {
    loadSongArtwork(it).then(async art => {
      if (!art || core.currentSong !== it) return;
      it.artBlob = art;
      await applySongBackground(it);
      if (core.currentSong !== it) return;
      renderLib(); renderBanner(); core.emit("songArtwork", it);
    }).catch(() => {});
  }
  /* 🏷 埋め込みテキストタグも再生準備と並行して読む（表示だけ。行とバナーは onSongTagsLoaded が更新。trk167） */
  if (canExtractSongArt(it)) void loadSongTags(it);
  await applySongBackground(it);
  if (core.currentSong !== it) return;
  previewPending = true;
  const ok = await window.Trk.media.loadMedia(it.file, { title:songDisplayTitle(it), onReady:() => restoreSongState(it) });
  if (!ok || core.currentSong !== it) return;
  renderLib(); renderBanner(); updateSpBuilder(); renderSeedTools();
}
/* 解析後・譜面を作る前に呼ばれる。true を返すと自動生成を省略 */
async function restoreSongState(it) {
  if (core.currentSong !== it) return false;
  const sp = songPrefs.byFp[core.fingerprint];
  let bpm = core.settings.bpm, offset = core.settings.offset, seed = core.settings.seed, key = "songPrefsHint";
  if (sp && sp.bpm) { bpm = sp.bpm; offset = sp.offset ?? 0; seed = sp.seed ?? seed; key = "songPrefsRestored"; }
  else if (it.bpm) { bpm = it.bpm; offset = it.offset ?? 0; key = "songPrefsPack"; }
  core.$("bpm").value = bpm; core.$("offset").value = offset; core.$("seed").value = seed;
  core.setStatus("songPrefsStatus", key);
  core.refreshSeedSecrets(); core.syncPickers();
  songPrefs.keyFp[it.key] = core.fingerprint; saveSongPrefsStore();
  return trySongChart();
}
/* 曲パック・フォルダに、今の難易度の譜面があれば読み込む */
async function trySongChart() {
  const s = core.currentSong, d = core.settings.difficulty;
  if (!s || !core.videoReady) return false;
  /* 🎼 trk!同梱のデモ譜面（初級・中級・上級）。無い難易度＝達人・RUSHは自動生成へ戻る */
  if (s.source === "builtin" && s.key === FIRST_SPARK_KEY && firstSparkChartMap[d]) {
    let data = null;
    try { data = await firstSparkChartData(d); } catch (_) {}
    if (data && window.Trk.media.applyChartData(data, "custom", "importStatus", false)) { core.setStatus("importStatus", "builtinChartLoaded", { d:tr(d) }); return true; }
    return false;
  }
  if (s.chartBlobs && s.chartBlobs[d]) {
    let data = null; try { data = JSON.parse(await s.chartBlobs[d].text()); } catch (_) {}
    if (data && window.Trk.media.applyChartData(data, "pack", "importStatus", false)) { core.setStatus("importStatus", "packChartLoaded", { d:tr(d) }); return true; }
  }
  if (s.charts && s.charts.length) {
    const lower = f => f.name.toLowerCase();
    const f = s.charts.find(x => lower(x).endsWith(`-${d}${CHART_SUFFIX}`)) || s.charts.find(x => lower(x) === (s.base + CHART_SUFFIX).toLowerCase());
    if (f && await window.Trk.media.importChartFile(f)) { core.setStatus("libStatus", "libChartLoaded", { f:f.name }); return true; }
  }
  return false;
}

/* ---------- 📻 ラジオ：曲が終わったら、少しして次の曲へ ---------- */
let radioTimer = 0, radioTick = 0;
function cancelRadio() { clearTimeout(radioTimer); clearInterval(radioTick); radioTimer = radioTick = 0; }
function nextSong() {
  const list = libView.length ? libView : allSongs(); if (!list.length) return null;
  const i = core.currentSong ? list.findIndex(x => x.key === core.currentSong.key) : -1;
  return list[(i + 1) % list.length];
}
/* 📺 TVドックの ◀ から使う（前の曲。端は末尾へ回り込む。曲が無いときは null） */
function prevSong() {
  const list = libView.length ? libView : allSongs(); if (!list.length) return null;
  const i = core.currentSong ? Math.max(0, list.findIndex(x => x.key === core.currentSong.key)) : 0;
  return list[(i - 1 + list.length) % list.length];
}
async function radioGo(next) {
  cancelRadio();
  if (core.phase !== "ended" || !core.settings.radio) return;
  window.Trk.play.toTitle();
  await selectSong(next);
  if (core.phase === "title" && core.videoReady && core.chart.length && core.currentSong === next) window.Trk.play.startGame();
}
on("screen", id => {
  if (id !== "endScreen" || !core.settings.radio) return;
  const next = nextSong(); if (!next) return;
  cancelRadio();
  let n = RADIO_WAIT;
  core.setStatus("endStatus", "radioNext", { t:next.title, n });
  radioTick = setInterval(() => { n--; if (n > 0) core.setStatus("endStatus", "radioNext", { t:next.title, n }); }, 1000);
  radioTimer = setTimeout(() => radioGo(next), RADIO_WAIT * 1000);
});
on("phase", p => { if (p !== "ended") cancelRadio(); });   // もう一度・選曲へ戻ると止まる

/* ---------- 選択ファイルの一時追加（保存ボタンを押したものだけ IndexedDB へ） ---------- */
async function addSongFiles(list) {
  const files = Array.from(list || []).filter(f => MEDIA_EXT.includes(core.extOf(f.name)));
  if (!files.length) return;
  let first = null;
  for (const f of files) {
    const addedAt = Date.now();
    const it = addedItem(f, false, addedAt, { sessionOnly:true }), i = addedSongs.findIndex(x => x.key === it.key);
    if (i >= 0) addedSongs.splice(i, 1);
    addedSongs.unshift(it); first = first || it;
  }
  while (addedSongs.length > ADDED_MAX) addedSongs.pop();
  // 📄参照も別枠で永続化（ゴーストとしてリロード後も残る）
  for(const it of addedSongs.slice(0, files.length)) rememberSongRef(it);
  renderLib();
  if (first) selectSong(first);
}
/* ---------- 🎬 動画ファイルとして読み込む ----------
   ふつうの「＋ 曲ファイルを追加」は音も映像も同じ道を通るため、大きな動画だと
   ・音声解析でファイルを丸ごとメモリに載せる（2GBなどは失敗・待たされる）
   ・映像が間に合わず、音楽ファイルのように見えてしまう
   ことがあります。こちらは「映像つき」として読み込みます：
   ① <video> で最初のフレームまで待ち、videoWidth > 0 を確かめる（＝動画だと正確に分かる。ここが時間のかかる所）
   ② 確かめられたものだけこのタブの曲リストで 🎬 として扱う（本体は保存しない。大きいファイルの音声解析は media.js 側で省略）
   ③ 読み込み後、そのまま全画面ビューア（🖥）で流す
   ※ 端末が映像を解釈できない形式なら「音として読み込みました」と出します（無理に動かさない）。 */
const VIDEO_EXT = ["mp4", "m4v", "mov", "webm", "mkv", "avi", "ogv", "3gp", "mpg", "mpeg", "mpe", "m2v", "m2ts"];
/* 拡張子だけで「映像」と決められるもの（mp4/mov/webm は音だけのこともあるので入れない）。
   フォルダーから取り込んだ .mkv/.mpg に 🎬 を付けるためだけに使う（重い下調べはしない） */
const VIDEO_ONLY_EXT = ["m4v", "mkv", "avi", "ogv", "3gp", "mpg", "mpeg", "mpe", "m2v", "m2ts"];
const VIDEO_PROBE_MS = 15000;   /* 最初のフレームを待つ上限 */
/* 🎞 trk196：ブラウザー（Chrome/Firefox）が中身を再生できないことが多い入れ物。
   一覧の行に ⚠ を付けて、開いてから驚かないようにする（判定は拡張子だけ＝重くしない）。
   mpg/mpeg/mpe/m2v＝MPEG-1/2、m2ts＝MPEG-TS（TV録画）、avi＝DivX/Xvid が多い。
   mkv は H.264＋AAC なら再生できるので、ここには入れない。 */
const MAYBE_UNPLAYABLE_EXT = ["mpg", "mpeg", "mpe", "m2v", "m2ts", "avi"];
const maybeUnplayable = it => !!(it && it.file && MAYBE_UNPLAYABLE_EXT.includes(core.extOf(it.file.name)));
function probeVideoFile(file) {
  return new Promise(resolve => {
    const el = document.createElement("video");
    let url = "", done = false, timer = 0;
    el.preload = "auto"; el.muted = true; el.setAttribute("playsinline", "");
    const finish = ok => {
      if (done) return; done = true;
      clearTimeout(timer);
      try { el.removeAttribute("src"); el.load(); } catch (_) {}
      if (url) URL.revokeObjectURL(url);
      resolve(!!ok);
    };
    const check = () => { if (el.videoWidth > 0 && el.videoHeight > 0) finish(true); };
    const looksLikeAudio = !VIDEO_EXT.includes(core.extOf(file.name)) && !/^video\//i.test(file.type || "");
    const meta = () => {   /* 映像が無いと分かる形（音声ファイル）なら、待たずに終える */
      check();
      if (!done && looksLikeAudio && el.videoWidth === 0 && el.readyState >= 1) finish(false);
    };
    el.addEventListener("loadedmetadata", meta);
    el.addEventListener("loadeddata", check);
    el.addEventListener("canplay", check);
    el.addEventListener("playing", () => { try { el.pause(); } catch (_) {} check(); });
    el.addEventListener("error", () => finish(false));
    timer = setTimeout(() => finish(el.videoWidth > 0), VIDEO_PROBE_MS);
    /* type が空の .mkv/.mpg は、拡張子から MIME を補ってから渡す（下調べの取りこぼしを減らす） */
    const hinted = window.Trk.media && typeof window.Trk.media.withMimeHint === "function" ? window.Trk.media.withMimeHint(file) : file;
    try { url = URL.createObjectURL(hinted); el.src = url; el.load(); } catch (_) { finish(false); }
  });
}
async function addVideoFiles(list, opts) {
  const options = opts || {};
  const files = Array.from(list || []).filter(f => f && (VIDEO_EXT.includes(core.extOf(f.name)) || /^video\//i.test(f.type || "") || MEDIA_EXT.includes(core.extOf(f.name))));
  if (!files.length) return;
  let first = null;
  core.setStatus("libStatus", "libVideoProbe");
  for (let i = 0; i < files.length; i++) {
    const f = files[i], isVideo = await probeVideoFile(f);
    if (files.length > 1) core.setStatus("libStatus", "libVideoProbeN", { i:i + 1, n:files.length, name:f.name });
    const addedAt = Date.now();
    const it = addedItem(f, isVideo, addedAt, { sessionOnly:true }), at = addedSongs.findIndex(x => x.key === it.key);
    if (at >= 0) addedSongs.splice(at, 1);
    addedSongs.unshift(it); first = first || it;
    if (isVideo) core.setStatus("libStatus", "libVideoYes", { name:f.name });
    else {
      /* 🎞 映像として開けなかったとき：.mkv/.mpg などは「音として読み込みました」だけだと理由が分からない。
         中身のコーデックが原因だと分かったときだけ、その理由（MP4 に変換すると再生できる）を出す。
         分からないとき（音だけの MP4 など）は今までどおり「音として読み込みました」。 */
      const why = window.Trk.media && typeof window.Trk.media.explainLoadFailure === "function"
        ? await window.Trk.media.explainLoadFailure(f) : null;
      const known = why && ["loadCodecUnsupported", "loadMpegPsUnsupported", "loadMpegTsUnsupported"].includes(why.key);
      if (known) core.setStatus("libStatus", why.key, { ...why.vars, name:f.name });
      else core.setStatus("libStatus", "libVideoNo", { name:f.name });
    }
  }
  while (addedSongs.length > ADDED_MAX) addedSongs.pop();
  for(const it of addedSongs.slice(0, files.length)) rememberSongRef(it);
  renderLib();
  if (!first) return;
  selectSong(first);
  if (!first.video || options.openViewer === false) return;
  /* 映像の準備ができたら、そのまま全画面ビューアを開く（見たかった映画をすぐ見られるように） */
  let waited = 0;
  const openWhenReady = () => {
    if (!window.TrkVideoMax || typeof window.TrkVideoMax.open !== "function") return;
    if (core.videoReady || waited >= 8000) {
      try { if (window.TrkVideoMax.open()) core.setStatus("libStatus", "libVideoWatch"); } catch (_) {}
      return;
    }
    waited += 300; setTimeout(openWhenReady, 300);
  };
  setTimeout(openWhenReady, 300);
}
function removeAdded(it) {
  /* 通常読み込みはセッション内だけ。ここでは一時リストから外すだけで、保存棚のレコードは削除しません。 */
  addedSongs = addedSongs.filter(x => x.key !== it.key);
  renderLib();
}

/* ---------- 曲パックの曲 ---------- */
async function refreshPackSongs() {
  try { packSongs = (await window.Trk.custom.getPackSongs()).map(packItem); } catch (e) { console.error(e); packSongs = []; }
  try { syncTrkOstPackSongs(); } catch (_) {}   /* 🎵 公式OSTパックの曲を trk's OST Vol.1 へつなぐ */
  renderLib();
}
on("packsChanged", refreshPackSongs);

/* ---------- ミュージックフォルダ（📁 開く ／ 📤 共有） ----------
   📁 開く … 今までどおり。選んだフォルダの中だけを曲リストに入れる（🎬 動画フォルダなどにも）
   📤 共有 … 端末（PC・スマホ）に**1回だけ**許可をもらって、ミュージックフォルダの中身を
             ぜんぶ一気に取り込む。許可は libKV の "share" に覚えておくので、次回からは
             「🔗 共有をつづける」の1タップ（ブラウザの都合で、許可は操作のたびに要ります）
   💾 端末に残す（settings.libKeepShared）… 共有で取り込んだ曲を shadow_taiko_shared に保存して、
             許可なしでも遊べるようにする。上限は SHARED_MAX 曲・SHARED_MB MB（空き容量を守るため）
   ⚠ 曲は端末の外へ送りません（読むだけ。アップロードはしません） */
function ingestFolder(list, dirName, shared, skipped) {
  folderSongs = []; const charts = {}; const lyrics = {}; const subs = {};
  for (const { file, rel } of list) {
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "", lower = file.name.toLowerCase();
    if (lower.endsWith(CHART_SUFFIX)) {
      const base = file.name.slice(0, -CHART_SUFFIX.length).replace(/-(easy|normal|hard|master|rush)$/i, "");
      (charts[dir + "/" + base] ||= []).push(file);
    } else if (lower.endsWith(".lrc")) {
      lyrics[dir + "/" + core.baseName(file.name)] = file;   /* 🎤 同じフォルダの同名 .lrc（trk166） */
    } else if (lower.endsWith(".srt") || lower.endsWith(".vtt")) {
      /* 💬 同じフォルダの同名 .srt/.vtt（trk169）。両方あったら .vtt を優先する */
      const k = dir + "/" + core.baseName(file.name);
      if (!subs[k] || lower.endsWith(".vtt")) subs[k] = file;
    } else if (MEDIA_EXT.includes(core.extOf(file.name)) && folderSongs.length < LIB_MAX) {
      const base = core.baseName(file.name), ext = core.extOf(file.name);
      /* 🎞 .mkv/.mpg/.avi などは拡張子だけで映像と分かるので 🎬 を付ける（下調べはしない＝大きいフォルダーでも速い） */
      folderSongs.push({ key:`${file.size}|${base}`, source:"folder", file, title:base, base, size:file.size, dir,
        video:VIDEO_ONLY_EXT.includes(ext) });
    }
  }
  for (const it of folderSongs) { it.charts = charts[it.dir + "/" + it.base] || null; it.lyricsFile = lyrics[it.dir + "/" + it.base] || null; it.subsFile = subs[it.dir + "/" + it.base] || null; }
  /* 📤 共有のときは「何曲きたか」と「対象外が何件あったか」を両方出す（変なファイルも見て分かるように） */
  if (shared) core.setStatus("libStatus", "libShareFound", { dir:dirName || "", n:folderSongs.length, skip:skipped || 0 });
  else core.setStatus("libStatus", folderSongs.length ? "libFound" : "libEmpty", { n:folderSongs.length, dir:dirName || "" });
  /* 🗂 trk201：フォルダーの曲の参照は保存しない（フォルダー自体を覚えている）。
     以前の版が残したフォルダー曲の参照があれば、ここで掃除する。 */
  void pruneFolderRefsOnce();
  renderLib();
}
/* フォルダの中を歩く。読み込んだ曲数は onProgress に出す（大きなフォルダでも待てるように） */
async function scanHandle(h, onProgress) {
  const files = []; let skipped = 0;
  async function walk(dir, path, depth) {
    if (depth > LIB_DEPTH || files.length > LIB_MAX * 2) return;
    for await (const e of dir.values()) {
      if (e.kind === "file") {
        const n = e.name.toLowerCase();
        if (MEDIA_EXT.includes(core.extOf(n)) || n.endsWith(CHART_SUFFIX) || n.endsWith(".lrc") || n.endsWith(".srt") || n.endsWith(".vtt")) {
          files.push({ file:await e.getFile(), rel:`${path}/${e.name}` });   /* 🎤 .lrc・💬 .srt/.vtt も集める（trk166/169） */
          if (onProgress && !(files.length % 25)) onProgress(files.length);
        } else skipped++;                       /* 曲でも譜面でもないファイル（写真・テキストなど） */
      } else if (e.kind === "directory" && !e.name.startsWith(".")) await walk(e, `${path}/${e.name}`, depth + 1);
    }
  }
  await walk(h, h.name, 0);
  return { files, skipped };
}
/* 🔓 覚えているフォルダーを起動時にどう扱うか（trk194。純関数＝テストで確認）
   "scan" … 許可が生きている＝そのまま読み取る（クリック不要・VLCのように開けば曲がある）
   "ask"  … 確認が必要＝最初のタップ（クリック）の中で1回だけ requestPermission する
   "none" … 何もしない（設定オフ・セーフモード・許可が拒否済み・覚えたフォルダーが無い） */
function folderReadPlan(st) {
  if (!st || !st.hasHandle) return "none";
  if (st.safe || st.autoRead === false) return "none";   /* 設定オフ・セーフモードは手動だけ */
  if (st.permission === "denied") return "none";         /* 断られたら、こちらからは聞き直さない */
  if (st.permission === "granted") return "scan";        /* 許可が生きている＝そのまま読む */
  return "ask";                                          /* 最初のタップの中で1回だけ確認 */
}
async function folderPermissionOf(h) {
  let p = "denied";
  try { p = await h.queryPermission({ mode:"read" }); } catch (_) { p = "denied"; }
  folderLastPermission = p;
  return p;
}
/* 🚫 自動の待ち合わせを解除する（read の確認は1回だけ。要らなくなったら確実に外す） */
function disarmFolderAutoRead() {
  folderAutoArmed = false;
  document.removeEventListener("pointerdown", folderAutoKick, true);
  document.removeEventListener("pointerup", folderAutoKick, true);
  document.removeEventListener("keydown", folderAutoKick, true);
}
/* 最初のタップ／キー入力の「中」で許可を確認する。ブラウザーはクリックの中でしか確認を出せないため、
   起動時のタイマーでは出せない（ここが VLC との違い。1タップだけ我慢してもらう）。 */
let folderAutoBusy = false;   /* 最初の pointerdown とボタンの click が続けて来ても、確認は1回だけ */
/* フォルダーを選ぶボタン自身を押したときは、自動の確認より手動の流れ（選び直し）を優先する */
const FOLDER_MANUAL_SELECTOR = "#libOpenBtn, #libShareBtn, #libShareSettingsBtn, #libShareVideoBtn, #libSharedFolderList, #libReconnectBtn, #libRescanBtn, #trkMusicFolderBtn, #libDirInput, .fileBtn, #folderAutoNowBtn";
async function folderAutoKick(e) {
  if (e && e.target && typeof e.target.closest === "function" && e.target.closest(FOLDER_MANUAL_SELECTOR)) return;
  if (folderAutoBusy) return;
  /* タッチの pointerdown や Esc キーは「ユーザー操作」として数えられず、requestPermission が失敗する。
     その場合は待ち合わせを外さず、次の pointerup／click／キーを待つ（「拒否された」と誤表示しない） */
  if (e && typeof navigator !== "undefined" && navigator.userActivation && !navigator.userActivation.isActive) return;
  /* 📤 trk208：共有フォルダーを登録しているときは登録簿のほうを（1本だけなら下の今までの道と同じ結果になる） */
  const registry = typeof sharedFolders === "undefined" ? [] : sharedFolders;
  if (!libHandle && !registry.length) { disarmFolderAutoRead(); core.setStatus("libShareStatus", "folderPermNone"); return; }
  folderAutoBusy = true;
  const h = libHandle, wasShared = libShared;
  disarmFolderAutoRead();
  try {
    if (registry.length) { await folderAutoKickShared(); return; }
    core.setStatus("libStatus", "folderAutoChecking", { name:h.name });
    const p = await folderPermissionOf(h);
    if (p === "granted") { await useHandle(h, false, wasShared); markFolderAccess(true); return; }
    if (p === "denied") { core.setStatus("libShareStatus", "libDenied"); syncShareUI(); return; }
    /* ここはクリック／キー入力の中。ブラウザーの確認は、この中でしか出せない */
    const r = await h.requestPermission({ mode:"read" });
    if (r === "granted") { await useHandle(h, false, wasShared); markFolderAccess(false); }   /* 今回の許可（毎回許可かは分からない） */
    else { core.setStatus("libShareStatus", "libDenied"); core.$("libReconnectBtn").hidden = false; showReconnect(); syncShareUI(); }
  } catch (_) {
    core.setStatus("libShareStatus", "libDenied");
    core.$("libReconnectBtn").hidden = false; showReconnect(); syncShareUI();
  } finally { folderAutoBusy = false; }
}
function armFolderAutoRead() {
  if (folderAutoArmed) return;
  folderAutoArmed = true;
  document.addEventListener("pointerdown", folderAutoKick, true);
  document.addEventListener("pointerup", folderAutoKick, true);   /* タッチは pointerup でユーザー操作になる */
  document.addEventListener("keydown", folderAutoKick, true);
  showReconnect();
}
/* 許可が生きていることを覚えて、設定の表示とボタンの文言を合わせる */
function markFolderAccess(persisted) {
  folderAccessPersisted = persisted === true;
  folderAccessSession = persisted !== true;
  syncShareUI();
}
/* 起動時の入口。許可が生きていれば読み取り、確認が必要なら最初のタップを待つ */
async function restoreFolderAccess() {
  /* 📤 trk208：登録簿にフォルダーがあるときは、そちらで許可を確かめる（音楽・動画をまとめて） */
  if (typeof sharedFolders !== "undefined" && sharedFolders.length) return restoreSharedFolders();
  if (!libHandle) { syncShareUI(); return "none"; }
  const permission = await folderPermissionOf(libHandle);
  const plan = folderReadPlan({ hasHandle:true, permission,
    autoRead: core.settings.folderAutoRead !== false,
    safe: !!(window.TrkSafeMode && window.TrkSafeMode()) });
  if (plan === "scan") {
    folderAccessPersisted = true; folderAccessSession = false;
    await useHandle(libHandle, false, libShared);
    core.setStatus("libStatus", libShared ? "libShareAutoRestored" : "libAutoRestored", { name:libHandle.name });
  } else if (plan === "ask") {
    folderAccessPersisted = false;
    core.$("libReconnectBtn").hidden = false; showReconnect();
    armFolderAutoRead();
    core.setStatus("libStatus", "folderAutoNeedsTap", { name:libHandle.name });
  } else {
    folderAccessPersisted = false;
    core.$("libReconnectBtn").hidden = false; showReconnect();
    /* 🚫 trk197：起動したときに許可が拒否されていたら、黙って何もしないのではなく理由と直し方を出す */
    if (permission === "denied" && core.settings.folderAutoRead !== false)
      core.setStatus("libStatus", "folderPermDenied", { name:libHandle.name });
  }
  syncShareUI();
  return plan;
}

async function useHandle(h, remember, shared) {
  libShared = !!shared;
  core.setStatus("libStatus", shared ? "libShareScanning" : "libScanning", { n:0 });
  try {
    const r = await scanHandle(h, n => core.setStatus("libStatus", shared ? "libShareScanning" : "libScanning", { n }));
    libHandle = h; lastScan = r.files;
    ingestFolder(r.files, h.name, libShared, r.skipped);
    if (remember) { libKV.put(shared ? "share" : "dir", h).catch(() => {}); if (shared) shareRemembered = true; }
    core.$("libReconnectBtn").hidden = true; core.$("libRescanBtn").hidden = false;
    if (shared && core.settings.libKeepShared) await keepSharedSongs(r.files);
    syncShareUI();
  } catch (e) { console.error(e); core.setStatus("libStatus", shared ? "libShareDenied" : "libDenied"); }
}
async function openFolder() {
  dirInputMode = "open";
  disarmFolderAutoRead();   /* trk194：自分で選び直すときは、自動の待ち合わせを先に止める（二重に読まない） */
  if (!canPickDir) { core.$("libDirInput").click(); return; }
  try { await useHandle(await showDirectoryPicker({ id:"trk-music", mode:"read", startIn:"music" }), true, false); }
  catch (e) { if (e.name !== "AbortError") { console.error(e); core.$("libDirInput").click(); } }
}
/* 📤 ミュージックフォルダを共有：端末に1回許可してもらうと、中身のリストをぜんぶ引き受けます。
   trk208：選んだフォルダーは登録簿に**追加**します（もう1本、動画フォルダーも、書斎のフォルダーも並べて覚えられる）。 */
async function shareMusicFolder() { return addSharedFolder("music"); }
/* 🚫 共有をやめる：覚えた許可と、端末に残した曲をぜんぶ消します */
async function stopSharing() {
  /* 🛡 覚えてあるフォルダの鍵（📤 共有の "share" と 📁 開くの "dir"）を、両方とも IndexedDB から消す。
     ページ内で動くコード（アドオン等）が、許可の生きているうちに再利用できないようにするため。
     ⚠ handle.remove() は呼ばない：あれは「本物のファイル／フォルダを消す」API。
       権限の取り消しはブラウザの設定（サイトデータ）側で行うもので、こちらからは触らない。 */
  try { await libKV.del("share"); } catch (_) {}
  try { await libKV.del("dir"); } catch (_) {}
  try { await libKV.del("folders"); } catch (_) {}   /* trk208：登録した共有フォルダー（音楽・動画）もぜんぶ忘れる */
  const hadRegistry = sharedFolders.length > 0;
  sharedFolders = []; sharedLabels = [];
  shareRemembered = false;
  folderAccessPersisted = false; folderAccessSession = false; disarmFolderAutoRead();   /* trk194：自動の待ち合わせも解除 */
  await clearSharedSongs();
  if (libShared || hadRegistry) {
    folderSongs = []; libHandle = null; libShared = false; lastScan = [];
    core.$("libReconnectBtn").hidden = true; core.$("libRescanBtn").hidden = true;
  }
  renderLib(); syncShareUI();
  core.setStatus("libShareStatus", "libShareStopped");
}
/* trk211：🔓 の文面に出す「次に聞く1本」を決める。
   まだ許可待ち（prompt）の先頭を選び、全部が拒否なら先頭の1本を出す
   （空にして libHandle.name に落ちると、別のフォルダー名が出てしまうため）。
   引数は {folder, permission} の配列（foldersNeedingPermission）と、フォルダーの配列（readSharedFolders の pending）の両方。 */
function sharedPendingNameFrom(list) {
  const need = Array.isArray(list) ? list : [];
  const pick = need.find(n => n && n.permission && n.permission !== "denied") || need[0];
  const folder = pick && (pick.folder || pick);
  return folder && folder.name ? folder.name : "";
}
function showReconnect() {
  const b = core.$("libReconnectBtn");
  if (!libHandle || !b || b.hidden) return;
  /* 🔓 trk194：最初のタップ待ちのときは「読み取る」と書く（何が起きるか分かるように） */
  const key = folderAutoArmed ? "libReconnectAuto" : libShared ? "libShareResume" : "libReconnect";
  /* trk210：共有フォルダーが複数あるときは「まだ許可が要る1本」の名前を出す（1タップ＝1本で聞くため） */
  b.textContent = tr(key, { name:sharedPendingName || libHandle.name });
}

/* ---------- 📤 trk208：共有フォルダーの登録簿（音楽も動画も、いくつでも） ----------
   trk207 までは「📤 共有」＝1本のフォルダーだけだった。書斎のようにフォルダーが何本もある使い方に
   合わせて、**覚えたフォルダーを一覧で持つ**ようにした。中身は1本のときと同じで、
   「1回許可 → 一覧に取り込む → 次回は起動しただけで読む（許可が生きていれば）」。
   ・音楽フォルダー … startIn:"music" ／ 動画フォルダー … startIn:"videos"
   ・フォルダーは「読むだけ」。曲も動画も端末の外へ送らない。 */
const FOLDER_KIND_START = { music:"music", video:"videos" };
const FOLDER_KIND_MAX = 8;   /* 覚えるフォルダーの本数（多すぎると起動の走査が重くなる） */
function sharedFolderLabel(f, index) {
  const name = String(f && f.name || "").trim() || "Folder";
  return sharedLabels[index] || name;
}
function sharedFolderNames() {
  return sharedFolders.map((f, i) => sharedFolderLabel(f, i)).join("・");
}
/* 登録簿を IndexedDB から読む。無ければ trk194〜207 の "share"（1本）をここへ移す（後方互換） */
async function loadSharedFolders() {
  let list = [];
  try { list = await libKV.get("folders") || []; } catch (_) { list = []; }
  const kept = [];
  for (const item of Array.isArray(list) ? list : []) {
    const h = item && item.handle;
    if (!h || h.kind !== "directory" || typeof item.name !== "string" || !item.name) continue;
    kept.push({ id:String(item.id || item.name).slice(0, 200), name:String(item.name).slice(0, 200),
      kind:item.kind === "video" ? "video" : "music", handle:h, addedAt:Math.max(0, Number(item.addedAt) || 0),
      label:String(item.label || "").slice(0, 200) });
  }
  if (!kept.length) {
    try {
      const legacy = await libKV.get("share");
      if (legacy && legacy.kind === "directory" && legacy.name) {
        kept.push({ id:legacy.name, name:legacy.name, kind:"music", handle:legacy, addedAt:0, label:"" });
        await libKV.put("folders", kept).catch(() => {});   /* 移せたら登録簿が本籍（"share" は消さない＝読めない環境でも失わない） */
      }
    } catch (_) {}
  }
  sharedFolders = kept; sharedLabels = kept.map(f => f.label);
  return kept;
}
async function saveSharedFolders() {
  try { await libKV.put("folders", sharedFolders); return true; } catch (e) { console.warn("shared folders could not be saved", e); return false; }
}
/* 同じフォルダーを2回登録しない（isSameEntry があればそれで、無ければ名前と種類で見る） */
async function sameFolder(a, b) {
  if (!a || !b) return false;
  try { if (typeof a.isSameEntry === "function") return await a.isSameEntry(b); } catch (_) {}
  return String(a.name || "") === String(b.name || "");
}
/* 📤 フォルダーを登録して、すぐ読む（音楽／動画で startIn だけ変える） */
async function addSharedFolder(kind) {
  const video = kind === "video";
  dirInputMode = "share";
  disarmFolderAutoRead();   /* trk194：自分で選び直すときは自動の待ち合わせを先に止める */
  if (!canPickDir) { core.setStatus("libShareStatus", "libShareUnsupported"); core.$("libDirInput").click(); return; }
  let handle = null;
  try {
    handle = await showDirectoryPicker({ id:video ? "trk-video-share" : "trk-music-share", mode:"read",
      startIn:FOLDER_KIND_START[video ? "video" : "music"] });
  } catch (e) {
    if (e && e.name === "AbortError") { dirInputMode = "open"; return; }   /* キャンセルは何もしない */
    console.error(e);
    core.setStatus("libStatus", "libShareDenied"); core.setStatus("libShareStatus", "libShareUnsupported");
    core.$("libDirInput").click();
    return;
  }
  try {
    for (const f of sharedFolders) if (await sameFolder(f.handle, handle)) {
      core.setStatus("libShareStatus", "libShareAlready", { name:handle.name });
      await readSharedFolders();
      return;
    }
    if (sharedFolders.length >= FOLDER_KIND_MAX) { core.setStatus("libShareStatus", "libShareFolderMax", { max:FOLDER_KIND_MAX }); return; }
    const entry = { id:`${video ? "video" : "music"}:${handle.name}:${Date.now().toString(36)}`, name:handle.name,
      kind:video ? "video" : "music", handle, addedAt:Date.now(), label:"" };
    sharedFolders.push(entry);
    sharedLabels = sharedFolders.map((f, i) => sharedFolderLabel(f, i));
    shareRemembered = true;
    await saveSharedFolders();
    await readSharedFolders();
    core.setStatus("libShareStatus", "libShareAdded", { name:handle.name, folders:sharedFolders.length });
  } catch (e) {
    console.error(e);
    core.setStatus("libStatus", "libShareDenied");
    core.setStatus("libShareStatus", "libShareDenied");
  }
}
/* 登録したフォルダーを、いま許可が生きているものだけ読む（1本だけのときもここを通る） */
async function readSharedFolders() {
  if (!sharedFolders.length) return { granted:0 };
  core.setStatus("libStatus", "libShareScanning", { n:0 });
  const scans = [];
  const pending = [];
  let granted = 0;
  for (const f of sharedFolders) {
    const p = await folderPermissionOf(f.handle).catch(() => "prompt");
    if (p !== "granted") { pending.push(f); scans.push({ name:f.name, files:[], skipped:0 }); continue; }
    granted++;
    try {
      const r = await scanHandle(f.handle, n => core.setStatus("libStatus", "libShareScanning", { n }));
      scans.push({ name:f.name, files:r.files, skipped:r.skipped });
    } catch (e) { console.warn("shared folder could not be read", e); scans.push({ name:f.name, files:[], skipped:0 }); }
  }
  const merged = TrkSharedFolders.mergeScans(scans);
  sharedPendingName = sharedPendingNameFrom(pending);   /* trk211：ヘルパーに集約 */
  /* 同名フォルダーの「(2)」を、次回も同じ名前で出せるように覚える（dir の見分けが毎回変わらないように） */
  sharedLabels = merged.labels;
  let renamed = false;
  sharedFolders.forEach((f, i) => { const next = merged.labels[i] || ""; if (next && f.label !== next) { f.label = next; renamed = true; } });
  if (renamed) void saveSharedFolders();
  libShared = granted > 0;
  libHandle = sharedFolders[0].handle;
  shareRemembered = true;
  lastScan = merged.files;
  ingestFolder(merged.files, merged.label, true, merged.skipped);
  /* trk210：1本でも許可待ち（確認が必要・拒否）が残っている間は 🔓 を出したままにする。
     許可が生きているフォルダーは、残りを待たずにここで読めている。 */
  core.$("libReconnectBtn").hidden = granted >= sharedFolders.length;
  core.$("libRescanBtn").hidden = sharedFolders.length === 0;
  if (libShared && core.settings.libKeepShared) await keepSharedSongs(merged.files);
  syncShareUI();
  return { granted, total:sharedFolders.length };
}
/* 🔓 登録簿のフォルダーで、まだ許可が要るもの（起動時と最初のタップで使う） */
async function foldersNeedingPermission() {
  const out = [];
  for (const f of sharedFolders) {
    const permission = await folderPermissionOf(f.handle).catch(() => "prompt");
    if (permission !== "granted") out.push({ folder:f, permission });
  }
  return out;
}
/* 起動時の入口（登録簿があるとき）。1本だけのときは restoreFolderAccess の元の道を通る */
async function restoreSharedFolders() {
  libHandle = sharedFolders[0].handle;
  shareRemembered = true;
  const autoRead = core.settings.folderAutoRead !== false && !(window.TrkSafeMode && window.TrkSafeMode());
  const need = await foldersNeedingPermission();
  folderLastPermission = need.some(n => n.permission === "denied") ? "denied"
    : need.length ? "prompt" : "granted";
  const plan = TrkSharedFolders.plan({ hasHandle:true, permission:folderLastPermission, autoRead, safe:false });
  sharedPendingName = sharedPendingNameFrom(need);   /* trk211：次に聞く1本（拒否は後ろ） */
  core.$("libReconnectBtn").hidden = false; showReconnect();
  /* trk210：1本でも「確認が必要」「拒否」があると、許可が生きているフォルダーの曲まで
     最初のタップ（拒否なら手動）まで出なかった。生きているフォルダーは先に読む。 */
  if (plan !== "scan" && autoRead && need.length < sharedFolders.length) {
    folderAccessPersisted = true; folderAccessSession = false;
    await readSharedFolders();
  }
  if (plan === "scan") {
    folderAccessPersisted = true; folderAccessSession = false;
    const r = await readSharedFolders();
    if (r.granted) core.setStatus("libStatus", "libShareAutoRestored", { name:sharedFolderNames(), n:folderSongs.length });
  } else if (plan === "ask") {
    folderAccessPersisted = false;
    armFolderAutoRead();
    core.setStatus("libStatus", "folderAutoNeedsTap", { name:sharedPendingName });
  } else if (folderLastPermission === "denied" && autoRead) {
    folderAccessPersisted = false;
    core.setStatus("libStatus", "folderPermDenied", { name:sharedPendingName });
  }
  syncShareUI();
  return plan;
}
/* 最初のタップの中で、許可が要るフォルダーを1本ずつ確かめる（1タップ＝1本。確認をまとめて出さない） */
async function folderAutoKickShared() {
  const need = await foldersNeedingPermission();
  const target = need.find(n => n.permission !== "denied");
  if (target) {
    core.setStatus("libStatus", "folderAutoChecking", { name:target.folder.name });
    const answer = await target.folder.handle.requestPermission({ mode:"read" });
    if (answer !== "granted") {
      /* trk211：断られたら、まず残りを数え直してから文面を合わせる。
         以前は sharedPendingName を更新せずに showReconnect() していたので、
         🔓 に「いま断った1本」か、その前のフォルダー名が残ることがあった。 */
      const rest = await foldersNeedingPermission();
      sharedPendingName = sharedPendingNameFrom(rest);
      core.setStatus("libShareStatus", "libDenied");
      core.$("libReconnectBtn").hidden = false; syncShareUI();
      if (rest.some(n => n.permission === "prompt")) armFolderAutoRead();   /* ほかのフォルダーは次のタップで */
      return;
    }
    markFolderAccess(false);   /* 今回の許可（毎回許可かは分からない） */
  }
  await readSharedFolders();
  const rest = await foldersNeedingPermission();
  sharedPendingName = sharedPendingNameFrom(rest);   /* trk211：読み終えた後も残りの1本に合わせる */
  if (rest.some(n => n.permission === "prompt")) armFolderAutoRead();
  syncShareUI();
}
/* 登録簿から1本を外す（📤 共有をぜんぶやめるのは stopSharing） */
async function removeSharedFolder(id) {
  const before = sharedFolders.length;
  sharedFolders = sharedFolders.filter(f => f.id !== id);
  sharedLabels = sharedFolders.map((f, i) => sharedFolderLabel(f, i));
  if (sharedFolders.length === before) return;
  await saveSharedFolders();
  if (!sharedFolders.length) {
    /* 最後の1本を外したら、📁 開く で覚えたフォルダーに戻す（共有の曲は消す）。
       trk210：trk194〜207 の "share"（1本だけの共有）も一緒に消す。残すと登録簿が空なので、
       次の起動で loadSharedFolders が "share" を移し直し、外したはずのフォルダーが戻ってくる。 */
    try { await libKV.del("share"); } catch (_) {}
    sharedPendingName = "";
    await clearSharedSongs().catch(() => {});
    folderSongs = []; libHandle = null; libShared = false; lastScan = [];
    shareRemembered = false;
    core.$("libReconnectBtn").hidden = true; core.$("libRescanBtn").hidden = true;
    try {
      const hd = await libKV.get("dir");
      if (hd && hd.kind === "directory") { libHandle = hd; libShared = false; }
    } catch (_) {}
    renderLib(); syncShareUI();
    core.setStatus("libShareStatus", "libShareRemoved", { name:"" });
    return;
  }
  await readSharedFolders();
  core.setStatus("libShareStatus", "libShareRemoved", { name:"" });
}
/* 共有フォルダーの一覧（📤 パネル）。フォルダーごとの曲数と、× で外すボタンを出す */
function renderSharedFolderList() {
  const box = core.$("libSharedFolderList");
  if (!box) return;
  box.textContent = "";
  if (!sharedFolders.length) { box.hidden = true; return; }
  box.hidden = false;
  const counts = new Map();
  for (const song of folderSongs) {
    const dir = String(song.dir || ""), head = dir.split("/")[0];
    if (head) counts.set(head, (counts.get(head) || 0) + 1);
  }
  sharedFolders.forEach((f, index) => {
    const label = sharedFolderLabel(f, index), row = document.createElement("div");
    row.className = "libSharedFolderRow";
    const name = document.createElement("span");
    name.className = "libSharedFolderName";
    name.textContent = `${f.kind === "video" ? "🎬" : "🎵"} ${label}`;
    const n = document.createElement("span");
    n.className = "libSharedFolderCount";
    n.textContent = tr("libShareFolderCount", { n:counts.get(label) || 0 });
    const off = document.createElement("button");
    off.type = "button"; off.className = "libSharedFolderOff";
    off.dataset.folderId = f.id;
    off.textContent = "×";
    off.title = tr("libShareFolderRemoveHint", { name:label });
    off.setAttribute("aria-label", tr("libShareFolderRemoveHint", { name:label }));
    row.append(name, n, off);
    box.append(row);
  });
}

/* ---------- 💾 共有した曲を端末に残す（settings.libKeepShared） ---------- */
function sharedItem(r) {
  const f = r.file instanceof File ? r.file : new File([r.file], r.name || "song"), base = core.baseName(f.name);
  /* addedAt＝💾 端末に残した日時（⚡スマート棚の「最近追加」の材料・trk172） */
  return { key:`${f.size}|${base}`, source:"folder", shared:true, file:f, title:base, base, size:f.size, dir:r.dir || "", charts:null,
    addedAt: Number(r.addedAt) > 0 ? Number(r.addedAt) : 0 };
}
async function loadSharedSongs() {
  try {
    const recs = await sharedDB.all();
    sharedSongs = (recs || []).filter(r => r && r.file).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)).map(sharedItem);
  } catch (e) { console.error(e); sharedSongs = []; }
}
async function clearSharedSongs() {
  try { for (const k of (await sharedDB.keys()) || []) await sharedDB.del(k); } catch (e) { console.error(e); }
  sharedSongs = [];
}
async function removeShared(it) {
  sharedSongs = sharedSongs.filter(x => x.key !== it.key);
  try { await sharedDB.del(it.key); } catch (_) {}
  renderLib(); syncShareUI();
}
/* 共有で取り込んだ曲を端末の中へ。上限（曲数・バイト数）に達したら、そこで止めて正直に出します。
   ⚡ もう端末にある曲（key＝「サイズ|曲名」が同じ）は書き直さないので、↻ 再スキャンは軽く済みます */
async function keepSharedSongs(list) {
  let why = "", saved = 0, bytes = 0;
  const have = new Map();                                            /* key → 保存してあるバイト数 */
  try {
    for (const k of (await sharedDB.keys()) || []) {
      const sz = Number(String(k).split("|")[0]) || 0;
      have.set(String(k), sz); bytes += sz;
    }
  } catch (_) {}
  let n = have.size;
  for (const { file, rel } of list || []) {
    if (!MEDIA_EXT.includes(core.extOf(file.name))) continue;
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "", key = `${file.size}|${core.baseName(file.name)}`;
    if (have.has(key)) continue;
    if (n >= SHARED_MAX || bytes + file.size > SHARED_BYTES) { why = "full"; break; }
    try { await sharedDB.put(key, { key, file, name:file.name, dir, addedAt:Date.now() }); }
    catch (e) { console.error(e); why = "failed"; break; }            /* 空き容量が足りない（QuotaExceededError など） */
    have.set(key, file.size); n++; bytes += file.size; saved++;
    if (!(saved % 10)) core.setStatus("libShareStatus", "libKeepSharedSaving", { n:saved });
  }
  await loadSharedSongs();
  renderLib();
  core.setStatus("libShareStatus", why === "failed" ? "libKeepSharedFailed" : why === "full" ? "libKeepSharedFull" : "libKeepSharedSaved",
    { n, max:SHARED_MAX, mb:SHARED_MB });
  return n;
}
/* 設定パネル「📤 ミュージックフォルダの共有」の中身を、いまの状態に合わせます */
function syncShareUI() {
  const chk = core.$("libKeepSharedChk"), hint = core.$("libKeepSharedHint"), state = core.$("libShareState"), stop = core.$("libShareStopBtn");
  if (chk) chk.checked = !!core.settings.libKeepShared;
  if (hint) hint.textContent = tr("libKeepSharedHint", { max:SHARED_MAX, mb:SHARED_MB });
  /* 🔓 trk194：自動の読み取りの設定と、いまの許可の状態（次回も自動で読めるか） */
  const autoChk = core.$("folderAutoReadChk"), autoHint = core.$("folderAutoReadHint"), permState = core.$("folderPermState");
  if (autoChk) autoChk.checked = core.settings.folderAutoRead !== false;
  if (autoHint) autoHint.textContent = tr("folderAutoReadHint");
  if (permState) permState.textContent = folderAccessPersisted ? tr("folderPermPersisted")
    : folderAccessSession ? tr("folderPermSession")
    : !libHandle ? tr("folderPermNone")
    /* 🚫 trk197：拒否されているときは「自動オフ」ではなく、なぜ曲が出ないかと直し方を出す */
    : folderLastPermission === "denied" ? tr("folderPermDenied", { name:libHandle.name })
    : folderAutoArmed ? tr("folderPermNeedsTap", { name:libHandle.name })
    : tr("folderPermManual");
  const sharing = !!libHandle && libShared, opened = !!libHandle && !libShared;
  /* 📤 trk208：フォルダーを登録しているときは「何本・何曲」を出す（1本だけなら今までと同じ言い方） */
  const multi = typeof sharedFolders !== "undefined" ? sharedFolders.length : 0;
  if (state) state.textContent = multi
    ? tr("libShareStateMulti", { folders:multi, songs:folderSongs.length, names:sharedFolderNames() })
    : sharing ? tr("libShareStateShared", { name:libHandle.name, n:folderSongs.length })
    : opened ? tr("libShareStateOpened", { name:libHandle.name, n:folderSongs.length })   /* 📁 開く で覚えたフォルダー（trk194） */
    : sharedSongs.length ? tr("libKeepSharedRestored", { n:sharedSongs.length }) : tr("libShareStateNone");
  if (stop) stop.hidden = !(multi || sharing || shareRemembered || sharedSongs.length);
  renderSharedFolderList();
  showReconnect();
}
function syncTrkUI() {
  const chk = core.$("trkPlaylistChk");
  if (chk) chk.checked = core.settings.trkPlaylist !== false;
  const st = core.$("trkStatus");
  if (st) {
    const tp = core.settings.playlists.find(function(p){ return p.id === TRK_PLAYLIST_ID; });
    if (core.settings.trkPlaylist === false) st.textContent = tr("trkHide") + " \u2014 " + tr("trkPanelHint");
    else if (tp) st.textContent = tr("trkPlaylistTitle") + " \u00B7 " + tr("plSongsNow", { n: (tp.songs.length + (tp.wish ? tp.wish.length : 0)) });
    else st.textContent = tr("trkPlaylistHint");
  }
  const chkC = core.$("trkClassicChk");
  if (chkC) chkC.checked = core.settings.trkClassic !== false;
  const stC = core.$("trkClassicStatus");
  if (stC) {
    const tc = core.settings.playlists.find(function(p){ return p.id === TRK_CLASSIC_ID; });
    if (core.settings.trkClassic === false) stC.textContent = tr("trkClassicHide") + " \u2014 " + tr("trkClassicPanelHint");
    else if (tc) stC.textContent = tr("trkClassicTitle") + " \u00B7 " + tr("plSongsNow", { n: (tc.songs.length + (tc.wish ? tc.wish.length : 0)) });
    else stC.textContent = tr("trkClassicHint");
  }
  const nameSel = core.$("trkTabNameSel");
  if (nameSel) nameSel.value = trkNameMode();
  const chkAbc = core.$("trkSortAbcChk");
  if (chkAbc) chkAbc.checked = !!core.settings.trkSortABC;
  const restore = core.$("trkRestoreBtn");
  if (restore) {
    const removed = Array.isArray(core.settings.trkRemoved) ? core.settings.trkRemoved.length : 0;
    /* 🐔 trk217：戻すのは上の「リスト選択」から1本ずつ（trk-apk と同じ）。♻ は出さない */
    restore.hidden = true;
    restore.textContent = tr("trkRestoreBtn", { n: removed });
  }
  try { renderTrkSettings(); } catch(_){}
}
function trkFolderIdSet() { return plWishFolderIds(TRK_FOLDER_ID); }
/* 🐔 の中のリスト（trk が作ったもの、または 🐔 のフォルダ内にあるもの）か */
function plIsTrkManaged(p) { return TRK_AUTO_ID.test(p.id) || trkFolderIdSet().has(p.folder); }   /* 🐔 の階層に入るフォルダ（trk 自身と、その子孫） */
/* 🐔 trk218：trk が作った（配布の）リストか。ID が trk- で始まるものだけ。
   利用者が 📋 で作ったコピーは pl… なので、🐔 の中にあっても利用者のリストとして扱う */
function trkIsFixedList(p) { return !!p && TRK_AUTO_ID.test(p.id); }
/* 👁 曲画面の「プレイリストに入れる」に出すか。trk のリストは初期状態では出さない（並ぶと圧迫するため） */
function trkListShown(p) {
  if (!trkIsFixedList(p)) return true;
  return Array.isArray(core.settings.trkListed) && core.settings.trkListed.includes(p.id);
}
/* 🗑／👁 を切り替える（リストそのものは消さない） */
function trkListSetShown(p, on) {
  if (!p) return;
  const ids = new Set(Array.isArray(core.settings.trkListed) ? core.settings.trkListed : []);
  if (on) ids.add(p.id); else ids.delete(p.id);
  core.settings.trkListed = [...ids].slice(-200);
  core.saveUserPrefs();
}
/* 📋 編集できるコピー＝通常のプレイリスト（中クリックで消せる・名前や色も変えられる）。
   カタログとの紐づけ（cat）は付けないので、起動時の更新で中身を上書きされない。 */
function trkCopyAsUser(p) {
  if (!p || core.settings.playlists.length >= TRK_LIST_MAX) return null;
  const suffix = tr("trkCopySuffix");
  const base = String(p.name || "").slice(0, Math.max(1, 24 - suffix.length));
  const copy = plSanitize({ id: "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: base + suffix, icon: p.icon, color: p.color, frozen: false, locked: false,
    songs: (p.songs || []).slice(), wish: (p.wish || []).slice(), guide: p.guide || null,
    folder: p.folder || "", tags: (p.tags || []).slice(), cat: "", createdAt: Date.now() });
  if (!copy) return null;
  core.settings.playlists.push(copy);
  core.saveUserPrefs();
  return copy;
}
/* 📢 固定の案内（アップデート後に一度だけ）。trk のリストがある人にだけ出す */
function trkFixedNoticeOnce() {
  if (core.settings.trkFixedNotice === 1) return false;
  if (!core.settings.playlists.some(trkIsFixedList)) return false;
  core.settings.trkFixedNotice = 1;
  core.saveUserPrefs();
  try { plToast(tr("trkFixedNotice")); } catch (_) {}
  return true;
}
function renderTrkSettings() {
  const box = core.$("trkOrderList");
  if (!box) return;
  box.replaceChildren();
  const ids = trkFolderIdSet();
  const trkList = core.settings.playlists.filter(p => ids.has(p.folder));
  if (!trkList.length) { box.append(el("div", "hint", tr("trkOrderEmpty"))); return; }
  const ordered = trkOrderedPlaylists(trkList), peers = ordered.map(x => x.id);
  for (const [i, p] of ordered.entries()) {
    const row = el("div", "plTrkRow"); row.style.cssText = "border:1px solid var(--ui-border);border-radius:10px;padding:6px 8px";
    const name = el("span", "", (p.icon || "\uD83C\uDFA7") + " " + p.name);
    const open = el("button", "plBtn small", tr("trkOpenItem")); open.type = "button";
    open.addEventListener("click", () => { core.settings.libTab = "pl:" + p.id; core.saveUserPrefs(); renderLib(); });
    const up = el("button", "plBtn small", "\u2191"); up.type = "button"; up.title = tr("trkMoveUp"); up.setAttribute("aria-label", tr("trkMoveUp") + " " + p.name);
    const down = el("button", "plBtn small", "\u2193"); down.type = "button"; down.title = tr("trkMoveDown"); down.setAttribute("aria-label", tr("trkMoveDown") + " " + p.name);
    trkMoveButtonsState(up, down, i, ordered.length);
    up.addEventListener("click", () => trkMovePlaylist(p.id, -1, peers));
    down.addEventListener("click", () => trkMovePlaylist(p.id, 1, peers));
    /* 🗑 曲画面の「プレイリストに入れる」から隠す／👁 また出す。trk のリストは初期状態では隠れている（trk218）。
       📋 で作ったコピー（pl…）は利用者のリストなので、この2つは出さない（元から一覧に出る・そのまま編集できる） */
    const listed = trkListShown(p);
    const eye = el("button", "plBtn small", listed ? "\uD83D\uDDD1" : "\uD83D\uDC41");
    eye.type = "button";
    eye.title = listed ? tr("trkListHide") : tr("trkListShow");
    eye.setAttribute("aria-label", (listed ? tr("trkListHide") : tr("trkListShow")) + " " + p.name);
    eye.setAttribute("aria-pressed", listed ? "true" : "false");
    if (!listed) eye.classList.add("plTrkHidden");
    eye.addEventListener("click", () => {
      trkListSetShown(p, !listed);
      plToast(listed ? tr("trkListHidden", { name: p.name }) : tr("trkListShown", { name: p.name }));
      renderTrkSettings();
    });
    /* 📋 編集できるコピー（通常のプレイリスト）を作る。元のリストはそのまま */
    const copyBtn = el("button", "plBtn small", "\uD83D\uDCCB");
    copyBtn.type = "button"; copyBtn.title = tr("trkCopyBtn"); copyBtn.setAttribute("aria-label", tr("trkCopyBtn") + " " + p.name);
    copyBtn.addEventListener("click", () => {
      const copy = trkCopyAsUser(p);
      if (!copy) { plToast(tr("trkCopyFail", { n: TRK_LIST_MAX })); return; }
      plToast(tr("trkCopyDone", { name: copy.name }));
      renderTrkSettings(); renderLib();
    });
    row.append(name, open, up, down);
    if (trkIsFixedList(p)) row.append(eye, copyBtn);
    box.append(row);
  }
  box.append(el("div", "hint", tr("trkListNote")));
  if (core.settings.trkSortABC) box.append(el("div", "hint", tr("trkOrderAbcOff")));
}

/* 🐔 trk217：カタログから「選んだリストだけ」を追加する（trk-apk の新基準）。
   起動時に何十本も作らず、要るものだけを設定の 🐔 から入れる。消したリストもここから戻せる。 */
function trkPickEntries() {
  const originals = tr("trkPickOriginals");
  const list = [
    { id: TRK_OST_ID, name: "🎓 trk's OST Vol.1", group: originals, special: "ost" },
    { id: TRK_PLAYLIST_ID, name: "🐔 Game Vol.1", group: originals, special: "game" },
    { id: TRK_CLASSIC_ID, name: "🎻 Classic Vol.1", group: originals, special: "classic" },
  ];
  if (builtInSongs.some(song => String(song.key).startsWith(AGENT_OST_KEY_PREFIX)))
    list.push({ id: AGENT_OST_ID, name: "🎼 " + AGENT_OST_NAME, group: originals, special: "agent" });
  for (const series of trkCatalog()) for (const playlist of (series.playlists || [])) {
    const songs = playlist.songs || [];
    if (!songs.length) continue;   /* 曲の無いカタログ項目は出さない（作っても空になる） */
    const volumes = Math.max(1, Math.ceil(songs.length / 100));   /* 1本100曲まで。超えるものは Vol に分ける */
    for (let i = 0; i < volumes; i++) {
      const suffix = volumes > 1 ? "-v" + (i + 1) : "";
      /* plSanitize は ID を24文字までにする。Vol の接尾辞は削らない */
      const id = ("trk-" + playlist.id).slice(0, 24 - suffix.length) + suffix;
      list.push({ id, series, playlist, index: i, volumes,
        name: (playlist.icon || series.icon || "🎵") + " " + playlist.name + (volumes > 1 ? " Vol." + (i + 1) : ""),
        group: (series.icon || "🎵") + " " + series.name });
    }
  }
  return list;
}
function trkPickHas(entry) {
  if (!entry) return true;
  if (core.settings.playlists.some(p => p.id === entry.id)) return true;
  if (!entry.playlist) return false;
  const cats = [entry.series.id + ":" + entry.playlist.id, "trk:" + entry.series.id + ":" + entry.playlist.id];
  return entry.volumes === 1 && core.settings.playlists.some(p => cats.includes(p.cat));
}
function trkPickAdd(entry) {
  if (!entry || trkPickHas(entry) || core.settings.playlists.length >= TRK_LIST_MAX) return false;
  const hasFolder = id => core.settings.plFolders.some(f => f.id === id);
  if (entry.special) {
    /* 🐔（Classic は 🎻 も）が要る。作る前に数を確かめる */
    const need = (entry.special === "classic" ? [TRK_FOLDER_ID, "trk-classic"] : [TRK_FOLDER_ID]).filter(id => !hasFolder(id));
    if (!plFolderRoom(need.length)) return false;
    if (entry.special === "game" && !trkWishesFromCatalog().length) return false;
    if (entry.special === "classic" && !trkClassicWishesFromCatalog().length) return false;
    /* 「表示オフ」で止まらないよう、作る前に一時的にオンへ（失敗したら元に戻す） */
    const before = { trkPlaylist: core.settings.trkPlaylist, trkClassic: core.settings.trkClassic };
    trkUnmarkRemoved(entry.id);
    if (entry.special === "game" || entry.special === "classic") core.settings.trkPlaylist = true;
    if (entry.special === "classic") core.settings.trkClassic = true;
    let made = false;
    trkSelectedFoldersOnly = true;
    try {
      if (entry.special === "classic") { ensureTrkFolder(); ensureTrkSubfolder("trk-classic", "Classic", "🎻"); }
      if (entry.special === "ost") made = !!ensureTrkOstPlaylist({ toast: false });
      else if (entry.special === "game") made = !!ensureTrkPlaylist({ toast: false });
      else if (entry.special === "classic") made = !!ensureTrkClassicPlaylist({ toast: false });
      else made = !!ensureAgentOstPlaylist(builtInSongs.filter(song => String(song.key).startsWith(AGENT_OST_KEY_PREFIX)).map(song => song.key));
    } finally { trkSelectedFoldersOnly = false; }
    if (!made) { core.settings.trkPlaylist = before.trkPlaylist; core.settings.trkClassic = before.trkClassic; return false; }
    core.settings.trkPlaylist = true;   /* 追加したリストが見えるよう、🐔 のタブは出す */
    core.saveUserPrefs();
    return true;
  }
  const series = entry.series, pl = entry.playlist;
  if (!(pl.songs || []).length) return false;
  const shelf = trkShelfFor(series.id, pl.id);
  const need = [TRK_FOLDER_ID, shelf && shelf === ENDFIELD_CHARACTER_FOLDER ? "trk-endfield" : "", shelf]
    .filter((id, i, arr) => id && !hasFolder(id) && arr.indexOf(id) === i);
  if (!plFolderRoom(need.length)) return false;
  trkSelectedFoldersOnly = true;
  try {
    ensureTrkFolder();
    for (const sh of TRK_SHELVES) if (need.includes(sh.id)) ensureTrkSubfolder(sh.id, sh.name, sh.icon, sh.parent);
  } finally { trkSelectedFoldersOnly = false; }
  const folder = shelf && hasFolder(shelf) ? shelf : TRK_FOLDER_ID;
  const p = plSanitize({ id: entry.id, name: pl.name + (entry.volumes > 1 ? " Vol." + (entry.index + 1) : ""),
    icon: pl.icon || series.icon, color: pl.color || series.color, folder, tags: pl.tags,
    wish: (pl.songs || []).slice(entry.index * 100, (entry.index + 1) * 100).map(trkWishFromTrack),
    guide: trkCatalogGuide(series, pl, true), cat: "trk:" + series.id + ":" + pl.id, songs: [], createdAt: Date.now() });
  if (!p) return false;
  trkUnmarkRemoved(entry.id);
  core.settings.playlists.push(p);
  core.settings.trkPlaylist = true;
  core.saveUserPrefs();
  return true;
}
function trkPickRender() {
  const select = core.$("trkPickSelect"), button = core.$("trkPickAdd");
  if (!select || !button) return;
  const hint = core.$("trkPickHint"), status = core.$("trkPickStatus");
  if (hint) hint.textContent = tr("trkPickHint");
  const label = core.$("trkPickLabel");
  if (label) label.textContent = tr("trkPickLabel");
  button.textContent = tr("trkPickAdd");
  if (status && !status.dataset.keep) status.textContent = "";
  const previous = select.value, entries = trkPickEntries();
  select.replaceChildren();
  let group = null, groupName = "";
  for (const [i, entry] of entries.entries()) {
    if (entry.group !== groupName) { groupName = entry.group; group = el("optgroup"); group.label = groupName; select.append(group); }
    const taken = trkPickHas(entry);
    const option = el("option", "", entry.name + (taken ? " — " + tr("trkPickAdded") : ""));
    option.value = String(i); option.disabled = taken; group.append(option);
  }
  if (previous && select.querySelector('option[value="' + previous + '"]:not(:disabled)')) select.value = previous;
  /* 先頭が「追加済み」で選べないときは、選べる最初のものへ寄せる（押せないボタンで止まらない） */
  if (select.selectedIndex < 0 || select.options[select.selectedIndex].disabled) {
    const first = Array.prototype.findIndex.call(select.options, o => !o.disabled);
    if (first >= 0) select.selectedIndex = first;
  }
  button.disabled = select.selectedIndex < 0 || select.options[select.selectedIndex].disabled;
}
function trkPickSay(key) {
  const status = core.$("trkPickStatus");
  if (!status) return;
  status.textContent = tr(key);
  status.dataset.keep = "1";
  setTimeout(() => { delete status.dataset.keep; }, 1200);
}
const trkPickSelect = core.$("trkPickSelect"), trkPickAddBtn = core.$("trkPickAdd");
if (trkPickSelect && trkPickAddBtn) {
  trkPickSelect.addEventListener("change", () => {
    trkPickAddBtn.disabled = trkPickSelect.selectedIndex < 0 || trkPickSelect.options[trkPickSelect.selectedIndex].disabled;
  });
  trkPickAddBtn.addEventListener("click", () => {
    const entry = trkPickEntries()[Number(trkPickSelect.value)];
    const ok = trkPickAdd(entry);
    trkPickSay(ok ? "trkPickOk" : "trkPickFail");
    if (ok) { core.saveUserPrefs(); syncTrkUI(); renderLib(); }
    trkPickRender();
  });
  if (typeof on === "function") on("language", trkPickRender);
  const panel = core.$("trkPanel");
  if (panel) panel.addEventListener("toggle", () => { if (panel.open) trkPickRender(); });
  trkPickRender();
}


/* ---------- ボタンの配線（📁 開く と 📤 共有 はならべて残します） ---------- */
const libOpenBtn = core.$("libOpenBtn"); if (libOpenBtn) libOpenBtn.addEventListener("click", openFolder);
const libShareBtn = core.$("libShareBtn"); if (libShareBtn) libShareBtn.addEventListener("click", shareMusicFolder);
const libShareSettingsBtn = core.$("libShareSettingsBtn"); if (libShareSettingsBtn) libShareSettingsBtn.addEventListener("click", shareMusicFolder);
/* 🎬 trk208：動画フォルダーも同じやり方で共有できる（startIn:"videos"） */
const libShareVideoBtn = core.$("libShareVideoBtn"); if (libShareVideoBtn) libShareVideoBtn.addEventListener("click", () => addSharedFolder("video"));
/* 📤 一覧の × は1本だけ外す（登録簿から消す。押した拍子に自動の許可確認を出さないよう、タップは止める） */
const libSharedFolderList = core.$("libSharedFolderList");
if (libSharedFolderList) libSharedFolderList.addEventListener("click", e => {
  const off = e.target && typeof e.target.closest === "function" ? e.target.closest(".libSharedFolderOff") : null;
  if (!off) return;
  e.preventDefault(); e.stopPropagation();
  const id = off.dataset.folderId || "";
  if (id) void removeSharedFolder(id);
});
const libShareStopBtn = core.$("libShareStopBtn"); if (libShareStopBtn) libShareStopBtn.addEventListener("click", stopSharing);
/* 🔓 trk194：起動したら自動で読み取る（オフにすると今までどおり手動の再接続だけ） */
const folderAutoReadChk = core.$("folderAutoReadChk");
if (folderAutoReadChk) folderAutoReadChk.addEventListener("change", async () => {
  core.settings.folderAutoRead = !!folderAutoReadChk.checked;
  core.saveUserPrefs();
  if (core.settings.folderAutoRead && libHandle) await restoreFolderAccess();
  else { disarmFolderAutoRead(); syncShareUI(); }
});
/* 「いま読み取る」ボタン：確認が必要なときに、タップの中で許可を求める（自動の待ち合わせと同じ道） */
const folderAutoNowBtn = core.$("folderAutoNowBtn");
if (folderAutoNowBtn) folderAutoNowBtn.addEventListener("click", () => { void folderAutoKick(); });
const trkMusicFolderBtn = core.$("trkMusicFolderBtn");
if (trkMusicFolderBtn) trkMusicFolderBtn.addEventListener("click", openFolder);   /* 📁 自分で作った Music/trk を読み取り専用で選ぶ */
const trkChk = core.$("trkPlaylistChk");
if (trkChk) trkChk.addEventListener("change", function(){
  /* 🐔 trk217：ここは「タブを出すか」だけ。リストは ⚙ のリスト選択から追加する */
  core.settings.trkPlaylist = !!trkChk.checked; core.saveUserPrefs();
  syncTrkUI(); renderLib();
  core.setStatus("trkStatus", core.settings.trkPlaylist ? "trkShow" : "trkHide");
});
const trkAbcChk = core.$("trkSortAbcChk");
if (trkAbcChk) trkAbcChk.addEventListener("change", function(){
  core.settings.trkSortABC = !!trkAbcChk.checked; core.saveUserPrefs();
  syncTrkUI(); renderLib();
});
/* 🐔 タブの表示名（3種類）。名前と色そのものは固定なので、選べるのは表示だけ */
const trkNameSel = core.$("trkTabNameSel");
if (trkNameSel) trkNameSel.addEventListener("change", function(){
  core.settings.trkTabName = TRK_TAB_NAME_MODES.includes(trkNameSel.value) ? trkNameSel.value : "full";
  core.saveUserPrefs(); syncTrkUI(); renderLib();
});
const trkOpenBtn = core.$("trkOpenBtn");
if (trkOpenBtn) trkOpenBtn.addEventListener("click", function(){
  trkUnmarkRemoved(TRK_PLAYLIST_ID);   /* 自分で開く＝消した印は外す */
  const created = ensureTrkPlaylist({ toast: true });
  core.settings.libTab = "pl:" + TRK_PLAYLIST_ID; core.saveUserPrefs(); renderLib();
  if (!created) plToast(tr("trkDup"));
});
const trkHideBtn = core.$("trkHideBtn");
if (trkHideBtn) trkHideBtn.addEventListener("click", function(){
  core.settings.trkPlaylist = false; core.saveUserPrefs(); syncTrkUI(); renderLib(); plToast(tr("trkHide"));
});
const trkClassicChk = core.$("trkClassicChk");
if (trkClassicChk) trkClassicChk.addEventListener("change", function(){
  /* 🎻 trk217：ここも表示だけ（リストは ⚙ のリスト選択から） */
  core.settings.trkClassic = !!trkClassicChk.checked; core.saveUserPrefs();
  syncTrkUI(); renderLib();
  core.setStatus("trkClassicStatus", core.settings.trkClassic ? "trkClassicShow" : "trkClassicHide");
});
const trkClassicOpenBtn = core.$("trkClassicOpenBtn");
if (trkClassicOpenBtn) trkClassicOpenBtn.addEventListener("click", function(){
  trkUnmarkRemoved(TRK_CLASSIC_ID);   /* 自分で開く＝消した印は外す */
  const created = ensureTrkClassicPlaylist({ toast: true });
  core.settings.libTab = "pl:" + TRK_CLASSIC_ID; core.saveUserPrefs(); renderLib();
  if (!created) plToast(tr("trkClassicDup"));
});
const trkClassicHideBtn = core.$("trkClassicHideBtn");
if (trkClassicHideBtn) trkClassicHideBtn.addEventListener("click", function(){
  core.settings.trkClassic = false; core.saveUserPrefs(); syncTrkUI(); renderLib(); plToast(tr("trkClassicHide"));
});
const trkRestoreBtn = core.$("trkRestoreBtn");
if (trkRestoreBtn) trkRestoreBtn.addEventListener("click", function(){
  const n = trkRestoreRemoved();
  syncTrkUI(); renderLib(); plToast(tr("trkRestored", { n }));
});
if (typeof on === "function") on("language", syncTrkUI);
const libKeepChk = core.$("libKeepSharedChk");
if (libKeepChk) libKeepChk.addEventListener("change", async () => {
  core.settings.libKeepShared = !!libKeepChk.checked; core.saveUserPrefs();
  if (core.settings.libKeepShared) {
    if (lastScan.length) await keepSharedSongs(lastScan);
    else core.setStatus("libShareStatus", "libKeepSharedNone");            /* まだ共有していない */
  } else {
    await clearSharedSongs(); renderLib();
    core.setStatus("libShareStatus", "libKeepSharedCleared");
  }
  syncShareUI();
});
const mediaKeepLimitSelect = core.$("mediaKeepLimit");
if (mediaKeepLimitSelect) mediaKeepLimitSelect.addEventListener("change", () => {
  const prev = core.settings.mediaKeepLimit === "5g" || core.settings.mediaKeepLimit === "unlimited" ? core.settings.mediaKeepLimit : "1g";
  const next = ["1g", "5g", "unlimited"].includes(mediaKeepLimitSelect.value) ? mediaKeepLimitSelect.value : "1g";
  if (next === "unlimited" && prev !== "unlimited" && !mediaKeepConfirm("mediaKeepUnlimitedConfirm")) {
    mediaKeepLimitSelect.value = prev; return;
  }
  core.settings.mediaKeepLimit = next; core.saveUserPrefs();
  void renderMediaKeep();
});
const mediaKeepClearBtn = core.$("mediaKeepClearBtn");
if (mediaKeepClearBtn) mediaKeepClearBtn.addEventListener("click", () => { void clearSavedMedia(); });
const mediaKeepReviewBtn = core.$("mediaKeepReviewBtn");
if (mediaKeepReviewBtn) mediaKeepReviewBtn.addEventListener("click", () => {
  if (!savedSongs.length) return;
  core.settings.libTab = "kept"; core.saveUserPrefs(); core.closeSettings(); renderLib();
});
const mediaKeepCurrentBtn = core.$("mediaKeepCurrentBtn");
if (mediaKeepCurrentBtn) mediaKeepCurrentBtn.addEventListener("click", () => {
  const it = core.currentSong;
  if (it && it.source === "file" && it.sessionOnly) void keepAddedMedia(it);
});
on("songSelected", syncMediaKeepCurrentButton);
core.$("libRescanBtn").addEventListener("click", () => {
  if (sharedFolders.length) void readSharedFolders();
  else if (libHandle) useHandle(libHandle, false, libShared);
  else { dirInputMode = libShared ? "share" : "open"; core.$("libDirInput").click(); }
});
core.$("libDirInput").addEventListener("change", e => {
  const list = Array.from(e.target.files || []).map(f => ({ file:f, rel:f.webkitRelativePath || f.name }));
  e.target.value = "";
  if (!list.length) return;
  const shared = dirInputMode === "share"; dirInputMode = "open";
  const skipped = list.filter(({ file }) => !MEDIA_EXT.includes(core.extOf(file.name)) && !file.name.toLowerCase().endsWith(CHART_SUFFIX)).length;
  libShared = shared; libHandle = null; lastScan = list; core.$("libRescanBtn").hidden = false;
  ingestFolder(list, list[0].rel.split("/")[0] || "", shared, skipped);
  if (shared && core.settings.libKeepShared) keepSharedSongs(list);
  syncShareUI();
});
core.$("libReconnectBtn").addEventListener("click", async () => {
  disarmFolderAutoRead();   /* trk194：ボタンから読むときも、自動の待ち合わせと重ねない */
  /* 📤 trk208：登録簿があるときは、許可を確かめてから全部読む。
     trk210：**1タップ＝1本**にした。Chrome は1回の操作で requestPermission を何本も出すと
     2本目以降が NotAllowedError（ユーザー操作が必要）になることがあるため、自動の流れ
     （folderAutoKickShared）と同じく、まだ許可が要る先頭の1本だけを聞く。 */
  if (sharedFolders.length) {
    try {
      const need = await foldersNeedingPermission();
      const target = need.find(n => n.permission !== "denied");
      if (target) {
        const answer = await target.folder.handle.requestPermission({ mode:"read" }).catch(() => "denied");
        if (answer !== "granted") {
          /* trk211：断られた1本ではなく、次に聞く1本（残りの先頭）を文面に出す */
          const rest = await foldersNeedingPermission();
          sharedPendingName = sharedPendingNameFrom(rest);
          core.$("libReconnectBtn").hidden = false; showReconnect(); syncShareUI();
          core.setStatus("libStatus", "libShareDenied");
          /* まだ聞ける1本が残っていれば、次のタップでもう1本（拒否した1本は手動まで待つ） */
          if (rest.some(n => n.permission === "prompt")) armFolderAutoRead();
          return;
        }
        markFolderAccess(false);
      }
      await readSharedFolders();
      const rest = await foldersNeedingPermission();
      sharedPendingName = sharedPendingNameFrom(rest);   /* trk211 */
      if (rest.some(n => n.permission === "prompt")) armFolderAutoRead();
      syncShareUI();
    } catch (e) { console.error(e); core.setStatus("libStatus", "libShareDenied"); }
    return;
  }
  if (!libHandle) return;
  try {
    let p = await libHandle.queryPermission({ mode:"read" });
    if (p !== "granted") p = await libHandle.requestPermission({ mode:"read" });
    if (p !== "granted") { core.setStatus("libStatus", libShared ? "libShareDenied" : "libDenied"); return; }
    await useHandle(libHandle, false, libShared);
  } catch (e) { console.error(e); core.setStatus("libStatus", libShared ? "libShareDenied" : "libDenied"); }
});

/* ---------- 検索・並べ替え・ランダム ---------- */
let libSearchTimer = 0;
core.$("libSearch").addEventListener("input", () => { clearTimeout(libSearchTimer); libSearchTimer = setTimeout(renderLib, 150); });
core.$("libSort").addEventListener("change", e => { core.settings.libSort = e.target.value; core.saveUserPrefs(); renderLib(); });
core.$("libProgress").addEventListener("change", e => { core.settings.libProgress = e.target.value; core.saveUserPrefs(); renderLib(); });   /* 📈 進捗フィルター（trk174） */
core.$("libRandomBtn").addEventListener("click", () => {
  /* 🎲 おまかせ：いまの一覧 ＋ 📌ピンの曲（ほかのタブにいても、必ず候補に入る）
     ＝ 曲名バナーの🎲（長押し／タップ）と同じ抽選を使う */
  const it = randomSongPick();
  if (it) selectSong(it);
});

on("records", renderLib);
on("chart", updateSpBuilder);
let lastUseStudyArtwork = core.settings.useStudyArtwork === true;
// 書斎カバーの割り当て／使用設定が変わったら、選択中の曲の背景を優先順で読み直す。
on("studyCoverChanged", key => {
  const song = core.currentSong;
  if (!song || key !== song.key) return;
  applySongBackground(song).then(ok => { if (ok && core.currentSong === song) core.emit("songArtwork", song); }).catch(() => {});
});
on("options", () => {
  const enabled = core.settings.useStudyArtwork === true;
  if (enabled === lastUseStudyArtwork) return;
  lastUseStudyArtwork = enabled;
  const song = core.currentSong;
  if (song) applySongBackground(song).then(ok => { if (ok && core.currentSong === song) core.emit("songArtwork", song); }).catch(() => {});
});
on("language", () => { core.$("libSearch").placeholder = tr("libSearch"); showReconnect(); syncShareUI();   /* syncShareUI が trk194 の文言も更新 */ syncTrkUI(); syncGhostUI(); renderLib(); renderBanner(); syncVideoButton(); syncMediaKeepCurrentButton(); void renderMediaKeep();
  const hint = core.$("mediaStartFromZeroHint"); if (hint) hint.textContent = tr("mediaStartFromZeroHint");
  if (!bannerStartPanel.hidden) { startBarLabels(); startBarSyncText(); }   /* 開いているバーの文言も今の言語へ（trk193） */
});
/* 🎬 「動画を読み込む」の説明（通常より時間がかかります）をボタンに付ける */
function syncVideoButton() { const label = core.$("libVideoLabel"); if (label) label.title = tr("libAddVideoHint"); }

/* ---------- 起動時（main.js から呼びます） ---------- */
async function initLibrary() {
  core.$("libSort").value = core.settings.libSort;
  core.$("libProgress").value = core.settings.libProgress || "all";   /* 📈 進捗フィルター（trk174） */
  core.$("previewEnabled").checked = core.settings.previewEnabled;
  syncStartZeroInputs();   /* ⏮ 常に最初から再生（trk193）の3か所を今の値にそろえる */
  core.$("libSearch").placeholder = tr("libSearch");
  syncVideoButton();
  renderBanner(); renderSeedTools();
  try { await reloadSavedMedia(); }
  catch (error) { console.warn("Could not read the saved media shelf", error); }
  mediaKeepOverCapNoticeOnce();
  await renderMediaKeep();
  await refreshPackSongs();
  if (canPickDir) {
    try {
      /* 📤 trk208：まず登録簿（音楽・動画・何本でも）を読む。空なら 📁 開く で覚えたフォルダー1本。 */
      await loadSharedFolders();
      if (sharedFolders.length) {
        libHandle = sharedFolders[0].handle; libShared = true; shareRemembered = true;
        core.$("libReconnectBtn").hidden = false; showReconnect();
        await restoreFolderAccess();
      } else {
        /* 📤 共有の許可があれば優先（無ければ 📁 開く で覚えたフォルダ） */
        const hs = await libKV.get("share"), hd = hs ? null : await libKV.get("dir");
        const h = hs || hd;
        if (h && h.kind === "directory") {
          libHandle = h; libShared = !!hs; shareRemembered = !!hs;
          core.$("libReconnectBtn").hidden = false; showReconnect();
          /* 🔓 trk194：許可が生きていれば、ここで自動的に読み取る（クリック不要）。
             確認が必要なら、最初のタップで1回だけ確認する待ち合わせに入る。 */
          await restoreFolderAccess();
        }
      }
    } catch (_) {}
  } else core.setStatus("libStatus", "libFallbackNote");
  /* 💾 端末に残した共有の曲（?safe=1 では読み戻しません） */
  if (core.settings.libKeepShared && !(window.TrkSafeMode && TrkSafeMode())) {
    await loadSharedSongs();
    if (sharedSongs.length) core.setStatus("libStatus", "libKeepSharedRestored", { n:sharedSongs.length });
  }
  syncShareUI();
  // 📄ゴースト（参照のみ）を復元 — 本体が無くても“あったこと”を表示
  try{ await loadGhostSongs(); }catch(_){}
  /* 🗂 trk201：以前の版が保存した「フォルダー曲の参照」を一度だけ掃除する（起動が軽くなる） */
  try{ await pruneFolderRefsOnce(); }catch(_){}
  try{ setupGhostPanel(); syncGhostUI(); }catch(_){}
  // 🐔 trk's playlist — チュートリアル済みなら初回だけ自動で1タブ追加（設定で非表示なら作らない・トーストなし）
  if (TRK_AUTO_GAME_CLASSIC && core.settings.tutorialDone && core.settings.trkPlaylist !== false) {
    try { ensureTrkPlaylist({ toast: false }); } catch(_){}
  }
  // 🎻 trk classic — 同上。ゲームとは別枠で100曲。設定で非表示なら作らない
  if (TRK_AUTO_GAME_CLASSIC && core.settings.tutorialDone && core.settings.trkClassic !== false) {
    try { ensureTrkClassicPlaylist({ toast: false }); } catch(_){}
  }
  trkOstLegacyCleanOnce();   /* 🎓 分離前の旧OST参照を一度だけ掃除（trk189・未チュートリアルでも移行する） */
  // 🎓 trk's OST Vol.1 — あるときだけ曲目を最新に保つ。無ければ ⚙ のリスト選択から追加する（trk217）
  if (core.settings.tutorialDone && core.settings.playlists.some(p => p.id === TRK_OST_ID)) {
    try { ensureTrkOstPlaylist({ toast: false }); } catch(_){}
  }
  // 🐔 trk217：起動時は「作らない」。既にあるリストの曲目・ガイド・旧データだけ最新に保つ
  if (core.settings.tutorialDone) {
    try { ensureTrkDistributionPlaylists({ create: false }); } catch(_){}
  }
  try { trkGuideBackfill(); } catch(_){}
  try { repairDefaultTrkGuideLinks(); } catch(_){}
  /* 旧「🎓デモ曲」タブ（builtin）を見ていた設定を、新しいOSTプレイリストへ移行 */
  if (core.settings.libTab === "builtin") core.settings.libTab = plById(TRK_OST_ID) ? "pl:" + TRK_OST_ID : "all";
  syncTrkUI();
  renderLib();
  /* 📢 trk218：trk のリストが「曲画面の一覧に出ない」既定へ変わったことを、一度だけ伝える */
  try { trkFixedNoticeOnce(); } catch(_){}
  void initOptionalTutorialDemo();
  void initTrkOstSongs();
  void initAgentOstTracks();
}
/* ✅ library.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.LIB_SHOW = LIB_SHOW;
window.addSongFiles = addSongFiles;
window.addVideoFiles = addVideoFiles;
Object.defineProperty(window, "addonSongs", { configurable:true, get:() => addonSongs, set:v => { addonSongs = v; } });
window.allSongs = allSongs;
window.bannerRandomBtn = bannerRandomBtn;
window.bannerVolTip = bannerVolTip;
window.ensureTrkDistributionPlaylists = ensureTrkDistributionPlaylists;
window.initLibrary = initLibrary;
Object.defineProperty(window, "libView", { configurable:true, get:() => libView, set:v => { libView = v; } });
window.nextSong = nextSong;
window.onLongPress = onLongPress;
window.plToast = plToast;
window.prevSong = prevSong;
window.previewStartFor = previewStartFor;
window.refreshPackSongs = refreshPackSongs;
/* 後から読み込まれるファイルがこの名前を差し替える（window.renderBanner の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "renderBanner", { configurable:true, get:() => renderBanner, set:v => { renderBanner = v; } });
/* 後から読み込まれるファイルがこの名前を差し替える（window.renderLib の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "renderLib", { configurable:true, get:() => renderLib, set:v => { renderLib = v; } });
window.saveSongPrefs = saveSongPrefs;
window.selectSong = selectSong;
window.setAddonSongs = setAddonSongs;
window.songInfo = songInfo;
window.songDisplayTitle = songDisplayTitle;   /* 🏷 表示名（ユーザー設定名→タグ→カタログ曲名→ファイル名）。favs.js・game.js・study-room.js・video-max.js の typeof ガードが実際に届くようになる（trk167） */
window.srcLabel = srcLabel;
window.startPreview = startPreview;
window.trySongChart = trySongChart;
/* 領域（window.Trk.library）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
/* trk191: フェーズ変わり・媒体の準備完了でも「いまの曲」を知らせる（中身は都度 nowPlaying() で読む） */
core.on("phase", () => core.emit("nowPlaying", nowPlaying()));
core.on("mediaReady", () => core.emit("nowPlaying", nowPlaying()));

window.Trk.library = Object.assign(window.Trk.library || {}, { LIB_SHOW, MEDIA_EXT, VIDEO_EXT, addSongFiles, addVideoFiles, allSongs, bannerRandomBtn, bannerVolTip, ensureTrkDistributionPlaylists, ensureTrkOstPlaylist, trkOstPlaylistId: TRK_OST_ID, trkRestoreRemoved, initLibrary, nextSong, noteMediaPlayed, onLongPress, setStartFromZero, syncStartZeroInputs, startBarOpen, syncPreviewSetBtn, restoreFolderAccess, folderReadPlan, plToast, prevSong, previewStartFor, previewContinue, pruneFolderRefsOnce, refreshPackSongs, saveSongPrefs, selectSong, setAddonSongs, songInfo, songDisplayTitle, songDisplayMeta, songTagsOf, loadSongTags, srcLabel, nowPlaying, startPreview, trySongChart, plTitleKeys, plSongMatchKeys, plWishTitleKeys, plIsClassicalTitle, plClassicalTitleKey, plDecoratedTitleKeys, plWishDecoratedKeys, plHasVersionTag, plWishMediaMatches });
Object.defineProperty(window.Trk.library, "addonSongs", { configurable:true, get:() => addonSongs, set:v => { addonSongs = v; } });
Object.defineProperty(window.Trk.library, "libView", { configurable:true, get:() => libView, set:v => { libView = v; } });
Object.defineProperty(window.Trk.library, "renderBanner", { configurable:true, get:() => renderBanner, set:v => { renderBanner = v; } });
Object.defineProperty(window.Trk.library, "renderLib", { configurable:true, get:() => renderLib, set:v => { renderLib = v; } });
})();
