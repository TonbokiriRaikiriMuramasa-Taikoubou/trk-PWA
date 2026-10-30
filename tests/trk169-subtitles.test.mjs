// SPDX-License-Identifier: GPL-3.0-or-later
/* trk169: 💬 字幕（SRT/VTT）。
   ① subtitles.js 全体を vm で実行し、SRT/VTT のパース・WebVTT 変換・遅延調整・保存（追い出し）・
      解決の優先順（手動 → フォルダの .srt/.vtt）・PiP用 <track> の付け外しまで実際に動かす。
   ② 配線の走査：library.js の相乗り収集、media-player-mode.js のパネル/オーバーレイ/フック（4言語）、
      video-max.js のオーバーレイ、index.html の読み込み順、css、sw.js のキャッシュ名。
   字幕は読み取りだけ（書き戻し経路なし・送信なし）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const subsSrc = fs.readFileSync(`${ROOT}/js/subtitles.js`, "utf8");
const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const videoMaxSrc = fs.readFileSync(`${ROOT}/js/video-max.js`, "utf8");
const htmlSrc = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

/* ---------- vm の道具（localStorage・Blob/URL・最小の document） ---------- */
function subsVm() {
  const store = new Map();
  const revoked = [];
  let blobs = 0;
  const sandbox = {
    window: {},
    localStorage: { getItem:k => (store.has(String(k)) ? store.get(String(k)) : null), setItem:(k, v) => store.set(String(k), String(v)), removeItem:k => store.delete(String(k)) },
    JSON, Math, Number, Array, String, Object, Date, Boolean, isNaN, parseInt, parseFloat,
    URL: { createObjectURL: () => `blob:subs${++blobs}`, revokeObjectURL: u => revoked.push(u) },
    Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } },
    document: { createElement: tag => ({ tag, kind:"", label:"", srclang:"", src:"", dataset:{}, removed:false, remove() { this.removed = true; } }) },
    revoked, store
  };
  vm.createContext(sandbox);
  vm.runInContext(subsSrc, sandbox, { filename: "js/subtitles.js" });
  return sandbox;
}
function fakeVideo() {
  const kids = [];
  return {
    kids,
    append(t) { kids.push(t); },
    querySelectorAll: () => kids.filter(t => t.dataset && t.dataset.trkSubs),
    textTracks: []
  };
}
const srtOf = (n = 1) => `${n}\n00:00:0${n},000 --> 00:00:0${n},900\nLine ${n}\n\n`;

/* ---------- ① パース ---------- */
test("parseSubtitles(): SRT and WebVTT both parse into sorted cues; junk becomes null", () => {
  const api = subsVm().window.Trk.subtitles;
  /* SRT：番号行・カンマms・複数行・CRLF・順序バラバラ・{\an8}/<i> の掃除 */
  const srt = "2\r\n00:00:05,500 --> 00:00:07,000\r\n{\\an8}<i>Second</i> cue\r\nsecond line\r\n\r\n1\r\n00:00:01,000 --> 00:00:02,500\r\nFirst cue\r\n\r\n";
  const r1 = api.parseSubtitles(srt);
  assert.equal(r1.cues.length, 2);
  assert.deepEqual([r1.cues[0].start, r1.cues[0].end], [1, 2.5], "sorted by start; comma ms");
  assert.equal(r1.cues[0].text, "First cue");
  assert.equal(r1.cues[1].text, "Second cue\nsecond line", "ASS override + html-ish tags stripped, lines joined");
  /* VTT：ヘッダ・NOTE・STYLE・キューID・position 指定・短縮時刻 MM:SS.mmm・ドットms */
  const vtt = `WEBVTT\n\nNOTE\na comment\n\nSTYLE\n::cue { color: white }\n\ncue-1\n01:02.500 --> 01:04.000 position:10% align:middle\nShort stamp cue\n\n00:01:05.250 --> 00:01:06.750\nHour stamp cue\n`;
  const r2 = api.parseSubtitles(vtt);
  assert.equal(r2.cues.length, 2, "NOTE and STYLE blocks are skipped");
  assert.deepEqual([r2.cues[0].start, r2.cues[0].end], [62.5, 64], "MM:SS.mmm short form");
  assert.equal(r2.cues[0].text, "Short stamp cue");
  assert.deepEqual([r2.cues[1].start, r2.cues[1].end], [65.25, 66.75], "HH:MM:SS.mmm with VTT settings after the arrow");
  /* BOM・end<start・壊れた行 */
  const r3 = api.parseSubtitles("\uFEFF1\n00:00:09,000 --> 00:00:03,000\nClamped\n\n2\nnonsense --> line\n\n3\n00:00:10,000 --> 00:00:11,000\n\n");
  assert.equal(r3.cues.length, 1, "end<start is clamped, broken timing and empty text are dropped");
  assert.deepEqual([r3.cues[0].start, r3.cues[0].end], [9, 9]);
  /* 読み切れないもの */
  assert.equal(api.parseSubtitles(""), null);
  assert.equal(api.parseSubtitles("just some text\nno timings here\n"), null);
  assert.equal(api.parseSubtitles(null), null);
  /* 上限：5001 キュー → 5000 で止まる */
  let big = "";
  for (let i = 1; i <= 5001; i++) big += `${i}\n00:00:00,100 --> 00:00:00,200\nx\n\n`;
  assert.equal(api.parseSubtitles(big).cues.length, api.limits.cues);
});

