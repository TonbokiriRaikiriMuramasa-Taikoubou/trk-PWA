// SPDX-License-Identifier: GPL-3.0-or-later
/* trk168: 🔊 音量の平準化（ReplayGain方式）。
   ① audio-art.js の rgTrackGain 読み取り（ID3 TXXX・Vorbis REPLAYGAIN_TRACK_GAIN・MP4 freeform "----"）
   ② media.js analyzeAudio の loudness（ゲート付きRMSのdB）・peak と、loudnessDb の古いキャッシュ追い越し
   ③ fx.js normPlan（純関数）：タグ優先・クランプ・ピークガード・素通し
   ④ 配線の走査（G.norm が通り道に常にあること、mediaReady/songTags 購読、4言語の文言、キャッシュ後方互換）
   いずれもファイルは読み取りだけ（書き戻し経路は作らない）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const artSrc = fs.readFileSync(`${ROOT}/js/audio-art.js`, "utf8");
const mediaSrc = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const fxSrc = fs.readFileSync(`${ROOT}/js/fx.js`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

/* ---------- 合成バイナリの道具（trk167 と同じ形） ---------- */
function artVm() {
  const sandbox = { window: {}, TextDecoder, Blob, File, atob, console: { error() {} } };
  vm.createContext(sandbox);
  vm.runInContext(artSrc, sandbox, { filename: "js/audio-art.js" });
  return sandbox.window.Trk.media.audioArt;
}
const bytesOf = s => new TextEncoder().encode(s);
function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0; for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
}
const fileFrom = (bytes, name) => new File([bytes], name, { type: "application/octet-stream" });
const u32be = n => new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
const u32le = n => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
const syncsafe = n => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
function utf16leOf(s) {
  const out = [];
  for (const ch of s) { const c = ch.codePointAt(0); out.push(c & 0xff, (c >> 8) & 0xff); }
  return new Uint8Array(out);
}
function id3File(frames, { version = 3, name = "song.mp3" } = {}) {
  const head = version === 2 ? 6 : 10;
  const tagLen = frames.reduce((n, f) => n + head + f.body.length, 0);
  const parts = [new Uint8Array([0x49, 0x44, 0x33, version, 0, 0, ...syncsafe(tagLen)])];
  for (const f of frames) {
    const h = new Uint8Array(head);
    for (let i = 0; i < f.id.length; i++) h[i] = f.id.charCodeAt(i);
    const sz = f.body.length;
    if (version === 2) { h[3] = (sz >> 16) & 0xff; h[4] = (sz >> 8) & 0xff; h[5] = sz & 0xff; }
    else { h[4] = (sz >>> 24) & 0xff; h[5] = (sz >>> 16) & 0xff; h[6] = (sz >>> 8) & 0xff; h[7] = sz & 0xff; }
    parts.push(h, f.body);
  }
  parts.push(new Uint8Array(32));
  return fileFrom(concatBytes(...parts), name);
}
/* TXXX: encoding + 説明（ヌル終端）+ 値。UTF-16 の説明終端は 00 00 */
const txxxFrame = (desc, value, encoding = 3) => encoding === 3
  ? concatBytes(new Uint8Array([3]), bytesOf(desc), new Uint8Array([0]), bytesOf(value))
  : concatBytes(new Uint8Array([1, 0xff, 0xfe]), utf16leOf(desc), new Uint8Array([0, 0]), utf16leOf(value));
const textFrame = (text, encoding = 3) => encoding === 3
  ? concatBytes(new Uint8Array([3]), bytesOf(text))
  : concatBytes(new Uint8Array([1, 0xff, 0xfe]), utf16leOf(text));
