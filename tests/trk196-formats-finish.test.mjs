// SPDX-License-Identifier: GPL-3.0-or-later
/* trk196: 🎞 形式まわりの仕上げ（trk195 の続き）。
   ① 再生できない理由を「選曲画面のバナー」だけでなく、メディアプレーヤーにも出す
   ② MPEG-TS／MPEG-2 の仲間（.m2ts/.m2v/.mpe）も取り込めるようにする
   ③ 一覧の行に「再生できない場合がある」印（⚠）を付ける（開いてから驚かない）
   ④ ⚙ 設定に「📖 再生できる形式」の説明を置く（4言語） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const mediaSrc = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const titleSrc = fs.readFileSync(`${ROOT}/js/title-match.js`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");

const listOf = (src, name) => src.match(new RegExp(`const ${name} = \\[[^\\]]*\\];`))[0];
const hasAll = (list, exts) => exts.every(ext => list.includes(`"${ext}"`));

/* ---------- ② 拡張子 ---------- */
test("trk196: MPEG-TS / MPEG-2 family joins the extensions that can be imported", () => {
  assert.ok(hasAll(listOf(libSrc, "MEDIA_EXT"), ["m2ts", "m2v", "mpe"]), "取込・曲追加・共有の対象");
  assert.ok(hasAll(listOf(libSrc, "VIDEO_EXT"), ["m2ts", "m2v", "mpe"]), "🎬 動画として読む対象");
  assert.ok(hasAll(listOf(libSrc, "VIDEO_ONLY_EXT"), ["m2ts", "m2v", "mpe"]), "拡張子だけで 🎬 を付ける対象");
  /* .ts は TypeScript のソースと紛れるので、あえて入れない（必要になったら1行で足せる） */
  assert.ok(!/"ts"/.test(listOf(libSrc, "MEDIA_EXT")), ".ts は入れない（.m2ts で足りる）");
  for (const htmlPart of [html.match(/id="videoFile"[^>]*/)[0], html.match(/id="mediaFile"[^>]*/)[0]])
    for (const ext of [".m2ts", ".m2v", ".mpe"]) assert.ok(htmlPart.includes(ext), `${ext} を accept に`);
  assert.ok(/\|mpe\|m2v\|m2ts\)\$/.test(titleSrc), "曲プロフィールの音/映像の見分けにも");
});

test("trk196: the new containers get a MIME hint for files with an empty type", () => {
  const media = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
  for (const [ext, mime] of [["m2ts", "video/mp2t"], ["ts", "video/mp2t"], ["m2v", "video/mpeg"], ["mpe", "video/mpeg"]])
    assert.ok(new RegExp(`\\b${ext}:"${mime.replace("/", "\\/")}"`).test(media), `${ext} → ${mime}`);
});

/* ---------- ③ 一覧の印 ---------- */
test("trk196: the list marks formats a browser usually can't play", () => {
  assert.ok(hasAll(listOf(libSrc, "MAYBE_UNPLAYABLE_EXT"), ["mpg", "mpeg", "mpe", "m2v", "m2ts", "avi"]));
  /* mkv は H.264＋AAC なら再生できるので、警告しない */
  assert.ok(!/"mkv"/.test(listOf(libSrc, "MAYBE_UNPLAYABLE_EXT")));
  assert.ok(/const maybeUnplayable = it =>/.test(libSrc), "拡張子だけで判定する（1本ずつ開かない）");
  assert.ok(/if \(maybeUnplayable\(it\)\) \{/.test(libSrc), "行を描くときに使う");
  assert.ok(/libTag libWarnTag", "⚠"/.test(libSrc), "⚠ の印");
  assert.ok(libSrc.includes('tr("libMaybeUnplayableHint")'), "理由は title／aria-label で");
  assert.ok(/\.libTag\.libWarnTag\{/.test(cssSrc), "印の見た目");
});

/* ---------- ① 理由をメディアプレーヤーにも ---------- */
test("trk196: the load failure is remembered so every screen can repeat it", () => {
  assert.ok(/core\.mediaLoadFailure = null;/.test(mediaSrc), "読み込みのたびに消す（前の曲の理由を持ち越さない）");
  assert.ok(/core\.mediaLoadFailure = \{ key:/.test(mediaSrc), "失敗したら理由を残す");
  assert.ok(/known: !!\(why && why\.key && why\.key !== "loadError"\)/.test(mediaSrc), "「言える理由」かどうかも持つ");
});

test("trk196: the media player shows the reason instead of a generic line", () => {
  assert.ok(/const failure = key === "mediaLoadFailed" && core\.mediaLoadFailure;/.test(playerSrc), "再生できなかったとき");
  assert.ok(/const failure = !core\.videoReady && core\.currentSong && core\.mediaLoadFailure;/.test(playerSrc), "開いたとき（曲はあるが読み込めていない）");
  assert.ok((playerSrc.match(/failure\.known/g) || []).length >= 2, "分かる理由のときだけ差し替える");
});

/* ---------- ④ 設定の説明 ---------- */
test("trk196: settings explain which formats play, in all four languages", () => {
  const keys = ["formatHelpTitle", "formatHelpMusic", "formatHelpMidi", "formatHelpVideo", "formatHelpUnplayable", "formatHelpConvert", "libMaybeUnplayableHint"];
  for (const key of keys) assert.equal(i18nSrc.split(`\n    ${key}:`).length - 1, 4, `${key} は4言語`);
  const panel = html.slice(html.indexOf('id="formatHelpPanel"'), html.indexOf("</details>", html.indexOf('id="formatHelpPanel"')));
  for (const key of ["formatHelpMusic", "formatHelpMidi", "formatHelpVideo", "formatHelpUnplayable", "formatHelpConvert"])
    assert.ok(panel.includes(`data-i18n="${key}"`), `${key} を設定に出す`);
  /* 変換の案内は「このアプリは元ファイルを書き換えない」まで言う */
  const convert = i18nSrc.match(/formatHelpConvert:"([^"]*)"/)[1];
  assert.ok(/MP4/.test(convert) && /(書き換えません|never rewrites)/.test(convert));
});

/* ---------- 既存の下調べと矛盾しない ---------- */
test("trk196: the probe still names MPEG-TS, so these files get a real reason", () => {
  const probe = mediaSrc.slice(mediaSrc.indexOf("/* ---------- 🎞 コンテナとコーデックの下調べ"), mediaSrc.indexOf("/* ---------- 曲の読み込み ----------"));
  const api = vm.runInNewContext(`${probe}\n;({ probeContainer, explainProbe })`, { File });
  const ts = new Uint8Array(188 * 8).map((_, i) => i % 188 === 0 ? 0x47 : 0);
  assert.equal(api.probeContainer(ts).container, "mpeg-ts");
  assert.equal(api.explainProbe(api.probeContainer(ts), "m2ts").key, "loadMpegTsUnsupported");
});
