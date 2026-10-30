// SPDX-License-Identifier: GPL-3.0-or-later
/* trk170: 🔖 M4Bチャプター。chpl(Nero) ボックスの読み取り（js/audio-art.js・FFmpeg libavformat/mov.c の
   mov_read_chpl と同じ並び：version+flags → version≠0なら予約4バイト → 個数1バイト →
   項目[開始=8バイト big-endian の100ナノ秒・名前長=1バイト・UTF-8名]）と、
   library.js の MEDIA_EXT に m4b が入ったこと、プレーヤーの配線（4言語テキスト・チャプタースリープ）を確認する。
   チャプターは読み取り専用：書き戻し経路が無いことも確認する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const artSrc = fs.readFileSync(`${ROOT}/js/audio-art.js`, "utf8");
const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");

/* ---------- 合成バイナリの道具（trk167 と同じ流儀） ---------- */
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
const u64be = n => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return new Uint8Array(b); };
const box = (type, payload) => concatBytes(u32be(8 + payload.length), bytesOf(type), payload);
/* chpl(Nero)：entries = [[開始秒, 名前]]。version 1 は予約4バイトが増える（実在する bento4 出力の形） */
function chplBox(entries, version = 0) {
  const head = concatBytes(new Uint8Array([version, 0, 0, 0]), version !== 0 ? new Uint8Array(4) : new Uint8Array(0),
    new Uint8Array([entries.length & 0xff]));
  let body = new Uint8Array(0);
  for (const [t, name] of entries) {
    const nb = bytesOf(name);
    body = concatBytes(body, u64be(Math.round(t * 10000000)), new Uint8Array([nb.length]), nb);
  }
  return box("chpl", concatBytes(head, body));
}
function m4bFile(entries, { version = 0, name = "book.m4b", wrapInUdta = true } = {}) {
  const chpl = chplBox(entries, version);
  const moov = wrapInUdta ? box("moov", box("udta", chpl)) : box("moov", chpl);   /* moov 直下の chpl も探す（再帰） */
  return fileFrom(concatBytes(box("ftyp", bytesOf("M4B ")), moov, new Uint8Array(16)), name);
}

/* ---------- extractChapters ---------- */
test("extractChapters(): chpl version 0 → [{t:秒, text}]（100ナノ秒の big-endian 換算）", async () => {
  const api = artVm();
  const chaps = await api.extractChapters(m4bFile([[0, "Introduction"], [65.5, "Chapter 1"], [3600, "Chapter 2"]]));
  assert.equal(chaps.length, 3);
  /* ⚠ vm 跨ぎのオブジェクトは deepEqual できない（プロトタイプ違い）のでフィールドごとに見る */
  assert.equal(chaps[0].t, 0);
  assert.equal(chaps[0].text, "Introduction");
  assert.ok(Math.abs(chaps[1].t - 65.5) < 1e-6, `65.5s ↔ 655000000×100ns, got ${chaps[1].t}`);
  assert.equal(chaps[2].text, "Chapter 2");
  assert.equal(chaps[2].t, 3600);
});

test("extractChapters(): version 1 は予約4バイトを飛ばして同じ結果", async () => {
  const api = artVm();
  const v0 = await api.extractChapters(m4bFile([[0, "A"], [30, "B"]], { version: 0 }));
  const v1 = await api.extractChapters(m4bFile([[0, "A"], [30, "B"]], { version: 1 }));
  assert.deepEqual(Array.from(v1).map(c => [c.t, c.text]), Array.from(v0).map(c => [c.t, c.text]));
});

test("extractChapters(): 空の名前は飛ばす・開始順に並べ替える・名前は UTF-8", async () => {
  const api = artVm();
  const chaps = await api.extractChapters(m4bFile([[120, "第三章"], [0, ""], [60, "第二章"]]));
  assert.equal(chaps.length, 2, "empty name skipped");
  assert.deepEqual(Array.from(chaps).map(c => c.text), ["第二章", "第三章"], "sorted by start");
  assert.deepEqual(Array.from(chaps).map(c => c.t), [60, 120]);
});

test("extractChapters(): moov 直下の chpl も見つかる（udta を挟まない置き方）", async () => {
  const api = artVm();
  const chaps = await api.extractChapters(m4bFile([[0, "Start"], [10, "Next"]], { wrapInUdta: false }));
  assert.equal(chaps.length, 2);
});

test("extractChapters(): 個数の上限は 255・86400 秒（24時間）超えの項目は飛ばす", async () => {
  const api = artVm();
  const many = [];
  for (let i = 0; i < 255; i++) many.push([i * 10, `C${i}`]);
  const capped = await api.extractChapters(m4bFile(many));
  assert.equal(capped.length, 255, "MAX_CHAPTERS=255（個数フィールドは1バイトなのでこれが実物の最大）");
  const far = await api.extractChapters(m4bFile([[0, "OK"], [90000, "Too far"]]));
  assert.equal(far.length, 1, "25時間の bogus タイムスタンプは捨てて、正常な項目だけ返す");
  assert.equal(far[0].text, "OK");
});

