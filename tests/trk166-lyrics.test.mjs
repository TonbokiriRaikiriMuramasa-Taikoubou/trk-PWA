// SPDX-License-Identifier: GPL-3.0-or-later
/* trk166: 🎤 歌詞（LRC パーサ・埋め込み歌詞の読み取り・優先順）のテスト。
   js/lyrics.js と js/audio-art.js は**実ファイル全体を vm で実行**して、合成したバイナリ
   （ID3 USLT/SYLT/ULT・MP4 ©lyr・FLAC/Ogg LYRICS）から実際に読み出せるところまで見る。
   歌詞は読み取り専用：書き戻しの経路が無いこともソース走査で確認する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const lyricsSrc = fs.readFileSync(`${ROOT}/js/lyrics.js`, "utf8");
const artSrc = fs.readFileSync(`${ROOT}/js/audio-art.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const htmlSrc = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;

/* ---------- js/lyrics.js 全体を vm で ---------- */
function lyricsVm({ embedded = null } = {}) {
  const store = new Map();
  const sandbox = {
    window: {},
    localStorage: {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); },
    },
    console: { error() {} },
  };
  sandbox.window.Trk = { media: { audioArt: { extractLyrics: async () => embedded } } };
  vm.createContext(sandbox);
  vm.runInContext(lyricsSrc, sandbox, { filename: "js/lyrics.js" });
  return { api: sandbox.window.Trk.lyrics, store };
}

test("parseLrc(): stamps, multiple stamps per line, offsets, metadata and inline tags", async () => {
  const { api } = lyricsVm();
  const basic = api.parseLrc("[00:01.50]first line\n[00:03]second\n[01:02.345]third");
  assert.equal(basic.synced, true);
  assert.deepEqual(Array.from(basic.lines.map(l => l.t)), [1.5, 3, 62.345]);
  assert.deepEqual(Array.from(basic.lines.map(l => l.text)), ["first line", "second", "third"]);

  const multi = api.parseLrc("[00:10.00][00:20.00]chorus");
  assert.deepEqual(Array.from(multi.lines.map(l => l.t)), [10, 20], "a chorus line stamped twice appears twice");

  const unsorted = api.parseLrc("[00:05.00]later\n[00:02.00]earlier");
  assert.deepEqual(Array.from(unsorted.lines.map(l => l.text)), ["earlier", "later"], "sorted by time");

  const offsetUp = api.parseLrc("[offset:+500]\n[00:01.00]x");
  assert.equal(offsetUp.lines[0].t, 0.5, "[offset:+N] shifts N ms earlier (LRC spec)");
  const offsetDown = api.parseLrc("[offset:-500]\n[00:00.20]x");
  assert.equal(offsetDown.lines[0].t, 0.7);
  const offsetClamp = api.parseLrc("[offset:+5000]\n[00:01.00]x");
  assert.equal(offsetClamp.lines[0].t, 0, "never goes below zero");

  const meta = api.parseLrc("[ti:Title]\n[ar:Artist]\n[al:Album]\n[by:Someone]\n[xx:junk]\n[00:01.00]body");
  assert.equal(meta.meta.title, "Title");
  assert.equal(meta.meta.artist, "Artist");
  assert.equal(meta.lines.length, 1, "known ID tags are consumed; the untimed rest is dropped in synced lyrics");

  const verse = api.parseLrc("[Intro:soft]\nplain body");
  assert.deepEqual(Array.from(verse.lines.map(l => l.text)), ["[Intro:soft]", "plain body"], "unknown bracket lines stay as lyrics");

  const colonFrac = api.parseLrc("[00:01:25]colon fraction");
  assert.equal(colonFrac.lines[0].t, 1.25, "[mm:ss:xx] is accepted too");

  const extended = api.parseLrc("[00:01.00]word<00:01.20>by<00:01.40>word");
  assert.equal(extended.lines[0].text, "word by word", "inline word timings are stripped to the line text");

  const plain = api.parseLrc("just text\nsecond line\n");
  assert.equal(plain.synced, false);
  assert.deepEqual(Array.from(plain.lines.map(l => l.t)), [null, null]);
  assert.deepEqual(Array.from(plain.lines.map(l => l.text)), ["just text", "second line"]);

  const instrumental = api.parseLrc("[00:12.00]\n[00:15.00]back");
  assert.equal(instrumental.lines[0].text, "", "an empty timed line stays as a marker");

  const crlf = api.parseLrc("\uFEFF[00:01.00]bom and crlf\r\n[00:02.00]second\r\n");
  assert.equal(crlf.lines.length, 2);

  assert.equal(api.parseLrc("").lines.length, 0);
  assert.equal(api.parseLrc(null).lines.length, 0);

  const spam = Array.from({ length: 60 }, (_, i) => `[00:${String(i % 60).padStart(2, "0")}.00]`).join("") + "x";
  const guarded = api.parseLrc(spam);
  assert.equal(guarded.lines.length, 50, "stamps per line are capped at 50");
});

