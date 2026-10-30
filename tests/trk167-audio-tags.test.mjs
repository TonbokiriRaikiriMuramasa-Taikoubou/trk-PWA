// SPDX-License-Identifier: GPL-3.0-or-later
/* trk167: 🏷 埋め込みテキストタグ（ID3 TIT2/TPE1/TALB/TPE2/TRCK/TCON・MP4 ©nam/©ART/©alb/aART/trkn/©gen・
   FLAC/Ogg の TITLE/ARTIST/…）の読み取りと、表示名の優先順（ユーザー設定名→タグ→カタログ曲名→ファイル名）のテスト。
   audio-art.js は実ファイル全体を vm で実行し、合成バイナリから実際に読む。
   タグは読み取り専用：書き戻し経路（createWritable 等）が無いことも確認する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const artSrc = fs.readFileSync(`${ROOT}/js/audio-art.js`, "utf8");
const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const htmlSrc = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

/* ---------- 合成バイナリの道具 ---------- */
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
const textFrame = (text, encoding = 3) => encoding === 3
  ? concatBytes(new Uint8Array([3]), bytesOf(text))
  : concatBytes(new Uint8Array([1, 0xff, 0xfe]), utf16leOf(text));
function mp4File(items) {
  /* items: [[boxType, dataKind, payloadBytes]] */
  const box = (type, payload) => {
    const t = new Uint8Array(4);
    for (let i = 0; i < 4; i++) t[i] = type.charCodeAt(i) & 0xff;
    return concatBytes(u32be(8 + payload.length), t, payload);
  };
  let ilst = new Uint8Array(0);
  for (const [type, kind, payload] of items) {
    ilst = concatBytes(ilst, box(type, box("data", concatBytes(u32be(kind), u32be(0), payload))));
  }
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

/* ---------- extractTags ---------- */
test("extractTags(): ID3 v2.3/v2.4 text frames in UTF-8 and UTF-16, track 4/12", async () => {
  const api = artVm();
  const tags = await api.extractTags(id3File([
    { id: "TIT2", body: textFrame("  Song Name  ") },
    { id: "TPE1", body: textFrame("Artist 名前", 1) },
    { id: "TALB", body: textFrame("Album") },
    { id: "TPE2", body: textFrame("Album Artist") },
    { id: "TRCK", body: textFrame("4/12") },
    { id: "TCON", body: textFrame("J-Pop") },
    { id: "TXXX", body: textFrame("ignored") },
  ]));
  assert.equal(tags.title, "Song Name", "trimmed");
  assert.equal(tags.artist, "Artist 名前", "UTF-16 decodes");
  assert.equal(tags.album, "Album");
  assert.equal(tags.albumArtist, "Album Artist");
  assert.equal(tags.track, 4);
  assert.equal(tags.trackTotal, 12);
  assert.equal(tags.genre, "J-Pop");
  assert.equal(tags.xxx, undefined, "TXXX is not a display field");

  const v22 = await api.extractTags(id3File([
    { id: "TT2", body: textFrame("old title") },
    { id: "TP1", body: textFrame("old artist") },
    { id: "TRK", body: textFrame("7") },
  ], { version: 2 }));
  assert.equal(v22.title, "old title");
  assert.equal(v22.artist, "old artist");
  assert.equal(v22.track, 7);
  assert.ok(!("trackTotal" in v22), "a bare track number has no total");

  assert.equal(await api.extractTags(id3File([])), null, "no text frames → null");
  assert.equal(await api.extractTags(id3File([{ id: "TIT2", body: textFrame("   ") }])), null, "blank-only tags → null");
  assert.equal(await api.extractTags(fileFrom(new Uint8Array(64), "song.mp3")), null, "no ID3 → null");
  assert.equal(await api.extractTags(fileFrom(new Uint8Array(64), "notes.txt")), null, "unknown extension → null");
  const long = await api.extractTags(id3File([{ id: "TIT2", body: textFrame("y".repeat(500)) }]));
  assert.equal(long.title.length, 200, "display text is capped");
  const wav = await api.extractTags(id3File([{ id: "TIT2", body: textFrame("wav tag") }], { name: "rec.wav" }));
  assert.equal(wav.title, "wav tag");
});

test("extractTags(): MP4 ©nam/©ART/©alb/aART/©gen and the binary trkn box", async () => {
  const api = artVm();
  const tags = await api.extractTags(mp4File([
    ["\xA9nam", 1, bytesOf("MP4 Song")],
    ["\xA9ART", 1, bytesOf("MP4 Artist")],
    ["\xA9alb", 1, bytesOf("MP4 Album")],
    ["aART", 1, bytesOf("MP4 Album Artist")],
    ["\xA9gen", 1, bytesOf("Rock")],
    ["trkn", 0, new Uint8Array([0, 0, 0, 3, 0, 10, 0, 0])],
  ]));
  assert.equal(tags.title, "MP4 Song");
  assert.equal(tags.artist, "MP4 Artist");
  assert.equal(tags.album, "MP4 Album");
  assert.equal(tags.albumArtist, "MP4 Album Artist");
  assert.equal(tags.genre, "Rock");
  assert.equal(tags.track, 3);
  assert.equal(tags.trackTotal, 10);

  const empty = await api.extractTags(mp4File([]));
  assert.equal(empty, null, "an ilst without known boxes → null");
});

test("extractTags(): FLAC / Ogg Vorbis / Opus comments, case-insensitive keys", async () => {
  const api = artVm();
  const flac = await api.extractTags(flacFile(["TITLE=Flac Song", "artist=Flac Artist", "ALBUM=Flac Album", "TRACKNUMBER=5/9", "GENRE=Ambient"]));
  assert.equal(flac.title, "Flac Song");
  assert.equal(flac.artist, "Flac Artist", "keys are matched case-insensitively");
  assert.equal(flac.album, "Flac Album");
  assert.equal(flac.track, 5);
  assert.equal(flac.trackTotal, 9);
  assert.equal(flac.genre, "Ambient");

  const ogg = await api.extractTags(oggFile(concatBytes(new Uint8Array([3]), bytesOf("vorbis"), vorbisComment(["TITLE=Ogg Song", "TRACKNUMBER=2", "TRACKTOTAL=8"])), "song.ogg"));
  assert.equal(ogg.title, "Ogg Song");
  assert.equal(ogg.track, 2);
  assert.equal(ogg.trackTotal, 8, "TRACKTOTAL fills the total when TRACKNUMBER has none");

  const opus = await api.extractTags(oggFile(concatBytes(bytesOf("OpusTags"), vorbisComment(["TITLE=Opus Song"])), "song.opus"));
  assert.equal(opus.title, "Opus Song");

  const junk = await api.extractTags(flacFile(["TRACKNUMBER=abc", "TITLE="]));
  assert.equal(junk, null, "an unparsable track and an empty title leave nothing to show");
});

test("extract() and extractLyrics(): the art and lyrics paths still work after the tags refactor", async () => {
  const api = artVm();
  const jpeg = concatBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), new Uint8Array(60));
  const apic = concatBytes(new Uint8Array([0]), bytesOf("image/jpeg"), new Uint8Array([0]), new Uint8Array([3, 0]), jpeg);
  const blob = await api.extract(id3File([{ id: "APIC", body: apic }]));
  assert.ok(blob && blob.type === "image/jpeg", "front cover still comes back");
  const uslt = concatBytes(new Uint8Array([3]), bytesOf("eng"), new Uint8Array([0]), bytesOf("[00:01.00]still here"));
  const lyr = await api.extractLyrics(id3File([{ id: "USLT", body: uslt }]));
  assert.equal(lyr.text, "[00:01.00]still here", "lyrics path intact");
  const flacArt = await api.extractLyrics(flacFile(["LYRICS=flac lyric"]));
  assert.equal(flacArt.text, "flac lyric");
});

