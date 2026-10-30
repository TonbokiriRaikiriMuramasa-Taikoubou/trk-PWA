// SPDX-License-Identifier: GPL-3.0-or-later
/* 選曲画面のTV（TVドック）が、アプリの画面状態を core.screen から読むことの検査（trk100）。
 *
 *   node --test tests/        または   npm test
 *
 * 背景：core.js は画面状態 screen を大域へ出さない（trk70 の利用者決定。ブラウザ標準の
 * window.screen を隠さないため）。それ以降、js/tv-dock.js の裸の `screen` 参照は
 * window.screen（オブジェクト）に静かに当たり、typeof screen === "string" が常に false →
 * screenName() が常に "" になり、選曲画面のTVの映像（liveOn）・確認タブ（previewOn）・
 * メニュー再生（menuVideoWanted）がすべて止まっていた（最大化とメディアプレーヤーは
 * core.screen を読まない／別の経路なので表示され続けた＝利用者の報告どおり）。
 *
 * 検査は js/tv-dock.js の実ソースの断片を vm で実行する（tests/game-end.test.mjs と同じ流儀）。
 * サンドボックスには本物のブラウザと同じく screen＝オブジェクト（window.screen 相当）を置き、
 * 裸の名前では画面状態を読めないことを再現する。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tvSource = fs.readFileSync(path.join(root, "js/tv-dock.js"), "utf8");

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `start marker not found: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `end marker not found: ${end}`);
  return source.slice(a, b);
}

const screenNameSrc = between(tvSource, "const screenName", "/* ・音は出さない");
const menuVideoSrc = between(tvSource, "let menuMutedByUs", 'core.video.addEventListener("ended", () => {');
const liveOnSrc = between(tvSource, "const liveOn =", "screenDiv.dataset.live");
const previewOnSrc = between(tvSource, "const previewOn =", "function pvChipText");

function makeContext({
  screen = "select", phase = "title", videoReady = true, paused = false, hasSrc = true, videoWidth = 320, videoHeight = 180,
  tvMenuPreview = true, tvMenuVideo = false, previewEnabled = true, videoStyle = "color",
  tab = "preview", detailsOpen = true, paneHidden = false, docHidden = false,
} = {}) {
  const calls = { play: 0, pause: 0 };
  const core = {
    screen,                       // 正規の画面状態（window.Trk.core.screen の中身）
    phase, videoReady,
    settings: { tvMenuPreview, tvMenuVideo, previewEnabled, videoStyle },
    video: {
      src: hasSrc ? "blob:trk-demo" : "", paused, muted: false, videoWidth, videoHeight,
      play() { calls.play++; this.paused = false; return Promise.resolve(); },
      pause() { calls.pause++; this.paused = true; },
    },
  };
  const sandbox = {
    core, calls,
    /* ブラウザ標準の window.screen 相当。裸の `screen` はこれに当たる（文字列ではない） */
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    document: { hidden: docHidden },
    /* liveOn の断片が読む局部の状態（render() の中の周り） */
    isOff: videoStyle === "off",
    /* previewOn の断片が読む局部の状態（くわしい欄の中の周り） */
    tab, body: { open: detailsOpen }, panePreview: { hidden: paneHidden },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(
    `${screenNameSrc}\n${menuVideoSrc}\n${liveOnSrc}\n${previewOnSrc}\n` +
    "globalThis.out = { screenName, menuVideoWanted, menuVideoTick, liveOn, previewOn };",
    context, { filename: "js/tv-dock.js#screen-state" });
  return { core, calls, out: sandbox.out, sandbox };
}

test("サンドボックスの screen はブラウザ標準と同じオブジェクト（裸の名前では画面状態を読めない）", () => {
  const { sandbox } = makeContext();
  assert.equal(typeof sandbox.screen, "object");
  assert.notEqual(typeof sandbox.screen, "string");
});

test("screenName() は core.screen を読む（select／settings／非文字列）", () => {
  assert.equal(makeContext({ screen: "select" }).out.screenName(), "select");
  assert.equal(makeContext({ screen: "settings" }).out.screenName(), "settings");
  assert.equal(makeContext({ screen: null }).out.screenName(), "", "non-string state falls back to an empty string");
});

