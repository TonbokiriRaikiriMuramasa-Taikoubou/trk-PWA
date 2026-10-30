// SPDX-License-Identifier: GPL-3.0-or-later
/* trk193: ⏮「常に最初から再生する」と、曲名タブの長押しで出るプレビュー開始位置のバー。
   ・設定は core.settings.mediaStartFromZero の1つだけ（初期オフ・初期化とセーフモードでオフ）
   ・オンのときはプレビュー（previewStartFor）もメディアプレーヤーの「続きから」（savedMediaPosition）も 0 を返す
   ・置き場所は3か所（⚙ 設定の 🎵 サウンド／メディアプレーヤーのオプション行／曲名タブの長押しバー）で、
     どれを触っても同じ値が変わる
   ・曲名タブの「⏱ ここをプレビュー開始位置にする」は長押し（650ms・12px 動いたらやめる）でバーを開く */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const mediaSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const css = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");

/* ---------- 設定（1つの値・初期オフ・初期化/セーフモードでオフ） ---------- */
test("trk193: the setting is a single opt-in boolean and resets to off", () => {
  assert.ok(coreSrc.includes("mediaStartFromZero: prefs.mediaStartFromZero === true"),
    "初期オフ（今までの動きを変えない）");
  const off = coreSrc.match(/settings\.mediaStartFromZero = false/g) || [];
  assert.equal(off.length, 2, "設定の初期化とセーフモードの両方でオフへ戻す");
});

/* ---------- プレビューの開始位置 ---------- */
function previewStartWith({ on = false, songStart = 20, songDefault = 12, duration = 100 } = {}) {
  const fn = libSrc.match(/function previewStartFor\(\) \{[\s\S]*?\n\}/)[0];
  const context = vm.createContext({
    core: { settings: { mediaStartFromZero: on }, fingerprint: "1:2", currentSong: { size: 1, previewStart: songDefault } },
    songPrefs: { byFp: { "1:2": { previewStart: songStart } } },
    video: { duration },
  });
  return vm.runInContext(`${fn}; previewStartFor()`, context);
}

test("trk193: previews keep their saved start point unless the setting is on", () => {
  assert.equal(previewStartWith({ on: false }), 20, "オフ＝曲ごとのプレビュー開始位置（今までどおり）");
  assert.equal(previewStartWith({ on: true }), 0, "オン＝いつも 0:00");
  assert.equal(previewStartWith({ on: true, duration: 0 }), 0, "長さが読めていなくても 0");
});

/* ---------- メディアプレーヤーの「続きから」 ---------- */
function savedMediaPositionWith(on) {
  const fn = mediaSrc.match(/function savedMediaPosition\(opts = \{\}\) \{[\s\S]*?\n\}/)[0];
  const context = vm.createContext({
    core: { settings: { mediaStartFromZero: on, mediaResumeRewind: 0 }, video: { duration: 100 } },
    mediaPositions: { "1:2": 42 },
    mediaPositionKey: () => "1:2",
    rewindResumePosition: p => p,
    resumeRewindSeconds: () => 0,
  });
  return vm.runInContext(`${fn}; savedMediaPosition({ resume:true })`, context);
}

test("trk193: the media player resumes only while the setting is off", () => {
  assert.equal(savedMediaPositionWith(false), 42, "オフ＝保存した位置から（今までどおり）");
  assert.equal(savedMediaPositionWith(true), 0, "オン＝開き直しても 0:00 から");
});

/* ---------- 3か所の置き場所が同じ値を見る ---------- */
test("trk193: the same switch lives in settings, the media player and the banner bar", () => {
  assert.ok(html.includes('<input id="mediaStartFromZero" type="checkbox">'), "⚙ 設定（🎵 サウンド）");
  assert.ok(html.includes('data-i18n="mediaStartFromZeroHint"'), "設定には説明文を添える");
  assert.ok(mediaSrc.includes('startZeroNode.id = "mediaStartFromZeroPlayer"'), "▶ メディアプレーヤーのオプション行");
  assert.ok(libSrc.includes("bannerStartZero.id = \"bannerStartZero\""), "⏱ 曲名タブの長押しバー");
  assert.ok(libSrc.includes("function syncStartZeroInputs()"), "3か所を1つの関数でそろえる");
  assert.ok(libSrc.includes("window.TrkMediaStartZeroSync"), "メディアプレーヤー側のチェックへも反映");
  const sync = libSrc.match(/function syncStartZeroInputs\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(sync.includes('core.$("mediaStartFromZero")'), "設定のチェックを合わせる");
  assert.ok(sync.includes("bannerStartZero.checked = on"), "バーのチェックを合わせる");
  assert.ok(sync.includes("window.TrkMediaStartZeroSync"), "メディアプレーヤーのチェックを合わせる");
});

/* ---------- 長押しでバーを開く ---------- */
test("trk193: long-pressing the preview-set button opens the start bar", () => {
  assert.ok(libSrc.includes('previewSetBtn.addEventListener("pointerdown"'), "長押しの入口");
  assert.ok(/previewSetPressTimer = setTimeout\(\(\) => \{[^}]*previewSetLongPressed = true; startBarOpen\(\); \}, 650\);/.test(libSrc),
    "650ms 押し続けたらバーを開く");
  assert.ok(libSrc.includes("Math.hypot(e.clientX - previewSetDownX, e.clientY - previewSetDownY) > 12"), "12px 動いたら取りやめ");
  assert.ok(libSrc.includes('previewSetBtn.addEventListener("pointercancel"'), "取り消しでも止まる");
  assert.ok(libSrc.includes("if (previewSetLongPressed) { previewSetLongPressed = false; return; }"),
    "長押しのあとの click で位置を保存してしまわない");
  assert.ok(libSrc.includes("previewSetBtn.title = tr(\"previewSetLongPress\")"), "長押しの説明をボタンに付ける");
});

test("trk193: the start bar can pick a position, save it and go back to the song default", () => {
  assert.ok(libSrc.includes("function startBarOpen()"), "バーを開く");
  assert.ok(libSrc.includes('bannerStartRange.type = "range"'), "つまみで位置を選ぶ");
  assert.ok(libSrc.includes("bannerStartRange.step = \"0.1\""), "0.1秒きざみ");
  assert.ok(libSrc.includes('core.setStatus("songPrefsStatus", "startBarSaved"'), "保存の知らせ");
  assert.ok(libSrc.includes("delete sp.previewStart"), "曲の既定に戻せる");
  assert.ok(libSrc.includes("try { video.currentTime = t; } catch (_) {}"), "つまみを動かすとその位置を試せる");
  assert.ok(css.includes(".bannerStartPanel{"), "バーの見た目");
  assert.ok(css.includes(".bannerStartZeroRow{"), "チェック行の見た目");
});

/* ---------- 4言語 ---------- */
test("trk193: every new label exists in all four languages", () => {
  for (const key of ["mediaStartFromZero", "mediaStartFromZeroHint", "previewSetLongPress", "startBarTitle",
    "startBarAt", "startBarAlwaysNote", "startBarSave", "startBarReset", "startBarClose", "startBarSaved", "startBarResetDone"]) {
    const n = (i18nSrc.match(new RegExp(`(^|[\\s,{])${key}:`, "g")) || []).length;
    assert.equal(n, 4, `${key} は4言語`);
  }
});