test("activeLineIndex(): binary search over the sorted lines", async () => {
  const { api } = lyricsVm();
  const { lines } = api.parseLrc("[00:01.00]a\n[00:05.00]b\n[00:10.00]c");
  assert.equal(api.activeLineIndex(lines, 0.5), -1, "before the first line");
  assert.equal(api.activeLineIndex(lines, 1), 0, "exactly on a stamp");
  assert.equal(api.activeLineIndex(lines, 4.9), 0);
  assert.equal(api.activeLineIndex(lines, 5), 1);
  assert.equal(api.activeLineIndex(lines, 999), 2, "after the end stays on the last line");
  assert.equal(api.activeLineIndex(lines, NaN), -1);
  assert.equal(api.activeLineIndex([], 5), -1);
  assert.equal(api.activeLineIndex(null, 5), -1);
});

test("normalizeLyrics(): strings, {text} and SYLT {lines} all land in one shape", async () => {
  const { api } = lyricsVm();
  const fromString = api.normalizeLyrics("[00:01.00]hi");
  assert.equal(fromString.synced, true);
  const fromText = api.normalizeLyrics({ text: "[00:02.00]embedded lrc" });
  assert.equal(fromText.lines[0].t, 2, "embedded USLT holding LRC text becomes synced");
  const plainText = api.normalizeLyrics({ text: "static lyrics" });
  assert.equal(plainText.synced, false);
  const sylt = api.normalizeLyrics({ lines: [{ t: 3, text: "b" }, { t: 1.5, text: "a" }] });
  assert.equal(sylt.synced, true);
  assert.deepEqual(Array.from(sylt.lines.map(l => l.t)), [1.5, 3], "SYLT lines get sorted");
  assert.equal(api.normalizeLyrics({ lines: [] }), null);
  assert.equal(api.normalizeLyrics({ text: "   " }), null);
  assert.equal(api.normalizeLyrics(null), null);
  assert.equal(api.normalizeLyrics({}), null);
});

test("manual lyrics store: save, load, clear and eviction past the total cap", async () => {
  const { api, store } = lyricsVm();
  assert.equal(api.manualLyrics("k1"), null);
  assert.equal(api.saveManualLyrics("k1", "[00:01.00]first", "one.lrc"), true);
  const entry = api.manualLyrics("k1");
  assert.ok(entry && entry.name === "one.lrc" && entry.text.includes("first"));
  assert.ok(store.has(api.LYRICS_KEY), "stored under trk_lyrics_v1");

  const huge = "x".repeat(300 * 1024);   /* 1曲ぶんは 256KB に切られる */
  api.saveManualLyrics("k2", huge, "two.lrc");
  assert.equal(api.manualLyrics("k2").text.length, 256 * 1024, "clipped to the per-song cap");
  api.saveManualLyrics("k3", huge, "three.lrc");   /* 合計 512KB を超える → 古い k2 が追い出される */
  api.saveManualLyrics("k4", "fourth", "four.lrc");
  const raw = JSON.parse(store.get(api.LYRICS_KEY));
  assert.equal(raw.k4.text, "fourth", "the newest always survives");
  assert.ok(raw.k3, "the song just saved survives its own eviction pass");
  assert.ok(!("k1" in raw) && !("k2" in raw), "the oldest entries are evicted past the total cap");

  api.clearManualLyrics("k4");
  assert.equal(api.manualLyrics("k4"), null);
  assert.equal(api.saveManualLyrics("", "x", ""), false, "no key, no save");
  assert.equal(api.saveManualLyrics("k9", "   ", ""), false, "blank lyrics are refused");
});

