(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：読み込み・音声解析・譜面・ヒットSE ============ */
"use strict";

/* ---------- Web Audio ---------- */
let audioCtx = null;
function getAC() {
  if (!audioCtx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; audioCtx = new C(); }
  return audioCtx;
}
function decodeAudio(buf) {
  const ac = getAC(); if (!ac) return Promise.reject(new Error("no audio"));
  return new Promise((res, rej) => {
    try { const p = ac.decodeAudioData(buf, res, rej); if (p && typeof p.then === "function") p.then(res, rej); } catch (e) { rej(e); }
  });
}

/* ---------- 背景画像（曲パック用。音声だけの曲で表示） ---------- */
async function setBackground(blob) {
  if (core.bgImage && core.bgImage._url) URL.revokeObjectURL(core.bgImage._url);
  core.bgImage = null;
  if (!blob) return null;
  const url = URL.createObjectURL(blob), im = new Image();
  const ok = await new Promise(res => { im.onload = () => res(true); im.onerror = () => res(false); im.src = url; });
  if (!ok) { URL.revokeObjectURL(url); return null; }
  im._url = url; core.bgImage = im;
  return im;
}

/* 🎬 これより大きいファイルは音声解析（file.arrayBuffer で丸ごとメモリに載せる）をしません。
   解析が無くても譜面はBPMから作れます（analysis を使う所は全部 if (analysis) で守ってあります）。 */
const ANALYZE_MAX = 96 * 1024 * 1024;
/* 🎬 ファイルサイズ（圧縮後）だけでは判断できない：デコード後のPCMは長さに比例して膨らむ
   （48kHz・ステレオ・float32 で 1分 ≒ 23MB、20分 ≒ 460MB）。長さでも区切る。
   decodeAudioData が返す量（コンテキストのサンプリングレートへ再サンプルした後の長さ）は減るが、
   デコード中のピークメモリは実装しだいで減らないことが多い。OfflineAudioContext で
   ダウンサンプルしても瞬間の最大メモリは減らない見込み（時間上限で切る判断はこのため）。 */
const ANALYZE_MAX_SEC = 20 * 60;
/* 🪶 軽量化が有効な端末では、PCM のピークを抑えるため解析を10分までにする */
const ANALYZE_LITE_MAX_SEC = 10 * 60;

/* ---------- 🎞 コンテナとコーデックの下調べ（trk195） ----------
   .mkv（Matroska）や .mpg（MPEG-PS）は、ブラウザーが「中身のコーデック次第」で再生できたりできなかったりする。
   読み込めなかったときに理由を言えるよう、先頭だけを見てコンテナとコーデックを取り出す。
   読むのは先頭の PROBE_BYTES バイトだけで、元ファイルは書き換えない・外部へも送らない。 */
const PROBE_BYTES = 2 * 1024 * 1024;
/* 拡張子から MIME の見当をつける（ブラウザーが type を空で渡してきたときの補助） */
const MIME_BY_EXT = {
  mp4:"video/mp4", m4v:"video/mp4", mov:"video/quicktime", webm:"video/webm", mkv:"video/x-matroska",
  mpg:"video/mpeg", mpeg:"video/mpeg", mpe:"video/mpeg", m2v:"video/mpeg", m2ts:"video/mp2t", ts:"video/mp2t",
  avi:"video/x-msvideo", ogv:"video/ogg", "3gp":"video/3gpp",
  m4a:"audio/mp4", m4b:"audio/mp4", mp3:"audio/mpeg", flac:"audio/flac", ogg:"audio/ogg", oga:"audio/ogg",
  opus:"audio/ogg", wav:"audio/wav", aac:"audio/aac", mid:"audio/midi", midi:"audio/midi",
};
function mimeHintFor(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  return MIME_BY_EXT[ext] || "";
}
/* type が空のときだけ、拡張子から MIME を付けた File を作る（中身はコピーしない） */
function withMimeHint(file) {
  if (!file || file.type) return file;
  const type = mimeHintFor(file.name);
  if (!type) return file;
  try { return new File([file], file.name, { type, lastModified: Number(file.lastModified) || Date.now() }); } catch (_) { return file; }
}
/* 表示用の名前。知らない ID はそのまま出す（推測で「対応」と言わない） */
const CONTAINER_LABEL = { matroska:"MKV（Matroska）", webm:"WebM", "mpeg-ps":"MPEG-PS（.mpg）", "mpeg-ts":"MPEG-TS", mp4:"MP4", ogg:"Ogg", unknown:"" };
const CODEC_LABEL = {
  "V_MPEG4/ISO/AVC":"H.264", "V_MPEGH/ISO/HEVC":"HEVC（H.265）", "V_VP8":"VP8", "V_VP9":"VP9", "V_AV1":"AV1",
  "V_THEORA":"Theora", "V_MPEG1":"MPEG-1 映像", "V_MPEG2":"MPEG-2 映像", "V_MPEG4/ISO/ASP":"MPEG-4（DivX 系）映像",
  "V_MS/VFW/FOURCC":"AVI 由来の映像（Xvid など）", "V_QUICKTIME":"QuickTime 映像", "V_PRORES":"ProRes",
  "A_AAC":"AAC", "A_AAC/MPEG4/LC":"AAC", "A_AAC/MPEG4/LC/SBR":"AAC", "A_OPUS":"Opus", "A_VORBIS":"Vorbis",
  "A_MPEG/L3":"MP3", "A_MPEG/L2":"MP2", "A_MPEG/L1":"MP1", "A_FLAC":"FLAC", "A_PCM/INT/LIT":"PCM",
  "A_AC3":"AC3", "A_EAC3":"E-AC3", "A_DTS":"DTS", "A_TRUEHD":"TrueHD", "A_MLP":"MLP",
};
/* ブラウザー（Chromium 系）がそのまま再生できる見込みのコーデック。ここに無いものは「非対応の見込み」 */
const CODEC_OK = new Set([
  "V_MPEG4/ISO/AVC", "V_VP8", "V_VP9", "V_AV1", "V_THEORA",
  "A_AAC", "A_AAC/MPEG4/LC", "A_AAC/MPEG4/LC/SBR", "A_OPUS", "A_VORBIS", "A_MPEG/L3", "A_FLAC", "A_PCM/INT/LIT",
]);
function codecLabel(id) { return CODEC_LABEL[id] || id; }
/* 🎞 trk200：音として鳴らせる見込みのコーデック（CODEC_OK のうち音声のもの）。
   AC3・E-AC3・DTS・TrueHD・MLP は「映像は出るが無音」になる代表。 */
const AUDIO_CODEC_OK = new Set(["A_AAC", "A_AAC/MPEG4/LC", "A_AAC/MPEG4/LC/SBR", "A_OPUS", "A_VORBIS", "A_MPEG/L3", "A_FLAC", "A_PCM/INT/LIT"]);
const isAudioCodecId = id => /^A_/i.test(String(id || ""));
/* 読み込めて再生もできるのに音だけ出ない、と分かったときの理由（分からなければ null＝何も言わない） */
function explainAudioWarning(probe) {
  if (!probe) return null;
  const audio = (probe.audioCodecs && probe.audioCodecs.length ? probe.audioCodecs
    : (probe.codecs || []).filter(isAudioCodecId));
  if (!audio.length) return null;                      /* 音声トラックが読めない＝判断しない */
  if (audio.some(id => AUDIO_CODEC_OK.has(id))) return null;
  const container = CONTAINER_LABEL[probe.container] || "";
  return { key:"loadAudioUnsupported", vars:{ container, codec: audio.map(codecLabel).join("・") } };
}
/* 先頭だけを見て、音が出ない見込みの理由を返す（読み込みに成功したあとに使う） */
async function explainAudioFailure(file) {
  try {
    const head = new Uint8Array(await file.slice(0, PROBE_BYTES).arrayBuffer());
    return explainAudioWarning(probeContainer(head));
  } catch (_) { return null; }
}
/* ---- EBML（Matroska/WebM）の最小の読み取り：ID は印を含む vint、サイズは印を外す vint ---- */
function ebmlVint(u8, pos, keepMarker) {
  if (pos < 0 || pos >= u8.length) return null;
  const first = u8[pos];
  if (!first) return null;
  let len = 1, mask = 0x80;
  while (!(first & mask)) { len++; mask >>= 1; if (len > 8) return null; }
  if (pos + len > u8.length) return null;
  let value = keepMarker ? first : (first & (mask - 1));
  for (let i = 1; i < len; i++) value = value * 256 + u8[pos + i];
  return { len, value };
}
function ebmlAscii(u8, start, end) {
  let out = "";
  for (let i = start; i < end && out.length < 64; i++) { const c = u8[i]; if (!c) break; out += String.fromCharCode(c); }
  return out;
}
function ebmlUint(u8, start, end) {
  let v = 0;
  for (let i = start; i < Math.min(end, start + 8); i++) v = v * 256 + u8[i];
  return v;
}
/* Matroska の Tracks（0x1654AE6B）→ TrackEntry（0xAE）→ CodecID（0x86）を拾う。
   🎞 trk200：TrackType（0x83・1=映像 2=音声）も見て、**音声だけ**を取り出せるようにする
   （映像は出るのに音が出ない .mkv を、読み込めたときにも言い当てるため） */
function probeMatroska(u8) {
  const out = { container:"matroska", docType:"", codecs:[], audioCodecs:[], videoCodecs:[] };
  const isUnknownSize = size => {
    /* サイズの全ビットが 1 ＝ 長さ未定（Segment などで使われる） */
    if (!size) return false;
    const len = size.len, bytes = [];
    let v = size.value;
    for (let i = 0; i < len; i++) { bytes.unshift(v & 0xff); v = Math.floor(v / 256); }
    const firstMask = 0x80 >> (len - 1);
    return (bytes[0] & (firstMask - 1)) === (firstMask - 1) && bytes.slice(1).every(b => b === 0xff);
  };
  const readEntry = (start, end) => {
    let pos = start, codec = "", type = 0, guard = 0;
    while (pos < end && guard++ < 64) {
      const id = ebmlVint(u8, pos, true); if (!id) break;
      const size = ebmlVint(u8, pos + id.len, false); if (!size) break;
      const dStart = pos + id.len + size.len;
      const dEnd = Math.min(dStart + size.value, end);
      if (id.value === 0x86) codec = ebmlAscii(u8, dStart, dEnd);
      else if (id.value === 0x83) type = ebmlUint(u8, dStart, dEnd);
      pos = Math.max(dEnd, pos + id.len + size.len);
    }
    return codec ? { codec, type } : null;
  };
  const walk = (start, stop, depth) => {
    if (depth > 5) return;
    let pos = start, guard = 0;
    while (pos < stop && guard++ < 256) {
      const id = ebmlVint(u8, pos, true); if (!id) return;
      const size = ebmlVint(u8, pos + id.len, false); if (!size) return;
      const dStart = pos + id.len + size.len;
      const unknown = isUnknownSize(size);
      const dEnd = unknown ? stop : Math.min(dStart + size.value, stop);
      if (id.value === 0x4282) out.docType = ebmlAscii(u8, dStart, dEnd);
      else if (id.value === 0x1A45DFA3 || id.value === 0x18538067 || id.value === 0x1654AE6B) walk(dStart, dEnd, depth + 1);
      else if (id.value === 0xAE) {
        const t = readEntry(dStart, dEnd);
        if (t) {
          out.codecs.push(t.codec);
          if (t.type === 2) out.audioCodecs.push(t.codec);
          else if (t.type === 1) out.videoCodecs.push(t.codec);
        }
      }
      pos = Math.max(dEnd, pos + id.len + size.len);
    }
  };
  walk(0, u8.length, 0);
  if (out.docType === "webm") out.container = "webm";
  return out;
}
/* MPEG-PS（.mpg）／MPEG-TS の見分け。コーデックまでは踏み込まず、形式の名前を返す */
function probeMpeg(u8) {
  let ps = false, video = false, audio = false, seq = false;
  for (let i = 0; i + 3 < u8.length; i++) {
    if (u8[i] || u8[i + 1] || u8[i + 2] !== 1) continue;
    const c = u8[i + 3];
    if (c === 0xba) ps = true;
    else if (c >= 0xe0 && c <= 0xef) video = true;
    else if (c >= 0xc0 && c <= 0xdf) audio = true;
    else if (c === 0xbd) audio = true;          /* private_stream_1（AC3/DTS など） */
    else if (c === 0xb3) seq = true;            /* MPEG-1/2 のシーケンスヘッダー */
    if (ps && (video || seq)) break;
  }
  if (ps) return { container:"mpeg-ps", docType:"", codecs:[], note:{ video:video || seq, audio } };
  /* TS：188 バイトごとに 0x47 が並ぶ */
  for (const step of [188, 192]) {
    let ok = 0;
    for (let i = 0; i < Math.min(u8.length, step * 8); i += step) if (u8[i] === 0x47) ok++;
    if (ok >= 4) return { container:"mpeg-ts", docType:"", codecs:[], note:{} };
  }
  return null;
}
/* 先頭バイトからコンテナとコーデックを推定する（純関数・テストで確認） */
function probeContainer(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const unknown = { container:"unknown", docType:"", codecs:[] };
  if (u8.length < 12) return unknown;
  if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return probeMatroska(u8);
  /* MP4 は 4バイト目の "ftyp" で決まる（先に見る＝映像データ中の 00 00 01 を MPEG と取り違えない） */
  if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return { container:"mp4", docType:"", codecs:[] };
  if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) return { container:"ogg", docType:"", codecs:[] };
  const mpeg = probeMpeg(u8);
  if (mpeg) return mpeg;
  return unknown;
}
/* 読み込めなかった理由を、画面に出す言葉（i18n のキー）にする */
function explainProbe(probe, ext) {
  if (!probe) return { key:"loadError", vars:{} };
  const container = CONTAINER_LABEL[probe.container] || "";
  const bad = (probe.codecs || []).filter(id => !CODEC_OK.has(id));
  const good = (probe.codecs || []).filter(id => CODEC_OK.has(id));
  if (probe.container === "mpeg-ps") return { key:"loadMpegPsUnsupported", vars:{ container } };
  if (probe.container === "mpeg-ts") return { key:"loadMpegTsUnsupported", vars:{ container } };
  if (bad.length) return { key:"loadCodecUnsupported", vars:{ container, codec: bad.map(codecLabel).join("・") } };
  if (probe.container === "matroska" || probe.container === "webm")
    return { key:"loadContainerUnreadable", vars:{ container, codec: good.map(codecLabel).join("・") || "—" } };
  return { key:"loadError", vars:{ container, ext: String(ext || "") } };
}
async function explainLoadFailure(file) {
  try {
    const head = new Uint8Array(await file.slice(0, PROBE_BYTES).arrayBuffer());
    const ext = String((file && file.name) || "").split(".").pop().toLowerCase();
    return explainProbe(probeContainer(head), ext);
  } catch (_) { return { key:"loadError", vars:{} }; }
}