test("stampSeconds(): SRT comma, VTT dot, short form; rejects junk", () => {
  const api = subsVm().window.Trk.subtitles;
  assert.equal(api.stampSeconds("01:02:03,500"), 3723.5);
  assert.equal(api.stampSeconds("01:02:03.50"), 3723.5, "2-digit fraction is padded");
  assert.equal(api.stampSeconds("02:03.500"), 123.5);
  assert.equal(api.stampSeconds("100:00:00.000"), null, "hours over 99 are rejected");
  assert.equal(api.stampSeconds("00:60:00.000"), null);
  assert.equal(api.stampSeconds("abc"), null);
});

test("toVtt(): WEBVTT text with the delay baked in (for the PiP track)", () => {
  const api = subsVm().window.Trk.subtitles;
  const cues = [{ start: 1, end: 2.5, text: "Hello\nworld" }];
  const v = api.toVtt(cues, 0);
  assert.ok(v.startsWith("WEBVTT\n\n"));
  assert.ok(v.includes("00:00:01.000 --> 00:00:02.500\nHello\nworld\n"), v);
  const late = api.toVtt(cues, 250);
  assert.ok(late.includes("00:00:01.250 --> 00:00:02.750"), "positive delay shifts cues later");
  const early = api.toVtt(cues, -2000);
  assert.ok(early.includes("00:00:00.000 --> 00:00:00.500"), "negative delay is clamped at 0");
});

test("activeCues() and currentTexts(): window, overlap cap, pause and on/off", () => {
  const sb = subsVm();
  const api = sb.window.Trk.subtitles;
  const cues = [{ start:0, end:2, text:"a" }, { start:1, end:3, text:"b" }, { start:5, end:6, text:"c" }];
  assert.deepEqual(Array.from(api.activeCues(cues, 1.5)), ["a", "b"], "overlapping cues in display order");
  assert.deepEqual(Array.from(api.activeCues(cues, 4)), [], "between cues → nothing");
  assert.deepEqual(Array.from(api.activeCues(cues, NaN)), []);
  /* currentTexts：offsetMs > 0 ＝字幕を遅く表示（再生位置からは引く） */
  api.setCurrent({ cues: [{ start:10, end:12, text:"x" }], offsetMs: 1000 }, true);
  assert.deepEqual(Array.from(api.currentTexts(11.5)), ["x"], "with +1s delay the cue shows at 11–13s");
  assert.deepEqual(Array.from(api.currentTexts(10.5)), [], "…and not before");
  api.pauseOverlay(true);
  assert.deepEqual(Array.from(api.currentTexts(11.5)), [], "paused (reverse playback) → nothing");
  api.pauseOverlay(false);
  api.setOn(false);
  assert.deepEqual(Array.from(api.currentTexts(11.5)), [], "off → nothing");
  api.setOn(true);
  assert.deepEqual(Array.from(api.currentTexts(11.5)), ["x"]);
  api.setCurrent(null);
  assert.deepEqual(Array.from(api.currentTexts(11.5)), [], "cleared → nothing");
});

