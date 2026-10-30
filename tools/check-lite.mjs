#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 🪶 軽量化（js/lite.js）の依存なし検査。
 *
 * ・js/lite.js を Node 上を実際に走らせて、ゲートの振る舞いを確かめます
 *   （軽量化がオフのときは一切働かない／曲リストの行数／音声解析と3Dマスコットの
 *    自動読み込みを飛ばす／動き続ける装飾を liteFps の上限で間引く／プリセット）。
 * ・index.html・js/core.js・js/i18n.js は静的に、設定ID・既定値・リセット・4言語を確かめます。
 * ・ゲームの判定と時計がゲートの前にあること（＝フレームレートを落としても判定がズレない）は
 *   tools/check-repo.mjs が見ています。ここは lite.js 側の契約だけ。
 * これは実ブラウザ・実機の代わりではありません（発熱・電池・30fpsのプレイ感は実機で確認してください）。
 */
import assert from "node:assert/strict";
import { restoreCoreAlias, sourceOf } from "./lib/js-source.mjs";
import fs from "node:fs";
import vm from "node:vm";

const read = rel => sourceOf(rel, fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const liteSource = read("js/lite.js");
const html = read("index.html");
const core = read("js/core.js");
const i18n = read("js/i18n.js");

/* ---------- js/lite.js を DOM の代わりにかざした Stage で動かす ---------- */
const preamble = `
var __now = 1000;
var toasts = [], saves = 0;
var nodes = Object.create(null);
function mkEl() {
  return { value:"", checked:false, textContent:"", open:false,
    classList: { set: new Set(), toggle(k, on) { if (on === undefined) on = !this.set.has(k); if (on) this.set.add(k); else this.set.delete(k); } },
    addEventListener() {} };
}
function $(id) { if (!nodes[id]) nodes[id] = mkEl(); return nodes[id]; }
var window = { matchMedia: () => ({ matches:false, addEventListener(){} }), TrkSafeMode: () => false };
var document = {
  body: { classList: { set: new Set(), toggle(k, on) { if (on === undefined) on = !this.set.has(k); if (on) this.set.add(k); else this.set.delete(k); } } },
  addEventListener(){}, createElement: () => ({ style:{}, append(){}, classList:{ toggle(){} }, setAttribute(){} })
};
var navigator = { userAgent:"Mozilla/5.0 (X11; Linux x86_64)", hardwareConcurrency:8, deviceMemory:8, connection:{ saveData:false }, standalone:false };
var devicePixelRatio = 2;
var performance = { now: () => __now };
var localStorage = { store:{}, getItem(k){ return this.store[k] ?? null; }, setItem(k,v){ this.store[k]=v; }, removeItem(k){ delete this.store[k]; } };
var location = { search:"", hash:"" };
var settings = { liteMode:"auto", liteFps:"30", liteMascot:"30", liteScale:"1.5", liteSpectrumOff:true, liteFx:true, liteBlur:true,
  liteDecor:true, liteLibRows:"device", liteNoAnalyze:false, liteMascotNoLoad:false, liteGameFull:false, liteSeen:true };
function saveUserPrefs(){ saves++; }
function tr(k, vars){ return k + (vars ? " " + JSON.stringify(vars) : ""); }
function on(){}
function emit(){}
function plToast(t){ toasts.push(t); }
/* 名前空間 D：lite.js は window.Trk.core.* を読む（同じ束縛へ向ける） */
var window = { Trk: { core: { $: id => null, emit, phase: "title", saveUserPrefs, get settings(){ return settings; } } } };
`;
/* liteInit() は設定画面の DOM を配線する関数なので、評価だけさせて呼ばない（IDの網羅は下の静的検査で見張る） */
/* 即時関数で包まれていても、中の名前を同じ方法で取り出す（包みの先頭と末尾だけを外す） */
let body = liteSource.replace(/^\(\(\) => \{\n/, "").replace(/\}\)\(\);\s*$/, "");
body = body.replace(/\nliteInit\(\);\n/, "\n/* liteInit() is wired against the real DOM; skipped here */\n");
assert.notEqual(body, liteSource, "js/lite.js still calls liteInit() at the end");
body = "var __exports = null;\n" + body + `
;__exports = { liteActive, liteAllow, liteAllowGame, liteMascotAllow, liteNoMascot, liteSpecBlocked, liteBlurCap,
  liteDecorBlocked, liteDecorAllow, liteLibRows, liteNoAnalyze, liteMascotNoLoad, liteApplyPreset, litePresetId,
  liteApply, liteValueOf, litePixelRatio, LITE_PRESETS, LITE_DEFAULT_ON };`;
const ctx = vm.createContext({ console });
vm.runInContext(preamble, ctx, { filename: "js/lite.js#stub" });
vm.runInContext(body, ctx, { filename: "js/lite.js" });
const L = ctx.__exports;
const S = ctx.settings;
const set = patch => Object.assign(S, patch);

let checks = 0;
const eq = (got, want, label) => { checks++; assert.deepEqual(got, want, label); };
const truthy = (v, label) => { checks++; assert.ok(v, label); };

/* ---------- 1) 軽量化がオフのときは、何も働かない ---------- */
set({ liteMode:"off", liteDecor:true, liteLibRows:"60", liteNoAnalyze:true, liteMascotNoLoad:true, liteFps:"20" });
eq(L.liteActive(), false, "liteMode=off keeps lite mode off");
eq(L.liteLibRows(300), 300, "lite off: the song list is not shortened");
eq(L.liteNoAnalyze(), false, "lite off: audio analysis still runs");
eq(L.liteMascotNoLoad(), false, "lite off: the 3D mascot is still loaded at startup");
eq(L.liteDecorBlocked(), false, "lite off: decorations keep running");
eq(L.liteDecorAllow(ctx.__now), true, "lite off: every frame is drawn");
eq(L.liteSpecBlocked(), false, "lite off: the spectrum is not blocked");
eq(L.liteBlurCap(), 0, "lite off: no blur cap");
eq(L.litePixelRatio(2), 2, "lite off: pixel ratio untouched");

/* ---------- 2) オンでは4系統がそろって働く ---------- */
set({ liteMode:"on", liteScale:"1.5" });
eq(L.litePixelRatio(2), 1.5, "🖼 liteScale caps devicePixelRatio");
set({ liteScale:"1" }); eq(L.litePixelRatio(2), 1, "🖼 1.0× is the lightest"); set({ liteScale:"device" });
eq(L.litePixelRatio(2), 2, "🖼 device leaves it alone");
set({ liteScale:"1.5" });
eq(L.liteActive(), true, "liteMode=on turns lite mode on");
eq(L.liteLibRows(300), 60, "📜 liteLibRows caps the first song-list render");
eq(L.liteLibRows(40), 40, "📜 a shorter shelf stays as it is");
eq(L.liteLibRows(0), 0, "📜 0 and missing values never throw");
set({ liteLibRows:"150" }); eq(L.liteLibRows(300), 150, "📜 150 rows");
set({ liteLibRows:"device" }); eq(L.liteLibRows(300), 300, "📜 device = no cap");
set({ liteLibRows:"9999" }); eq(L.liteLibRows(300), 300, "📜 a bogus value falls back to no cap");
truthy(L.liteNoAnalyze() && L.liteMascotNoLoad() && L.liteDecorBlocked() && L.liteSpecBlocked(), "🧠🩷📡📊 all active while lite mode is on");

/* ---------- 3) 動き続ける装飾は liteFps の上限で間引く ---------- */
set({ liteFps:"60", liteLibRows:"device" });
eq(L.liteDecorAllow(0), true, "📡 60fps cap draws every frame (also with now=0)");
set({ liteFps:"20" });
ctx.__now = 20000;
eq(L.liteDecorAllow(20000), true, "📡 20fps cap draws the first frame");
eq(L.liteDecorAllow(20008), false, "📡 the next frame right away is skipped");
eq(L.liteDecorAllow(20055), true, "📡 55ms later it draws again");
eq(typeof L.liteDecorAllow(NaN), "boolean", "📡 a NaN timestamp is not a crash");
set({ liteDecor:false });
eq(L.liteDecorBlocked(), false, "📡 the decoration switch can be turned off");
eq(L.liteDecorAllow(20056), true, "📡 and then every frame draws again");
set({ liteDecor:true, liteFps:"30" });

/* ---------- 4) プリセットは新しい4キーもまとめて扱う ---------- */
for (const preset of L.LITE_PRESETS) {
  for (const key of ["liteFps", "liteMascot", "liteScale", "liteSpectrumOff", "liteFx", "liteBlur", "liteGameFull",
                     "liteDecor", "liteLibRows", "liteNoAnalyze", "liteMascotNoLoad"])
    truthy(Object.prototype.hasOwnProperty.call(preset.values, key), `preset ${preset.id} lists ${key}`);
}
L.liteApplyPreset("max");
eq(L.litePresetId(), "max", "🔋 maximum saving stays selected");
eq([S.liteLibRows, S.liteNoAnalyze, S.liteMascotNoLoad, S.liteDecor], ["60", true, true, true], "🔋 maximum saving also cuts what gets loaded");
set({ liteLibRows:"150" });
eq(L.litePresetId(), "custom", "changing one row turns the preset into custom");
L.liteApplyPreset("balanced");
eq(L.litePresetId(), "balanced", "🪶 balanced matches its values again");
eq([S.liteNoAnalyze, S.liteMascotNoLoad], [false, false], "🪶 balanced never skips loading");
L.liteApplyPreset("game");
eq([S.liteGameFull, S.liteNoAnalyze], [true, false], "🎯 game first keeps notes and loading untouched");
L.liteApplyPreset("nothing-here");
eq(L.litePresetId(), "game", "an unknown preset id changes nothing");
/* ✨軽量化しない の状態で軽いプリセットを当てると、mode も戻す（直さなかった方） */
L.liteApplyPreset("off");
eq([S.liteMode, L.liteActive()], ["off", false], "✨ no lite mode switches the mode off");
eq([S.liteDecor, S.liteLibRows, S.liteNoAnalyze, S.liteMascotNoLoad], [false, "device", false, false], "✨ no lite mode resets the new keys too");
L.liteApplyPreset("max");
eq([S.liteMode, L.liteActive()], ["on", true], "picking a lite preset while off re-enables lite mode");
/* 自動（auto）のまま、PC などで軽いプリセットを選んだら、mode を on にして効かせる（以前は auto のまま何も変わらなかった） */
S.liteMode = "auto";
L.liteApplyPreset("balanced");
eq(S.liteMode, "on", "picking a preset while auto switches to on (it must take effect)");
L.liteApplyPreset("max");   // 後の検査は最大節約の状態を前提にしている

/* ---------- 5) body クラス（CSS 側の間引き） ---------- */
const cls = ctx.document.body.classList.set;
L.liteApply();
truthy(cls.has("trkLite") && cls.has("trkLiteStill") && cls.has("trkLiteFx") && cls.has("trkNoMascot"),
  "🔋 maximum saving sets trkLite / trkLiteStill / trkLiteFx / trkNoMascot");
set({ liteDecor:false }); L.liteApply();
truthy(!cls.has("trkLiteStill") && cls.has("trkLite"), "📡 turning the decoration switch off lifts trkLiteStill only");
set({ liteMode:"off" }); L.liteApply();
truthy(!cls.has("trkLite") && !cls.has("trkLiteStill") && !cls.has("trkNoMascot"), "lite off lifts every lite class");
set({ liteMode:"auto" });

/* ---------- 6) M-02（Object.prototype などの継承キーを true にしない） ---------- */
set({ liteMode:"on", liteDecor:true });
eq(L.liteValueOf("constructor"), undefined, "liteValueOf ignores inherited keys");
eq(L.liteValueOf("toString"), undefined, "liteValueOf ignores toString");
eq(L.liteValueOf("liteDecor"), true, "liteValueOf reads the default-on keys as on");
eq(L.LITE_DEFAULT_ON.join(), "liteSpectrumOff,liteFx,liteBlur,liteDecor", "the default-on list is the one the panel shows");
set({ liteMascot:"off" });
eq([L.liteNoMascot("mmd"), L.liteNoMascot("vrm"), L.liteNoMascot("skin")], [true, true, false], "🩷 only the 3D mascots get skipped");
set({ liteMascot:"30" });

/* ---------- 7) 設定欄・既定値・リセット・4言語（静的） ---------- */
for (const id of ["liteDecor", "liteLibRows", "liteNoAnalyze", "liteMascotNoLoad"])
  truthy(html.includes(`id="${id}"`), `the ⚙ panel has #${id}`);
truthy(["device", "150", "60"].every(v => html.includes(`<option value="${v}" data-i18n="liteLibRows`)), "the row select offers the three choices");
for (const key of ["liteDecor", "liteLibRows", "liteNoAnalyze", "liteMascotNoLoad"]) {
  checks++;
  assert.ok(core.includes(`${key}: `), `js/core.js has a default for settings.${key}`);
  assert.equal((i18n.match(new RegExp("\\b" + key + ":", "g")) || []).length, 4, `settings.${key} label exists in four languages`);
}
const mediaSource = read("js/media.js");
truthy(mediaSource.includes("const ANALYZE_LITE_MAX_SEC = 10 * 60") &&
  mediaSource.includes("liteActive ? ANALYZE_LITE_MAX_SEC : ANALYZE_MAX_SEC") &&
  mediaSource.includes('liteLong ? "analysisSkippedLiteLong"'), "light mode uses a separate 10-minute analysis cap and status");
checks++;
assert.equal((i18n.match(/\banalysisSkippedLiteLong:/g) || []).length, 4,
  "the light-mode 10-minute skip reason exists in four languages");
truthy(core.includes('liteLibRows: ["device", "150", "60"]'), "LITE_ENUM_VALUES lists the row choices");
truthy(core.includes('"liteMode", "liteFps", "liteMascot", "liteScale", "liteLibRows", "trkTabName"'),
  "the emergency settings import validates liteLibRows too");
{
  const start = core.indexOf("function resetLitePrefs()");
  const body = start >= 0 ? core.slice(start, core.indexOf("\n}", start)) : "";
  for (const key of ["liteDecor", "liteLibRows", "liteNoAnalyze", "liteMascotNoLoad"])
    truthy(body.includes(`settings.${key} =`), `?reset=lite restores ${key}`);
}
truthy(core.includes("liteMascotNoLoad: prefs.liteMascotNoLoad === true") && core.includes("liteNoAnalyze: prefs.liteNoAnalyze === true") &&
  core.includes("liteDecor: prefs.liteDecor !== false"), "default-on/off of the new keys follows the existing style");
for (const [file, token] of [["js/media.js", "TrkLite.noAnalyze()"], ["js/library.js", "TrkLite.libRows(LIB_SHOW)"],
  ["js/fx-dock.js", "TrkLite.decorAllow("], ["js/video-max.js", 'TrkLite.allow("max"'], ["js/synth-mode.js", "TrkLite.decorBlocked"],
  ["js/mmd.js", "TrkLite.mascotNoLoad"], ["js/vrm.js", "TrkLite.mascotNoLoad"], ["js/custom.js", 'emit("mascot")'],
  ["css/style.css", "body.trkLiteStill #fxDock *"], ["js/media.js", "analysisSkippedLite"]])
  truthy(read(file).includes(token), `${file} wires ${token}`);
/* 古いキャッシュの lite.js と新しい js が組んでも落ちない（窓口関数の typeof 検査） */
for (const file of ["js/media.js", "js/library.js", "js/fx-dock.js", "js/mmd.js", "js/vrm.js"])
  truthy(/typeof TrkLite\.(noAnalyze|libRows|decorAllow|mascotNoLoad) === "function"/.test(read(file)) ||
    /TrkLite\.(noAnalyze|libRows|decorAllow|mascotNoLoad) &&/.test(read(file)),
    `${file} checks the TrkLite function exists before calling it`);

console.log(`🪶 lite mode check: ${checks} assertion(s) passed · gates, presets, ${L.LITE_PRESETS.length} presets, panel wiring in 4 languages`);