test("resolveLyrics(): manual beats folder .lrc beats embedded tags", async () => {
  const folderFile = { name: "song.lrc", size: 40, text: async () => "[00:01.00]from folder" };
  const song = { key: "100|song", file: { name: "song.mp3" }, lyricsFile: folderFile };

  const embeddedOnly = lyricsVm({ embedded: { text: "embedded lyric" } });
  const r1 = await embeddedOnly.api.resolveLyrics(song);
  assert.equal(r1.source, "folder", "the same-named .lrc wins over embedded tags");
  assert.equal(r1.lines[0].text, "from folder");
  assert.equal(r1.name, "song.lrc");

  const noFolder = lyricsVm({ embedded: { text: "embedded lyric" } });
  const r2 = await noFolder.api.resolveLyrics({ key: "k", file: { name: "s.mp3" } });
  assert.equal(r2.source, "embedded");

  const withManual = lyricsVm({ embedded: { text: "embedded lyric" } });
  withManual.api.saveManualLyrics("100|song", "[00:02.00]manual wins", "chosen.lrc");
  const r3 = await withManual.api.resolveLyrics(song);
  assert.equal(r3.source, "manual");
  assert.equal(r3.lines[0].text, "manual wins");

  const tooBig = lyricsVm({ embedded: { text: "embedded lyric" } });
  const r4 = await tooBig.api.resolveLyrics({ key: "k", file: {}, lyricsFile: { name: "huge.lrc", size: 999 * 1024, text: async () => "x" } });
  assert.equal(r4.source, "embedded", "an oversized .lrc is skipped instead of read");

  const none = lyricsVm({ embedded: null });
  assert.equal(await none.api.resolveLyrics({ key: "k", file: {} }), null);
  assert.equal(await none.api.resolveLyrics(null), null);
});

test("readLyricsFile(): rejects huge, broken and empty files with honest errors", async () => {
  const { api } = lyricsVm();
  const ok = await api.readLyricsFile({ text: async () => "[00:01.00]hello", size: 20 });
  assert.ok(ok.ok && ok.ok.lines.length === 1 && ok.text.includes("hello"));
  const tooBig = await api.readLyricsFile({ text: async () => "x", size: 300 * 1024 });
  assert.equal(tooBig.error, "tooBig");
  const broken = await api.readLyricsFile({ text: async () => { throw new Error("gone"); }, size: 10 });
  assert.equal(broken.error, "unreadable");
  const empty = await api.readLyricsFile({ text: async () => "  \n ", size: 3 });
  assert.equal(empty.error, "empty");
  assert.equal((await api.readLyricsFile(null)).error, "unreadable");
});

