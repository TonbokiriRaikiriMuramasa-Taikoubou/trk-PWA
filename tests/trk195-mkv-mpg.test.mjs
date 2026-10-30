// SPDX-License-Identifier: GPL-3.0-or-later
/* trk195: 🎞 .mkv（Matroska）と .mpg（MPEG-PS）を使えるようにする。
   ・拡張子の一覧（取込・曲追加・共有インボックス・ファイル選択）に .mkv/.mpg/.mpeg を加える
   ・ただし「取り込める＝再生できる」ではない。ブラウザーが中身のコーデックを持っていないことがあり、
     そのときは黙って「読み込めませんでした」ではなく、先頭だけ見て理由（形式・コーデック）を言う
   tests で確かめること：拡張子の一覧・probeContainer（合成した MKV/MPG/MP4 の先頭バイト）・
   理由の言葉（i18n 4言語）・type が空のファイルへの MIME 補助 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const mediaSrc = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const titleSrc = fs.readFileSync(`${ROOT}/js/title-match.js`, "utf8");

/* 下調べの一式（PROBE_BYTES 〜 explainLoadFailure まで）をそのまま VM で動かす。
   画面も <video> も要らない純関数だけなので、ここだけ切り出して検証できる。 */
const probeBlock = mediaSrc.slice(
  mediaSrc.indexOf("/* ---------- 🎞 コンテナとコーデックの下調べ"),
  mediaSrc.indexOf("/* ---------- 曲の読み込み ----------"),
);
const api = vm.runInNewContext(`${probeBlock}\n;({ probeContainer, explainProbe, mimeHintFor, withMimeHint, codecLabel })`, { File });

/* ---------- 合成した先頭バイト（EBML の最小の組み立て） ---------- */
const cat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0), out = new Uint8Array(total);
  let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const ascii = s => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
const size = n => n < 0x7f ? Uint8Array.of(0x80 | n)
  : n < 0x3fff ? Uint8Array.of(0x40 | (n >> 8), n & 0xff)
    : Uint8Array.of(0x20 | (n >> 16), (n >> 8) & 0xff, n & 0xff);
const el = (id, payload) => cat(Uint8Array.from(id), size(payload.length), payload);
const trackEntry = codecId => el([0xae], cat(el([0x83], Uint8Array.of(1)), el([0x86], ascii(codecId))));
const mkv = (codecs, docType = "matroska") => cat(
  el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], ascii(docType))),
  el([0x18, 0x53, 0x80, 0x67], el([0x16, 0x54, 0xae, 0x6b], cat(...codecs.map(trackEntry)))),
  /* 本体（ここから先は見ない） */
  new Uint8Array(64),
);
/* MPEG-PS：パックヘッダー（00 00 01 BA）＋映像（E0）＋音声（C0） */
const mpg = cat(Uint8Array.of(0, 0, 1, 0xba, 0x44, 0, 0x04, 0, 0x04, 0x01, 0, 0, 1),
  Uint8Array.of(0, 0, 1, 0xe0, 0x00, 0x30), new Uint8Array(32),
  Uint8Array.of(0, 0, 1, 0xc0, 0x00, 0x30), new Uint8Array(32));
const mp4 = cat(Uint8Array.of(0, 0, 0, 0x18), ascii("ftypisom"), new Uint8Array(64));

/* ---------- 拡張子の一覧 ---------- */
test("trk195: .mkv/.mpg are accepted for folder import and song adding", () => {
  const list = libSrc.match(/const MEDIA_EXT = \[[^\]]*\];/)[0];
  for (const ext of ["mkv", "mpg", "mpeg"]) assert.ok(list.includes(`"${ext}"`), `${ext} を MEDIA_EXT に`);
  const video = libSrc.match(/const VIDEO_EXT = \[[^\]]*\];/)[0];
  for (const ext of ["mkv", "mpg", "mpeg"]) assert.ok(video.includes(`"${ext}"`), `${ext} を VIDEO_EXT に`);
});

test("trk195: the file pickers and the shared-file router know the new extensions", () => {
  const videoInput = html.match(/id="videoFile"[^>]*/)[0];
  assert.ok(videoInput.includes(".mkv"), "🎬 動画を読み込む の accept に .mkv");
  assert.ok(videoInput.includes(".mpg"), "🎬 動画を読み込む の accept に .mpg");
  const mediaInput = html.match(/id="mediaFile"[^>]*/)[0];
  assert.ok(mediaInput.includes(".mkv") && mediaInput.includes(".mpg"), "＋ 曲ファイルを追加 の accept にも");
  /* share-inbox は lib.MEDIA_EXT / lib.VIDEO_EXT を参照するので、一覧に足せば共有シートからも届く */
  assert.ok(fs.readFileSync(`${ROOT}/js/share-inbox.js`, "utf8").includes("lib.VIDEO_EXT"));
  assert.ok(/\|mpg\|mpeg(?:\||\))/.test(titleSrc), "曲プロフィールの音/映像の見分けにも .mpg");
});

test("trk195: folder imports mark .mkv/.mpg as video (🎬) without probing every file", () => {
  assert.ok(/const VIDEO_ONLY_EXT = \[[^\]]*"mkv"[^\]]*"mpg"[^\]]*\]/.test(libSrc), "映像と決められる拡張子の一覧");
  assert.ok(/video:VIDEO_ONLY_EXT\.includes\(ext\)/.test(libSrc), "フォルダーの取り込みで使う");
});