/* ---------- ② 保存と解決 ---------- */
test("store: manual subs win over the folder sidecar; delay is saved per song; eviction keeps the current song", async () => {
  const sb = subsVm();
  const api = sb.window.Trk.subtitles;
  const sidecar = { name: "movie.srt", size: 100, text: async () => srtOf(1) };
  /* フォルダの .srt だけ */
  let r = await api.resolveSubs({ key: "k1", subsFile: sidecar });
  assert.equal(r.source, "folder");
  assert.equal(r.name, "movie.srt");
  assert.equal(r.cues.length, 1);
  assert.equal(r.offsetMs, 0);
  /* 手動を選ぶとそちらが勝つ */
  assert.ok(api.saveManualSubs("k1", "1\n00:00:02,000 --> 00:00:03,000\nManual\n", "chosen.vtt", 0));
  r = await api.resolveSubs({ key: "k1", subsFile: sidecar });
  assert.equal(r.source, "manual");
  assert.equal(r.name, "chosen.vtt");
  assert.equal(r.cues[0].text, "Manual");
  /* 消すとフォルダに戻る */
  api.clearManualSubs("k1");
  r = await api.resolveSubs({ key: "k1", subsFile: sidecar });
  assert.equal(r.source, "folder");
  /* 遅延だけ保存（フォルダ字幕の曲でも残る） */
  api.saveSubsOffset("k2", 1500);
  r = await api.resolveSubs({ key: "k2", subsFile: { name: "m.srt", size: 90, text: async () => srtOf(2) } });
  assert.equal(r.offsetMs, 1500);
  assert.equal(api.subsOffset("k2"), 1500);
  api.saveSubsOffset("k2", 999999);
  assert.equal(api.subsOffset("k2"), api.limits.offsetMs, "offset is clamped to ±5 min");
  /* 追い出し：合計 1MB を超えたら古い順に消える（今の曲は残る） */
  const sb2 = subsVm();
  const api2 = sb2.window.Trk.subtitles;
  const chunk = "1\n00:00:01,000 --> 00:00:02,000\n" + "x".repeat(300_000) + "\n\n";
  api2.saveManualSubs("old1", chunk, "a.srt");
  api2.saveManualSubs("old2", chunk, "b.srt");
  api2.saveManualSubs("old3", chunk, "c.srt");
  api2.saveManualSubs("now", chunk, "d.srt");
  assert.equal(api2.manualSubs("now") !== null, true, "the current song survives");
  assert.equal(api2.manualSubs("old1"), null, "the oldest entry was evicted");
  assert.ok(sb2.store.get("trk_subs_v1").length <= api2.limits.storeBytes, "store stays within the cap");
  /* 保存先は trk_subs_v1 */
  assert.ok(sb.store.has(api.SUBS_KEY) && api.SUBS_KEY === "trk_subs_v1");
  /* 字幕なし・読めないファイル */
  assert.equal(await api.resolveSubs({ key: "k3" }), null);
  assert.equal(await api.resolveSubs(null), null);
});

test("readSubsFile(): ok / tooBig / empty / unreadable", async () => {
  const api = subsVm().window.Trk.subtitles;
  const okFile = { name: "a.srt", size: 60, text: async () => srtOf(1) };
  const r = await api.readSubsFile(okFile);
  assert.ok(r.ok && r.ok.cues.length === 1 && typeof r.text === "string");
  const big = { name: "b.srt", size: api.limits.entryBytes + 1, text: async () => "" };
  assert.deepEqual((await api.readSubsFile(big)).error, "tooBig");
  assert.deepEqual((await api.readSubsFile({ name: "c.srt", size: 10, text: async () => "no timings" })).error, "empty");
  assert.deepEqual((await api.readSubsFile({ name: "d.srt", size: 10, text: async () => { throw new Error("x"); } })).error, "unreadable");
  assert.deepEqual((await api.readSubsFile(null)).error, "unreadable");
});

test("attachTrack()/detachTrack(): one managed <track> with a blob WebVTT (for picture-in-picture)", () => {
  const sb = subsVm();
  const api = sb.window.Trk.subtitles;
  const video = fakeVideo();
  const cues = [{ start: 1, end: 2, text: "PiP line" }];
  assert.equal(api.attachTrack(video, cues, 500, "movie.srt"), true);
  const t = video.kids[0];
  assert.equal(t.tag, "track");
  assert.equal(t.kind, "subtitles");
  assert.equal(t.label, "movie.srt");
  assert.equal(t.dataset.trkSubs, "1");
  assert.equal(t.src, "blob:subs1");
  /* 付け直すときは古いのが消えて URL も返上する（1本だけ管理） */
  assert.equal(api.attachTrack(video, cues, 0, "other.vtt"), true);
  assert.equal(t.removed, true);
  assert.deepEqual(sb.revoked, ["blob:subs1"]);
  assert.equal(video.kids[1].label, "other.vtt");
  api.detachTrack(video);
  assert.equal(video.kids[1].removed, true);
  assert.deepEqual(sb.revoked, ["blob:subs1", "blob:subs2"]);
  assert.equal(api.attachTrack(video, [], 0, "x"), false, "no cues → nothing attached");
  /* 読み取り専用：書き戻し経路が無い */
  assert.ok(!subsSrc.includes("createWritable"));
});