const box = (type, payload) => {
  const t = new Uint8Array(4);
  for (let i = 0; i < 4; i++) t[i] = type.charCodeAt(i) & 0xff;
  return concatBytes(u32be(8 + payload.length), t, payload);
};
/* MP4 freeform: ilst → "----" → mean/name/data */
function mp4FreeformFile(mean, name, value) {
  const inner = concatBytes(
    box("mean", concatBytes(u32be(0), bytesOf(mean))),
    box("name", concatBytes(u32be(0), bytesOf(name))),
    box("data", concatBytes(u32be(1), u32be(0), bytesOf(value))));
  const ilst = box("----", inner);
  const meta = box("meta", concatBytes(new Uint8Array(4), box("ilst", ilst)));
  const moov = box("moov", box("udta", meta));
  return fileFrom(concatBytes(box("ftyp", bytesOf("isom")), moov, new Uint8Array(16)), "song.m4a");
}
const vorbisComment = pairs => {
  const parts = [u32le(4), bytesOf("trk!"), u32le(pairs.length)];
  for (const pair of pairs) { const b = bytesOf(pair); parts.push(u32le(b.length), b); }
  return concatBytes(...parts);
};
const flacFile = pairs => {
  const payload = vorbisComment(pairs);
  return fileFrom(concatBytes(bytesOf("fLaC"),
    new Uint8Array([0x84, (payload.length >> 16) & 0xff, (payload.length >> 8) & 0xff, payload.length & 0xff]),
    payload, new Uint8Array(16)), "song.flac");
};
const oggFile = (packet, name) => {
  const header = concatBytes(bytesOf("OggS"), new Uint8Array([0, 0]), u32be(0), u32be(0), u32le(1), u32le(0), u32le(0), new Uint8Array([1, packet.length]));
  return fileFrom(concatBytes(header, packet, new Uint8Array(8)), name);
};

/* ---------- ① rgTrackGain（タグの ReplayGain） ---------- */
test("extractTags(): ReplayGain tags from ID3 TXXX, Vorbis comments, and MP4 freeform", async () => {
  const api = artVm();
  /* ID3 TXXX（UTF-8）＋表示タグも同居 */
  const t1 = await api.extractTags(id3File([
    { id: "TIT2", body: textFrame("Song") },
    { id: "TXXX", body: txxxFrame("REPLAYGAIN_TRACK_GAIN", "-6.53 dB") }
  ]));
  assert.equal(t1.title, "Song");
  assert.ok(Math.abs(t1.rgTrackGain - -6.53) < 1e-9, `ID3 TXXX utf-8 → ${t1.rgTrackGain}`);
  /* ID3 TXXX（UTF-16・説明大文字小文字無視・"dB" なしも可） */
  const t2 = await api.extractTags(id3File([
    { id: "TXXX", body: txxxFrame("replaygain_track_gain", "+2.5", 1) }
  ]));
  assert.ok(Math.abs(t2.rgTrackGain - 2.5) < 1e-9, "UTF-16 TXXX, case-insensitive desc, bare number");
  /* 説明が違う TXXX・壊れた値・範囲外は無視 */
  const t3 = await api.extractTags(id3File([
    { id: "TXXX", body: txxxFrame("MusicBrainz Artist Id", "abc") },
    { id: "TXXX", body: txxxFrame("REPLAYGAIN_TRACK_GAIN", "loud") }
  ]));
  assert.equal(t3, null, "unknown TXXX and garbage values are ignored");
  const t4 = await api.extractTags(id3File([{ id: "TXXX", body: txxxFrame("REPLAYGAIN_TRACK_GAIN", "+30 dB") }]));
  assert.equal(t4, null, "out-of-range (+30 dB) is rejected");
  /* FLAC / Opus の Vorbis コメント（キーは大小無視） */
  const t5 = await api.extractTags(flacFile(["TITLE=Flac Song", "REPLAYGAIN_TRACK_GAIN=-1.20 dB"]));
  assert.equal(t5.title, "Flac Song");
  assert.ok(Math.abs(t5.rgTrackGain - -1.2) < 1e-9, "FLAC Vorbis comment");
  const opusPacket = concatBytes(bytesOf("OpusTags"), vorbisComment(["replaygain_track_gain=-9.99 dB"]));
  const t6 = await api.extractTags(oggFile(opusPacket, "song.opus"));
  assert.ok(Math.abs(t6.rgTrackGain - -9.99) < 1e-9, "Opus OpusTags");
  /* MP4 freeform（----:com.apple.iTunes:REPLAYGAIN_TRACK_GAIN） */
  const t7 = await api.extractTags(mp4FreeformFile("com.apple.iTunes", "REPLAYGAIN_TRACK_GAIN", "-3.45 dB"));
  assert.ok(Math.abs(t7.rgTrackGain - -3.45) < 1e-9, "MP4 freeform box");
  const t8 = await api.extractTags(mp4FreeformFile("com.apple.iTunes", "MusicBrainz Album Id", "abc"));
  assert.equal(t8, null, "freeform with another name is ignored");
  /* RG だけ（表示テキストなし）でもタグありとして返る */
  const t9 = await api.extractTags(id3File([{ id: "TXXX", body: txxxFrame("REPLAYGAIN_TRACK_GAIN", "-6.53 dB") }]));
  assert.deepEqual(Object.keys(t9), ["rgTrackGain"]);
  /* trk167 の回帰：空白だけの表示タグ＋RG なしは null のまま */
  const t10 = await api.extractTags(id3File([{ id: "TIT2", body: textFrame("   ") }]));
  assert.equal(t10, null);
  /* 書き戻し経路が無いこと（読み取り専用方針） */
  assert.ok(!artSrc.includes("createWritable"), "audio-art.js never writes to files");
});