test("extractChapters(): chpl がない／MP4 ではない／対応外の拡張子は null", async () => {
  const api = artVm();
  const bare = fileFrom(concatBytes(box("ftyp", bytesOf("M4B ")), box("moov", box("udta", new Uint8Array(0)))), "book.m4b");
  assert.equal(await api.extractChapters(bare), null, "no chpl box");
  assert.equal(await api.extractChapters(m4bFile([[0, "A"]], { name: "song.mp3" })), null, "ext gate: mp3");
  assert.equal(await api.extractChapters(m4bFile([[0, "A"]], { name: "song.flac" })), null, "ext gate: flac");
  const notMp4 = fileFrom(concatBytes(bytesOf("fLaC"), new Uint8Array(64)), "book.m4b");
  assert.equal(await api.extractChapters(notMp4), null, "no ftyp header");
});

test("extractChapters(): m4a/mp4/mov も対象（オーディオブックは m4a 拡張子のことがある）", async () => {
  const api = artVm();
  for (const name of ["book.m4a", "clip.mp4", "movie.mov"]) {
    const chaps = await api.extractChapters(m4bFile([[0, "A"], [5, "B"]], { name }));
    assert.equal(chaps.length, 2, `${name} parses`);
  }
});

test("extractChapters(): 長い名前は MAX_TAG_TEXT(200) で切り詰め・壊れた個数宣言でも例外を投げない", async () => {
  const api = artVm();
  const long = await api.extractChapters(m4bFile([[0, "x".repeat(232)]]));
  assert.equal(long.length, 1);
  assert.ok(long[0].text.length <= 200, "clamped to MAX_TAG_TEXT");
  const junk = fileFrom(concatBytes(box("ftyp", bytesOf("M4B ")), box("moov", box("udta",
    concatBytes(u32be(8 + 6), bytesOf("chpl"), new Uint8Array([0, 0, 0, 0, 5, 0]))))), "junk.m4b");
  assert.equal(await api.extractChapters(junk), null, "count=5 but no entries → null, no throw");
});

test("audio-art.js: チャプターは読み取り専用（書き戻し・送信の経路が無い）", () => {
  assert.ok(!artSrc.includes("createWritable"), "no write-back");
  assert.ok(artSrc.includes("chapters:MAX_CHAPTERS"), "documented hard cap in limits");
});

/* ---------- library.js / プレーヤーの配線 ---------- */
test("library.js: MEDIA_EXT に m4b が入った（オーディオブックのフォルダが取込の対象に）", () => {
  assert.match(librarySrc, /const MEDIA_EXT = \[[^\]]*"m4b"[^\]]*\]/);
  const m = librarySrc.match(/const MEDIA_EXT = \[([^\]]*)\]/);
  const exts = m[1].split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean);
  /* 並びは問わない（trk195 が .mkv/.mpg/.mpeg を足した）。m4b と既存の音声が残っていることだけ見る */
  for (const ext of ["mp4", "m4a", "m4b", "mp3", "ogg", "oga", "opus", "wav", "webm", "flac", "aac", "mov", "mid", "midi"])
    assert.ok(exts.includes(ext), `${ext} stays in MEDIA_EXT`);
  assert.ok(!exts.includes("srt") && !exts.includes("vtt"), "subtitle files stay out of MEDIA_EXT (they ride it.subsFile)");
});

test("media-player-mode.js: 🔖 チャプターの配線（パネル・スリープ・4言語テキスト）", () => {
  /* パネルとダイアログの並び */
  assert.ok(playerSrc.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)"));
  for (const fn of ["function chapsAllowed()", "async function ensureChapters()", "async function loadChapters(",
    "function renderChapters()", "function renderChaptersActive()", "function chapterIndexAt(",
    "function seekToChapter(t)", "function stepChapter(delta)", "function checkChapterSleep()"]) {
    assert.ok(playerSrc.includes(fn), `missing ${fn}`);
  }
  /* 💤 スリープの「チャプターの終わりで止める」（-2）と、曲の終わり（-1）が併存 */
  assert.ok(playerSrc.includes('o.value = "chapter"'), "sleep option exists");
  assert.ok(playerSrc.includes("Number(minutes) === -2"), "setSleep chapter branch");
  assert.ok(playerSrc.includes('sleepNode.value === "chapter" ? -2'), "change handler maps chapter → -2");
  assert.ok(playerSrc.includes("sleepChapterEnd"), "chapter sleep end state");
  /* 250ms tick に相乗り */
  assert.ok(playerSrc.includes("renderChaptersActive();"), "highlight rides the tick");
  assert.ok(playerSrc.includes("checkChapterSleep();"), "sleep watcher rides the tick");
  /* 4言語テキスト */
  for (const key of ["mediaChapTitle:", "mediaChapHint:", "mediaChapNone:", "mediaChapLoading:", "mediaChapCount:",
    "mediaChapNow:", "mediaChapPrev:", "mediaChapNext:", "mediaSleepChapter:", "mediaSleepChapterSet:", "mediaSleepChapterNone:"]) {
    const n = (playerSrc.match(new RegExp(key.replace(":", ":"), "g")) || []).length;
    assert.equal(n, 4, `${key} in 4 languages`);
  }
  /* 曲が変わったら読み直し（歌詞/字幕の行とは別の購読） */
  assert.ok(playerSrc.includes('on("songSelected", () => { loadChapters(true); });'));
});