/* ---------- 先頭バイトから形式を見分ける ---------- */
test("trk195: a Matroska file yields its container and codecs", () => {
  const r = api.probeContainer(mkv(["V_MPEG4/ISO/AVC", "A_AAC"]));
  assert.equal(r.container, "matroska");
  assert.deepEqual(Array.from(r.codecs), ["V_MPEG4/ISO/AVC", "A_AAC"]);
  assert.equal(api.probeContainer(mkv(["V_VP9"], "webm")).container, "webm", "DocType が webm なら WebM");
});

test("trk195: an .mpg is recognised as MPEG-PS, an MP4 is not mistaken for it", () => {
  assert.equal(api.probeContainer(mpg).container, "mpeg-ps");
  assert.equal(api.probeContainer(mp4).container, "mp4");
  assert.equal(api.probeContainer(new Uint8Array(0)).container, "unknown", "空でも落ちない");
  assert.equal(api.probeContainer(new Uint8Array(64)).container, "unknown");
});

/* ---------- 「なぜ再生できないか」の言葉 ---------- */
test("trk195: an MKV whose codecs the browser lacks names the codec", () => {
  const why = api.explainProbe(api.probeContainer(mkv(["V_MPEG2", "A_AC3"])), "mkv");
  assert.equal(why.key, "loadCodecUnsupported");
  assert.match(why.vars.codec, /MPEG-2 映像/);
  assert.match(why.vars.codec, /AC3/);
  assert.match(why.vars.container, /MKV/);
});

test("trk195: an MKV with playable codecs still explains the container problem", () => {
  const why = api.explainProbe(api.probeContainer(mkv(["V_VP9", "A_OPUS"])), "mkv");
  assert.equal(why.key, "loadContainerUnreadable");
  assert.match(why.vars.codec, /VP9・Opus/);
});

test("trk195: a plain .mpg gets its own explanation (no silent failure)", () => {
  const why = api.explainProbe(api.probeContainer(mpg), "mpg");
  assert.equal(why.key, "loadMpegPsUnsupported");
  assert.match(why.vars.container, /MPEG-PS/);
});

test("trk195: other failures keep the old generic message", () => {
  assert.equal(api.explainProbe(api.probeContainer(mp4), "mp4").key, "loadError");
  assert.equal(api.explainProbe(api.probeContainer(new Uint8Array(64)), "bin").key, "loadError");
  assert.equal(api.explainProbe(null, "mkv").key, "loadError");
});

test("trk195: the failure path actually asks the probe before saying anything", () => {
  assert.ok(/const why = await explainLoadFailure\(file\);/.test(mediaSrc), "読み込み失敗時に下調べする");
  assert.ok(/core\.setStatus\("loadStatus", why\.key, why\.vars\)/.test(mediaSrc), "理由をそのまま出す");
  assert.ok(/core\.setStatus\("loadStatus", "loadError"\)/.test(mediaSrc), "言えないときは今までどおり");
  assert.ok(/window\.Trk\.media = Object\.assign\(window\.Trk\.media \|\| \{\}, \{[^}]*probeContainer, withMimeHint/.test(mediaSrc), "library.js から使える公開名");
  assert.ok(/explainLoadFailure\(f\)/.test(libSrc), "🎬 動画として開けなかったときも理由を出す（library.js）");
});

/* ---------- type が空のファイル ---------- */
test("trk195: files with an empty type get a MIME hint from their extension", () => {
  assert.equal(api.mimeHintFor("movie.mkv"), "video/x-matroska");
  assert.equal(api.mimeHintFor("clip.MPG"), "video/mpeg");
  assert.equal(api.mimeHintFor("song.mp3"), "audio/mpeg");
  assert.equal(api.mimeHintFor("unknown.xyz"), "");
  const bare = new File([new Uint8Array(8)], "movie.mkv", { type:"" });
  const hinted = api.withMimeHint(bare);
  assert.equal(hinted.type, "video/x-matroska");
  assert.equal(hinted.name, "movie.mkv");
  assert.equal(api.withMimeHint(new File([new Uint8Array(8)], "a.bin", { type:"" })).type, "", "知らない拡張子はそのまま");
  assert.equal(api.withMimeHint(null), null);
  const typed = new File([new Uint8Array(8)], "movie.mkv", { type:"video/mp4" });
  assert.equal(api.withMimeHint(typed), typed, "type が入っていれば触らない");
  assert.ok(/withMimeHint\(file\)/.test(libSrc), "動画の下調べ側でも補う");
});

/* ---------- 4言語の言葉 ---------- */
test("trk195: the new explanations exist in all four languages", () => {
  for (const key of ["loadMpegPsUnsupported", "loadMpegTsUnsupported", "loadCodecUnsupported", "loadContainerUnreadable"]) {
    const hits = i18nSrc.split(`\n    ${key}:`).length - 1;
    assert.equal(hits, 4, `${key} は4言語`);
  }
  assert.ok(/loadCodecUnsupported:"🎞 \{container\} の\{codec\}は/.test(i18nSrc), "日本語は {container}/{codec} を使う");
  for (const key of ["loadMpegPsUnsupported", "loadCodecUnsupported"]) {
    const ja = i18nSrc.match(new RegExp(`${key}:"([^"]*)"`))[1];
    assert.ok(/MP4/.test(ja), `${key} は「MP4 に変換すれば再生できる」まで言う`);
  }
  /* バナーの高さ（190px）に収まる長さにしておく＝1行が長すぎると読む前に切れる */
  for (const key of ["loadMpegPsUnsupported", "loadMpegTsUnsupported", "loadCodecUnsupported", "loadContainerUnreadable"]) {
    const ja = i18nSrc.match(new RegExp(`${key}:"([^"]*)"`))[1];
    assert.ok(ja.length <= 60, `${key} は短く（${ja.length}文字）`);
  }
});
