// SPDX-License-Identifier: GPL-3.0-or-later
/* trk200: 🎞 映像は出るのに音が出ない .mkv（AC3・E-AC3・DTS・TrueHD）を、読み込めたときにも言い当てる。
   いままでは「読み込み完了」と出て、鳴らしてみると無音（実測：AC3 で webkitAudioDecodedByteCount が 0）。
   音ゲーとしては致命的なので、先頭 2MB の Tracks を見て音声コーデックだけを確かめ、
   鳴らせない見込みなら理由（MP4（AAC）に変換）を、読み込み直後とメディアプレーヤーの停止中に出す。
   tests で確かめること：Matroska の TrackType で音声だけを取り出す・AAC/Opus は黙る・
   MP4 など音声が読めない入れ物では何も言わない・i18n 4言語・読み込み経路の配線 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const mediaSrc = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");

const probeBlock = mediaSrc.slice(
  mediaSrc.indexOf("/* ---------- 🎞 コンテナとコーデックの下調べ"),
  mediaSrc.indexOf("/* ---------- 曲の読み込み ----------"),
);
const api = vm.runInNewContext(
  `${probeBlock}\n;({ probeContainer, explainAudioWarning, explainProbe, AUDIO_CODEC_OK, codecLabel })`,
  { File },
);

/* ---------- 合成した Matroska（TrackType つき） ---------- */
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
/* type：1＝映像 2＝音声（Matroska の TrackType） */
const track = (codecId, type) => el([0xae], cat(el([0x83], Uint8Array.of(type)), el([0x86], ascii(codecId))));
const mkv = tracks => cat(
  el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], ascii("matroska"))),
  el([0x18, 0x53, 0x80, 0x67], el([0x16, 0x54, 0xae, 0x6b], cat(...tracks))),
  new Uint8Array(64),
);
const mp4 = cat(Uint8Array.of(0, 0, 0, 0x18), ascii("ftypisom"), new Uint8Array(64));

test("trk200: the Matroska probe separates audio tracks from video tracks", () => {
  const r = api.probeContainer(mkv([track("V_MPEG4/ISO/AVC", 1), track("A_AC3", 2)]));
  assert.equal(r.container, "matroska");
  assert.deepEqual(Array.from(r.audioCodecs), ["A_AC3"], "音声だけを別に持つ");
  assert.deepEqual(Array.from(r.videoCodecs), ["V_MPEG4/ISO/AVC"]);
  assert.deepEqual(Array.from(r.codecs), ["V_MPEG4/ISO/AVC", "A_AC3"], "今までの一覧も残す（trk195 の表示用）");
});

test("trk200: an AC3/DTS/TrueHD track gets a 'no sound' reason naming the codec", () => {
  for (const [codec, label] of [["A_AC3", "AC3"], ["A_EAC3", "E-AC3"], ["A_DTS", "DTS"], ["A_TRUEHD", "TrueHD"]]) {
    const why = api.explainAudioWarning(api.probeContainer(mkv([track("V_MPEG4/ISO/AVC", 1), track(codec, 2)])));
    assert.ok(why, `${codec} は理由を返す`);
    assert.equal(why.key, "loadAudioUnsupported");
    assert.match(why.vars.codec, new RegExp(label));
    assert.match(why.vars.container, /MKV/);
  }
});

test("trk200: playable audio stays quiet, and so does anything we cannot judge", () => {
  for (const codec of ["A_AAC", "A_OPUS", "A_VORBIS", "A_MPEG/L3", "A_FLAC", "A_PCM/INT/LIT"]) {
    assert.equal(api.explainAudioWarning(api.probeContainer(mkv([track("V_MPEG4/ISO/AVC", 1), track(codec, 2)]))), null, `${codec} は言わない`);
  }
  /* 音声トラックが無い／読めない入れ物（MP4・音だけの不明ファイル）では判断しない */
  assert.equal(api.explainAudioWarning(api.probeContainer(mkv([track("V_MPEG4/ISO/AVC", 1)]))), null);
  assert.equal(api.explainAudioWarning(api.probeContainer(mp4)), null);
  assert.equal(api.explainAudioWarning(null), null);
  /* 音声が2つあるときは、1つでも鳴れば黙る（よくある二重音声の MKV） */
  assert.equal(api.explainAudioWarning(api.probeContainer(mkv([track("A_AC3", 2), track("A_AAC", 2)]))), null);
  assert.ok(api.AUDIO_CODEC_OK.has("A_AAC") && !api.AUDIO_CODEC_OK.has("A_DTS"), "鳴らせる音声の一覧");
});

test("trk200: the load path checks the audio after the file opens, and keeps the reason", () => {
  const load = mediaSrc.slice(mediaSrc.indexOf("async function loadMedia("), mediaSrc.indexOf("/* ---------- 解析結果のキャッシュ"));
  assert.ok(/core\.mediaLoadWarning = null;/.test(load), "前の曲の警告を持ち越さない");
  assert.ok(/const warn = await explainAudioFailure\(file\);/.test(load), "MIDI 以外は先頭を見る");
  assert.ok(/if \(warn\) core\.mediaLoadWarning = \{ key:warn\.key, vars:warn\.vars/.test(load), "理由を残す（プレーヤーが読む）");
  assert.ok(/warn \? warn\.key :/.test(load), "読み込み完了の代わりに理由を出す");
  assert.ok(/window\.Trk\.play\.showToast\(tr\(warn\.key, warn\.vars\)\)/.test(load), "その場でも一度知らせる");
  const at = load.indexOf("core.mediaLoadWarning = {");
  assert.ok(at > load.indexOf("core.videoReady = true;"), "読めたあと（失敗の理由とは別の経路）で確かめる");
  assert.ok(/const why = await explainLoadFailure\(file\);/.test(load), "読めなかったときの理由は今までどおり");
});

test("trk200: the media player shows the reason while it is stopped", () => {
  assert.ok(/const silent = core\.videoReady && core\.video\.paused && core\.mediaLoadWarning;/.test(playerSrc),
    "止まっているあいだだけ出す（再生中の状態表示は埋めない）");
  assert.ok(/else if \(silent\) \{ statusNode\.textContent = tr\(silent\.key, silent\.vars\);/.test(playerSrc));
});

test("trk200: the 'no sound' explanation is in all four languages and readable in a banner", () => {
  assert.equal(i18nSrc.split("\n    loadAudioUnsupported:").length - 1, 4, "loadAudioUnsupported は4言語");
  const ja = i18nSrc.match(/loadAudioUnsupported:"([^"]*)"/)[1];
  assert.ok(ja.length <= 60, `案内は短く（${ja.length}文字）`);
  assert.match(ja, /\{codec\}/);
  assert.match(ja, /MP4/);
  assert.ok(new RegExp("loadAudioUnsupported:\"[^\"]*\\{codec\\}").test(i18nSrc), "コーデック名を差し込む");
  /* ⚙ 設定の「📖 再生できる形式」にも、音声の線引きを書いておく */
  assert.ok(html.includes('data-i18n="formatHelpAudio"'), "設定に音声の説明の行がある");
  assert.equal(i18nSrc.split("\n    formatHelpAudio:").length - 1, 4, "formatHelpAudio も4言語");
  assert.match(i18nSrc.match(/formatHelpAudio:"([^"]*)"/)[1], /DTS/);
});