/* ---------- js/audio-art.js 全体を vm で：合成バイナリから埋め込み歌詞を読む ---------- */
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
function fileFrom(bytes, name) { return new File([bytes], name, { type: "application/octet-stream" }); }
function syncsafe(n) { return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]; }
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
  parts.push(new Uint8Array(32));   /* 本体のダミー（file.size の下限対策） */
  return fileFrom(concatBytes(...parts), name);
}
function u32be(n) { return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]); }
function u32le(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]); }
function usltBody(text, { encoding = 3 } = {}) {
  if (encoding === 3) return concatBytes(new Uint8Array([3]), bytesOf("eng"), new Uint8Array([0]), bytesOf(text));
  const chars = [0xff, 0xfe];   /* BOM + UTF-16LE */
  for (const ch of text) { const c = ch.codePointAt(0); chars.push(c & 0xff, (c >> 8) & 0xff); }
  return concatBytes(new Uint8Array([1]), bytesOf("eng"), new Uint8Array([0, 0]), new Uint8Array(chars));
}
function utf16leOf(s) {
  const out = [];
  for (const ch of s) { const c = ch.codePointAt(0); out.push(c & 0xff, (c >> 8) & 0xff); }
  return new Uint8Array(out);
}
function syltBody(entries, { encoding = 3, format = 2 } = {}) {
  const parts = [new Uint8Array([encoding]), bytesOf("eng"), new Uint8Array([format, 1, 0])];
  if (encoding === 1) parts[2] = new Uint8Array([format, 1, 0, 0]);   /* UTF-16 の説明終端は2バイト */
  for (const [ms, text] of entries) {
    parts.push(encoding === 1 ? utf16leOf(text) : bytesOf(text), encoding === 1 ? new Uint8Array([0, 0]) : new Uint8Array([0]), u32be(ms));
  }
  return concatBytes(...parts);
}

test("extractLyrics(): ID3 USLT (UTF-8 and UTF-16), v2.2 ULT, and LRC inside USLT", async () => {
  const api = artVm();
  const utf8 = await api.extractLyrics(id3File([{ id: "USLT", body: usltBody("hello\nworld") }]));
  assert.equal(utf8.text, "hello\nworld");

  const utf16 = await api.extractLyrics(id3File([{ id: "USLT", body: usltBody("line one", { encoding: 1 }) }]));
  assert.equal(utf16.text, "line one", "UTF-16 with BOM decodes");

  const v22 = await api.extractLyrics(id3File([{ id: "ULT", body: usltBody("old tag") }], { version: 2 }));
  assert.equal(v22.text, "old tag", "ID3v2.2 ULT works too");

  const lrcInUslt = await api.extractLyrics(id3File([{ id: "USLT", body: usltBody("[00:01.00]timed inside a tag") }]));
  const { api: lyrics } = lyricsVm();
  const normalized = lyrics.normalizeLyrics(lrcInUslt);
  assert.equal(normalized.synced, true, "USLT text holding LRC stamps becomes synced lyrics");

  assert.equal(await api.extractLyrics(id3File([])), null, "no lyrics frames → null");
  assert.equal(await api.extractLyrics(fileFrom(new Uint8Array(64), "song.mp3")), null, "no ID3 → null");
  const broken16 = id3File([{ id: "USLT", body: concatBytes(new Uint8Array([1]), bytesOf("eng"), bytesOf("no terminator")) }]);
  assert.equal(await api.extractLyrics(broken16), null, "a UTF-16 frame without terminators is refused, not garbled");
});

test("extractLyrics(): SYLT timed lines win over USLT and MIDI-format SYLT is skipped", async () => {
  const api = artVm();
  const sylt = await api.extractLyrics(id3File([{ id: "SYLT", body: syltBody([[3000, "second"], [1500, "first"]]) }]));
  assert.deepEqual(Array.from(sylt.lines.map(l => l.t)), [1.5, 3], "SYLT lines are sorted and in seconds");
  assert.deepEqual(Array.from(sylt.lines.map(l => l.text)), ["first", "second"]);

  const both = await api.extractLyrics(id3File([
    { id: "USLT", body: usltBody("plain fallback") },
    { id: "SYLT", body: syltBody([[1000, "timed wins"]]) },
  ]));
  assert.ok(both.lines, "SYLT is preferred over USLT");

  const midi = await api.extractLyrics(id3File([{ id: "SYLT", body: syltBody([[120, "midi ticks"]], { format: 1 }) }]));
  assert.equal(midi, null, "MIDI-tick SYLT can't become seconds without tempo → skipped");

  const utf16Sylt = await api.extractLyrics(id3File([{ id: "SYLT", body: syltBody([[2000, "wide text"]], { encoding: 1 }) }]));
  assert.equal(utf16Sylt.lines[0].text, "wide text", "UTF-16 SYLT entries decode");
});