/* ---------- 表示名の優先順（library.js の実関数を vm で） ---------- */
function displayVm() {
  const grab = pattern => {
    const m = librarySrc.match(pattern);
    assert.ok(m, `can isolate ${pattern}`);
    return m[0];
  };
  const fnTagsOf = grab(/function songTagsOf\(it\) \{[^\n]*\}/);
  const fnTagField = grab(/function songTagField\(it, field\) \{[^\n]*\}/);
  const fnDisplay = grab(/function songDisplayTitle\(it, meta = metaOf\(it && it\.key\) \|\| \{\}\) \{[\s\S]*?\n\}/);
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(`
const songTags = new Map();
${fnTagsOf}
${fnTagField}
let metaOfResult = null, touhouResult = "";
function metaOf(key) { return metaOfResult; }
function touhouCatalogTitle(it) { return touhouResult; }
${fnDisplay}
window.__display = songDisplayTitle;
window.__tags = songTags;
window.__setMeta = m => { metaOfResult = m; };
window.__setTouhou = v => { touhouResult = v; };
`, sandbox, { filename: "js/library.js#display-title" });
  return sandbox.window;
}

test("songDisplayTitle(): user setting beats tag beats catalog beat the file name", () => {
  const api = displayVm();
  const it = { key: "100|file_name", title: "file_name", base: "file_name" };
  api.__tags.set(it.key, { title: "Tag Title", artist: "Tag Artist" });

  api.__setMeta(null); api.__setTouhou("");
  assert.equal(api.__display(it), "Tag Title", "the tag title replaces the raw file name");

  api.__setTouhou("Catalog Title");
  assert.equal(api.__display(it), "Tag Title", "the file's own tag outranks the catalog title");

  api.__tags.delete(it.key);
  assert.equal(api.__display(it), "Catalog Title", "without a tag the catalog title shows (Touhou MIDI etc.)");

  api.__setMeta({ title: "User Title" });
  api.__tags.set(it.key, { title: "Tag Title" });
  assert.equal(api.__display(it), "User Title", "the user's own choice always wins");

  api.__setMeta(null); api.__setTouhou(""); api.__tags.delete(it.key);
  assert.equal(api.__display(it), "file_name", "with nothing else, the file name shows as before");
  assert.equal(api.__display(null), "");
});

