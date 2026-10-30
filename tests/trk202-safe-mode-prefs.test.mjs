// SPDX-License-Identifier: GPL-3.0-or-later
/* trk202: 🛟 セーフモードが倒した設定を、通常の起動に持ち越さない。
   いまは ?safe=1 で入ったあと何か設定を保存すると、folderAutoRead・mediaStartFromZero・
   previewEnabled が false のまま保存され、通常の URL で開き直しても戻らなかった（1.0.7 レビューの推奨）。
   ・倒す前の値を覚えておき、保存のときだけ元の値に差し替える（保存データは書き換えない）
   ・セーフモードのまま再読み込みするときは URL に ?safe=1 を付け直す（設定を書き換えずに続ける）
   tests で確かめること：差し替えの範囲・通常時は素通し・再読み込みの URL・4言語の案内 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");

function between(start, end) {
  const a = coreSrc.indexOf(start);
  assert.ok(a >= 0, `${start} がある`);
  const b = coreSrc.indexOf(end, a);
  assert.ok(b > a, `${end} が後ろにある`);
  return coreSrc.slice(a, b);
}

/* セーフモードの節＋保存の差し替えを、そのまま VM で動かす */
const safeBlock = between("let safeModeOn = false;", "function resetKeysPrefs() {");
const saveBlock = between("function prefsForSave() {", "function rememberMusicVolume(");

function ctx(settings, href = "https://trk.example/?safe=1") {
  const sandbox = {
    settings,
    window: {},
    markAmpReset: () => {},
    view: { style: {} },
    location: { href, replace(u) { sandbox.replaced = u; }, reload() { sandbox.reloaded = true; } },
    URL,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${saveBlock}\n${safeBlock}\n;globalThis.__prefsForSave = prefsForSave; globalThis.__enter = enterSafeMode; globalThis.__href = safeModeHref; globalThis.__reload = reloadInSafeMode;`, context);
  return { sandbox, context };
}

const base = () => ({
  videoStyle: "mono", bgDim: .4, bgBlur: 8, tvParamFavs: ["x"], tvDockSkin: "custom", tvDockFive: true,
  tvOrder: "fx-first", tvOverlay: true, previewEnabled: true, mediaStartFromZero: true, folderAutoRead: true,
  tvMenuPreview: true, tvMenuVideo: true, tvSongWhilePlaying: true, specOn: true, specTv: true, specSkin: true,
  specSkinOpen: true, artWallpaperBg: true, useStudyArtwork: true, hideArtworkDuringChart: true,
  synthModeKeyboardLock: false, synthModeWideKeyboard: true, libKeepShared: true, fxPower: 1,
  gameFxMode: "full", hideGameplayUI: false, midiMixEnabled: true, midiMixOpen: true, tvRichOpen: true,
  mascot: "vrm", fxRack: [], fxRackOn: true,
});

test("trk202: saving during safe mode keeps the user's own auto-start settings", () => {
  const settings = base();
  const { context } = ctx(settings);
  vm.runInContext("__enter()", context);
  assert.equal(settings.folderAutoRead, false, "その場では安全側（自動読み取りをしない）");
  assert.equal(settings.mediaStartFromZero, false);
  assert.equal(settings.previewEnabled, false);
  assert.equal(settings.libKeepShared, false);
  const saved = vm.runInContext("__prefsForSave()", context);
  assert.equal(saved.folderAutoRead, true, "保存には元の値（オフにしたまま持ち越さない）");
  assert.equal(saved.mediaStartFromZero, true);
  assert.equal(saved.previewEnabled, true);
  assert.equal(saved.libKeepShared, true);
  assert.equal(saved.videoStyle, "off", "画面まわりは今までどおり安全側で保存する（見た目の初期化）");
  assert.equal(saved.tvRichOpen, false);
  assert.notEqual(saved, settings, "settings 自体は書き換えない（元のオブジェクトを汚さない）");
  assert.equal(settings.folderAutoRead, false, "元のオブジェクトはそのまま");
  /* 2回目以降の保存でも同じ */
  assert.equal(vm.runInContext("__prefsForSave()", context).folderAutoRead, true);
});

test("trk202: without safe mode the saved settings pass through untouched", () => {
  const settings = base();
  const { context } = ctx(settings);
  const saved = vm.runInContext("__prefsForSave()", context);
  assert.equal(saved, settings, "そのまま返す（コピーもしない）");
  assert.equal(saved.folderAutoRead, true);
  assert.equal(saved.mediaStartFromZero, true);
});

test("trk202: safe mode survives a reload through the URL, not through saved settings", () => {
  const { sandbox, context } = ctx(base(), "https://trk.example/app.html?v=1#hash");
  const href = vm.runInContext("__href()", context);
  assert.match(href, /[?&]safe=1/, "再読み込みのURLに ?safe=1 を付ける");
  assert.match(href, /v=1/, "ほかのパラメータは残す");
  assert.ok(!href.includes("#hash"), "hash のコマンドは落とす（もう一度リセットしない）");
  vm.runInContext("__reload()", context);
  assert.match(sandbox.replaced, /safe=1/, "location.replace で開き直す（履歴を増やさない）");
});

test("trk202: every reload that enters safe mode goes through the URL helper", () => {
  assert.ok(!/enterSafeMode\(\); saveUserPrefs\(\); location\.reload\(\)/.test(coreSrc), "URL を付けずに再読み込みしない");
  const reloads = coreSrc.split("\n").filter(line => /enterSafeMode\(\); saveUserPrefs\(\); reloadInSafeMode\(\)/.test(line));
  assert.ok(reloads.length >= 3, `緊急の入口が3つ以上ある（${reloads.length}）`);
  assert.ok(/window\.Trk\.core|safeModeHref,/.test(coreSrc), "safeModeHref は公開名にも入れる");
  assert.ok(/setTimeout\(\(\)=> reloadInSafeMode\(\), 800\)/.test(coreSrc), "緊急復旧パネルのボタンも同じ");
});

test("trk202: the notice says what is saved (video/TV reset) and what lasts only while ?safe=1, in four languages", () => {
  assert.equal(i18nSrc.split("\n    safeModeNotice:").length - 1, 4, "safeModeNotice は4言語");
  assert.ok(/safe: tr\("safeModeNotice"\)/.test(coreSrc), "起動の案内は i18n から引く");
  const ja = i18nSrc.match(/safeModeNotice:"([^"]*)"/)[1];
  assert.match(ja, /\?safe=1/, "戻し方（URL）まで言う");
  assert.match(ja, /保存されます/, "映像・TVなどの戻しは保存されると正直に言う（enterSafeMode は SAFE_SESSION_KEYS 以外も保存する）");
  assert.match(ja, /元に戻ります/, "自動読み取りなどは開き直すと戻ると分かる");
});