test("extractLyrics(): MP4 ©lyr, FLAC LYRICS and Ogg/Opus comment lyrics", async () => {
  const api = artVm();
  /* MP4: ftyp + moov(udta(meta(fullbox)→ilst→©lyr→data(kind=1)))。
     ボックス名はバイト単位（© = 0xA9。UTF-8 にすると 2 バイトになって壊れる） */
  const box = (type, payload) => {
    const t = new Uint8Array(4);
    for (let i = 0; i < 4; i++) t[i] = type.charCodeAt(i) & 0xff;
    return concatBytes(u32be(8 + payload.length), t, payload);
  };
  const data = box("data", concatBytes(u32be(1), u32be(0), bytesOf("mp4 lyric text")));
  const lyr = box("\xA9lyr", data);
  const ilst = box("ilst", lyr);
  const meta = box("meta", concatBytes(new Uint8Array(4), ilst));   /* full box: version/flags */
  const udta = box("udta", meta);
  const moov = box("moov", udta);
  const ftyp = box("ftyp", bytesOf("isom"));
  const m4a = fileFrom(concatBytes(ftyp, moov, new Uint8Array(16)), "song.m4a");
  const mp4 = await api.extractLyrics(m4a);
  assert.equal(mp4.text, "mp4 lyric text");
  assert.equal(await api.extractLyrics(fileFrom(concatBytes(ftyp, box("moov", box("udta", box("meta", concatBytes(new Uint8Array(4), box("ilst", new Uint8Array(0)))))), new Uint8Array(16)), "song.m4a")), null, "no ©lyr → null");

  /* FLAC: fLaC + VORBIS_COMMENT(4)ブロック（最終ブロック） */
  const comment = t => concatBytes(u32le(4), bytesOf("trk!"), u32le(1), u32le(bytesOf(t).length), bytesOf(t));
  const flacPayload = comment("lyrics=[00:01.00]lowercase key works");
  const flac = fileFrom(concatBytes(bytesOf("fLaC"), new Uint8Array([0x84, (flacPayload.length >> 16) & 0xff, (flacPayload.length >> 8) & 0xff, flacPayload.length & 0xff]), flacPayload, new Uint8Array(16)), "song.flac");
  const fl = await api.extractLyrics(flac);
  assert.equal(fl.text, "[00:01.00]lowercase key works", "keys are matched case-insensitively");

  /* Ogg: 1ページ + vorbis コメントパケット（CRC は見ないので 0 でよい） */
  const oggFile = (packet, name) => {
    const header = concatBytes(bytesOf("OggS"), new Uint8Array([0, 0]), u32be(0), u32be(0), u32le(1), u32le(0), u32le(0), new Uint8Array([1, packet.length]));
    return fileFrom(concatBytes(header, packet, new Uint8Array(8)), name);
  };
  const vorbisPacket = concatBytes(new Uint8Array([3]), bytesOf("vorbis"), comment("UNSYNCEDLYRICS=ogg unsynced"));
  const ogg = await api.extractLyrics(oggFile(vorbisPacket, "song.ogg"));
  assert.equal(ogg.text, "ogg unsynced");
  const opusPacket = concatBytes(bytesOf("OpusTags"), comment("LYRICS=opus line"));
  const opus = await api.extractLyrics(oggFile(opusPacket, "song.opus"));
  assert.equal(opus.text, "opus line");
  assert.equal(await api.extractLyrics(oggFile(vorbisPacket, "song.txt")), null, "unknown extension → null");
});

test("extract(): the cover-art path still works after the lyrics refactor", async () => {
  const api = artVm();
  const jpeg = concatBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), new Uint8Array(60));   /* JPEG マジック + ダミー */
  const apic = concatBytes(new Uint8Array([0]), bytesOf("image/jpeg"), new Uint8Array([0]), new Uint8Array([3, 0]), jpeg);
  const blob = await api.extract(id3File([{ id: "APIC", body: apic }]));
  assert.ok(blob, "front cover still comes back");
  assert.equal(blob.type, "image/jpeg");
  assert.equal(await api.extract(id3File([{ id: "USLT", body: usltBody("lyrics are not art") }])), null, "extract() still returns art only");
});