/* ---------- 配線（ソース走査） ---------- */
test("wiring: read-only tag pipeline, lazy loading, display hooks, exports", () => {
  assert.ok(artSrc.includes("extractTags,") && artSrc.includes("extractLyrics,"), "extractTags is exported");   /* ⚠ export 行の完全一致は trk170（extractChapters 追加）で割れるので名前だけで見る */
  assert.ok(artSrc.includes("tagText:MAX_TAG_TEXT"), "the tag text cap is in limits");
  assert.ok(artSrc.includes("ID3_TAG_FRAMES") && artSrc.includes("MP4_TAG_BOXES") && artSrc.includes("VORBIS_TAG_KEYS"), "all three tag vocabularies exist");
  assert.ok(!artSrc.includes("createWritable") && !librarySrc.includes("createWritable"), "no write-back path anywhere (tags are read-only)");

  assert.ok(librarySrc.includes("const songTags = new Map()"), "tags live in a bounded in-memory map");
  assert.ok(librarySrc.includes("return meta.title || songTagField(it, \"title\") || touhouCatalogTitle(it) || (it && it.title) || \"\""), "the display priority chain");
  assert.ok(librarySrc.includes("void loadSongTags(job.it)"), "rows load tags when they become visible");
  assert.ok(librarySrc.includes("if (canExtractSongArt(it)) void loadSongTags(it);"), "selecting a song loads its tags");
  assert.ok(librarySrc.includes("b.dataset.songKey = it.key"), "rows are addressable for in-place updates");
  assert.ok(librarySrc.includes("core.emit(\"songTags\", it)"), "late tag loads are announced");
  assert.ok(librarySrc.includes("window.songDisplayTitle = songDisplayTitle"), "the global the typeof-guards in favs/game/study/video-max look for");
  assert.ok(librarySrc.includes("songDisplayTitle, songDisplayMeta, songTagsOf, loadSongTags"), "Trk.library exports the tag helpers");
  assert.ok(librarySrc.includes("plNormTitle((metaOf(it.key) || {}).artist || it.artist)"), "catalog matching still uses the raw names — tags never change matching");
  assert.ok(librarySrc.includes("m.artist || (t && t.artist) || s.artist"), "the song-select banner shows tag artists");

  assert.ok(playerSrc.includes("function trackDisplayMeta(s)"), "the media player asks the library for display meta");
  assert.ok(playerSrc.includes("core.on(\"songTags\", () => { renderQueue(); if (mediaOpen) renderMedia(); })"), "queue and header follow late tag loads");
  assert.ok(playerSrc.includes("title:d.title || s.title || core.baseName(core.mediaName) || \"trk!\""), "Media Session (lock screen) uses the same display title");

  assert.ok(htmlSrc.includes('<script src="js/audio-art.js"></script>'), "audio-art.js still loaded");
  assert.ok(/^const CACHE = "trk-v[\d.]+-trk\d+";$/m.test(swSrc), "the worker cache name keeps its versioned shape");
});