/* ---------- 曲の読み込み ----------
   opts.title   : 表示名
   opts.onReady : 解析後・譜面生成前に呼ばれる。true を返すと自動生成を省略（曲パックの譜面など） */
async function loadMedia(file, opts = {}) {
  if (!file || core.phase !== "title") return false;
  const token = ++core.loadToken;
  core.emit("beforeLoad");
  core.video.pause();
  core.videoReady = false; core.analysis = null; core.chart = []; core.chartMode = "generated"; core.fingerprint = "";
  core.setStatus("chartStatus", null); core.setStatus("importStatus", null); core.updateChartButtons();
  core.mediaLoadFailure = null;   /* 🎞 前の曲の失敗理由を持ち越さない（メディアプレーヤーが読む） */
  core.mediaLoadWarning = null;   /* 🎞 trk200：音だけ出ない見込みの理由も持ち越さない */
  if (core.mediaURL) URL.revokeObjectURL(core.mediaURL);
  core.mediaName = file.name || "song";
  core.$("songTitle").textContent = opts.title || core.baseName(core.mediaName);
  const midi = window.Trk && window.Trk.midi;
  const midiInput = !!(midi && midi.isMidiFile(file));
  /* type が空のファイル（フォルダー共有・PC のドラッグなどでよくある）は、拡張子から MIME を補って渡す。
     .mkv・.mpg はブラウザーが「中身を見ないと分からない」形式なので、これが効くことがある */
  let playbackFile = withMimeHint(file);
  core.setStatus("loadStatus", midiInput ? "midiRendering" : "loading");
  if (midiInput) {
    /* 長い・音の多いMIDIは変換に時間がかかるので、5%刻みで進み具合を出す。
       別の曲を読み込んだら（loadToken が変わったら）次の区切りで変換を止める。 */
    let shownPercent = 0;
    const onProgress = fraction => {
      if (token !== core.loadToken) return;
      const percent = Math.floor(Math.max(0, Math.min(1, Number(fraction) || 0)) * 20) * 5;
      if (percent <= shownPercent || percent >= 100) return;
      shownPercent = percent;
      core.setStatus("loadStatus", "midiRenderingProgress", { p:percent });
    };
    try {
      playbackFile = await midi.renderFile(file, { profileId:core.settings.midiSoundProfile,
        shouldAbort:() => token !== core.loadToken, onProgress });
    }
    catch (error) {
      if (token !== core.loadToken) return false;
      const status = error && error.code === "midi-too-large" ? "midiTooLarge"
        : error && error.code === "midi-too-long" ? "midiTooLong"
          : error && error.code === "midi-smpte-unsupported" ? "midiUnsupported"
            : error && error.code === "midi-unsupported-format" ? "midiFormatUnsupported"
              : error && error.code === "midi-too-dense" ? "midiTooDense"
                : error && ["midi-event-limit", "midi-track-limit"].includes(error.code) ? "midiTooComplex" : "midiError";
      core.setStatus("loadStatus", status);
      core.updateChartButtons();
      return false;
    }
  }
  if (token !== core.loadToken) return false;
  core.mediaURL = URL.createObjectURL(playbackFile);
  const ok = await new Promise(res => {
    const done = v => { core.video.removeEventListener("loadedmetadata", onOk); core.video.removeEventListener("error", onErr); res(v); };
    const onOk = () => done(true), onErr = () => done(false);
    core.video.addEventListener("loadedmetadata", onOk); core.video.addEventListener("error", onErr);
    core.video.src = core.mediaURL; core.video.load();
  });
  if (token !== core.loadToken) return false;
  if (!ok || !isFinite(core.video.duration) || core.video.duration <= 0) {
    /* なぜ読めなかったのかを、先頭だけ見て言い当てる（言えないときは今までどおりの一文） */
    const why = await explainLoadFailure(file);
    if (token !== core.loadToken) return false;
    if (why && why.key && why.key !== "loadError") core.setStatus("loadStatus", why.key, why.vars);
    else core.setStatus("loadStatus", "loadError");
    /* 🎞 理由は core にも残す：選曲画面のバナーだけでなく、メディアプレーヤーや曲追加の案内でも同じことを言う */
    core.mediaLoadFailure = { key: why && why.key ? why.key : "loadError", vars: (why && why.vars) || {},
      name: file.name || "", known: !!(why && why.key && why.key !== "loadError") };
    core.updateChartButtons(); return false;
  }
  core.videoReady = true; core.fingerprint = `${file.size}:${Math.round(core.video.duration * 10)}`;
  /* 🎞 trk200：映像は出るが音が出ない入れ物（.mkv の AC3・DTS など）は、
     再生はじまってから「無音だ」と気づくことになる。先頭を見て分かったら、その場で言う。
     （解析は無音のまま進み、譜面は BPM グリッドになる。理由が分かれば納得できる） */
  if (!midiInput) {
    const warn = await explainAudioFailure(file);
    if (token !== core.loadToken) return false;
    if (warn) core.mediaLoadWarning = { key:warn.key, vars:warn.vars, name:file.name || "" };
  }
  core.setStatus("loadStatus", "analyzing"); core.updateChartButtons();
  await new Promise(r => { setTimeout(r, 30); });
  const tooBig = (Number(playbackFile.size) || 0) > ANALYZE_MAX;
  const liteActive = typeof TrkLite === "object" && typeof TrkLite.active === "function" && TrkLite.active();
  const tooLong = core.video.duration > (liteActive ? ANALYZE_LITE_MAX_SEC : ANALYZE_MAX_SEC);
  const liteLong = liteActive && tooLong;
  /* 🪶 軽量化：解析をしない設定では、ファイル全体をデコードして走り直すところごと飛ばします
     （長い曲ほど効きます。譜面はBPMグリッド中心の自動生成になり、自作・取り込み譜面はそのまま） */
  const liteSkip = !tooBig && !tooLong && typeof TrkLite === "object" && typeof TrkLite.noAnalyze === "function" && TrkLite.noAnalyze();
  const skipAnalyze = tooBig || tooLong || liteSkip;
  if (skipAnalyze) core.analysis = null;
  else { try { core.analysis = await analyzeAudioCached(playbackFile, core.fingerprint); } catch (_) { core.analysis = null; } }
  if (token !== core.loadToken) return false;
  const warn = core.mediaLoadWarning;
  core.setStatus("loadStatus", warn ? warn.key : midiInput ? "midiLoaded" : tooBig ? "analysisSkipped" : liteLong ? "analysisSkippedLiteLong" : tooLong ? "analysisSkippedLong" : liteSkip ? "analysisSkippedLite" : core.analysis ? "loaded" : "decodeFallback",
    warn ? warn.vars : undefined);
  /* 選曲画面の状態行は次に何かをすると消えるので、その場でも一度だけ知らせる */
  if (warn && window.Trk && window.Trk.play && typeof window.Trk.play.showToast === "function") {
    try { window.Trk.play.showToast(tr(warn.key, warn.vars)); } catch (_) {}
  }
  let supplied = false;
  if (opts.onReady) { try { supplied = !!(await opts.onReady()); } catch (e) { console.error(e); } }
  if (token !== core.loadToken) return false;
  if (!supplied) buildChart();
  core.emit("mediaReady");
  return true;
}