test("TVの標準画面（liveOn）：既定のまま・選曲中・再生中なら映像が出る", () => {
  /* 何も設定していない状態＝ tvMenuPreview 初期オン・videoStyle off 以外・プレビュー再生中 */
  assert.equal(makeContext().out.liveOn, true);
});

test("音声だけのMP3プレビューではTV動画を重ねず、ジャケット表示の場所を空ける", () => {
  assert.equal(makeContext({ videoWidth:0, videoHeight:0 }).out.liveOn, false);
});

test("TVの標準画面（liveOn）：設定画面・再生していない・電源オフ・演奏中・初期オンを切った場合は出ない", () => {
  assert.equal(makeContext({ screen: "settings" }).out.liveOn, false);
  assert.equal(makeContext({ paused: true }).out.liveOn, false);
  assert.equal(makeContext({ videoStyle: "off" }).out.liveOn, false);
  assert.equal(makeContext({ phase: "playing" }).out.liveOn, false);
  assert.equal(makeContext({ tvMenuPreview: false }).out.liveOn, false);
  assert.equal(makeContext({ videoReady: false }).out.liveOn, false);
});

test("メニュー再生（menuVideoTick）：音プレビューOFF＋🎬ONなら、選曲画面で映像を鳴らし始める", async () => {
  const { core, calls, out } = makeContext({
    tvMenuVideo: true, previewEnabled: false, paused: true,
  });
  assert.equal(out.menuVideoWanted(), true);
  out.menuVideoTick();
  assert.equal(calls.play, 1, "video.play() is called once");
  assert.equal(core.video.muted, true, "menu playback stays muted");
  await Promise.resolve();
  /* 条件が外れたら（設定画面へ移ったら）止めてミュートを戻す */
  core.screen = "settings";
  out.menuVideoTick();
  assert.equal(calls.pause, 1, "video.pause() is called once");
  assert.equal(core.video.muted, false, "mute is released");
});

test("メニュー再生（menuVideoWanted）：音プレビューON・設定画面・🎬OFFでは鳴らさない", () => {
  /* 音ありプレビュー（previewEnabled 初期オン）が優先。🎬 は「オフでも映像を流す」設定 */
  assert.equal(makeContext({ tvMenuVideo: true, previewEnabled: true }).out.menuVideoWanted(), false);
  assert.equal(makeContext({ tvMenuVideo: true, previewEnabled: false, screen: "settings" }).out.menuVideoWanted(), false);
  assert.equal(makeContext({ tvMenuVideo: false, previewEnabled: false }).out.menuVideoWanted(), false);
  assert.equal(makeContext({ tvMenuVideo: true, previewEnabled: false, hasSrc: false }).out.menuVideoWanted(), false);
});

test("確認タブ（previewOn）：選曲画面なら描く、設定画面なら描かない", () => {
  assert.equal(makeContext({ screen: "select" }).out.previewOn(), true);
  assert.equal(makeContext({ screen: "settings" }).out.previewOn(), false);
  assert.equal(makeContext({ tab: "setup" }).out.previewOn(), false);
  assert.equal(makeContext({ detailsOpen: false }).out.previewOn(), false);
});

test("配線：tv-dock.js に裸の screen 参照が残っていない（読みは core.screen だけ）", () => {
  /* tools/check-repo.mjs の trk100 ガードと同じ約束を、この検査でも文として残す。
     局所の div は screenDiv。裸の screen はブラウザ標準の window.screen に当たる。 */
  assert.match(tvSource, /const screenName = \(\) => \(typeof core\.screen === "string" \? core\.screen : ""\);/);
  assert.match(tvSource, /screenName\(\) === "select"/);
  assert.ok(!/(^|[^.\w$"'-])screen\s*===\s*"select"/m.test(tvSource), "bare `screen === \"select\"` must not come back");
  assert.ok(!/const screen = core\.el\("div", "tvScreen"\)/.test(tvSource), "the local TV div must stay renamed (screenDiv)");
});