/* ---------- ② analyzeAudio の loudness / peak と loudnessDb ---------- */
test("analyzeAudio(): gated loudness (dB) and peak; loudnessDb() recomputes for old cache records", async () => {
  /* media.js から analyzeAudio と loudnessDb だけを切り出して vm で実行する（decodeAudio は合成バッファで差し替え） */
  const start = mediaSrc.indexOf("async function analyzeAudio(file) {");
  const end = mediaSrc.indexOf("\nconst frameAt");
  assert.ok(start >= 0 && end > start, "analyzeAudio + loudnessDb can be isolated");
  const slice = mediaSrc.slice(start, end);
  assert.ok(slice.includes("function loudnessDb(a)"), "the slice carries loudnessDb too");
  /* 合成音声：8000Hz・2秒＝前半1秒が無音、後半1秒が振幅0.5の矩形波 */
  const ch = new Float32Array(16000);
  for (let i = 8000; i < 16000; i++) ch[i] = ((i - 8000) % 16) < 8 ? 0.5 : -0.5;
  const fakeBuffer = { sampleRate: 8000, length: 16000, numberOfChannels: 1, getChannelData: () => ch };
  const sandbox = { Float32Array, Float64Array, Math, Number, Array, decodeAudio: async () => fakeBuffer };
  vm.createContext(sandbox);
  vm.runInContext(slice + "\nglobalThis.__analyze = analyzeAudio; globalThis.__loudnessDb = loudnessDb;", sandbox, { filename: "js/media.js(slice)" });
  const a = await sandbox.__analyze({ arrayBuffer: async () => new ArrayBuffer(8) });
  /* 無音のフレームはゲート（最大フレームの15%）で外れるので、loudness ≈ 20*log10(0.5) = -6.02 dB */
  assert.ok(Math.abs(a.loudness - 20 * Math.log10(0.5)) < 0.01, `loudness → ${a.loudness}`);
  assert.equal(a.peak, 0.5, "peak is the largest |sample|");
  assert.equal(a.frames, 200);
  /* loudnessDb：新しい記録はそのまま、古い記録（loudness なし）は rms から計算し直す */
  assert.equal(sandbox.__loudnessDb(a), a.loudness);
  const old = { rms: Float32Array.from([0, 0, 0.5, 0.5, 0.5, 0]), maxRms: 0.5, frames: 6 };
  assert.ok(Math.abs(sandbox.__loudnessDb(old) - 20 * Math.log10(0.5)) < 0.01, "old cache record → recomputed from rms");
  assert.equal(sandbox.__loudnessDb({ rms: new Float32Array(0) }), null);
  assert.equal(sandbox.__loudnessDb(null), null);
  /* 全部が無音の曲：loudness は床（-60）で、平準化側は Number.isFinite なので拾えるが上げすぎはクランプが守る */
  const silent = { sampleRate: 8000, length: 8000, numberOfChannels: 1, getChannelData: () => new Float32Array(8000) };
  sandbox.decodeAudio = async () => silent;
  const s = await sandbox.__analyze({ arrayBuffer: async () => new ArrayBuffer(8) });
  assert.equal(s.loudness, -60);
  assert.equal(s.peak, 0);
});