/* ---------- 解析結果のキャッシュ（IndexedDB・この端末の中だけ） ----------
   同じ曲をもう一度読み込んだとき、デコードと解析を飛ばすためのもの。
   保存するのは解析の配列（rms・onset・ratio）と数値だけ。PCM（音声の波形）は保存しない。
   🔊 loudness・peak（trk168・音量の平準化の材料）も数値なので一緒に保存する（古い記録に無くても読める）。
   鍵は fingerprint（サイズ・長さ）＋先頭と末尾 64KB の SHA-256 ＋ 解析のバージョン。
   解析の式を変えたら ANALYSIS_CACHE_VERSION を上げる（古い結果は読まれなくなる）。
   セーフモードでは読まない・書かない。失敗しても普通に解析する（キャッシュは速さのためだけ）。 */
const ANALYSIS_CACHE_DB = "trk_analysis_cache_v1";
const ANALYSIS_CACHE_VERSION = 1;
const ANALYSIS_CACHE_MAX = 30;            // 件数の上限。超えたら古いものから消す
const ANALYSIS_CACHE_EDGE = 64 * 1024;    // 鍵に使う先頭・末尾のバイト数
let analysisCacheDb = null;
function analysisCacheOpen() {
  if (analysisCacheDb) return analysisCacheDb;
  analysisCacheDb = new Promise((res, rej) => {
    const r = indexedDB.open(ANALYSIS_CACHE_DB, 1);
    r.onupgradeneeded = () => {
      const os = r.result.createObjectStore("analysis", { keyPath: "key" });
      os.createIndex("savedAt", "savedAt");
    };
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); analysisCacheDb = null; }; res(r.result); };
    r.onerror = () => { analysisCacheDb = null; rej(r.error); };
    r.onblocked = () => { analysisCacheDb = null; rej(new Error("analysis-cache-blocked")); };
  });
  return analysisCacheDb;
}
async function analysisCacheKey(file, fingerprint) {
  const head = await file.slice(0, ANALYSIS_CACHE_EDGE).arrayBuffer();
  const tail = await file.slice(Math.max(0, file.size - ANALYSIS_CACHE_EDGE)).arrayBuffer();
  const both = new Uint8Array(head.byteLength + tail.byteLength);
  both.set(new Uint8Array(head), 0); both.set(new Uint8Array(tail), head.byteLength);
  const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", both)).slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `v${ANALYSIS_CACHE_VERSION}|${fingerprint}|${hex}`;
}
/* 読んだ記録のかたちを確かめる（端末の中の値は改ざんされうる。合わなければ無いものとして解析し直す） */
function analysisCacheValid(r) {
  return !!r && r.version === ANALYSIS_CACHE_VERSION && Number.isInteger(r.frames) && r.frames > 0 &&
    Number.isFinite(r.frameMs) && r.frameMs > 0 && Number.isFinite(r.maxRms) && Number.isFinite(r.scale) &&
    [r.rms, r.onset, r.ratio].every(a => a instanceof Float32Array && a.length === r.frames);
}
/* 読んだら savedAt を今に更新する（LRU：よく使う曲が件数の上限で先に消えないように）。
   不正な記録は触らない（解析し直したあと put で置き換わる）。 */