/* ---------- ③ 配線の走査 ---------- */
test("wiring: folder pickup, media-player panel + overlay + hooks (four languages), video-max overlay, script order, css, cache", () => {
  /* library.js：フォルダのスキャンが .srt/.vtt を集めて it.subsFile に付ける（📁 開く／📤 共有の両方） */
  assert.ok(librarySrc.includes('} else if (lower.endsWith(".srt") || lower.endsWith(".vtt")) {'), "ingestFolder collects sidecar subtitles");
  assert.ok(librarySrc.includes("if (!subs[k] || lower.endsWith(\".vtt\")) subs[k] = file;"), ".vtt wins when both exist");
  assert.ok(librarySrc.includes("it.subsFile = subs[it.dir + \"/\" + it.base] || null"), "sidecar is attached to the song");
  assert.ok(librarySrc.includes('n.endsWith(".srt") || n.endsWith(".vtt")'), "the recursive picker collects them too");
  /* media-player-mode.js：パネル・オーバーレイ・フック */
  assert.ok(playerSrc.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)"), "panel sits right after the lyrics panel");
  assert.ok(playerSrc.includes("stageWrap.append(stageCanvas, subsOverlay, stageNote)"), "overlay lives on the video stage");
  assert.ok(playerSrc.includes("renderSubsOverlay();"), "overlay updates on the 250ms media tick");
  assert.ok(playerSrc.includes("if (lyricsBoxOpen()) loadLyrics(); loadSubs(true); });"), "song changes reload subtitles (even with the panel closed)");
  assert.ok(playerSrc.includes("subsBox.hidden = !subsAllowed();"), "the panel shows only for video songs");
  assert.ok(playerSrc.includes("api.attachTrack(core.video, d.cues, d.offsetMs"), "PiP track is attached with the delay baked in");
  assert.ok(playerSrc.includes("if (reverseActive || reverseLoading || !core.videoReady) {"), "overlay hides during reverse playback");
  for (const key of ["mediaSubsTitle:", "mediaSubsHint:", "mediaSubsNone:", "mediaSubsChoose:", "mediaSubsClear:", "mediaSubsOn:", "mediaSubsOffset:", "mediaSubsEarlier:", "mediaSubsLater:", "mediaSubsOffsetNow:"]) {
    assert.equal((playerSrc.match(new RegExp(key, "g")) || []).length, 4, `${key} in all four languages`);
  }
  /* video-max.js：全画面でも同じオーバーレイ */
  assert.ok(videoMaxSrc.includes("stage.append(canvas, subsNode, noteNode)"));
  assert.ok(videoMaxSrc.includes('api.currentTexts(videoEl.currentTime || 0).join("\\n")'), "fullscreen paint shows the active cues");
  /* index.html：lyrics.js の直後（media-player-mode より前） */
  const iLyrics = htmlSrc.indexOf('<script src="js/lyrics.js">');
  const iSubs = htmlSrc.indexOf('<script src="js/subtitles.js">');
  const iJudge = htmlSrc.indexOf('<script src="js/judge-match.js">');
  assert.ok(iLyrics >= 0 && iSubs > iLyrics && iSubs < iJudge, "subtitles.js loads after lyrics.js");
  /* css と sw */
  assert.ok(cssSrc.includes(".mediaSubs{") && cssSrc.includes(".videoMaxSubs{") && cssSrc.includes(".mediaSubsBox{"), "overlay + panel styles");
  assert.ok(cssSrc.includes("pointer-events:none"), "the overlay never eats clicks");
  assert.match(swSrc, /^const CACHE = "trk-v[\d.]+-trk\d+";$/m);   /* 版数は固定しない（次のリリースで割れるため） */
});