/* ---------- ③ normPlan（fx.js の純関数） ---------- */
test("normPlan(): tag wins, clamps apply, peak guard limits boosting, otherwise passthrough", () => {
  const m = /const NORM_TARGET_DB[\s\S]*?\nfunction normPlan\([\s\S]*?\n\}/.exec(fxSrc);
  assert.ok(m, "normPlan and its constants can be isolated");
  const sandbox = { Number, Math, dbToGain: d => Math.pow(10, d / 20) };
  vm.createContext(sandbox);
  vm.runInContext(m[0] + "\nglobalThis.__normPlan = normPlan;", sandbox, { filename: "js/fx.js(slice)" });
  const plan = sandbox.__normPlan;
  const dbToGain = d => Math.pow(10, d / 20);
  /* vm 跨ぎのオブジェクトはプロトタイプが違うので、フィールドごとに見る（deepEqual しない） */
  const isPass = p => p.lin === 1 && p.db === 0 && p.src === "";
  /* オフ・情報なしは素通し */
  assert.ok(isPass(plan({ on: false, rgDb: -6, loudness: -10 })), "off → passthrough");
  assert.ok(isPass(plan({ on: true })), "nothing to use → passthrough");
  /* タグ優先：解析よりタグの dB をそのまま使う */
  const tag = plan({ on: true, rgDb: -6, loudness: -10, peak: 0.5 });
  assert.equal(tag.src, "tag");
  assert.ok(Math.abs(tag.lin - dbToGain(-6)) < 1e-9);
  /* 測定値：目標 -16 dB へ寄せる（loudness -10 → -6 dB） */
  const meas = plan({ on: true, loudness: -10, peak: 0.9 });
  assert.equal(meas.src, "measured");
  assert.ok(Math.abs(meas.db - -6) < 1e-9, `measured db → ${meas.db}`);
  /* クランプ：タグ +20 dB は +9 dB まで。解析なし（peak なし）は lin 2 天井 */
  const clamp = plan({ on: true, rgDb: 20 });
  assert.ok(Math.abs(clamp.lin - 2) < 1e-9, `no-peak cap → ${clamp.lin}`);
  assert.ok(Math.abs(clamp.db - 20 * Math.log10(2)) < 1e-9);
  /* ピークガード：静かな曲（loudness -30 → +9 dB クランプ）でも peak 0.99 なら 0.98/peak まで */
  const guard = plan({ on: true, loudness: -30, peak: 0.99 });
  assert.ok(Math.abs(guard.lin - 0.98 / 0.99) < 1e-9, `peak guard → ${guard.lin}`);
  assert.ok(guard.db < 0.1, "boost never pushes the loudest sample past full scale");
  /* 下げ方向はピークガードに影響されない */
  const cut = plan({ on: true, loudness: -6, peak: 0.99 });
  assert.ok(Math.abs(cut.lin - dbToGain(-10)) < 1e-9);
  /* 壊れた値（NaN）は素通し */
  assert.ok(isPass(plan({ on: true, rgDb: NaN, loudness: NaN, peak: NaN })), "NaN inputs → passthrough");
});