async function analysisCacheGet(key) {
  const db = await analysisCacheOpen();
  const tx = db.transaction("analysis", "readwrite");
  const os = tx.objectStore("analysis");
  const rec = await new Promise((res, rej) => {
    const q = os.get(key);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
  if (!analysisCacheValid(rec)) { tx.abort(); return null; }
  os.put({ ...rec, savedAt: Date.now() });
  await new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
  /* 🔊 loudness/peak（trk168）は古い記録に無いことがある（undefined）。使う側（loudnessDb）が rms から計算し直す */
  return { rms: rec.rms, onset: rec.onset, ratio: rec.ratio, frames: rec.frames, frameMs: rec.frameMs, maxRms: rec.maxRms, scale: rec.scale, loudness: rec.loudness, peak: rec.peak };
}
async function analysisCachePut(key, a) {
  const db = await analysisCacheOpen();
  const rec = { key, version: ANALYSIS_CACHE_VERSION, savedAt: Date.now(), frames: a.frames, frameMs: a.frameMs,
    maxRms: a.maxRms, scale: a.scale, rms: a.rms, onset: a.onset, ratio: a.ratio,
    loudness: a.loudness, peak: a.peak };   /* 🔊 音量の平準化（trk168）の材料も一緒に保存 */
  await new Promise((res, rej) => {
    const tx = db.transaction("analysis", "readwrite");
    tx.objectStore("analysis").put(rec);
    tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error);
  });
  /* 件数の上限：savedAt の index は古い順に並ぶので、先頭（古い）から消す（読み出しで savedAt を更新しているので LRU） */
  const tx2 = db.transaction("analysis", "readwrite");
  const keys = await new Promise((res, rej) => {
    const q = tx2.objectStore("analysis").index("savedAt").getAllKeys();
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
  for (let i = 0; i < keys.length - ANALYSIS_CACHE_MAX; i++) tx2.objectStore("analysis").delete(keys[i]);
  await new Promise((res, rej) => { tx2.oncomplete = () => res(); tx2.onerror = tx2.onabort = () => rej(tx2.error); });
}
/* 解析の入口。キャッシュがあればデコードせずに返す。無ければ解析して、あとで保存する（待たない） */
async function analyzeAudioCached(file, fingerprint) {
  const cacheOn = !(typeof window.TrkSafeMode === "function" && window.TrkSafeMode()) &&
    !!window.indexedDB && !!(window.crypto && window.crypto.subtle) && !!fingerprint;
  let key = null;
  if (cacheOn) {
    try { key = await analysisCacheKey(file, fingerprint); const hit = await analysisCacheGet(key); if (hit) return hit; }
    catch (_) { key = null; }
  }
  const a = await analyzeAudio(file);
  if (key) analysisCachePut(key, a).catch(() => {});
  return a;
}

/* ---------- 音声解析（音量・立ち上がり・高音の割合） ---------- */
async function analyzeAudio(file) {
  const audio = await decodeAudio(await file.arrayBuffer());
  const sr = audio.sampleRate, n = audio.length;
  const c0 = audio.getChannelData(0), c1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
  const hop = Math.max(1, Math.round(sr * 0.01)), frames = Math.floor(n / hop), frameMs = hop / sr * 1000;
  const rms = new Float32Array(frames), hf = new Float32Array(frames);
  let prev = 0, maxRms = 0, peak = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0, h = 0; const s0 = f * hop;
    for (let i = s0; i < s0 + hop; i++) {
      const x = c1 ? (c0[i] + c1[i]) * .5 : c0[i];
      e += x * x; const d = x - prev; h += d * d; prev = x;
      const ax = x < 0 ? -x : x; if (ax > peak) peak = ax;   /* 🔊 音量の平準化（trk168）：いちばん大きいサンプル */
    }
    rms[f] = Math.sqrt(e / hop); hf[f] = Math.sqrt(h / hop);
    if (rms[f] > maxRms) maxRms = rms[f];
  }
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, rms[f] - rms[f - 1]) + .6 * Math.max(0, hf[f] - hf[f - 1]);
  const P = new Float64Array(frames + 1);
  for (let f = 0; f < frames; f++) P[f + 1] = P[f] + flux[f];
  const onset = new Float32Array(frames), ratio = new Float32Array(frames), win = 25;
  for (let f = 0; f < frames; f++) {
    const lo = Math.max(0, f - win), hi = Math.min(frames, f + win + 1);
    onset[f] = Math.max(0, flux[f] - (P[hi] - P[lo]) / (hi - lo));
    ratio[f] = hf[f] / (rms[f] + 1e-6);
  }
  const nz = Array.from(onset).filter(v => v > 0).sort((a, b) => a - b);
  const scale = nz.length ? nz[Math.floor(nz.length * .95)] || nz[nz.length - 1] : 1;
  /* 🔊 音量の平準化（trk168）：曲全体の loudness＝ゲート（いちばん大きいフレームの15%）以上のフレームだけの
     エネルギー平均を dB にしたもの（無音の頭・間奏・フェードアウトに平均を引っ張られないための粗い近似） */
  const gate = Math.max(maxRms * .15, 1e-4);
  let gsum = 0, gn = 0;
  for (let f = 0; f < frames; f++) { const v = rms[f]; if (v > gate) { gsum += v * v; gn++; } }
  const loudness = gn ? 20 * Math.log10(Math.sqrt(gsum / gn)) : -60;
  return { rms, onset, ratio, frames, frameMs, maxRms: maxRms || 1, scale: scale || 1, loudness, peak };
}
/* 🔊 音量の平準化（trk168）：解析結果から曲全体の loudness（dB）を返す。
   古いキャッシュ記録（loudness が入る前のもの）では rms から計算し直す。無ければ null＝この曲は素通し。
   計算はこの端末の中だけ。ファイルは変更しない（読み取り専用方針）。 */
function loudnessDb(a) {
  if (!a || !(a.rms instanceof Float32Array) || !a.rms.length) return null;
  if (Number.isFinite(a.loudness)) return a.loudness;
  const max = Number.isFinite(a.maxRms) && a.maxRms > 0 ? a.maxRms : 1;
  const gate = Math.max(max * .15, 1e-4);
  let sum = 0, n = 0;
  for (let i = 0; i < a.rms.length; i++) { const v = a.rms[i]; if (v > gate) { sum += v * v; n++; } }
  return n ? 20 * Math.log10(Math.sqrt(sum / n)) : null;
}
const frameAt = t => Math.round(t / core.analysis.frameMs);
function rmsAt(t) { return core.analysis.rms[Math.min(core.analysis.frames - 1, Math.max(0, frameAt(t)))]; }
/* ---------- 譜面 ---------- */
const CHART_FILE_MAX = 2 * 1024 * 1024;   // docs/pack-format.md の譜面JSON上限に合わせる
/* 譜面の難易度表示。本体の式は js/chart-gen.js（cgEstimateLevel）。ここでは levelOverride（譜面パックの指定）だけを見る */
function estimateLevel(notes) {
  if (core.levelOverride) return core.levelOverride;
  return window.Trk.chart.cgEstimateLevel(notes);
}
/* ゲームの状態を変えずに譜面だけを作る（曲パックの書き出しでも使う）。
   作り方は chartGen（設定 settings.chartGen／既定 "4" = Bタイプ（方式4）、"3" = Aタイプ（従来）、"1"・"2" = 旧方式1・2）。中身は js/chart-gen.js の純関数。 */
function generateNotes(diff, bpm, offset, seed, chartGen = core.settings.chartGen) {
  if (!core.videoReady || !(bpm >= 60 && bpm <= 300) || !window.Trk.data.DIFF_IDS.includes(diff)) return [];
  const rand = core.mulberry32(core.hashString(`${String(seed).trim()}|${diff}|${bpm}|${offset}`));
  return window.Trk.chart.buildChartNotes({ analysis: core.analysis, durationMs: core.video.duration * 1000, diff, spec: window.Trk.data.DIFFS[diff], bpm, offset, rand, chartGen });
}
function buildChart() {
  if (!core.videoReady) return;
  core.chartMode = "generated"; core.chartDiff = core.settings.difficulty;
  const bpm = Number(core.$("bpm").value), offset = Number(core.$("offset").value) || 0;
  if (!(bpm >= 60 && bpm <= 300)) { core.chart = []; core.setStatus("chartStatus", "noChart"); core.updateChartButtons(); return; }
  core.chart = generateNotes(core.chartDiff, bpm, offset, core.$("seed").value).map(n => ({ ...n, judged:false, result:null }));
  core.chartMeta = { bpm, offset };
  core.currentLevel = estimateLevel(core.chart);
  core.setStatus("chartStatus", core.chart.length ? () => core.chartSummary() : "noChart");
  core.updateChartButtons();
}
function chartToData(notes, diff, meta = core.chartMeta) {
  return {
    format:"shadow-taiko-chart", version:2, app:"trk!",
    media:{ name:core.mediaName, fingerprint: core.fingerprint, duration:+(core.video.duration || 0).toFixed(3) },
    bpm:meta.bpm, offset:meta.offset, seed:core.$("seed").value.trim(), difficulty:diff, level:estimateLevel(notes),
    /* MIRROR／RANDOM は resetRun が n.lane を書き換える（元は origLane）。MOD を掛けて遊んだ後に書き出しても、
       元の譜面を書き出す（chartKeyOf と同じ考え方。trk132） */
    notes:notes.map(n => [n.time, n.origLane ?? n.lane])
  };
}
function exportChart(statusId) {
  if (!core.chart.length) { core.setStatus(statusId, "exportNone"); return; }
  const base = core.safeName(core.baseName(core.mediaName) || "chart");
  core.downloadBlob(new Blob([JSON.stringify(chartToData(core.chart, core.chartDiff))], { type:"application/json" }), `${base}-${core.chartDiff}.shadow-taiko.json`);
  core.setStatus(statusId, "exportDone");
}
function parseNote(n) {
  let time, lane;
  if (Array.isArray(n) && n.length >= 2) {
    [time, lane] = n;
  } else if (n && typeof n === "object" && !Array.isArray(n)) {
    time = n.time ?? n.t;
    lane = n.lane ?? n.l;
    if (lane === undefined && (n.type === "ka" || n.type === "don")) lane = n.type === "ka" ? 1 : 0;
  }
  return {
    time:typeof time === "number" ? time : NaN,
    lane:typeof lane === "number" ? lane : NaN
  };
}
/* 譜面データを確認する。問題があれば { key }、OKなら { notes } を返す */
function validateChartData(data, checkFingerprint = true) {
  if (!data || typeof data !== "object" || (data.format && !String(data.format).startsWith("shadow-taiko"))) return { key:"importBad" };
  const has = key => Object.prototype.hasOwnProperty.call(data, key);
  /* bpm は 0（小節線なし。bpm の無い譜面を chartToData が書き出すと 0 になる）か 1〜1000 に限る。
     負の値は小節線の描画ループ（render.js の drawMeasureLines・stage.js・modes.js の ORBIT 拍線）が
     終わらず、1e9 のような値も毎フレーム数百万回回るので、他人の譜面ファイル1つでタブが固まらないよう
     入口で弾く（F-33。生成側は 60〜300 を強制している）。 */
  const bpmOk = !has("bpm") || (typeof data.bpm === "number" && Number.isFinite(data.bpm) &&
    (data.bpm === 0 || (data.bpm >= 1 && data.bpm <= 1000)));
  if (!bpmOk || (has("offset") && (typeof data.offset !== "number" || !Number.isFinite(data.offset)))) return { key:"importInvalid" };
  if (!Array.isArray(data.notes) || data.notes.length > 50000) return { key:"importInvalid" };
  const notes = data.notes.map(parseNote);
  if (notes.some(n => !isFinite(n.time) || n.time < 0 || (n.lane !== 0 && n.lane !== 1))) return { key:"importInvalid" };
  if (!notes.length) return { key:"importEmpty" };
  if (checkFingerprint && data.media && data.media.fingerprint && data.media.fingerprint !== core.fingerprint) return { key:"importMismatch" };
  notes.sort((a, b) => a.time - b.time);
  if (notes[notes.length - 1].time > core.video.duration * 1000 + 1000) return { key:"importTooLong" };
  return { notes };
}
/* 確認した譜面を今の譜面にする（mode: "imported" / "pack"） */
function applyChartData(data, mode = "imported", sid = "importStatus", checkFingerprint = true) {
  if (!core.videoReady) { core.setStatus(sid, "loadError"); return false; }
  const v = validateChartData(data, checkFingerprint);
  if (v.key) { core.setStatus(sid, v.key); return false; }
  core.chart = v.notes.map(n => ({ time:Math.round(n.time), lane:n.lane, judged:false, result:null }));
  core.chartMode = mode;
  core.chartDiff = window.Trk.data.DIFF_IDS.includes(data.difficulty) ? data.difficulty : core.settings.difficulty;
  core.chartMeta = {
    bpm:typeof data.bpm === "number" && Number.isFinite(data.bpm) ? data.bpm : 0,
    offset:typeof data.offset === "number" && Number.isFinite(data.offset) ? data.offset : 0
  };
  core.currentLevel = estimateLevel(core.chart);
  core.setStatus("chartStatus", () => core.chartSummary());
  if (mode === "imported") core.setStatus(sid, "importSuccess");
  core.updateChartButtons();
  return true;
}
async function importChartFile(file, sid = "importStatus") {
  if (!file || typeof file.size !== "number" || !Number.isFinite(file.size) || file.size < 0 ||
      file.size > CHART_FILE_MAX || typeof file.text !== "function") {
    core.setStatus(sid, "importInvalid"); return false;
  }
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (_) { core.setStatus(sid, "importBad"); return false; }
  return applyChartData(data, "imported", sid, true);
}

/* ---------- ヒットSE ---------- */
const seBuffers = [null, null], seFiles = [null, null]; let noiseBuf = null;
function playSE(lane, force = false) {
  if (!core.settings.seEnabled && !force) return;
  const ac = getAC(); if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  const t = ac.currentTime, out = ac.createGain();
  out.gain.value = core.settings.seVolume; out.connect(ac.destination);
  if (seBuffers[lane]) { const s = ac.createBufferSource(); s.buffer = seBuffers[lane]; s.connect(out); s.start(t); return; }
  const o = ac.createOscillator(), e = ac.createGain();
  if (lane === 0) {
    o.type = "sine"; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(58, t + .14);
    e.gain.setValueAtTime(1, t); e.gain.exponentialRampToValueAtTime(.001, t + .2);
    o.connect(e).connect(out); o.start(t); o.stop(t + .22);
  } else {
    o.type = "triangle"; o.frequency.setValueAtTime(1350, t); o.frequency.exponentialRampToValueAtTime(820, t + .05);
    e.gain.setValueAtTime(.7, t); e.gain.exponentialRampToValueAtTime(.001, t + .08);
    o.connect(e).connect(out); o.start(t); o.stop(t + .1);
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * .05), ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const nz = ac.createBufferSource(), hp = ac.createBiquadFilter(), ng = ac.createGain();
    nz.buffer = noiseBuf; hp.type = "highpass"; hp.frequency.value = 2500;
    ng.gain.setValueAtTime(.4, t); ng.gain.exponentialRampToValueAtTime(.001, t + .05);
    nz.connect(hp).connect(ng).connect(out); nz.start(t);
  }
}
async function loadSE(file, lane) {
  if (!file) return;
  if (!getAC()) { core.setStatus("seStatus", "seUnavailable"); return; }
  try {
    seBuffers[lane] = await decodeAudio(await file.arrayBuffer());
    seFiles[lane] = file;
    core.setStatus("seStatus", lane ? "seLoadedKa" : "seLoadedDon");
  } catch (_) { core.setStatus("seStatus", "seLoadError"); }
}
/* ✅ media.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.CHART_FILE_MAX = CHART_FILE_MAX;
/* 後から読み込まれるファイルがこの名前を差し替える（window.applyChartData の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "applyChartData", { configurable:true, get:() => applyChartData, set:v => { applyChartData = v; } });
Object.defineProperty(window, "audioCtx", { configurable:true, get:() => audioCtx, set:v => { audioCtx = v; } });
window.buildChart = buildChart;
/* 後から読み込まれるファイルがこの名前を差し替える（window.chartToData の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "chartToData", { configurable:true, get:() => chartToData, set:v => { chartToData = v; } });
window.decodeAudio = decodeAudio;
window.estimateLevel = estimateLevel;
window.exportChart = exportChart;
window.generateNotes = generateNotes;
window.getAC = getAC;
window.importChartFile = importChartFile;
window.loadMedia = loadMedia;
window.loadSE = loadSE;
window.playSE = playSE;
window.rmsAt = rmsAt;
window.seBuffers = seBuffers;
window.seFiles = seFiles;
window.setBackground = setBackground;
/* 領域（window.Trk.media）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.media = Object.assign(window.Trk.media || {}, { CHART_FILE_MAX, buildChart, decodeAudio, estimateLevel, exportChart, generateNotes, getAC, importChartFile, loadMedia, loadSE, loudnessDb, playSE, rmsAt, seBuffers, seFiles, setBackground, codecLabel, explainAudioFailure, explainAudioWarning, explainLoadFailure, explainProbe, mimeHintFor, probeContainer, withMimeHint });
Object.defineProperty(window.Trk.media, "applyChartData", { configurable:true, get:() => applyChartData, set:v => { applyChartData = v; } });
Object.defineProperty(window.Trk.media, "audioCtx", { configurable:true, get:() => audioCtx, set:v => { audioCtx = v; } });
Object.defineProperty(window.Trk.media, "chartToData", { configurable:true, get:() => chartToData, set:v => { chartToData = v; } });
})();