/* ---------- 配線（ソース走査） ---------- */
test("wiring: script order, folder .lrc pickup, settings key, panel, four languages, cache bump", () => {
  const lyricsTag = '<script src="js/lyrics.js"></script>';
  assert.ok(htmlSrc.includes(lyricsTag), "lyrics.js is loaded");
  assert.ok(htmlSrc.indexOf(lyricsTag) > htmlSrc.indexOf('<script src="js/audio-art.js"></script>'), "after audio-art.js");
  assert.ok(htmlSrc.indexOf(lyricsTag) < htmlSrc.indexOf('<script src="js/library.js"></script>'), "before library.js");

  assert.ok(librarySrc.includes('it.lyricsFile = lyrics[it.dir + "/" + it.base] || null'), "folder songs get the same-named .lrc");
  assert.ok(librarySrc.includes('n.endsWith(".lrc")'), "the folder scan collects .lrc files");
  assert.ok(coreSrc.includes("mediaLyricsOpen: prefs.mediaLyricsOpen === true"), "the panel state is a setting");
  assert.equal((coreSrc.match(/settings\.mediaLyricsOpen = false/g) || []).length, 2, "both reset paths clear it");

  assert.ok(playerSrc.includes("renderLyrics();   /* 🎤"), "the 250ms tick renders lyrics");
  assert.ok(playerSrc.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)"), "the panel sits under the progress row (trk169: the 💬 panel follows it)");
  assert.ok(playerSrc.includes('lyricsFileNode.accept = ".lrc,.txt,text/plain"'), "manual lyrics picker accepts .lrc/.txt");
  assert.ok(playerSrc.includes("core.on(\"songSelected\", () => { renderMedia(); if (lyricsBoxOpen()) loadLyrics();"), "a new song reloads lyrics (the line may carry more followers)");
  assert.ok(playerSrc.includes("api.saveManualLyrics(song.key, r.text, file.name)"), "chosen lyrics persist per song");
  assert.ok(playerSrc.includes("seekToLyric(line.t)"), "clicking a synced line seeks");
  assert.ok(!playerSrc.includes("writeLyrics") && !lyricsSrc.includes("writable"), "lyrics are read-only — no write-back path");

  assert.ok(/audioArt = Object\.freeze\(\{[^}]*extractLyrics/.test(artSrc), "extractLyrics is exported");   /* export 行の完全一致は将来の追加で割れるので名前だけで見る */
  assert.ok(artSrc.includes("lyricsBytes:MAX_LYRICS_BYTES"), "the lyrics cap is documented in limits");
  assert.ok(artSrc.includes('type === "\\xA9lyr"'), "MP4 ©lyr marker");
  assert.ok(artSrc.includes("USLT") && artSrc.includes("SYLT") && artSrc.includes("UNSYNCEDLYRICS"), "ID3 and Vorbis lyric keys");

  assert.ok(cssSrc.includes(".mediaLyricsBox") && cssSrc.includes(".lyricLineActive") && cssSrc.includes("body.helpTextOff .mediaLyricsBox>.hint"), "panel styles exist");
  /* sw.js の cache 版数はリリースごとに進むので固定しない（check-repo の service-worker cache 見張りが担当） */
  assert.ok(/^const CACHE = "trk-v[\d.]+-trk\d+";$/m.test(swSrc), "the worker cache name keeps its versioned shape");

  for (const key of ["mediaLyricsTitle", "mediaLyricsHint", "mediaLyricsNone", "mediaLyricsLoading", "mediaLyricsSourceEmbedded", "mediaLyricsSourceFile", "mediaLyricsSourceManual", "mediaLyricsPlain", "mediaLyricsChoose", "mediaLyricsClear", "mediaLyricsSaved", "mediaLyricsTooBig", "mediaLyricsReadFailed", "mediaLyricsNeedSong"]) {
    assert.equal(count(playerSrc, `${key}:`), 4, `${key} exists in ja/en/zh/ko`);
  }
});