/* ---------- ④ 配線の走査 ---------- */
test("wiring: G.norm in the signal path, mediaReady/songTags hooks, four languages, cache stays backward compatible", () => {
  /* fx.js：平準化ノードは通り道に常にある（音量 → 平準化 → リミッター/出口） */
  assert.ok(fxSrc.includes("G.norm = gainN(ac, 1)"), "the norm node is created with the graph");
  assert.ok(fxSrc.includes("G.vol.connect(G.norm)"), "volume flows into the norm node");
  assert.ok(fxSrc.includes("G.norm.connect(G.lim); G.lim.connect(G.out)"), "norm → limiter → out when both are on");
  assert.ok(fxSrc.includes("else G.norm.connect(G.out)"), "norm → out otherwise");
  assert.ok(fxSrc.includes("settings.fxNorm = prefs.fxNorm === true"), "off by default, restored from prefs");
  assert.ok(fxSrc.includes('on("mediaReady", () => { if (settings.fxNorm && !G.src && G.ok) ensureGraph(); applyNorm(); })'), "song loads re-apply (and build the path when needed)");
  assert.ok(fxSrc.includes('on("songTags", () => { if (settings.fxNorm && !G.src && G.ok) ensureGraph(); applyNorm(); })'), "late-arriving tags re-apply");
  assert.ok(fxSrc.includes("window.Trk.media.loudnessDb(a)"), "the measured loudness comes from media.js");
  assert.ok(fxSrc.includes("lib.songTagsOf(song)"), "the tag ReplayGain comes from library.js");
  assert.ok(fxSrc.includes("normInfo:() => ({ on:!!settings.fxNorm"), "TrkFX.normInfo for other features and tests");
  /* 4言語の文言 */
  for (const key of ["sfxNormTitle:", "sfxNorm:", "sfxNormHint:", "sfxNormWait:", "sfxNormNone:", "sfxNormNow:", "sfxNormSrcTag:", "sfxNormSrcMeasured:"]) {
    assert.equal((fxSrc.match(new RegExp(key.replace(":", ":"), "g")) || []).length, 4, `${key} in all four languages`);
  }
  /* media.js：解析の戻り値とキャッシュに loudness/peak。ただし検証（analysisCacheValid）は据え置き＝古い記録も読める */
  assert.ok(mediaSrc.includes("maxRms: maxRms || 1, scale: scale || 1, loudness, peak"), "analyzeAudio returns loudness and peak");
  assert.ok(mediaSrc.includes("loudness: a.loudness, peak: a.peak"), "the cache stores them");
  assert.ok(mediaSrc.includes("loudness: rec.loudness, peak: rec.peak"), "the cache returns them (old records → undefined)");
  const valid = /function analysisCacheValid\(r\) \{[\s\S]*?\n\}/.exec(mediaSrc);
  assert.ok(valid && !valid[0].includes("loudness"), "old cache records (no loudness) stay valid — no version bump needed");
  assert.ok(mediaSrc.includes("loudnessDb, playSE"), "Trk.media exports loudnessDb");
  /* audio-art.js：三つの入れ物（ID3・Vorbis・MP4）から REPLAYGAIN_TRACK_GAIN を読む */
  assert.ok(artSrc.includes("function parseRgDb("), "the dB parser");
  assert.ok(artSrc.includes("function parseMp4FreeformRg("), "the MP4 freeform reader");
  assert.ok((artSrc.match(/REPLAYGAIN_TRACK_GAIN/g) || []).length >= 3, "ID3 + Vorbis + MP4 paths");
  assert.ok(!artSrc.includes("createWritable"), "read-only: no write path");
  /* sw.js：キャッシュ名の形だけ（版数はリリースごとに進むので固定しない） */
  assert.match(swSrc, /^const CACHE = "trk-v[\d.]+-trk\d+";$/m);
});
