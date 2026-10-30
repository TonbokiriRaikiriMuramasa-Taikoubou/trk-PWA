#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Small dependency-free repository smoke check.
 *
 * This is intentionally a static check: it catches broken references and
 * syntax regressions before a browser/device pass, but it does not claim to
 * replace real-browser testing.
 */
import fs from "node:fs";
import { restoreCoreAlias, sourceOf } from "./lib/js-source.mjs";
import { classicScriptOrder, stripCode } from "./globals-audit.mjs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
let warnings = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL  ${message}`);
}
function warn(message) {
  warnings += 1;
  console.warn(`WARN  ${message}`);
}
function ok(message) {
  console.log(`OK    ${message}`);
}
/* 名前空間 D：js/ の本文では、領域の接頭辞 window.Trk.<領域>. を取り除いて照合する（同じ束縛の別の書き方）。
   window.Trk.overlay は取り除かない（書斎・シンスの旗の検査が、その綴りを見る）。 */
/* 別名（const core = window.Trk.core;）を使うファイルは、同じ束縛として元の綴りに戻して照合する。
   alias の行を消し、その後の core. を取り除く（core.js の文字列は除く）。 */
function read(rel) {
  const text = sourceOf(rel, fs.readFileSync(path.join(root, rel), "utf8"));
  return rel.startsWith("js/") ? text.replace(/window\.Trk\.(?!overlay\b)[A-Za-z]\w*\./g, "") : text;
}

/* 利用者向けの説明文：README（概要）と docs/guide/*.md（くわしい説明）を合わせて読む。
   内容の有無を見る検査はこちらを使う。リンク先の存在は README 本体で見る。 */
function readReadme() {
  const guideDir = path.join(root, "docs/guide");
  const guide = fs.existsSync(guideDir) ? fs.readdirSync(guideDir).filter(f => f.endsWith(".md")).sort().map(f => fs.readFileSync(path.join(guideDir, f), "utf8")) : [];
  return [fs.readFileSync(path.join(root, "README.md"), "utf8"), ...guide].join("\n");
}

/* library.js の TEXT 断片（行頭の Object.assign(TEXT.xx, { … }); ）だけを評価した辞書。
   入手先ガイドは日本語の控え（note）を TEXT.ja から引くので、trkCatalogGuide を vm で動かす検査に渡す。 */
const LIBRARY_TEXT_FOR_CHECK = (() => {
  const TEXT = { ja: {}, en: {}, zh: {}, ko: {} };
  const context = vm.createContext({ TEXT });
  for (const block of read("js/library.js").match(/^Object\.assign\(TEXT\.(?:ja|en|zh|ko), \{[\s\S]*?^\}\);$/gm) || []) {
    new vm.Script(block).runInContext(context);
  }
  return TEXT;
})();

/* 曲名の照合（js/title-match.js の純関数）＋ plWishMatch（library.js）。
   check-repo の文字列検査と、vm での入出力検査が同じ定義を見るための共通の断片。 */
const titleMatchSrc = read("js/title-match.js");
const plWishMatchSlice = (read("js/library.js").match(/function plWishMatch[\s\S]*?(?=\nfunction plSyncWishes)/) || [""])[0];
const matchLogicSrc = titleMatchSrc + "\n" + plWishMatchSlice;
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".git" || ent.name === "node_modules") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
function localPath(value) {
  const clean = value.split(/[?#]/, 1)[0];
  return clean.startsWith("/") ? clean.slice(1) : clean;
}

// Every JavaScript file should at least parse in the Node parser. This does
// not execute browser code, so it remains safe and dependency-free.
const jsFiles = walk(path.join(root, "js")).filter(f => f.endsWith(".js"));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) fail(`JavaScript syntax: ${path.relative(root, file)}\n${(result.stderr || result.stdout).trim()}`);
}
if (!failures) ok(`JavaScript syntax (${jsFiles.length} files)`);

// Local script and stylesheet references in the entry point must resolve.
// Do not treat example script tags inside HTML comments as real assets.
const index = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
const refs = [
  ...[...index.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => ["script", m[1]]),
  ...[...index.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)].map(m => ["link", m[1]])
];
let missingRefs = 0;
for (const [kind, ref] of refs) {
  if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith("data:")) continue;
  const rel = localPath(ref);
  if (!exists(rel)) {
    missingRefs += 1;
    fail(`${kind} reference is missing: ${ref}`);
  }
}
if (!missingRefs) ok(`index.html local references (${refs.length} checked)`);

// Duplicate static IDs can silently wire event handlers to the wrong control.
const indexIds = [...index.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
const idCounts = new Map();
for (const id of indexIds) idCounts.set(id, (idCounts.get(id) || 0) + 1);
const duplicateIds = [...idCounts].filter(([, count]) => count > 1).map(([id, count]) => `${id} (${count})`);
if (duplicateIds.length) fail(`index.html contains duplicate IDs: ${duplicateIds.join(", ")}`);
else ok(`index.html static IDs are unique (${indexIds.length} checked)`);

// The fixed 1920×1080 stage must fit the current layout viewport, including narrow portrait screens.
{
  const css = read("css/style.css"), core = read("js/core.js");
  const fixed = css.includes("#stage{position:fixed;");
  const fit = core.includes("Math.min(innerWidth / W, innerHeight / H)") &&
    core.includes("stage.style.transform = `translate(-50%,-50%) scale(${s})`");
  const smoke = read("tools/smoke-browser.mjs");
  const viewportSmoke = smoke.includes("width:360, height:800") && smoke.includes("width:800, height:360") &&
    smoke.includes("getBoundingClientRect()") && smoke.includes("document.documentElement.scrollWidth");
  if (!fixed || !fit) fail("#stage must stay fixed to the viewport and fitStage() must scale against both viewport dimensions");
  else ok("#stage stays viewport-fixed and fitStage() scales for portrait and landscape viewports");
  if (!viewportSmoke) fail("the browser smoke must bound #stage in narrow portrait and short landscape viewports");
  else ok("browser smoke checks #stage bounds and document overflow at 360×800 and 800×360");
}

// 📺 TV picture looks and brightness/blur favorites: keep the documented
// preset count, four localized groups, safe long-press resets and bounded data.
{
  const presetSource = read("js/tv-presets.js");
  const tv = read("js/tv-dock.js");
  const core = read("js/core.js");
  const style = read("css/style.css");
  const notice = read("NOTICE.md");
  const ids = [...presetSource.matchAll(/\bid:"([^"]+)"/g)].map(m => m[1]);
  const catCounts = Object.fromEntries(["portrait", "anime", "texture", "quality"].map(cat =>
    [cat, (presetSource.match(new RegExp(`cat:"${cat}"`, "g")) || []).length]));
  const uniqueIds = new Set(ids).size === ids.length;
  const langsOk = ["tvCatPortrait", "tvCatAnime", "tvCatTexture", "tvCatQuality", "tvParamRandHint", "tvParamHint"]
    .every(key => (tv.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4);
  const presetsOk = ids.length === 70 && uniqueIds && Object.values(catCounts).every(n => n === 5);
  const resetOk = tv.includes('bindLongPressReset(rPar, () => applyParamValues(0, 0, "tvParamDefaultDone"))') &&
    tv.includes('bindLongPressReset(dimInp, () => applyParamValues(0, settings.bgBlur, "tvDimResetDone")') &&
    tv.includes('bindLongPressReset(blurInp, () => applyParamValues(settings.bgDim, 0, "tvBlurResetDone")') &&
    tv.includes('tvParamRandHint:"(長押しでデフォルトに戻します。)"') &&
    tv.includes('paramResetBtn.addEventListener("click"');
  const favoritesOk = core.includes("TV_PARAM_FAV_MAX = 8") && core.includes("cleanTvParamFavorites(prefs.tvParamFavs)") &&
    core.includes("settings.tvParamFavs = cleanTvParamFavorites(settings.tvParamFavs)") &&
    core.includes("settings.tvParamFavs = []") && tv.includes("cleanTvParamFavorites(prefs.tvParamFavs)") &&
    tv.includes("settings.tvParamFavs = cleanTvParamFavorites(settings.tvParamFavs)");
  const overlaysOk = ["portraitGlow", "softbox", "finegrain", "paper", "halftone"]
    .every(name => presetSource.includes(`overlay:"${name}"`) && tv.includes(`case "${name}"`));
  const canvasOriginalOk = tv.includes("function tvTextureRandom(seed)") && !tv.includes("fetch(") &&
    tv.includes("CanvasRenderingContext2D.filter is unavailable") && tv.includes("ctx.canvas.style.filter = filter") &&
    notice.includes("No third-party LUTs") && notice.includes("do not detect faces") && notice.includes("do not increase");
  const favoriteStyleOk = style.includes(".tvParamFavList") && style.includes(".tvParamTools");
  if (!presetsOk) fail(`TV preset catalog should contain 70 unique filters, five in each new category (found ${ids.length}; ${JSON.stringify(catCounts)})`);
  else if (!langsOk) fail("TV portrait/anime/texture/quality groups or parameter reset help are missing from one of the four languages");
  else if (!resetOk) fail("TV random button and brightness/blur sliders need their long-press reset paths and explicit reset control");
  else if (!favoritesOk) fail("brightness/blur favorites must be bounded, validated, persisted and safe-mode aware");
  else if (!overlaysOk || !canvasOriginalOk || !favoriteStyleOk) fail("original Canvas TV overlays, documented rights/scope, CSS-filter fallback, or parameter-favorite styling are missing");
  else ok("TV catalog (70 presets), localized picture categories, long-press resets, and bounded brightness/blur favorites are wired");
}

const privacy = read("privacy.html").replace(/<!--[\s\S]*?-->/g, "");
let missingPrivacyRefs = 0;
for (const match of privacy.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
  const ref = match[1];
  if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith("data:") || ref.startsWith("#")) continue;
  const rel = localPath(ref);
  if (!exists(rel)) {
    missingPrivacyRefs += 1;
    fail(`privacy.html reference is missing: ${ref}`);
  }
}
if (!missingPrivacyRefs) ok("privacy.html local references");

const credits = read("credits.html").replace(/<!--[\s\S]*?-->/g, "");
let missingCreditsRefs = 0;
for (const match of credits.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
  const ref = match[1];
  if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith("data:") || ref.startsWith("#")) continue;
  const rel = localPath(ref);
  if (!exists(rel)) {
    missingCreditsRefs += 1;
    fail(`credits.html reference is missing: ${ref}`);
  }
}
if (!missingCreditsRefs) ok("credits.html local references");

// The manifest's PWA icons are easy to break when an asset is regenerated.
try {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const icon of manifest.icons || []) {
    if (!icon.src || !exists(localPath(icon.src))) fail(`manifest icon is missing: ${icon.src}`);
  }
  if (Array.isArray(manifest.icons) && manifest.icons.length) ok(`manifest icons (${manifest.icons.length})`);
  else warn("manifest.webmanifest contains no icons");
} catch (error) {
  fail(`manifest.webmanifest is not valid JSON: ${error.message}`);
}

function pngSize(rel) {
  const b = fs.readFileSync(path.join(root, rel));
  if (b.length < 24 || !b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
for (const [rel, expectedWidth, expectedHeight] of [
  ["icons/icon-192.png", 192, 192],
  ["icons/icon-512.png", 512, 512],
  ["docs/og.png", 1200, 630]
]) {
  if (!exists(rel)) {
    fail(`required image is missing: ${rel}`);
    continue;
  }
  const size = pngSize(rel);
  if (!size) fail(`${rel} is not a PNG`);
  else if (size.width !== expectedWidth || size.height !== expectedHeight) fail(`${rel} is ${size.width}x${size.height}, expected ${expectedWidth}x${expectedHeight}`);
  else ok(`${rel} dimensions ${expectedWidth}x${expectedHeight}`);
}

// Keep the documented shelf count tied to the source of truth.
const skins = read("js/lib-skins.js");
const orderMatch = skins.match(/const LIB_SKIN_ORDER\s*=\s*\[([^\]]+)\]/s);
if (!orderMatch) {
  fail("LIB_SKIN_ORDER could not be read");
} else {
  const ids = [...orderMatch[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
  if (ids.length !== 30) fail(`expected 30 shelf skins, found ${ids.length}`);
  else ok("shelf skin count is 30");
}
if (/棚スキン11種|・11種類/.test(read("css/style.css") + skins)) {
  fail("stale shelf skin count (11) remains in source comments");
}

// Overall look skins: 33 presets in data.js (incl. the locked 🎓 reward skin, 3 見やすさ skins and 6 生活 skins, 4 ゲーム画面 skins) + 4 Miku skins = 44.
const dataJs = read("js/data.js");
const skinsStart = dataJs.indexOf("const SKINS = {");
const skinsEnd = dataJs.indexOf("\n};", skinsStart);
if (skinsStart < 0 || skinsEnd < 0) {
  fail("SKINS block could not be read in js/data.js");
} else {
  const presetCount = (dataJs.slice(skinsStart, skinsEnd).match(/label:\{ja:/g) || []).length;
  const mikuCount = (read("js/characters/miku.js").match(/^ {2}(?:window\.Trk\.data\.)?SKINS\.[A-Za-z0-9]+ = \{/gm) || []).length;
  if (presetCount + mikuCount !== 44) fail(`expected 44 overall skins, found ${presetCount + mikuCount}`);
  else ok("overall skin count is 44");
  /* 🎓 ごほうびスキン（グラデュエーション）は、スタンプ5つで解禁まで鍵がかかっていること */
  if (!/graduation:\s*\{[\s\S]*?locked:\s*true/.test(dataJs.slice(skinsStart, skinsEnd)) ||
      !read("js/core.js").includes("SKINS[id].locked && !settings.skinGradUnlocked")) fail("graduation reward-skin lock is missing");
  else ok("graduation reward skin stays locked until stamps");
}

// 🎧 Playlist tabs: user playlists in library.js, delete-mode setting in core.js, song profile storage.
if (!read("js/library.js").includes('startsWith("pl:")') ||
    !read("js/library.js").includes('SONG_META_KEY = "shadow_taiko_songmeta_v1"') ||
    !read("js/library.js").includes('PLAYED_KEY = "shadow_taiko_played_v1"') ||
    !read("js/library.js").includes('format: "trk-playlist"') ||
    !read("js/library.js").includes("plFolderSanitize") ||
    !read("js/core.js").includes("playlistDelMode") ||
    !read("js/core.js").includes("plFolders")) {
  fail("playlist tab plumbing is missing");
} else {
  ok("playlist tabs, profiles and sharing are wired");
}

// 🎚 Pro-audio effects: worklet processors + rack plumbing in fx.js.
if (!exists("js/fx-worklet.js") ||
    !read("js/fx-worklet.js").includes("trk-denoise") ||
    !read("js/fx-worklet.js").includes("trk-dyneq") ||
    !read("js/fx-worklet.js").includes("trk-gate") ||
    !read("js/fx.js").includes("settings.fxRack") ||
    !read("js/fx.js").includes("fxRackOn")) {
  fail("pro-audio effect plumbing is missing");
} else {
  ok("pro-audio effects (gate / denoise / dynamic EQ) and rack are wired");
}

// 🔥 TRK amp: the independent category right below "🎛 More (EQ / skin / menu)"
// at the bottom-left of the song column, driving the layered effect rack
// through the small rack API that fx.js exposes (the DSP itself is untouched).
{
  const fx = read("js/fx.js");
  const dock = read("js/fx-dock.js");
  const core = read("js/core.js");
  const css = read("css/style.css");
  const ampKeys = ["ampTitle", "ampHint", "ampUse", "ampStateOn", "ampStateOff", "ampEmpty", "ampStacksLabel",
    "ampStackTrk", "ampStackWarm", "ampStackRadio", "ampStackClean", "ampStackSet", "ampOnMsg", "ampOffMsg",
    "ampCleared", "ampFull", "ampStageAdd", "ampClear", "ampMore", "ampAdjustHint"];
  const apiOk = ['rack:() => ({ on:!!settings.fxRackOn, list:settings.fxRack.map(copy) })', "rackTypes:() => RACK_META.map",
    "rackOn:v =>", "rackSet:list =>", "rackAdd:type =>", "rackClear:() =>", 'emit("fxRack")'].every(t => fx.includes(t)) &&
    fx.includes("function cleanFx") && fx.includes("RACK_MAX = 8") &&
    /* 検証の定数（R / BIQUAD …）は、settings.fxRack を cleanFx で読む行より前に無いと
       保存済みの段がある人の読み込みで落ちる（参照エラー）ので、順番も見張る */
    fx.indexOf("const R = (v, lo, hi, d)") >= 0 &&
    fx.indexOf("const R = (v, lo, hi, d)") < fx.indexOf("settings.fxRack = (Array.isArray(prefs.fxRack)");
  const resetOk = ["function resetAmpPrefs()", 'markAmpReset("clear")', 'markAmpReset("off")',
    "function takeAmpReset()", '["amp","rack"].includes(r)'].every(t => core.includes(t)) &&
    fx.includes("takeAmpReset()") && fx.includes("if (ampReset === \"clear\") settings.fxRack = []");
  const uiOk = dock.includes('amp.id = "ampPanel"') && dock.includes("const AMP_STACKS") &&
    ["trk", "warm", "radio", "clean"].every(id => dock.includes(id + ":")) && dock.includes("data-ampstack") &&
    dock.includes('dock.append(dev, favChips, overLabel, overflow, body);') && dock.includes("const placeAmp = () =>") &&
    dock.includes('on("fxRack", renderAmp)') && dock.includes("const AMP_MAX = 8") &&
    dock.includes('settings.ampOpen = typeof prefs.ampOpen === "boolean" ? prefs.ampOpen : true') &&
    core.includes("settings.ampOpen = true;") && core.includes("settings.tvRichOpen = false;") &&
    fx.includes("settings.ampOpen = ampReset === \"clear\";") && dock.includes('data-i18n="sfxRackTitle"') &&
    ["TrkFX.rackSet(", "TrkFX.rackOn(true)", "TrkFX.rackAdd(", "TrkFX.rackClear()"].every(t => dock.includes(t)) &&
    css.includes("#ampPanel .ampStage") && css.includes("#ampPanel .ampStages");
  const langOk = ampKeys.every(k => (dock.match(new RegExp("\\b" + k + ":", "g")) || []).length === 4);
  if (!apiOk) fail("TRK amp rack API (fx.js) is missing: rack / rackTypes / rackOn / rackSet / rackAdd / rackClear (or the validators moved below the saved-rack load)");
  else if (!resetOk) fail("TRK amp reset plumbing (?reset=amp / ?reset=all / ?safe=1) is missing");
  else if (!uiOk) fail("TRK amp category (bottom-left, below 🎛 More) is not wired to the rack");
  else if (!langOk) fail("TRK amp strings are missing from one of the four languages");
  else ok("TRK amp: independent bottom-left category (below 🎛 More), open on arrival, with 4 stacks, stage chips and rack API in 4 languages");
}

// ✨ TRK effects: the independent bottom-left category right below 🔥 TRK amp,
// surfacing the "rich" video grades (portrait / anime / texture / studio) that
// tv-presets.js added. It only drives settings.videoStyle through TrkTV, so the
// TV's own video-filter list and this panel can never drift apart.
{
  const rich = read("js/tv-rich.js");
  const html = read("index.html");
  const css = read("css/style.css");
  const core = read("js/core.js");
  const keys = ["richTitle", "richHint", "richUse", "richOn", "richOff", "richSafe", "richPrevLabel",
    "richNextLabel", "richRandom", "richReset", "richRandomed", "richRestored", "richMore", "richNote", "richNoPreset"];
  const apiOk = rich.includes('panel.id = "richPanel"') && rich.includes('el("details", "panel dockRich")') &&
    rich.includes('const RICH_CATS = ["portrait", "anime", "texture", "quality"]') &&
    rich.includes("window.TrkTV") && rich.includes("TrkTV.list()") && rich.includes("TrkTV.select(") &&
    rich.includes("TrkTV.current()") && rich.includes('on("tvChange"') && rich.includes("const placeRich = () =>") &&
    rich.includes("settings.tvRichId") && rich.includes("settings.tvRichPrev") && rich.includes('typeof settings[key] === "string"') &&
    rich.includes("prefs.tvRichOpen !== false") && core.includes("settings.tvRichOpen = true;");
  const wireOk = html.includes('<script src="js/tv-rich.js"></script>') && css.includes("#richPanel .richChips") &&
    css.includes("#richPanel .richCats") && core.includes('settings.tvRichId = "portrait_natural"') &&
    core.includes("out.tvRichId = settings.tvRichId");
  const langOk = keys.every(k => (rich.match(new RegExp("\\b" + k + ":", "g")) || []).length === 4);
  if (!apiOk) fail("TRK effects (rich video) panel is not wired to the video filter (TrkTV / videoStyle)");
  else if (!wireOk) fail("TRK effects (rich video) is missing the script tag, styles, or the video reset/export keys");
  else if (!langOk) fail("TRK effects (rich video) strings are missing from one of the four languages");
  else ok("TRK effects: rich video grades as an independent bottom-left category (below 🔥 TRK amp), open on arrival, in 4 languages");
}

// 🛒 Official-source catalog: no-audio curated playlists with wishlist matching.
{
  const library = read("js/library.js");
  const css = read("css/style.css");
  const catalog = read("js/catalog.js");
  const babelStart = catalog.indexOf('PL("ak-babel"');
  const babelEnd = catalog.indexOf('PL("ak-hen"', babelStart + 1);
  const babelBlock = babelStart >= 0 && babelEnd > babelStart ? catalog.slice(babelStart, babelEnd) : "";
  const expectedBabelRows = [
    ["Storyteller", "https://monster-siren.hypergryph.com/music/779480"],
    ["Fire's Embrace", "https://monster-siren.hypergryph.com/music/953979"],
    ["The Opening", "https://monster-siren.hypergryph.com/music/697614"],
    ["Founding Stone", "https://monster-siren.hypergryph.com/music/048797"],
    ["Silent Tales", "https://monster-siren.hypergryph.com/music/461148"]
  ];
  const actualBabelRows = [...babelBlock.matchAll(/T\("([^"]+)",[^\n]*?"(https:\/\/monster-siren\.hypergryph\.com\/music\/\d{6})"\)/g)]
    .map(m => [m[1], m[2]]);
  const babelLinksOk = actualBabelRows.length === expectedBabelRows.length &&
    expectedBabelRows.every(([title, url], i) => actualBabelRows[i][0] === title && actualBabelRows[i][1] === url);
  const loneTrailStart = catalog.indexOf('PL("ak-lonetrail"');
  const loneTrailEnd = catalog.indexOf('PL("ak-walkindust"', loneTrailStart + 1);
  const loneTrailBlock = loneTrailStart >= 0 && loneTrailEnd > loneTrailStart ? catalog.slice(loneTrailStart, loneTrailEnd) : "";
  const expectedLoneTrailRows = [
    ["Ad astra", "https://monster-siren.hypergryph.com/music/125074"],
    ["Control's Wishes", "https://monster-siren.hypergryph.com/music/880337"],
    ["The Coming of the Future", "https://monster-siren.hypergryph.com/music/461158"],
    ["特里蒙的天空", "https://monster-siren.hypergryph.com/music/232266"],
    ["群星见我", "https://monster-siren.hypergryph.com/music/125073"],
    ["A World Above", "https://monster-siren.hypergryph.com/music/232265"],
    ["Rhine Lab.LLC", "https://monster-siren.hypergryph.com/music/779491"],
    ["Blues with you", "https://monster-siren.hypergryph.com/music/514542"],
    ["Bubble", "https://monster-siren.hypergryph.com/music/048700"],
    ["绿意游曳", "https://monster-siren.hypergryph.com/music/697629"]
  ];
  const actualLoneTrailRows = [...loneTrailBlock.matchAll(/T\("([^"]+)",[^\n]*?"(https:\/\/monster-siren\.hypergryph\.com\/music\/\d{6})"\)/g)]
    .map(m => [m[1], m[2]]);
  const loneTrailLinksOk = actualLoneTrailRows.length === expectedLoneTrailRows.length &&
    expectedLoneTrailRows.every(([title, url], i) => actualLoneTrailRows[i][0] === title && actualLoneTrailRows[i][1] === url);
  const loneTrailCatalogRefreshOk = catalog.includes('PL("ak-lonetrail", "LONETRAIL", "🚀"') &&
    library.includes('if (pl.id === "ak-lonetrail" && existing.cat === "trk:" + s.id + ":" + pl.id)') &&
    library.includes('if (JSON.stringify(existing.wish) !== JSON.stringify(wishes)) { existing.wish = wishes; changed = true; }') &&
    library.includes('if (existing.name === "アークナイツ — Lone Trail") { existing.name = pl.name; changed = true; }') &&
    library.includes('if (existing.icon === "🛤️") { existing.icon = pl.icon || s.icon; changed = true; }') &&
    library.includes('if (JSON.stringify(existing.tags) === JSON.stringify(["Game","Arknights","MSR","Lone Trail"]))');
  const xuStart = catalog.indexOf('PL("ak-hen"');
  const xuNext = catalog.indexOf('\n   PL(', xuStart + 1);
  const xuEnd = xuNext >= 0 ? xuNext : catalog.indexOf('])]);', xuStart);
  const xuBlock = xuStart >= 0 && xuEnd > xuStart ? catalog.slice(xuStart, xuEnd) : "";
  const expectedXuRows = [
    ["2:00 PM in Mitsukue", "https://monster-siren.hypergryph.com/music/779461"],
    ["墟", "https://monster-siren.hypergryph.com/music/232232"],
    ["夏日潜行", "https://monster-siren.hypergryph.com/music/306880"],
    ["夜间超速", "https://monster-siren.hypergryph.com/music/048779"],
    ["刀刃所栖之物", "https://monster-siren.hypergryph.com/music/514514"],
    ["关掉播放器之前", "https://monster-siren.hypergryph.com/music/697697"],
    ["与你在黄昏街角相遇", "https://monster-siren.hypergryph.com/music/125048"]
  ];
  const actualXuRows = [...xuBlock.matchAll(/T\("([^"]+)",[^\n]*?"(https:\/\/monster-siren\.hypergryph\.com\/music\/\d{6})"\)/g)]
    .map(m => [m[1], m[2]]);
  const xuLinksOk = actualXuRows.length === expectedXuRows.length &&
    expectedXuRows.every(([title, url], i) => actualXuRows[i][0] === title && actualXuRows[i][1] === url);
  const xuRefreshStart = library.indexOf('if (pl.id === "ak-hen" && existing.cat === "trk:" + s.id + ":" + pl.id)');
  const xuRefreshEnd = library.indexOf("\n        }\n        continue;", xuRefreshStart);
  const xuRefreshBlock = xuRefreshStart >= 0 && xuRefreshEnd > xuRefreshStart ? library.slice(xuRefreshStart, xuRefreshEnd) : "";
  const xuCatalogRefreshOk = catalog.split('PL("ak-hen"').length - 1 === 1 &&
    catalog.includes('PL("ak-hen", "アークナイツ — 墟", "👹"') &&
    !xuBlock.includes('T("痕 — Wounds"') &&
    xuRefreshBlock.includes('if (JSON.stringify(existing.wish) !== JSON.stringify(wishes)) { existing.wish = wishes; changed = true; }') &&
    library.includes('if (pl.id === "ak-hen" && existing.cat === "trk:" + s.id + ":" + pl.id)') &&
    library.includes('if (existing.name === "アークナイツ — 痕") { existing.name = pl.name; changed = true; }') &&
    library.includes('if (existing.icon === "🩹") { existing.icon = pl.icon || s.icon; changed = true; }') &&
    library.includes('if (JSON.stringify(existing.tags) === JSON.stringify(["Game","Arknights","MSR","痕"]))');
  const eventPlaylistExpected = {
    "ak-solongadele": [
      ["Misty Memory (Day Version)", "https://monster-siren.hypergryph.com/music/048708"],
      ["Misty Memory (Night Version)", "https://monster-siren.hypergryph.com/music/306816"],
      ["Misty Memory (Acoustic Version)", "https://monster-siren.hypergryph.com/music/880333"],
      ["Effervescence", "https://monster-siren.hypergryph.com/music/306815"],
      ["Counting Sheep", "https://monster-siren.hypergryph.com/music/953981"],
      ["Sheepnado Decimates Nomadic City", "https://monster-siren.hypergryph.com/music/232262"],
      ["Adele's Dream", "https://monster-siren.hypergryph.com/music/125070"],
      ["So Long for Another Summer", "https://monster-siren.hypergryph.com/music/514549"],
      ["Drifting Blossom", "https://monster-siren.hypergryph.com/music/461154"]
    ],
    "ak-nearlight": [
      ["大骑士领", "https://monster-siren.hypergryph.com/music/125091"],
      ["骑士之日", "https://monster-siren.hypergryph.com/music/697642"],
      ["无畏者", "https://monster-siren.hypergryph.com/music/953900"],
      ["冠军对决", "https://monster-siren.hypergryph.com/music/048729"]
    ],
    "ak-silverneherze": [
      ["Day Train to Lake Silberneherze", "https://monster-siren.hypergryph.com/music/514538"],
      ["Play with Burdenbeasts", "https://monster-siren.hypergryph.com/music/779486"],
      ["First Crevasse on the Frozen Lake", "https://monster-siren.hypergryph.com/music/461143"]
    ],
    "ak-ilsiracusano": [
      ["叙拉古人", "https://monster-siren.hypergryph.com/music/048728"],
      ["文明之名", "https://monster-siren.hypergryph.com/music/880356"],
      ["狼之主", "https://monster-siren.hypergryph.com/music/514563"],
      ["我即荒野", "https://monster-siren.hypergryph.com/music/880355"]
    ],
    "ak-stultiferanavis": [
      ["愚人曲", "https://monster-siren.hypergryph.com/music/953915"],
      ["黄金时代的遗产", "https://monster-siren.hypergryph.com/music/880362"],
      ["蔓延", "https://monster-siren.hypergryph.com/music/514570"],
      ["礁石不朽", "https://monster-siren.hypergryph.com/music/306849"],
      ["深渊梦呓", "https://monster-siren.hypergryph.com/music/697654"],
      ["Hunter's Song", "https://monster-siren.hypergryph.com/music/125007"]
    ],
    "ak-whoreal": [
      ["今夕何夕", "https://monster-siren.hypergryph.com/music/953903"],
      ["起墨", "https://monster-siren.hypergryph.com/music/697645"],
      ["何时卷", "https://monster-siren.hypergryph.com/music/779411"],
      ["几更笔", "https://monster-siren.hypergryph.com/music/048722"],
      ["山水烬尽", "https://monster-siren.hypergryph.com/music/880350"]
    ],
    "ak-comevultures": [
      ["巴伦巨舰", "https://monster-siren.hypergryph.com/music/697625"],
      ["Case Ejection", "https://monster-siren.hypergryph.com/music/232261"],
      ["The Survivor, The Winner", "https://monster-siren.hypergryph.com/music/880332"]
    ],
    "ak-zwillingstuerme": [
      ["Visage", "https://monster-siren.hypergryph.com/music/514547"],
      ["Underneath the Spires", "https://monster-siren.hypergryph.com/music/125078"],
      ["Der Hexenkönig", "https://monster-siren.hypergryph.com/music/779496"],
      ["Die Sünden des Herkunftshorns", "https://monster-siren.hypergryph.com/music/697623"],
      ["The Theme (Imperial)", "https://monster-siren.hypergryph.com/music/779495"],
      ["The Theme (Variant)", "https://monster-siren.hypergryph.com/music/461151"],
      ["Pavillon, My Last Creation", "https://monster-siren.hypergryph.com/music/306812"],
      ["Scordatura", "https://monster-siren.hypergryph.com/music/880330"],
      ["Before the Cessation", "https://monster-siren.hypergryph.com/music/232269"]
    ]
  };
  const eventPlaylistNames = {
    "ak-solongadele": "アークナイツ — So Long, Adele",
    "ak-nearlight": "アークナイツ — Near Light",
    "ak-silverneherze": "アークナイツ — The Rides to Lake Silberneherze",
    "ak-ilsiracusano": "アークナイツ — Il Siracusano",
    "ak-stultiferanavis": "アークナイツ — Stultifera Navis",
    "ak-whoreal": "アークナイツ — Who Is Real",
    "ak-comevultures": "アークナイツ — Come Catastrophes or Wakes of Vultures",
    "ak-zwillingstuerme": "アークナイツ — Zwillingstürme im Herbst"
  };
  const eventPlaylistLinksOk = Object.entries(eventPlaylistExpected).every(([id, expectedRows]) => {
    const start = catalog.indexOf(`PL("${id}"`);
    if (start < 0 || catalog.split(`PL("${id}"`).length - 1 !== 1 ||
        !catalog.includes(`PL("${id}", "${eventPlaylistNames[id]}"`)) return false;
    const next = catalog.indexOf("\n   PL(", start + 1);
    const final = catalog.indexOf("])]);", start);
    const end = next >= 0 && final >= 0 ? Math.min(next, final) : next >= 0 ? next : final;
    if (end <= start) return false;
    const block = catalog.slice(start, end);
    const actualRows = [...block.matchAll(/T\("([^\"]+)",[^\n]*?"(https:\/\/monster-siren\.hypergryph\.com\/music\/\d{6})"\)/g)]
      .map(m => [m[1], m[2]]);
    return actualRows.length === expectedRows.length &&
      expectedRows.every(([title, url], i) => actualRows[i][0] === title && actualRows[i][1] === url);
  });
  const soLongRefreshStart = library.indexOf('if (pl.id === "ak-solongadele" && existing.cat === "trk:" + s.id + ":" + pl.id)');
  const soLongRefreshEnd = library.indexOf("\n        }", soLongRefreshStart);
  const soLongRefreshBlock = soLongRefreshStart >= 0 && soLongRefreshEnd > soLongRefreshStart ?
    library.slice(soLongRefreshStart, soLongRefreshEnd) : "";
  const soLongCatalogRefreshOk = catalog.split('PL("ak-solongadele"').length - 1 === 1 &&
    catalog.includes('PL("ak-solongadele", "アークナイツ — So Long, Adele"') &&
    soLongRefreshBlock.includes('if (JSON.stringify(existing.wish) !== JSON.stringify(wishes)) { existing.wish = wishes; changed = true; }');
  /* 📡 「集める棚」：未入手の曲を開いた瞬間から灰色で並べ、入手したら黒くなる */
  const collectionOk = titleMatchSrc.includes("function plTitleKeys(") &&
    /function plWishMatch\(w, byTitle\) \{\s*for \(const k of plWishTitleKeys\(w\)\)/.test(library) &&
    titleMatchSrc.includes("function plSongMatchKeys(title, matchHint)") &&
    library.includes("for (const k of plSongMatchKeys(m.title || it.title, m.matchHint)) byTitleAdd(k, it);") &&
    library.includes("function plCollectionEntries(") && library.includes("function plWishFolderIds(") &&
    library.includes("const entries = plCollectionEntries(tabId, byTitle);") &&
    library.includes("if (!all.length && !entries.length) {") &&
    library.includes("if (!row.it) { box.append(plWishRow(row.w)); continue; }") &&
    library.includes("function trkFolderIdSet() { return plWishFolderIds(TRK_FOLDER_ID); }") &&
    library.includes("const haveAll = usedKeys.size, totalAll = entries.length;") &&
    library.includes("const usedKeys = new Set();") &&
    !library.includes("const wishLeft = []") &&   /* 下部の 📡 ブロックは行内の灰色行に置き換えた */
    /plWishRow\{[^}]*opacity/.test(css) && css.includes(".plWishHint{");
  /* 4言語ぶんの文言（ja/en/zh/ko で各4回）。行をまとめて書き換えたときに片方を消した事故を止める */
  const stringsOk = ["plWishHead", "plWishTag", "plWishHint", "plWishOpen", "plWishNoLink",
    "plCatalogBtn", "plCatalogHint", "plCatalogTake", "plCatalogTaken", "plCatalogDup"]
    .every(k => library.split(k + ':\"').length - 1 === 4);
  const profileMatchStringsOk = ["plMatchMemo", "plMatchMemoPh", "plMatchMemoNote"]
    .every(k => library.split(k + ':\"').length - 1 === 4);
  let matchHintBehaviorOk = false;
  try {
    const logic = plWishMatchSlice ? [matchLogicSrc] : null;
    if (logic) {
      const ctx = { metaOf: () => null };
      vm.runInNewContext(`${logic[0]}\nglobalThis.__plSongMatchKeys = plSongMatchKeys; globalThis.__plWishMatch = plWishMatch;`, ctx);
      const mapSong = (title, hint) => {
        const it = { key:title, title }, byTitle = new Map();
        for (const key of ctx.__plSongMatchKeys(title, hint)) {
          const hits = byTitle.get(key) || [];
          if (!hits.includes(it)) hits.push(it);
          byTitle.set(key, hits);
        }
        return { it, byTitle };
      };
      const examples = [
        ["BELIEVE.ogg", "Suguri", "Suguri - BELIEVE"],
        ["Comet.ogg", "Hime", "Hime - Comet"],
        ["Up_to_you.ogg", "Sora", "Sora - Up to you"]
      ];
      matchHintBehaviorOk = examples.every(([title, hint, wishTitle]) => {
        const { it, byTitle } = mapSong(title, hint);
        return ctx.__plWishMatch({ t:wishTitle, al:"", ar:"" }, byTitle) === it && it.title === title;
      });
      /* 曲名かメモの片方だけでよい。メモなしで BELIEVE.ogg、または別タイトル＋Suguri でも候補に当たる。 */
      const titleOnly = mapSong("BELIEVE.ogg", "");
      const hintOnly = mapSong("unrelated.ogg", "Suguri");
      const noMatch = mapSong("unrelated.ogg", "other hint");
      matchHintBehaviorOk = matchHintBehaviorOk &&
        ctx.__plWishMatch({ t:"Suguri - BELIEVE", al:"", ar:"" }, titleOnly.byTitle) === titleOnly.it &&
        ctx.__plWishMatch({ t:"Suguri - BELIEVE", al:"", ar:"" }, hintOnly.byTitle) === hintOnly.it &&
        ctx.__plWishMatch({ t:"Suguri - BELIEVE", al:"", ar:"" }, noMatch.byTitle) === null;
    }
  } catch (_) { matchHintBehaviorOk = false; }
  const fileExtensionOk = !/\.pgg\b/i.test(library + readReadme() + read("docs/HANDOFF.md")) &&
    /BELIEVE\.ogg/i.test(readReadme() + read("docs/HANDOFF.md"));
  const profileMatchOk = fileExtensionOk && library.includes('["matchHint", 80]') &&
    titleMatchSrc.includes('function plWishTitleKeys(wish)') &&
    library.includes('matchMemo.placeholder = tr("plMatchMemoPh")') &&
    library.includes('f.matchHint = matchMemo') &&
    library.includes('m.matchHint ? `${tr("plMatchMemo")}: ${m.matchHint}` : ""') &&
    profileMatchStringsOk && matchHintBehaviorOk;
  if (!exists("js/catalog.js") ||
      !read("js/catalog.js").includes("TRK_CATALOG") ||
      !library.includes("plCatalogMenu") ||
      !library.includes("plWishMatch") ||
      !library.includes("function plWishRow(") ||
      !read("index.html").includes('src="js/catalog.js"')) {
    fail("official catalog plumbing is missing");
  } else if (!collectionOk || !stringsOk || !profileMatchOk) {
    fail("the collection shelf, .ogg examples, or one-sided local profile match-hint path is incomplete");
  } else if (!babelLinksOk) {
    fail("the five Babel OST tracks do not point to their matching Monster-Siren song pages in order");
  } else if (!loneTrailLinksOk || !loneTrailCatalogRefreshOk) {
    fail("the ten LONETRAIL songs, direct links, or safe refresh for existing catalog imports are incomplete");
  } else if (!xuLinksOk || !xuCatalogRefreshOk) {
    fail("the seven 墟 songs, direct links, or safe replacement of existing 痕 imports are incomplete");
  } else if (!eventPlaylistLinksOk || !soLongCatalogRefreshOk) {
    fail("selected Arknights event OST titles, direct song links, or safe So Long, Adele catalog refresh are incomplete");
  } else {
    ok("official catalog (wishlist auto-match, profile match hint, Babel + LONETRAIL + 墟 + selected event OSTs, no bundled audio) is wired");
  }
}

// 🎯 VALORANT / 🩺 Arknights / ❄ Genshin / 🍊 OJ / 🌟 Gakumas catalog updates:
// official destinations, separated distribution claims, SEARCH RIGHT/LIGHT alias, safe refresh.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  let targetCatalogOk = false;
  let valorantCsOk = false;
  let aliasBehaviorOk = false;
  let safeRefreshOk = false;
  try {
    const fixture = JSON.parse(read("tools/gakumas-download-tracks.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const all = catalogContext.__TRK_CATALOG_FOR_CHECK;
    const gakumas = all.find(series => series.id === "gakumas");
    const instrumentLists = gakumas && ["gm-inst", "gm-inst2"].map(id => gakumas.playlists.find(pl => pl.id === id));
    const discography = gakumas && gakumas.playlists.find(pl => pl.id === "gm-releases");
    const instrumentSongs = instrumentLists && instrumentLists.flatMap(pl => pl.songs);
    const searchRight = instrumentSongs && instrumentSongs.find(track => track.t === "SEARCH RIGHT");
    const officialDiscographyUrl = url => /^https:\/\/gakuen-label\.idolmaster-official\.jp\/discography\/[A-Za-z0-9_-]+$/.test(url || "");
    const gakumasDataOk = !!gakumas && gakumas.url === fixture.sourcePage &&
      fixture.sourceUrl === "https://drive.google.com/drive/folders/1iv1Qrca365CpgklE5z-Al40_hNZI11Ly?usp=sharing" &&
      fixture.files.length === 50 && new Set(fixture.files).size === 50 &&
      instrumentLists.every((pl, i) => pl && pl.songs.length === 25 &&
        pl.sourceUrl === fixture.sourceUrl && pl.sourceLabel.includes("公式Google Drive") &&
        pl.songs.every(track => officialDiscographyUrl(track.u))) &&
      instrumentSongs.length === 50 && discography && discography.songs.length === 14 &&
      discography.sourceUrl === "https://gakuen-label.idolmaster-official.jp/discography" &&
      discography.songs.every(track => officialDiscographyUrl(track.u)) &&
      fixture.filenameAliases["SEARCH RIGHT"] === "SEARCH LIGHT" &&
      fixture.files.includes("SEARCH LIGHT") && searchRight &&
      JSON.stringify(searchRight.matchAliases) === JSON.stringify(["SEARCH LIGHT"]) &&
      gakumas.note.includes("限定的なファン動画向け") && gakumas.note.includes("購入や所持による利用許諾ではありません") &&
      gakumas.note.includes("配布不可と断定せず") && gakumas.note.includes("2026-10-14");

    const valorant = all.find(series => series.id === "valorant");
    const valThemes = valorant && valorant.playlists.find(pl => pl.id === "val-themes");
    const valAgents = valorant && valorant.playlists.find(pl => pl.id === "val-agent-themes");
    const genshin = all.find(series => series.id === "genshin");
    const arknights = all.find(series => series.id === "arknights");
    const xu = arknights && arknights.playlists.find(pl => pl.id === "ak-hen");
    const carnevale = arknights && arknights.playlists.find(pl => pl.id === "ak-ilcarnevale");
    const sam = all.find(series => series.id === "samfree");
    const oj = all.find(series => series.id === "oj");
    targetCatalogOk = gakumasDataOk &&
      !!valorant && valorant.url === "https://www.riotgames.com/en/riot-music-creator-safe-guidelines" &&
      !!valThemes && valThemes.songs.length === 6 && !!valAgents && valAgents.songs.length === 3 &&
      valorant.note.includes("二次利用許諾ではありません") && valorant.note.includes("Creator-Safe") &&
      !!genshin && genshin.playlists.length === 1 && genshin.playlists[0].songs.length === 12 &&
      genshin.playlists[0].songs.every(track => /^https:\/\/music\.apple\.com\/(?:us|jp)\/song\//.test(track.u)) &&
      genshin.note.includes("サブスク・購入は二次利用許諾ではありません") &&
      !!xu && xu.name === "アークナイツ — 墟" && xu.icon === "👹" && xu.songs.length === 7 &&
      !!carnevale && carnevale.songs.length === 6 &&
      arknights.playlists.every(pl => pl.songs.every(track => /^https:\/\/monster-siren\.hypergryph\.com\/music\/\d{6}$/.test(track.u))) &&
      !!sam && sam.playlists[0].songs.length === 10 &&
      sam.note.includes("個別の公式曲ページ・配布条件・二次利用許諾は未確認") &&
      !!oj && oj.playlists[0].songs.length === 15 &&
      oj.note.includes("個別公式曲ページや再利用許諾は未確認") &&
      [...sam.playlists, ...oj.playlists].every(pl => pl.songs.every(track => track.u === "https://fruitbatfactory.com/100orange/"));

    /* 🎯 VALORANT Creator-Safe（trk117）：VALORANT公式Creator-Safe Playlist（Spotify・全40曲）の記録と、
       catalog.js の VAL_CREATOR_SAFE・各リストの曲が矛盾しないこと。記録した40曲に入っている曲の数が
       matchedTracks、入っていない曲が notFound（今は9曲とも入っていない＝links-absent）。 */
    const valFixture = JSON.parse(read("tools/valorant-creator-safe.json"));
    const valCs = valFixture.creatorSafe || {};
    const normTitle = title => String(title).normalize("NFKC").replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();
    const valEntryTitles = new Set((valCs.entries || []).map(entry => normTitle(entry[0])));
    valorantCsOk = !!valorant && valCs.playlist === "https://open.spotify.com/playlist/4tyTLcBxJnf7DcQcHjwt0W" &&
      Array.isArray(valCs.entries) && valCs.entries.length === 40 &&
      valCs.entries.every(entry => Array.isArray(entry) && entry.length === 3 && entry.every(part => typeof part === "string" && part) &&
        /^[A-Za-z0-9]{22}$/.test(entry[2])) &&
      valCs.soundcloudPlaylist && valCs.soundcloudPlaylist.url === "https://soundcloud.com/valorant/sets/valorant-creator-safe-playlist" &&
      Array.isArray(valFixture.lists) && valFixture.lists.length === valorant.playlists.length &&
      valorant.playlists.every(pl => {
        const listed = valFixture.lists.find(list => list.id === pl.id);
        const c = (listed && listed.creatorSafe) || {};
        const titles = pl.songs.map(track => track.t);
        const found = titles.filter(title => valEntryTitles.has(normTitle(title)));
        const missing = titles.filter(title => !valEntryTitles.has(normTitle(title)));
        const statusFromEvidence = found.length === titles.length ? "links-verified" : found.length ? "links-partial" : "links-absent";
        return c.status === statusFromEvidence && pl.creatorSafe === c.status && c.matchedTracks === found.length &&
          (c.status === "links-verified" ? c.notFound === undefined : JSON.stringify(c.notFound) === JSON.stringify(missing)) &&
          c.evidence === "embed" && /^2026-\d{2}-\d{2}$/.test(c.checkedAt || "");
      }) &&
      valorant.note.includes("VALORANT公式Creator-Safe Playlist") && valorant.note.includes("見当たりませんでした") &&
      valorant.note.includes("Creator-Safe対象外・要確認");

    const wishHelperStart = library.indexOf("function trkWishFromTrack(");
    const wishHelperEnd = library.indexOf("\nfunction trkWishesFromCatalog", wishHelperStart);
    const sanitizeStart = library.indexOf("function plSanitize(raw) {");
    const sanitizeEnd = library.indexOf("\nconst TRK_PLAYLIST_ID", sanitizeStart);
    const matchLogic = plWishMatchSlice ? [matchLogicSrc] : null;
    if (gakumasDataOk && wishHelperStart >= 0 && wishHelperEnd > wishHelperStart &&
        sanitizeStart >= 0 && sanitizeEnd > sanitizeStart && matchLogic) {
      const aliasContext = vm.createContext({ PL_COLORS:{}, metaOf:() => null });
      new vm.Script(library.slice(wishHelperStart, wishHelperEnd) + "\n" +
        library.slice(sanitizeStart, sanitizeEnd) + "\n" + matchLogic[0] +
        "\nglobalThis.__trkWishFromTrack = trkWishFromTrack; globalThis.__plSanitize = plSanitize;" +
        " globalThis.__plWishMatch = plWishMatch; globalThis.__plSongMatchKeys = plSongMatchKeys;").runInContext(aliasContext);
      const projectedWish = aliasContext.__plSanitize({ id:"gakumas-alias-check", wish:[aliasContext.__trkWishFromTrack(searchRight)] }).wish[0];
      const downloadedFile = { key:"local-search-light", title:"SEARCH LIGHT.ogg", artist:"not 初星学園" };
      const byTitle = new Map();
      for (const key of aliasContext.__plSongMatchKeys(downloadedFile.title, "")) byTitle.set(key, [downloadedFile]);
      const unrelatedFile = { key:"unrelated", title:"unrelated.ogg", artist:"" };
      const unrelatedMap = new Map([["unrelated.ogg", [unrelatedFile]], ["unrelated", [unrelatedFile]]]);
      aliasBehaviorOk = projectedWish.t === "SEARCH RIGHT" &&
        JSON.stringify(projectedWish.matchAliases) === JSON.stringify(["SEARCH LIGHT"]) &&
        aliasContext.__plWishMatch(projectedWish, byTitle) === downloadedFile &&
        aliasContext.__plWishMatch(projectedWish, unrelatedMap) === null;

      const toWish = track => {
        const wish = { t:track.t, al:track.al || "", ar:track.ar || "", u:track.u || "" };
        if (Array.isArray(track.matchAliases) && track.matchAliases.length) wish.matchAliases = track.matchAliases.slice(0, 8);
        return wish;
      };
      const allGakumasWishes = gakumas.playlists.flatMap(pl => pl.songs.map(toWish));
      const owned = ["owned-gakumas-song"];
      const manualOwned = ["manual-gakumas-song"];
      const autoExisting = { id:"trk-gm-inst", cat:"trk:gakumas:gm-inst", name:"My renamed instruments", icon:"🎧", tags:["my-custom-tag"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:owned, guide:{note:"old guide", url:"https://example.com/old"} };
      const manuallyImported = { id:"manual-gm-inst", cat:"gakumas:gm-inst", name:"My manual list", icon:"🌟", tags:["manual"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:manualOwned, guide:{note:"old guide", url:"https://example.com/old"} };
      const renamedDefault = { id:"previous-gm-inst", cat:"trk:gakumas:gm-inst", name:"学マス インスト厳選 — キャラ別 Vol.1", icon:"🎛", tags:["old-tag"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:["owned-default-song"], guide:{note:"old guide", url:"https://example.com/old"} };
      const legacyOwned = ["legacy-gakumas-song"];
      const legacy = { id:"trk-gakumas-v1", cat:"trk:gakumas", name:"My legacy Gakumas", icon:"🌸", tags:["legacy-custom"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:legacyOwned, guide:{note:"old guide", url:"https://example.com/old"} };
      const testSettings = { playlists:[autoExisting, manuallyImported, renamedDefault, legacy] };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings:testSettings,
        ensureTrkFolder:() => {},
        trkCatalog:() => [gakumas],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize:raw => raw,
        saveUserPrefs:() => { saveCount++; },
        trkWishesForSeries:() => allGakumasWishes
      });
      new vm.Script(library.slice(wishHelperStart, wishHelperEnd) + "\n" +
        library.slice(library.indexOf("function trkCatalogGuide("), library.indexOf("\n(function plTighten()")) +
        "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const expectedInstrumentWish = instrumentLists[0].songs.map(toWish);
      const updatedImported = JSON.stringify(autoExisting.wish) === JSON.stringify(expectedInstrumentWish) &&
        JSON.stringify(manuallyImported.wish) === JSON.stringify(expectedInstrumentWish) &&
        autoExisting.guide.url === fixture.sourcePage && manuallyImported.guide.url === fixture.sourcePage &&
        autoExisting.guide.note.includes("ファン動画向け") && manuallyImported.guide.note.includes("ファン動画向け");
      const preservedUserData = autoExisting.name === "My renamed instruments" && autoExisting.icon === "🎧" &&
        JSON.stringify(autoExisting.tags) === JSON.stringify(["my-custom-tag"]) && autoExisting.songs === owned &&
        manuallyImported.name === "My manual list" && manuallyImported.icon === "🌟" &&
        JSON.stringify(manuallyImported.tags) === JSON.stringify(["manual"]) && manuallyImported.songs === manualOwned &&
        renamedDefault.name === instrumentLists[0].name && renamedDefault.icon === "🎛" &&
        JSON.stringify(renamedDefault.tags) === JSON.stringify(["old-tag"]) &&
        JSON.stringify(renamedDefault.songs) === JSON.stringify(["owned-default-song"]) &&
        legacy.name === "My legacy Gakumas" && legacy.icon === "🌸" &&
        JSON.stringify(legacy.tags) === JSON.stringify(["legacy-custom"]) && legacy.songs === legacyOwned;
      const legacyRefresh = JSON.stringify(legacy.wish) === JSON.stringify(allGakumasWishes) &&
        legacy.guide.url === fixture.sourcePage && legacy.guide.note.includes("ファン動画向け限定") &&
        legacy.guide.note.includes("Drive未掲載は配布不可の証明ではありません");
      const createsSeparatedLists = ["gm-inst2", "gm-releases"].every(id => {
        const created = testSettings.playlists.find(pl => pl.id === "trk-" + id);
        return !!created && created.folder === "trk-gakumas" && created.wish.length ===
          gakumas.playlists.find(pl => pl.id === id).songs.length && created.guide.url === fixture.sourcePage;
      });
      safeRefreshOk = updatedImported && preservedUserData && legacyRefresh && createsSeparatedLists && saveCount > 0;
    }
  } catch (error) {
    console.error(`WARN  targeted catalog test setup failed: ${error.message}`);
  }
  if (!targetCatalogOk) fail("VALORANT / Arknights / Genshin / OJ / Gakumas source, count, or rights-scope catalog checks failed");
  else if (!valorantCsOk) fail("VALORANT Creator-Safe: js/catalog.js VAL_CREATOR_SAFE must follow tools/valorant-creator-safe.json (all 40 entries of the official VALORANT Creator-Safe Playlist; matchedTracks/notFound computed from them) and the series note must say the catalog songs were not found");
  else if (!aliasBehaviorOk) fail("Gakumas SEARCH RIGHT must retain its official title and match the verified SEARCH LIGHT Drive filename after wish sanitization");
  else if (!safeRefreshOk) fail("Gakumas refresh must carry aliases, preserve owned/custom data, migrate legacy wishes, and keep instrumental/discography lists separate");
  else ok("VALORANT / Arknights / Genshin / OJ / Gakumas: official links, cautious rights notes, VALORANT Creator-Safe status (9 catalog songs not in the 40-entry official playlist; the VALORANT Creator-Safe list holds its 39 songs), SEARCH RIGHT alias and safe list refresh");
}

// 🎒 Blue Archive OST Vol.1–8: official order, track-level Apple Music IDs,
// per-volume NexTone links, and a safe refresh of existing catalog playlists.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  const core = read("js/core.js");
  let catalogDataOk = false;
  let safeRefreshOk = false;
  let catalogGuideOk = false;
  try {
    const fixture = JSON.parse(read("tools/bluearchive-tracklist.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const series = catalogContext.__TRK_CATALOG_FOR_CHECK.find(item => item.id === "bluearchive");
    const expectedAlbumIds = fixture.albums.map(album => album.id);
    const playlistOrderOk = !!series && JSON.stringify(series.playlists.map(pl => pl.id)) === JSON.stringify([...expectedAlbumIds, "ba-mika"]);
    let trackTotal = 0;
    let tracksMatch = playlistOrderOk;
    const appleIds = [];
    if (playlistOrderOk) for (let i = 0; i < fixture.albums.length; i++) {
      const expected = fixture.albums[i], actual = series.playlists[i];
      if (actual.sourceUrl !== expected.nexToneUrl || actual.sourceLabel !== "NexTone.Link" ||
          !/^https:\/\/nex-tone\.link\/A\d+$/.test(actual.sourceUrl || "") ||
          !/^https:\/\/music\.apple\.com\/jp\/album\/[^/]+\/\d+$/.test(expected.appleAlbumUrl || "")) tracksMatch = false;
      if (actual.songs.length !== expected.tracks.length) tracksMatch = false;
      for (let j = 0; j < expected.tracks.length; j++) {
        const [title, artist, appleId] = expected.tracks[j];
        const track = actual.songs[j];
        trackTotal++;
        appleIds.push(appleId);
        let validAppleUrl = false;
        try {
          const link = new URL(track.u);
          validAppleUrl = link.protocol === "https:" && link.hostname === "music.apple.com" &&
            /^\/jp\/song\/[^/]+\/\d+$/.test(link.pathname) && link.pathname.endsWith("/" + appleId);
        } catch (_) {}
        if (!track || track.t !== title || track.ar !== artist || track.al !== expected.album || !validAppleUrl) tracksMatch = false;
      }
    }
    catalogDataOk = playlistOrderOk && tracksMatch && trackTotal === 225 &&
      JSON.stringify(fixture.albums.map(album => album.tracks.length)) === JSON.stringify([39, 21, 26, 28, 27, 28, 28, 28]) &&
      new Set(appleIds).size === 225;

    const ensureStart = library.indexOf("function trkCatalogGuide(");
    const ensureEnd = library.indexOf("\n(function plTighten()", ensureStart);
    if (ensureStart >= 0 && ensureEnd > ensureStart) {
      const importedOwned = ["owned-bluearchive-track"];
      const autoOwned = ["custom-owned-track"];
      const autoExisting = { id:"trk-ba-v1", cat:"trk:bluearchive:ba-v1", name:"My renamed volume", icon:"🎧", tags:["my-custom-tag"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:autoOwned, guide:{note:"old guide", url:"https://example.com/old"} };
      const manuallyImported = { id:"pl-manual-ba-v1", cat:"bluearchive:ba-v1", name:"My other name", icon:"🌸", tags:["personal", "tag"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:importedOwned, guide:{note:"old guide", url:"https://example.com/old"} };
      const testSettings = { playlists:[autoExisting, manuallyImported] };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings:testSettings,
        ensureTrkFolder:() => {},
        trkCatalog:() => [series],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize:raw => raw,
        saveUserPrefs:() => { saveCount++; },
        trkWishesForSeries:() => []
      });
      new vm.Script(library.slice(library.indexOf("function trkWishFromTrack("), library.indexOf("\nfunction trkWishesFromCatalog")) + "\n" + library.slice(ensureStart, ensureEnd) + "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const expectedWish = fixture.albums[0].tracks.map(([t, ar, id], i) => {
        const track = series.playlists[0].songs[i];
        return { t, al:fixture.albums[0].album, ar, u:track.u };
      });
      const preservesCustomData = autoExisting.name === "My renamed volume" && autoExisting.icon === "🎧" &&
        JSON.stringify(autoExisting.tags) === JSON.stringify(["my-custom-tag"]) && autoExisting.songs === autoOwned &&
        manuallyImported.name === "My other name" && manuallyImported.icon === "🌸" &&
        JSON.stringify(manuallyImported.tags) === JSON.stringify(["personal", "tag"]) && manuallyImported.songs === importedOwned;
      const refreshesBothSources = JSON.stringify(autoExisting.wish) === JSON.stringify(expectedWish) &&
        JSON.stringify(manuallyImported.wish) === JSON.stringify(expectedWish) &&
        autoExisting.guide.url === fixture.albums[0].nexToneUrl && manuallyImported.guide.url === fixture.albums[0].nexToneUrl &&
        autoExisting.guide.note.includes("購入・サブスクは利用許諾ではありません") &&
        manuallyImported.guide.note.includes("購入・サブスクは利用許諾ではありません");
      const createsAllOtherVolumes = fixture.albums.slice(1).every(album => {
        const created = testSettings.playlists.find(p => p.id === "trk-" + album.id);
        return created && created.wish.length === album.tracks.length && created.guide.url === album.nexToneUrl;
      });
      safeRefreshOk = preservesCustomData && refreshesBothSources && createsAllOtherVolumes && saveCount > 0;
    }
    catalogGuideOk = /if \(pl\.sourceUrl\) \{[\s\S]*?plOpenLink\(pl\.sourceUrl\)/.test(library) &&
      library.includes("guide: trkCatalogGuide(s, pl)") && library.includes("guide: trkCatalogGuide(s, pl, true)") &&
      library.includes("songs: p.songs, wish: p.wish, guide: p.guide, cat: p.cat, by: p.by, createdAt: p.createdAt") &&
      !/catb\.hidden\s*=\s*true/.test(library) &&
      core.includes(".slice(0, 200)") && library.includes(".filter(Boolean).slice(0, 200)");
  } catch (error) {
    console.error(`WARN  Blue Archive catalog test setup failed: ${error.message}`);
  }
  if (!catalogDataOk) fail("Blue Archive OST fixture/catalog mismatch (expected 225 ordered tracks, artist + exact album, unique Apple Music song IDs, and eight NexTone links)");
  else if (!safeRefreshOk) fail("Blue Archive refresh must update wishes and per-volume guides while preserving owned songs and customized name/icon/tags");
  else if (!catalogGuideOk) fail("Blue Archive per-volume NexTone links must be reachable before import and from imported playlist guides; wishlist capacity must retain all volumes");
  else ok("Blue Archive OST Vol.1–8: 225 ordered Apple Music-linked tracks, NexTone per-volume guides, safe existing-playlist refresh");
}

// 🛰️ Arknights: Endfield — Zeroth Directive OST Vol.1–2: official order, Spotify track links,
// verified Chinese official titles as match aliases, ffm.to smart-link album sources, cautious rights notes,
// and a safe refresh of the old four-part 初号指令 playlist import.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  let catalogDataOk = false;
  let safeRefreshOk = false;
  try {
    const fixture = JSON.parse(read("tools/endfield-zeroth-directive-tracklist.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const series = catalogContext.__TRK_CATALOG_FOR_CHECK.find(item => item.id === "endfield");
    let trackTotal = 0;
    const spotifyIds = [];
    let albumsMatch = !!series && series.url === fixture.sources.officialSiteJa;
    for (const expected of fixture.albums) {
      const actual = series && series.playlists.find(pl => pl.id === expected.id);
      if (!actual || actual.name !== expected.name || actual.songs.length !== expected.tracks.length ||
          actual.sourceUrl !== expected.ffmToUrl || actual.sourceLabel !== "公式配信リンク（ffm.to）") { albumsMatch = false; continue; }
      for (let i = 0; i < expected.tracks.length; i++) {
        const [title, artist, spotifyId, cnTitle] = expected.tracks[i];
        const track = actual.songs[i];
        trackTotal++;
        spotifyIds.push(spotifyId);
        if (!track || track.t !== title || track.ar !== artist || track.al !== expected.album ||
            track.u !== "https://open.spotify.com/track/" + spotifyId ||
            JSON.stringify(track.matchAliases || []) !== JSON.stringify([cnTitle])) albumsMatch = false;
      }
    }
    const characterOstsKept = !!series && [["ef-blurring", 2], ["ef-ashen", 2], ["ef-floaty", 2], ["ef-makers", 1], ["ef-signal", 5]]
      .every(([id, count]) => {
        const pl = series.playlists.find(item => item.id === id);
        return !!pl && pl.songs.length === count;
      });
    const rightsOk = !!series && series.note.includes("音源は同梱せず") &&
      series.note.includes("二次利用許諾ではありません") &&
      series.note.includes(fixture.sources.fanContentGuidelinesJa) &&
      series.note.includes("ffm.to") &&
      fixture.sources.jpAnnouncement === "https://x.com/AKEndfieldJP/status/2022928866638205084" &&
      fixture.albums.every(album => album.releaseDate === "2026-02-15" && album.trackCount === album.tracks.length);
    catalogDataOk = albumsMatch && characterOstsKept && rightsOk && trackTotal === 60 &&
      new Set(spotifyIds).size === 60 &&
      JSON.stringify(fixture.albums.map(album => album.tracks.length)) === JSON.stringify([37, 23]) &&
      fixture.albums.every(album => [...album.name].length <= 24) &&   /* trk129: 24文字上限に収まる名（切れない） */
      JSON.stringify(series.playlists.map(pl => pl.id)) === JSON.stringify(fixture.seriesPlaylistOrder);

    const ensureStart = library.indexOf("function trkCatalogGuide(");
    const ensureEnd = library.indexOf("\n(function plTighten()", ensureStart);
    if (ensureStart >= 0 && ensureEnd > ensureStart) {
      /* trk110 以降の既存取り込みを再現：Vol.2（旧名・trk-endfield）を先に並べ、Vol.1 は実機で保存される
         24文字切り旧名（trk128 の名が切れた「初号指令 (上) ― Zeroth Direct」）の状態で渡す。
         キャラクターテーマは1つは既定場所・1つは利用者が別のフォルダへ動かした状態で渡す。 */
      const oldVol2 = { id:"trk-ef-firstorder2", cat:"trk:endfield:ef-firstorder2", name:"Endfield — Zeroth Directive OST Vol.2（初号指令・下）", icon:"⛰️",
        tags:["Game","Endfield","Zeroth Directive","Metal Scar Radio"], wish:[{t:"obsolete", al:"", ar:"", u:""}],
        songs:[], folder:"trk-endfield", guide:{note:"old guide", url:"https://example.com/old"} };
      const defaultImported = { id:"trk-ef-firstorder", cat:"trk:endfield:ef-firstorder", name:"初号指令 (上) ― Zeroth Direct", icon:"📜",
        tags:["Game","Endfield","Metal Scar Radio","First Order"], wish:[{t:"obsolete", al:"", ar:"", u:""}],
        songs:["owned-endfield-track"], folder:"trk-endfield", guide:{note:"old guide", url:"https://example.com/old"} };
      const customImported = { id:"pl-manual-ef", cat:"endfield:ef-firstorder", name:"My Endfield mix", icon:"🌸", tags:["personal"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:["manual-owned-track"], guide:{note:"old guide", url:"https://example.com/old"} };
      const charOnDefault = { id:"trk-ef-blurring", cat:"trk:endfield:ef-blurring", name:"Endfield — Blurring", icon:"🌫️",
        tags:["Game","Endfield","Metal Scar Radio","MSR Endfield"], wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:[], folder:"trk-endfield" };
      const charUserMoved = { id:"trk-ef-ashen", cat:"trk:endfield:ef-ashen", name:"Endfield — ASHEN REMAINS", icon:"🔥",
        tags:["Game","Endfield","Metal Scar Radio","Levatein"], wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:[], folder:"my-folder" };
      const testSettings = { playlists:[oldVol2, defaultImported, customImported, charOnDefault, charUserMoved] };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings:testSettings,
        ensureTrkFolder:() => {},
        trkCatalog:() => [series],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize:raw => raw,
        saveUserPrefs:() => { saveCount++; },
        trkWishesForSeries:() => []
      });
      const ensureCode = library.slice(library.indexOf("function trkWishFromTrack("), library.indexOf("\nfunction trkWishesFromCatalog")) + "\n" +
        library.slice(ensureStart, ensureEnd);
      new vm.Script(ensureCode + "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const expectedWish = fixture.albums[0].tracks.map(([t, ar, id, cnTitle]) => ({
        t, al:fixture.albums[0].album, ar, u:"https://open.spotify.com/track/" + id, matchAliases:[cnTitle]
      }));
      const migratesDefault = defaultImported.name === fixture.albums[0].name && defaultImported.icon === "📜" &&
        JSON.stringify(defaultImported.tags) === JSON.stringify(["Game","Endfield","Zeroth Directive","Metal Scar Radio"]) &&
        JSON.stringify(defaultImported.songs) === JSON.stringify(["owned-endfield-track"]) &&
        JSON.stringify(defaultImported.wish) === JSON.stringify(expectedWish) &&
        defaultImported.guide.url === fixture.albums[0].ffmToUrl &&
        defaultImported.guide.note.includes("二次利用許諾ではありません");
      const expectedWish2 = fixture.albums[1].tracks.map(([t, ar, id, cnTitle]) => ({
        t, al:fixture.albums[1].album, ar, u:"https://open.spotify.com/track/" + id, matchAliases:[cnTitle]
      }));
      const renamesVol2 = oldVol2.name === fixture.albums[1].name && oldVol2.folder === "trk-endfield" &&
        JSON.stringify(oldVol2.wish) === JSON.stringify(expectedWish2) && oldVol2.guide.url === fixture.albums[1].ffmToUrl;
      const preservesCustom = customImported.name === "My Endfield mix" && customImported.icon === "🌸" &&
        JSON.stringify(customImported.tags) === JSON.stringify(["personal"]) &&
        JSON.stringify(customImported.songs) === JSON.stringify(["manual-owned-track"]) &&
        JSON.stringify(customImported.wish) === JSON.stringify(expectedWish);
      /* trk129：これまでの既定名（trk128の長いフル名・trk110の24文字切り・最古の紹介版）からでも、
         24文字に収まる今の名（初号指令 (上) ZD OST Vol.1）へ改名が効くこと。利用者が付けた名前は触らない。 */
      const oldNames = ["初号指令 (上) ― Zeroth Directive Original Soundtrack Vol.1", "Endfield — Zeroth Direct", "Endfield — 初号指令 OST"];
      let migratesOldNames = true;
      for (const oldName of oldNames) {
        defaultImported.name = oldName;
        new vm.Script("ensureTrkDistributionPlaylists();").runInContext(runContext);
        if (defaultImported.name !== fixture.albums[0].name) migratesOldNames = false;
      }
      defaultImported.name = "My own Zeroth mix";
      new vm.Script("ensureTrkDistributionPlaylists();").runInContext(runContext);
      const keepsCustomName = defaultImported.name === "My own Zeroth mix";
      const namesFit = fixture.albums.every(album => [...album.name].length <= 24);
      /* trk128 の一回限りの整頓：初号指令上下が最上（カタログ順）、キャラクターテーマは既定場所だけ棚へ移動、
         利用者が動かしたものはそのまま。印（trkEndfieldTidy1）が付く。
         このテストでは欠落の9リスト（ef-eve ほか）も自動作成されるので、配列は全13リスト＋手動リスト。 */
      const idx = id => testSettings.playlists.findIndex(pl => pl.id === id);
      const tidyOk = testSettings.trkEndfieldTidy1 === 1 &&
        idx("trk-ef-firstorder") === 0 && idx("trk-ef-firstorder2") === 1 &&
        idx("trk-ef-eve") === 2 && idx("trk-ef-dreamscape") === 7 &&
        idx("trk-ef-blurring") === 8 && idx("trk-ef-ashen") === 9 && idx("trk-ef-signal") === 12 &&
        idx("pl-manual-ef") === 13 &&
        charOnDefault.folder === "trk-endfield-character" && charUserMoved.folder === "my-folder";
      safeRefreshOk = migratesDefault && migratesOldNames && keepsCustomName && namesFit && renamesVol2 && preservesCustom && tidyOk && saveCount > 0;
    }
  } catch (error) {
    console.error(`WARN  Endfield catalog test setup failed: ${error.message}`);
  }
  if (!catalogDataOk) fail("Endfield Zeroth Directive fixture/catalog mismatch (expected Vol.1 37 + Vol.2 23 ordered tracks, unique official Spotify track links, Chinese-title match aliases, ffm.to album sources, the release-ordered series layout, and rights notes)");
  else if (!safeRefreshOk) fail("Endfield refresh must migrate every old 初号指令 default name to the trk129 names (within the 24-character save limit, keeping a user-given name), keep owned songs and custom data, and re-order / move to the character shelf once (trkEndfieldTidy1)");
  else ok("Arknights: Endfield Zeroth Directive OST Vol.1–2: 60 ordered Spotify-linked tracks, Chinese-title aliases, ffm.to guides, release-ordered series with the character shelf, safe one-time tidy of existing imports");
}

// 🛰️ Arknights: Endfield — Metal Scar Radio official albums (batch 2): six albums (Eve of Departure,
// Thunder's Legacy, At the Wake of Spring, Contingency Contract Re-Ignition, Homecoming, Dreamscape of
// Wind and Snow) in official Spotify album order with unique per-track Spotify links, official Spotify
// album-page sources, cautious rights notes, and auto-creation of all six playlists under trk-endfield.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  let catalogDataOk = false;
  let autoCreateOk = false;
  try {
    const fixture = JSON.parse(read("tools/endfield-msr-albums-tracklist.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const series = catalogContext.__TRK_CATALOG_FOR_CHECK.find(item => item.id === "endfield");
    let trackTotal = 0;
    const spotifyIds = [];
    let albumsMatch = !!series && series.url === fixture.sources.officialSiteJa;
    for (const expected of fixture.albums) {
      const actual = series && series.playlists.find(pl => pl.id === expected.id);
      if (!actual || actual.name !== expected.name || actual.songs.length !== expected.tracks.length ||
          actual.sourceUrl !== expected.spotifyAlbumUrl || actual.sourceLabel !== "公式Spotifyアルバム") { albumsMatch = false; continue; }
      for (let i = 0; i < expected.tracks.length; i++) {
        const [title, artist, spotifyId] = expected.tracks[i];
        const track = actual.songs[i];
        trackTotal++;
        spotifyIds.push(spotifyId);
        if (!/^[A-Za-z0-9]{22}$/.test(spotifyId) || !track || track.t !== title || track.ar !== artist ||
            track.al !== expected.album || track.u !== "https://open.spotify.com/track/" + spotifyId ||
            track.matchAliases) albumsMatch = false;
      }
    }
    const earlierListsKept = !!series && [["ef-blurring", 2], ["ef-ashen", 2], ["ef-floaty", 2], ["ef-makers", 1],
      ["ef-firstorder", 37], ["ef-firstorder2", 23], ["ef-signal", 5]]
      .every(([id, count]) => {
        const pl = series.playlists.find(item => item.id === id);
        return !!pl && pl.songs.length === count;
      });
    const rightsOk = !!series && series.note.includes("音源は同梱せず") &&
      series.note.includes("二次利用許諾ではありません") &&
      series.note.includes(fixture.sources.fanContentGuidelinesJa) &&
      series.note.includes("Homecoming") && series.note.includes("Dreamscape of Wind and Snow") &&
      fixture.albums.every(album => album.trackCount === album.tracks.length &&
        /^2026-\d{2}-\d{2}$/.test(album.releaseDate) &&
        /^https:\/\/open\.spotify\.com\/album\/[A-Za-z0-9]{22}$/.test(album.spotifyAlbumUrl)) &&
      fixture.verification.spotCheckedTrackIds.every(([title, id]) =>
        fixture.albums.some(album => album.tracks.some(track => track[0] === title && track[2] === id)));
    catalogDataOk = albumsMatch && earlierListsKept && rightsOk && trackTotal === 81 &&
      new Set(spotifyIds).size === 81 &&
      JSON.stringify(fixture.albums.map(album => album.tracks.length)) === JSON.stringify([5, 9, 17, 4, 30, 16]);

    const ensureStart = library.indexOf("function trkCatalogGuide(");
    const ensureEnd = library.indexOf("\n(function plTighten()", ensureStart);
    if (ensureStart >= 0 && ensureEnd > ensureStart) {
      /* trkEndfieldTidy1 を先に付ける＝一回限りの整頓をスキップし、作成パスそのものが
         キャラクターテーマを trk-endfield-character へ置くことを検査する。 */
      const testSettings = { playlists: [], trkEndfieldTidy1: 1 };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings: testSettings,
        ensureTrkFolder: () => {},
        trkCatalog: () => [series],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize: raw => raw,
        saveUserPrefs: () => { saveCount++; },
        trkWishesForSeries: () => []
      });
      new vm.Script(library.slice(library.indexOf("function trkWishFromTrack("), library.indexOf("\nfunction trkWishesFromCatalog")) + "\n" +
        library.slice(ensureStart, ensureEnd) + "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const characterOnShelf = ["ef-blurring", "ef-ashen", "ef-floaty", "ef-makers"].every(id => {
        const created = testSettings.playlists.find(pl => pl.id === "trk-" + id);
        return !!created && created.folder === "trk-endfield-character" && created.cat === "trk:endfield:" + id;
      });
      autoCreateOk = saveCount > 0 && characterOnShelf && fixture.albums.every(expected => {
        const created = testSettings.playlists.find(pl => pl.id === "trk-" + expected.id);
        return !!created && created.folder === "trk-endfield" && created.cat === "trk:endfield:" + expected.id &&
          created.name === expected.name && created.wish.length === expected.tracks.length &&
          created.wish.every(wish => !wish.matchAliases && /^https:\/\/open\.spotify\.com\/track\//.test(wish.u)) &&
          created.guide.url === expected.spotifyAlbumUrl &&
          created.guide.note.includes("二次利用許諾ではありません");
      });
    }
  } catch (error) {
    console.error(`WARN  Endfield MSR albums test setup failed: ${error.message}`);
  }
  if (!catalogDataOk) fail("Endfield MSR albums fixture/catalog mismatch (expected 6 albums with 5+9+17+4+30+16 ordered tracks, unique official Spotify track links, Spotify album-page sources, and rights notes)");
  else if (!autoCreateOk) fail("Endfield MSR albums must auto-create the six playlists under trk-endfield with full wishes and official Spotify album guides, and the four character-theme lists under trk-endfield-character");
  else ok("Arknights: Endfield Metal Scar Radio albums (batch 2): 81 ordered Spotify-linked tracks across Eve of Departure, Thunder's Legacy, At the Wake of Spring, Re-Ignition, Homecoming, Dreamscape, plus the character-theme shelf");
}

/* 📁 trk128: サブフォルダ（🐔 の中・🎭 棚など）を見ているときは、そのフォルダをタブ帯に出す。
   出さないと呼び出し側のフォールバックで表示が「すべて」に戻ってしまう（実ブラウザで確認した既存の欠陥の修正）。 */
{
  const library = read("js/library.js");   /* read() の結果では core. 別名が完全に落ちる（settings.libTab になる） */
  const nestedFolderTabOk =
    library.includes('if (settings.libTab.startsWith("fld:")) {') &&
    library.includes("const cf = plFolderById(settings.libTab.slice(4));") &&
    library.includes("if (cf && cf.parent && !tabs.some(t => t.id === settings.libTab))");
  if (!nestedFolderTabOk) fail("Library must add the open nested folder to the tab list (libTabsOf fld: handling) so the folder view does not fall back to the all view");
  else ok("Library: open nested folder (trk subfolders / Endfield Character Theme shelf) is added to the tab bar so the folder view stays open");
}

/* 📁 trk129: フォルダの上限を13→40にし、**作るときに**上限を確かめて知らせる（黙って作って次の起動で切り捨てない）。
   上限13のときは、利用者のフォルダが4個以上あると配列の末尾にあった 🎭棚（trk-endfield-character）が毎回切り捨てられ、
   中に移したキャラクターテーマ4リストがトップへ落ちていた。上限を超えた配列は、trk の固定棚を先に残して
   利用者のフォルダを後ろから落とし、こわれた形だけを一回限りの整頓（trkEndfieldShelfRestoreOnce）で戻す。 */
{
  const library = read("js/library.js"), coreSrc = read("js/core.js");
  const fourLanguages = key => (library.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4;
  let limitOk = false, restoreOk = false;
  try {
    /* 上限まわりの純関数だけを切り出して動かす（plFolderSanitize の直前までが、その範囲） */
    const unit = library.slice(library.indexOf("/* 📁 フォルダの上限"), library.indexOf("function plFolderSanitize("));
    const settings = { plFolders: [] };
    const ctx = vm.createContext({ settings, saveUserPrefs: () => {} });
    new vm.Script(unit + "\nglobalThis.__unit = { PL_FOLDER_MAX, plFolderRoom, plFolderTrim };").runInContext(ctx);
    const { PL_FOLDER_MAX, plFolderRoom, plFolderTrim } = ctx.__unit;
    const mk = id => ({ id, name: id, icon: "", color: "none", parent: "", createdAt: 0 });
    const fixedIds = ["trk", "trk-classic", "trk-ba", "trk-lol", "trk-touhou", "trk-touhou-other", "trk-arknights", "trk-gakumas", "trk-endfield"];
    const fixed = fixedIds.map(mk), users = n => Array.from({ length: n }, (_, i) => mk("fl" + i));
    settings.plFolders = fixed.concat(users(31));                    /* 40個＝ちょうど上限 */
    const atCap = !plFolderRoom() && !plFolderRoom(2) && plFolderRoom(0);
    settings.plFolders = fixed.concat(users(30));                    /* 39個＝あと1つ作れる */
    const oneLeft = plFolderRoom() && !plFolderRoom(2);
    /* 41個（🎭棚が末尾）→ 固定棚10個は残り、利用者のフォルダが後ろから落ちる */
    const over = fixed.concat(users(30), [mk("trk-endfield-character"), mk("fl-extra")]);
    const trimmed = plFolderTrim(over);
    const trimKeepsShelves = trimmed.length === PL_FOLDER_MAX && trimmed.filter(f => f.id.startsWith("trk")).length === 10 &&
      trimmed.some(f => f.id === "trk-endfield-character") && !trimmed.some(f => f.id === "fl-extra") &&
      plFolderTrim(fixed.concat(users(3))).length === 12;
    limitOk = PL_FOLDER_MAX === 40 && atCap && oneLeft && trimKeepsShelves && coreSrc.includes("slice(0, 40)") &&
      library.includes('if (!plFolderRoom()) { plToast(tr("plFolderLimit", { n: PL_FOLDER_MAX })); return; }') &&
      library.includes("if (!parent && !plFolderRoom(2))") && library.includes("if (!fld && !plFolderRoom())") &&
      library.includes("settings.plFolders = plFolderTrim(") && fourLanguages("plFolderLimit");

    /* 🎭棚の戻し（一回限り）: 上限13でこわれた形（棚が消え、4リストがトップ）だけを戻す */
    const restoreUnit = library.slice(library.indexOf("/* 🎭 Endfieldのキャラクターテーマ曲（trk128）"),
      library.indexOf("function ensureTrkDistributionPlaylists("));
    const charIds = ["ef-blurring", "ef-ashen", "ef-floaty", "ef-makers"];
    const lists = () => charIds.map(id => ({ id: "trk-" + id, cat: "trk:endfield:" + id, folder: "", songs: [] }));
    const runRestore = state => {
      const s = vm.createContext({ settings: state, saveUserPrefs: () => {} });
      new vm.Script(restoreUnit + "\nglobalThis.__restore = trkEndfieldShelfRestoreOnce;").runInContext(s);
      s.__restore();
      return state;
    };
    const damaged = { playlists: lists(), plFolders: [], trkEndfieldTidy1: 1 };
    runRestore(damaged);
    const healed = damaged.playlists.every(p => p.folder === "trk-endfield-character") &&
      damaged.plFolders.length === 1 && damaged.plFolders[0].id === "trk-endfield-character" &&
      damaged.plFolders[0].parent === "trk-endfield" && damaged.plFolders[0].icon === "🎭" &&
      damaged.playlists[0].folder === "trk-endfield-character" && damaged.trkEndfieldTidy2 === 1;
    /* 一度きり：印が付いた後は、利用者がトップへ出した配置に触らない */
    damaged.playlists[0].folder = "";
    runRestore(damaged);
    const onceOnly = damaged.playlists[0].folder === "" && damaged.playlists[1].folder === "trk-endfield-character";
    /* 利用者が1つでも別の場所へ置いていれば、何も動かさない */
    const moved = { playlists: lists(), plFolders: [], trkEndfieldTidy1: 1 };
    moved.playlists[1].folder = "my-folder";
    runRestore(moved);
    const keepsUserPlacement = moved.playlists.every(p => p.folder === (p === moved.playlists[1] ? "my-folder" : ""));
    /* trk128 の整頓を通っていない起動（印が無い）では触らない */
    const before = { playlists: lists(), plFolders: [] };
    runRestore(before);
    const untouchedBeforeTidy1 = before.playlists.every(p => p.folder === "") && !before.trkEndfieldTidy2;
    restoreOk = healed && onceOnly && keepsUserPlacement && untouchedBeforeTidy1;
  } catch (error) {
    console.error(`WARN  playlist-folder limit test setup failed: ${error.message}`);
  }
  if (!limitOk) fail("playlist folders must be capped at 40 with the creation paths checked (plFolderRoom + plFolderLimit in four languages), core.js must read the same 40, and an over-cap list must keep the trk shelves");
  else if (!restoreOk) fail("trkEndfieldShelfRestoreOnce must move the four character-theme lists back under the Endfield Character Theme shelf exactly once (only when the shelf is empty and every remaining list sits outside every folder)");
  else ok("playlist folders: cap 40 checked before creating, trk shelves survive an over-cap trim, character-theme lists restored to the 🎭 shelf once (trk129)");
}

/* 🔀📥 trk130: ↕は「いま見えている並び」（peers）の中で入れ替える。共有プレイリストの取り込みはファイルを読む前に
   大きさを確かめ、曲名のゆるい照合は候補が1曲に絞れたときだけ採る（別のアルバムの「01 intro」と混ざらないように）。 */
{
  const library = read("js/library.js"), titleMatch = read("js/title-match.js");
  const fourLanguages = key => (library.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4;
  const functionUnit = name => {
    const a = library.indexOf(`function ${name}(`);
    const b = library.indexOf("\n}\n", a);
    return a >= 0 && b > a ? library.slice(a, b + 3) : "";
  };
  let moveOk = false, importOk = false, matchOk = false;
  try {
    /* ↕ の2関数だけを切り出して動かす（旧版は「全体の隣」と入れ替えるので、フォルダの中で押すと画面が変わらなかった） */
    const a = library.indexOf("/* ↕ 並べ替え");
    const b = library.indexOf("\n}\n", library.indexOf("function trkMoveButtonsState("));
    const moveUnit = library.slice(a, b + 3);
    const mk = (id, folder, createdAt) => ({ id, folder, name: id, createdAt });
    const run = (settings, args) => {
      /* read() は名前空間の接頭辞を外すので、切り出した本文は settings／saveUserPrefs などをそのまま読む */
      const ctx = vm.createContext({ settings, saveUserPrefs() {}, renderLib() {}, trkFolderIdSet: () => new Set(["trk", "trk-classic"]) });
      new vm.Script(functionUnit("trkOrderedPlaylists") + moveUnit + "\nglobalThis.__move = trkMovePlaylist;").runInContext(ctx);
      const group = folder => { ctx.folder = folder; return vm.runInContext("trkOrderedPlaylists(settings.playlists.filter(p => p.folder === folder)).map(p => p.id)", ctx); };
      const ids = grp => Array.from(grp);
      ctx.args = args;
      vm.runInContext("__move(...args)", ctx);
      return { settings, group, ids };
    };
    const four = () => [mk("A1", "trk", 1), mk("B1", "trk-classic", 2), mk("A2", "trk", 3), mk("B2", "trk-classic", 4)];
    const t1 = run({ trkSortABC: false, playlistOrder: [], playlists: four() }, ["A1", 1, ["A1", "A2"]]);
    const swapOk = t1.ids(t1.group("trk")).join() === "A2,A1" && t1.ids(t1.group("trk-classic")).join() === "B1,B2";
    const t2 = run({ trkSortABC: false, playlistOrder: [], playlists: four() }, ["A2", 1, ["A1", "A2"]]);
    const endOk = t2.ids(t2.group("trk")).join() === "A1,A2" && t2.settings.playlistOrder.length === 0;
    const t3 = run({ trkSortABC: false, playlistOrder: ["A1", "GHOST", "A2", "B1", "B2"], playlists: four() }, ["A1", 1, ["A1", "A2"]]);
    const ghostOk = t3.ids(t3.group("trk")).join() === "A2,A1" && !t3.settings.playlistOrder.includes("GHOST");
    const callSites = (library.match(/trkMovePlaylist\(p\.id, -?1, peers\)/g) || []).length === 6 &&
      (library.match(/trkMoveButtonsState\(up, down, i, (?:ordered|list)\.length\)/g) || []).length === 3 &&
      moveUnit.includes("up.disabled = abc || i <= 0") && moveUnit.includes("if (abc) { up.style.opacity");
    moveOk = swapOk && endOk && ghostOk && callSites;

    /* 📥 取り込みは「上限の判定 → ファイルを読む」の順（1000曲の上限は解析の後にしか効かない） */
    const pick = functionUnit("plImportPick");
    importOk = library.includes("const PLAYLIST_IMPORT_MAX = 4 * 1024 * 1024") &&
      pick.includes("f.size > PLAYLIST_IMPORT_MAX") && pick.includes("await f.text()") &&
      pick.indexOf("f.size > PLAYLIST_IMPORT_MAX") > 0 && pick.indexOf("f.size > PLAYLIST_IMPORT_MAX") < pick.indexOf("await f.text()") &&
      pick.includes("typeof f.size !== \"number\"") && pick.includes('plToast(tr("plImportTooBig", { n: 4 }))') && fourLanguages("plImportTooBig");

    /* 曲名のゆるい照合は、候補が1つに絞れて、大きさが分かるなら一致するときだけ */
    const matchUnit = library.slice(library.indexOf("const plMatchIndexCache"), library.indexOf("function plOpenLink("));
    const mctx = vm.createContext({ metaOf: () => null });
    new vm.Script(titleMatch + "\n" + matchUnit + "\nglobalThis.__match = plMatchByTitle;").runInContext(mctx);
    const song = (title, size) => ({ key: size + "|" + title, title, size });
    const match = (q, all) => { mctx.q = q; mctx.all = all; return vm.runInContext("__match(q, all)", mctx); };
    const local = song("08 sometimes", 1234);
    matchOk = match({ title: "08_sometimes", size: 1234 }, [local]) === local ?
      match({ title: "08_sometimes.flac", size: 1234 }, [local]) === local &&
      match({ title: "08_sometimes", size: 999 }, [local]) === null &&
      match({ title: "01 intro" }, [song("03 intro", 1), song("05 intro", 2)]) === null &&
      match({ title: "sometimes", size: 200 }, [song("Sometimes", 100), song("sometimes", 200)]).size === 200 : false;
  } catch (error) {
    console.error(`WARN  trk130 playlist check setup failed: ${error.message}`);
  }
  if (!moveOk) fail("↕ must swap inside the visible group (peers) and hand the buttons to trkMoveButtonsState in all three lists");
  else if (!importOk) fail("shared playlist import must reject files over PLAYLIST_IMPORT_MAX (4 MiB) before f.text(), with plImportTooBig in four languages");
  else if (!matchOk) fail("plMatchByTitle must use plTitleKeys/plSongMatchKeys only for a unique, size-matching candidate");
  else ok("playlists: ↕ moves inside the visible group and drops dead ids, shared-playlist import is size-capped before reading, title fallback takes only a unique match (trk130)");
}

/* 📦 trk132: スキンを持つパックAから、スキンを持たないパックBへ切り替えたときは、Aのスキンを消すときに
   退避したスキン（prev.skin）へ移る（shadow へ移すと、Bを外しても元に戻らない）。Aを使っている間に利用者が
   自分で変えた項目は、切り替えの直前に packRebase が prev へ取り込み、applied から外す。
   譜面の書き出しは、記録のキー（chartKeyOf）と同じく、MODを掛ける前のレーンを使う。 */
{
  const custom = read("js/custom.js"), game = read("js/game.js"), media = read("js/media.js");
  let rebaseOk = false, wiringOk = false, exportOk = false, descOk = false;
  try {
    /* packRebase だけを切り出して動かす（read() は core. の別名を外すので、本文は settings をそのまま読む） */
    const a = custom.indexOf("function packRebase("), b = custom.indexOf("\n}\n", a);
    const settings = { skin:"pack_A", notes:[{ color:"#111111", shape:"square" }, { color:"#222222", shape:"circle" }], fxPower:2, seEnabled:true,
      packPrev:{ skin:"sakura", notes:[{ color:"#ffffff", shape:"circle" }, { color:"#000000", shape:"diamond" }], fxPower:1.25, seEnabled:false,
        applied:{ skin:"pack_A", notes:[{ color:"#111111", shape:"square" }, { color:"#222222", shape:"circle" }], fxPower:2, seEnabled:true } } };
    const ctx = vm.createContext({ settings, JSON, Array, Object, String });
    new vm.Script(custom.slice(a, b + 3) + "\nglobalThis.__rebase = packRebase;").runInContext(ctx);
    settings.skin = "forest"; settings.seEnabled = false;   /* Aを使いながら、利用者が自分で変えた2項目 */
    vm.runInContext("__rebase()", ctx);
    const p = settings.packPrev;
    rebaseOk = a >= 0 && b > a && p.skin === "forest" && p.seEnabled === false &&
      !("skin" in p.applied) && !("seEnabled" in p.applied) &&
      p.applied.fxPower === 2 && p.applied.notes.length === 2 && p.fxPower === 1.25;

    /* 配線：切り替えの前に packRebase。パックのスキンを消すときは退避したスキンへ移し、applied.skin を外す */
    const act = custom.slice(custom.indexOf("async function activatePack("), custom.indexOf("function deactivatePack("));
    const deact = custom.slice(custom.indexOf("function deactivatePack("), custom.indexOf("async function installAndUse("));
    wiringOk = act.includes("if (!restore) { packSnapshot(); packRebase(); }") &&
      act.indexOf("packRebase();") < act.indexOf("deactivatePack(false);") &&
      deact.includes("const pv = settings.packPrev") && deact.includes('!pv.skin.startsWith("pack_")') &&
      deact.includes("delete pv.applied.skin") &&
      deact.indexOf("if (settings.skin === sid) {") < deact.indexOf("delete pv.applied.skin");

    /* 書き出しは、記録のキーと同じ「MODを掛ける前のレーン」 */
    const keyLine = game.split("\n").find(l => l.includes("const chartKeyOf ="));
    exportOk = media.includes("notes:notes.map(n => [n.time, n.origLane ?? n.lane])") && !!keyLine && keyLine.includes("n.origLane ?? n.lane");

    /* 検索結果に出る説明文（meta description）は、SNSカード（og:description）と同じ文面にする（trk132。別々に育つと方向がずれる） */
    const html = read("index.html");
    const metaDesc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1];
    const ogDesc = (html.match(/<meta property="og:description" content="([^"]*)">/) || [])[1];
    descOk = !!metaDesc && metaDesc === ogDesc;
  } catch (error) {
    console.error(`WARN  trk132 pack check setup failed: ${error.message}`);
  }
  if (!rebaseOk) fail("packRebase must lift only what the user changed while pack A was on into prev (and drop it from applied)");
  else if (!wiringOk) fail("deactivatePack must fall back to the saved skin (not shadow) when a pack skin goes away, and activatePack must rebase before unloading");
  else if (!exportOk) fail("chartToData must export the original lane (origLane), the same rule as the record key chartKeyOf");
  else if (!descOk) fail("the meta description shown in search results must be the same wording as the og:description card");
  else ok("packs: switching keeps the user's own choices and the skin to come back to, the chart export follows the record key, and the search/social description is one text (trk132)");
}

// ⚔️ LoL Creator-Safe Sessions: complete SoundCloud album order/count and one official song URL per track.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  let catalogDataOk = false;
  let safeRefreshOk = false;
  try {
    const fixture = JSON.parse(read("tools/leagueoflegends-sessions-tracklist.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const series = catalogContext.__TRK_CATALOG_FOR_CHECK.find(item => item.id === "lol");
    const expectedIds = fixture.albums.map(album => album.id);
    const sessionPlaylists = series ? series.playlists.filter(pl => expectedIds.includes(pl.id)) : [];
    const playlistOrderOk = !!series && JSON.stringify(sessionPlaylists.map(pl => pl.id)) === JSON.stringify(expectedIds);
    let trackTotal = 0;
    let tracksMatch = playlistOrderOk;
    const spotifyIds = [];
    if (playlistOrderOk) for (let i = 0; i < fixture.albums.length; i++) {
      const expected = fixture.albums[i], actual = series.playlists[i];
      const validSoundCloudAlbum = (actual.sourceUrl || "").startsWith("https://soundcloud.com/leagueoflegends/sets/");
      const validSpotifyAlbum = /^https:\/\/open\.spotify\.com\/album\/[A-Za-z0-9]{22}$/.test(expected.spotifyAlbumUrl || "");
      if (actual.name !== expected.name || actual.sourceUrl !== expected.soundcloudUrl || actual.sourceLabel !== "SoundCloud" ||
          !validSoundCloudAlbum || !validSpotifyAlbum || actual.songs.length !== expected.trackCount ||
          actual.songs.length !== expected.tracks.length) tracksMatch = false;
      for (let j = 0; j < expected.tracks.length; j++) {
        const [title, artist, spotifyId] = expected.tracks[j];
        const track = actual.songs[j];
        trackTotal++;
        spotifyIds.push(spotifyId);
        let validSpotifyUrl = false;
        try {
          const link = new URL(track.u);
          validSpotifyUrl = link.protocol === "https:" && link.hostname === "open.spotify.com" &&
            link.pathname === "/track/" + spotifyId && link.search === "";
        } catch (_) {}
        if (!/^[A-Za-z0-9]{22}$/.test(spotifyId) || !track || track.t !== title || track.ar !== artist ||
            track.al !== expected.name || !validSpotifyUrl) tracksMatch = false;
      }
    }
    catalogDataOk = playlistOrderOk && tracksMatch && trackTotal === 108 && new Set(spotifyIds).size === 108 &&
      JSON.stringify(fixture.albums.map(album => album.trackCount)) === JSON.stringify([36, 43, 29]) &&
      series.note.includes("これはLoL全楽曲ではなく") &&
      series.note.includes("二次利用許諾ではありません") &&
      series.url === "https://www.riotgames.com/en/riot-music-creator-safe-guidelines";

    const ensureStart = library.indexOf("function trkCatalogGuide(");
    const ensureEnd = library.indexOf("\n(function plTighten()", ensureStart);
    if (ensureStart >= 0 && ensureEnd > ensureStart) {
      const autoOwned = ["owned-lol-vi-track"];
      const manuallyOwned = ["manual-owned-lol-track"];
      const autoExisting = { id:"trk-lol-svi", cat:"trk:lol:lol-svi", name:"My renamed Vi playlist", icon:"🎧", tags:["my-custom-tag"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:autoOwned, guide:{note:"old guide", url:"https://example.com/old"} };
      const manuallyImported = { id:"pl-manual-lol-svi", cat:"lol:lol-svi", name:"Sessions: Vi 厳選", icon:"🥊", tags:["personal", "tag"],
        wish:[{t:"obsolete", al:"", ar:"", u:""}], songs:manuallyOwned, guide:{note:"old guide", url:"https://example.com/old"} };
      const testSettings = { playlists:[autoExisting, manuallyImported] };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings:testSettings,
        ensureTrkFolder:() => {},
        trkCatalog:() => [series],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize:raw => raw,
        saveUserPrefs:() => { saveCount++; },
        trkWishesForSeries:() => []
      });
      new vm.Script(library.slice(library.indexOf("function trkWishFromTrack("), library.indexOf("\nfunction trkWishesFromCatalog")) + "\n" + library.slice(ensureStart, ensureEnd) + "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const expectedWish = fixture.albums[0].tracks.map(([t, ar, spotifyId], i) => ({
        t, al:fixture.albums[0].name, ar, u:series.playlists[0].songs[i].u
      }));
      const preservesCustomData = autoExisting.name === "My renamed Vi playlist" && autoExisting.icon === "🎧" &&
        JSON.stringify(autoExisting.tags) === JSON.stringify(["my-custom-tag"]) && autoExisting.songs === autoOwned &&
        manuallyImported.name === "Sessions: Vi" && manuallyImported.icon === "🥊" &&
        JSON.stringify(manuallyImported.tags) === JSON.stringify(["personal", "tag"]) && manuallyImported.songs === manuallyOwned;
      const refreshesBothSources = JSON.stringify(autoExisting.wish) === JSON.stringify(expectedWish) &&
        JSON.stringify(manuallyImported.wish) === JSON.stringify(expectedWish) &&
        autoExisting.guide.url === fixture.albums[0].soundcloudUrl && manuallyImported.guide.url === fixture.albums[0].soundcloudUrl &&
        autoExisting.guide.note.includes("SoundCloud") && manuallyImported.guide.note.includes("SoundCloud") &&
        autoExisting.guide.note.includes("二次利用許諾ではありません") && manuallyImported.guide.note.includes("二次利用許諾ではありません");
      const createsOtherSessionsAlbums = fixture.albums.slice(1).every(album => {
        const created = testSettings.playlists.find(p => p.id === "trk-" + album.id);
        return created && created.folder === "trk-lol" && created.wish.length === album.trackCount &&
          created.guide.url === album.soundcloudUrl && created.guide.note.includes("SoundCloud");
      });
      safeRefreshOk = preservesCustomData && refreshesBothSources && createsOtherSessionsAlbums && saveCount > 0 &&
        library.includes('lol: "trk-lol"') && library.includes('{ id: "trk-lol", name: "League of Legends", icon: "⚔️" }') &&
        library.includes("for (const sh of TRK_SHELVES) ensureTrkSubfolder(sh.id, sh.name, sh.icon, sh.parent)") &&
        library.includes('pl.sourceLabel || tr("plOfficialLink")');
    }
  } catch (error) {
    console.error(`WARN  League of Legends Sessions test setup failed: ${error.message}`);
  }
  if (!catalogDataOk) fail("LoL Sessions fixture/catalog mismatch (expected complete Vi/Diana/Taliyah albums: 36+43+29 tracks, official SoundCloud album links, ordered individual Spotify song links)");
  else if (!safeRefreshOk) fail("LoL Sessions imports must refresh song wishes/guides safely, preserve owned/custom data, and create all albums in the League of Legends trk folder");
  else ok("LoL Sessions: three complete official SoundCloud albums (108 ordered Spotify-linked tracks), safe catalog refresh");
}

// 🎵 LoL catalogue (Phase 1 + incremental K/DA): verified releases stay split by type,
// use official destinations, state the intentionally incomplete scope, and never imply reuse rights.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  let catalogDataOk = false;
  let safeRefreshOk = false;
  try {
    const fixture = JSON.parse(read("tools/leagueoflegends-music-tracklist.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const series = catalogContext.__TRK_CATALOG_FOR_CHECK.find(item => item.id === "lol");
    const sessions = JSON.parse(read("tools/leagueoflegends-sessions-tracklist.json"));
    const sessionIds = sessions.albums.map(album => album.id);
    const expectedLists = [fixture.championThemes, fixture.worldsAnthems, fixture.msiAnthems, fixture.kdaSongs];
    const sessionOrderOk = !!series && JSON.stringify(series.playlists.slice(0, 3).map(pl => pl.id)) === JSON.stringify(sessionIds);
    const phaseOrderOk = !!series && JSON.stringify(series.playlists.slice(3, 3 + expectedLists.length).map(pl => pl.id)) ===
      JSON.stringify(expectedLists.map(list => list.id));
    let trackTotal = 0;
    let tracksMatch = sessionOrderOk && phaseOrderOk;
    let worlds2026ReleasedCount = 0;
    const allUrls = [];
    for (const expectedList of expectedLists) {
      const actual = series && series.playlists.find(pl => pl.id === expectedList.id);
      if (!actual || actual.name !== expectedList.name || actual.songs.length !== expectedList.tracks.length) {
        tracksMatch = false;
        continue;
      }
      for (let i = 0; i < expectedList.tracks.length; i++) {
        const expected = expectedList.tracks[i], track = actual.songs[i];
        trackTotal++;
        allUrls.push(track.u);
        let validOfficialUrl = false;
        try {
          const url = new URL(track.u);
          if (url.protocol === "https:" && url.hostname === "open.spotify.com") {
            validOfficialUrl = url.pathname.startsWith("/track/") && /^[A-Za-z0-9]{22}$/.test(url.pathname.slice(7)) && !url.search;
          } else if (url.protocol === "https:" && url.hostname === "www.youtube.com") {
            validOfficialUrl = url.pathname === "/watch" && /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") || "") &&
              [...url.searchParams.keys()].length === 1;
          } else if (url.protocol === "https:" && url.hostname === "soundcloud.com") {
            validOfficialUrl = url.pathname.startsWith("/leagueoflegends/") && !url.search;
          } else if (url.protocol === "https:" && url.hostname === "lolesports.com") {
            validOfficialUrl = track.u === fixture.sources.worlds2026Announcement;
          }
        } catch (_) {}
        if (expected.status === "released") {
          worlds2026ReleasedCount++;
          if (expectedList.id !== "lol-worlds-anthems" || expected.url !== fixture.sources.worlds2026SpotifyTrack ||
              expected.url === fixture.sources.worlds2026Announcement || !expected.artist.includes("True Damage") ||
              fixture.sources.worlds2026OfficialVideo !== "https://www.youtube.com/watch?v=mlFxxNsExJc" ||
              fixture.sources.worlds2026ListenNow !== "https://truedamage.ffm.to/knowmyname") tracksMatch = false;
        }
        if (track.t !== expected.title || track.al !== expected.album || track.ar !== expected.artist ||
            track.u !== expected.url || !validOfficialUrl) tracksMatch = false;
      }
    }
    const kdaTrackIds = ["3em2uN4cCWHcCXhjMzJ8ps", "6y3EPT8iw6HmuMpX05gyvt", "65pHtEdxGt4e3Fv1ncPi6V",
      "33CZravFcGBOwRw5dCOCel", "3CEW3iffD2QvNZMK20sMqW", "497qmwcUsCv5hmMU0K8Hik"];
    const kdaVideoIds = ["UOxkGD8qRB4", "RkID8_gnTxw", "3VTkBuxU4yk", "xoWxv2yZXLQ", "E_PbH5y70Tc", "WW1BpABbzHs"];
    const kdaSourcesOk = fixture.kdaSongs && fixture.kdaSongs.id === "lol-kda-songs" &&
      fixture.sources.kdaSpotifyArtist === "https://open.spotify.com/artist/4gOc8TsQed9eqnqJct2c5v" &&
      fixture.sources.kdaAllOutSpotifyAlbum === "https://open.spotify.com/album/3wX4yrxMuHapSLvadxQkVV" &&
      fixture.sources.kdaOfficialYoutubeChannel === "https://www.youtube.com/@leagueoflegends" &&
      JSON.stringify(fixture.kdaSongs.tracks.map(track => track.url.split("/").pop())) === JSON.stringify(kdaTrackIds) &&
      JSON.stringify(fixture.kdaSongs.tracks.map(track => new URL(track.officialVideoUrl).searchParams.get("v"))) === JSON.stringify(kdaVideoIds) &&
      fixture.kdaSongs.tracks.every(track => {
        const video = new URL(track.officialVideoUrl);
        return video.protocol === "https:" && video.hostname === "www.youtube.com" && video.pathname === "/watch" &&
          [...video.searchParams.keys()].length === 1;
      });
    const rightsAndScopeOk = !!series && series.url === fixture.sources.creatorSafeGuidelines &&
      series.note.includes("二次利用許諾ではありません") && series.note.includes("Creator-Safe対象") &&
      series.note.includes("K/DAの公式曲6曲") && series.note.includes("これはLoL全楽曲ではなく") &&
      series.note.includes("今後の調査対象");
    catalogDataOk = tracksMatch && kdaSourcesOk && trackTotal === 65 && worlds2026ReleasedCount === 1 &&
      new Set(allUrls).size === allUrls.length && rightsAndScopeOk;

    const ensureStart = library.indexOf("function trkCatalogGuide(");
    const ensureEnd = library.indexOf("\n(function plTighten()", ensureStart);
    if (ensureStart >= 0 && ensureEnd > ensureStart) {
      const autoOwned = ["owned-lol-champion-theme"];
      const manualOwned = ["owned-lol-worlds-song"];
      const autoExisting = { id:"trk-lol-champion-themes", cat:"trk:lol:lol-champion-themes", name:"My Champion Themes",
        icon:"🎧", tags:["custom-theme-tag"], wish:[{t:"old", al:"", ar:"", u:""}], songs:autoOwned,
        guide:{note:"old guide", url:"https://example.com/old"} };
      const manualExisting = { id:"trk-lol-worlds-anthems", cat:"lol:lol-worlds-anthems", name:"My Worlds playlist",
        icon:"🌟", tags:["custom-worlds-tag"], wish:[{t:"old", al:"", ar:"", u:""}], songs:manualOwned,
        guide:{note:"old guide", url:"https://example.com/old"} };
      const testSettings = { playlists:[autoExisting, manualExisting] };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings:testSettings,
        ensureTrkFolder:() => {},
        trkCatalog:() => [series],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize:raw => raw,
        saveUserPrefs:() => { saveCount++; },
        trkWishesForSeries:() => []
      });
      new vm.Script(library.slice(library.indexOf("function trkWishFromTrack("), library.indexOf("\nfunction trkWishesFromCatalog")) + "\n" + library.slice(ensureStart, ensureEnd) + "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const expectWish = list => list.tracks.map(track => ({ t:track.title, al:track.status === "announced-only"
        ? "Worlds 2026 Anthem — announced; official audio link pending" : track.album, ar:track.artist, u:track.url }));
      const preservesCustom = autoExisting.name === "My Champion Themes" && autoExisting.icon === "🎧" &&
        JSON.stringify(autoExisting.tags) === JSON.stringify(["custom-theme-tag"]) && autoExisting.songs === autoOwned &&
        manualExisting.name === "My Worlds playlist" && manualExisting.icon === "🌟" &&
        JSON.stringify(manualExisting.tags) === JSON.stringify(["custom-worlds-tag"]) && manualExisting.songs === manualOwned;
      const refreshesWishAndGuide = JSON.stringify(autoExisting.wish) === JSON.stringify(expectWish(fixture.championThemes)) &&
        JSON.stringify(manualExisting.wish) === JSON.stringify(expectWish(fixture.worldsAnthems)) &&
        autoExisting.guide.url === fixture.sources.creatorSafeGuidelines && manualExisting.guide.url === fixture.sources.creatorSafeGuidelines &&
        autoExisting.guide.note.includes("二次利用許諾ではありません") && manualExisting.guide.note.includes("二次利用許諾ではありません");
      const createdMsi = testSettings.playlists.find(p => p.id === "trk-lol-msi-anthems");
      const createsMissingMsi = createdMsi && createdMsi.folder === "trk-lol" && createdMsi.wish.length === fixture.msiAnthems.tracks.length &&
        JSON.stringify(createdMsi.wish) === JSON.stringify(expectWish(fixture.msiAnthems)) &&
        createdMsi.guide.url === fixture.sources.creatorSafeGuidelines &&
        createdMsi.guide.note.includes("二次利用許諾ではありません");
      const createdKda = testSettings.playlists.find(p => p.id === "trk-lol-kda-songs");
      const createsKda = createdKda && createdKda.folder === "trk-lol" && createdKda.wish.length === fixture.kdaSongs.tracks.length &&
        JSON.stringify(createdKda.wish) === JSON.stringify(expectWish(fixture.kdaSongs)) &&
        createdKda.guide.url === fixture.sources.creatorSafeGuidelines &&
        createdKda.guide.note.includes("二次利用許諾ではありません");
      safeRefreshOk = preservesCustom && refreshesWishAndGuide && createsMissingMsi && createsKda && saveCount > 0 &&
        library.includes('lol: "trk-lol"');
    }
  } catch (error) {
    console.error(`WARN  LoL catalogue test setup failed: ${error.message}`);
  }
  if (!catalogDataOk) fail("LoL fixture/catalog mismatch (expected 41 modern Champion Themes, 14 released Worlds anthems, four MSI anthems, six K/DA songs, official track/video sources, and rights/scope notice)");
  else if (!safeRefreshOk) fail("LoL playlist refresh must update wishes/guides, preserve user-owned songs/customized fields, and create missing MSI/K/DA lists in trk-lol");
  else ok("LoL catalog: Sessions 108 + Champion Themes 41 + Worlds 14 + MSI 4 + K/DA 6; official links, rights notices, safe refresh");
}

// 🎧 LoL Phase 3 (SoundCloud albums): one playlist per official album — Season 1–9 + Warsongs — plus the
// official popular-tracks snapshot. Album links stay on SoundCloud, per-track links on the official
// individual pages, wishes keep the prefix-only aliases, and nothing may imply reuse rights.
{
  const catalogSource = read("js/catalog.js");
  const library = read("js/library.js");
  let catalogDataOk = false;
  let capacityOk = false;
  let safeRefreshOk = false;
  let creatorSafeOk = false;
  let guideWordingOk = false;
  let autoCreated = 0;
  try {
    const fixture = JSON.parse(read("tools/leagueoflegends-soundcloud-albums-tracklist.json"));
    const catalogContext = vm.createContext({});
    new vm.Script(catalogSource + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const series = catalogContext.__TRK_CATALOG_FOR_CHECK.find(item => item.id === "lol");
    const popular = fixture.popularTracks;
    const expected = fixture.albums.concat([popular]);
    const actual = expected.map(list => (series ? series.playlists.find(pl => pl.id === list.id) : null));
    /* 既存の7リスト（Sessions 3＋Champion Themes／Worlds／MSI／K/DA）の後ろに、Season 1→9・Warsongs・人気曲の順 */
    const orderOk = !!series && actual.every(Boolean) &&
      JSON.stringify(series.playlists.slice(7, 7 + expected.length).map(pl => pl.id)) === JSON.stringify(expected.map(list => list.id));
    const trackUrl = (list, target) => list.id === popular.id
      ? "https://soundcloud.com/leagueoflegends/" + target
      : "https://open.spotify.com/track/" + target;
    const wishOf = list => list.tracks.map(([title, artist, target, alias]) => {
      const wish = { t: title, al: list.id === popular.id ? "" : list.album, ar: artist, u: trackUrl(list, target) };
      if (alias) wish.matchAliases = [alias];
      return wish;
    });
    let trackTotal = 0;
    let listsMatch = orderOk;
    const spotifyIds = [];
    const soundcloudUrls = [];
    for (let i = 0; i < expected.length; i++) {
      const want = expected[i], got = actual[i];
      const isPopular = want.id === popular.id;
      if (!got) { listsMatch = false; continue; }
      if (got.name !== want.name || got.name.length > 24 || got.sourceUrl !== want.soundcloudUrl ||
          got.sourceLabel !== "SoundCloud" || got.songs.length !== want.trackCount ||
          got.songs.length !== want.tracks.length || got.tags.length > 5 || got.tags.some(tag => tag.length > 16)) listsMatch = false;
      let sourceOk = false;
      try {
        const url = new URL(want.soundcloudUrl);
        sourceOk = url.protocol === "https:" && url.hostname === "soundcloud.com" && !url.search &&
          (isPopular ? url.pathname === "/leagueoflegends/popular-tracks" : url.pathname.startsWith("/leagueoflegends/sets/"));
      } catch (_) {}
      if (!sourceOk || (!isPopular && !/^https:\/\/open\.spotify\.com\/album\/[A-Za-z0-9]{22}$/.test(want.spotifyAlbumUrl || ""))) listsMatch = false;
      for (let j = 0; j < want.tracks.length; j++) {
        const [title, artist, target, alias] = want.tracks[j];
        const track = got.songs[j];
        trackTotal++;
        let urlOk = false;
        try {
          const url = new URL(track.u);
          urlOk = url.protocol === "https:" && !url.search && track.u === trackUrl(want, target) &&
            (isPopular
              ? url.hostname === "soundcloud.com" && url.pathname === "/leagueoflegends/" + target && /^[a-z0-9-]+$/.test(target)
              : url.hostname === "open.spotify.com" && url.pathname === "/track/" + target && /^[A-Za-z0-9]{22}$/.test(target));
        } catch (_) {}
        if (isPopular) soundcloudUrls.push(track.u); else spotifyIds.push(target);
        /* 別名は公式タイトルの前方一致（切り詰め）だけ。根拠のない別名を作らない。 */
        const aliases = Array.isArray(track.matchAliases) ? track.matchAliases : [];
        const aliasOk = alias
          ? aliases.length === 1 && aliases[0] === alias && title.startsWith(alias) && alias.length >= 3
          : aliases.length === 0;
        if (!track || track.t !== title || track.ar !== artist ||
            track.al !== (isPopular ? "" : want.album) || !urlOk || !aliasOk) listsMatch = false;
      }
    }
    const rightsOk = !!series && series.url === fixture.sources.creatorSafeGuidelines &&
      fixture.sources.soundcloudAlbumsPage === "https://soundcloud.com/leagueoflegends/albums" &&
      fixture.sources.soundcloudPopularTracks === "https://soundcloud.com/leagueoflegends/popular-tracks" &&
      series.note.includes("Season 1〜9") && series.note.includes("Warsongs 11曲") &&
      series.note.includes("人気曲30曲") && series.note.includes("二次利用許諾ではありません") &&
      series.note.includes("これはLoL全楽曲ではなく");
    /* ✅ Creator-Safe：LoLの全18リストの照合状態は catalog.js（LOL_CREATOR_SAFE）と各 fixture の creatorSafe が一致し、
       曲数・見当たらない曲（notFound）・根拠（embed／mirror）と矛盾しないこと（trk116で全リストを照合）。
       全曲あり＝Season 1〜9・Sessions: Vi・Star Guardian Taliyah／一部＝Warsongs・Sessions: Diana（partial）、
       Champion Theme・Worlds（links-partial）、人気曲（mixed）／なし＝MSI・K/DA（links-absent）。
       101曲目以降は公式の埋め込みに出ないので songdata.io の一覧で照合した。mirror を使うならその記録を fixture に残す。
       シリーズの説明も「全曲」「一部」「見当たらない」を書き分ける（照合していないものを対象と書かない）。 */
    const statusOf = id => ((series && series.playlists.find(pl => pl.id === id)) || {}).creatorSafe;
    const lolStatuses = new Set(["verified", "partial", "links-verified", "links-partial", "links-absent", "mixed", "unverified", "unknown"]);
    const evidenceKinds = new Set(["embed", "mirror", "embed+mirror"]);
    const mirrorOk = !!(fixture.creatorSafe && fixture.creatorSafe.mirror &&
      fixture.creatorSafe.mirror.url === "https://songdata.io/playlist/5hDYD44imzFZEqTfAoco1N" &&
      /^2026-\d{2}-\d{2}$/.test(fixture.creatorSafe.mirror.checkedAt || ""));
    const musicFixture = JSON.parse(read("tools/leagueoflegends-music-tracklist.json"));
    const sessionsFixture = JSON.parse(read("tools/leagueoflegends-sessions-tracklist.json"));
    const csLists = [
      ...fixture.albums.map(album => ({ id: album.id, cs: album.creatorSafe, titles: album.tracks.map(track => track[0]) })),
      { id: popular.id, cs: popular.creatorSafe, titles: popular.tracks.map(track => track[0]) },
      ...["championThemes", "worldsAnthems", "msiAnthems", "kdaSongs"].map(key =>
        ({ id: musicFixture[key].id, cs: musicFixture[key].creatorSafe, titles: musicFixture[key].tracks.map(track => track.title) })),
      ...sessionsFixture.albums.map(album => ({ id: album.id, cs: album.creatorSafe, titles: album.tracks.map(track => track[0]) })),
      /* trk118：プレイリストの曲から作った4リスト（曲名はカタログ側、根拠は riot-games-creator-safe-playlist.json） */
      ...JSON.parse(read("tools/riot-games-creator-safe-playlist.json")).lists.filter(list => list.series === "lol").map(list =>
        ({ id: list.id, cs: list.creatorSafe, titles: ((series && series.playlists.find(pl => pl.id === list.id)) || { songs: [] }).songs.map(track => track.t) }))
    ];
    const csListOk = ({ id, cs, titles }) => {
      const c = cs || {};
      const nf = c.notFound;
      const notFoundOk = n => Array.isArray(nf) && nf.length === n && new Set(nf).size === n && nf.every(title => titles.includes(title));
      const countOk = (c.status === "verified" || c.status === "links-verified") ? c.matchedTracks === titles.length && titles.length > 0 && nf === undefined
        : (c.status === "partial" || c.status === "links-partial" || c.status === "mixed")
          ? c.matchedTracks > 0 && c.matchedTracks < titles.length && notFoundOk(titles.length - c.matchedTracks)
          : c.status === "links-absent" ? c.matchedTracks === 0 && notFoundOk(titles.length)
            : c.status === "unverified" && c.matchedTracks === undefined;
      const dated = c.status === "unverified" || /^2026-\d{2}-\d{2}$/.test(c.checkedAt || "");
      const evidenced = c.status === "unverified" || (evidenceKinds.has(c.evidence) && (c.evidence === "embed" || mirrorOk));
      return countOk && dated && evidenced && c.notYetMatched === undefined && statusOf(id) === c.status;
    };
    const idsWith = status => csLists.filter(list => (list.cs || {}).status === status).map(list => list.id).sort().join();
    const seasonIds = Array.from({ length: 9 }, (_, i) => "lol-season-" + (i + 1));
    creatorSafeOk = !!series && fixture.sources.creatorSafePlaylist === "https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N" &&
      fixture.creatorSafe && fixture.creatorSafe.playlist === fixture.sources.creatorSafePlaylist &&
      series.playlists.every(pl => lolStatuses.has(pl.creatorSafe)) &&
      csLists.length === 22 && new Set(csLists.map(list => list.id)).size === 22 &&
      series.playlists.length === 22 && series.playlists.every(pl => csLists.some(list => list.id === pl.id)) &&
      csLists.every(csListOk) &&
      idsWith("verified") === [...seasonIds, "lol-svi", "lol-staliyah"].sort().join() &&
      idsWith("partial") === "lol-sdiana,lol-warsongs" &&
      idsWith("links-partial") === "lol-champion-themes,lol-worlds-anthems" &&
      idsWith("links-absent") === "lol-kda-songs,lol-msi-anthems" &&
      idsWith("mixed") === "lol-popular-tracks" &&
      idsWith("links-verified") === "lol-cs-esports,lol-cs-ost-2025,lol-cs-pentakill,lol-cs-themes" &&
      ["Season 1〜9の全243曲", "songdata.io", "979曲中977曲", "41曲中39曲", "43曲中42曲", "11曲中10曲", "Silver Scrapes", "30曲中7曲",
        "MSIアンセム4曲とK/DA 6曲は見当たりませんでした", "Creator-Safe対象外・要確認"].every(word => series.note.includes(word)) &&
      !series.note.includes("の対象として扱います") && !series.note.includes("可能性が高い") && !series.note.includes("K/DAもCreator-Safe対象かは未確認");
    catalogDataOk = listsMatch && rightsOk && trackTotal === 284 && spotifyIds.length === 254 &&
      soundcloudUrls.length === 30 && new Set(spotifyIds).size === 254 && new Set(soundcloudUrls).size === 30 &&
      JSON.stringify(fixture.albums.map(album => album.trackCount)) === JSON.stringify([9, 30, 23, 22, 25, 27, 48, 39, 20, 11]);

    /* 🐔 保存側の実上限（1プレイリスト100曲・全体100リスト）に収まること。超えると wish や Vol が黙って消える。 */
    const folderMap = { bluearchive: "trk-ba", lol: "trk-lol", touhou: "trk-touhou", arknights: "trk-arknights", gakumas: "trk-gakumas", endfield: "trk-endfield" };
    for (const s of catalogContext.__TRK_CATALOG_FOR_CHECK) {
      const folder = folderMap[s.id] || "";
      for (const pl of (s.playlists || [])) {
        const songs = (pl.songs || []).length;
        if (!folder || !songs) continue;
        autoCreated += Math.ceil(songs / 100) || 1;
      }
    }
    capacityOk = expected.every(list => list.trackCount <= 100) && autoCreated <= 100;

    const ensureStart = library.indexOf("function trkCatalogGuide(");
    const ensureEnd = library.indexOf("\n(function plTighten()", ensureStart);
    if (ensureStart >= 0 && ensureEnd > ensureStart) {
      const seasonOne = fixture.albums[0];
      const ownedSongs = ["owned-lol-season-track"];
      const manualSongs = ["manual-owned-lol-popular-track"];
      const autoExisting = { id: "trk-lol-season-1", cat: "trk:lol:lol-season-1", name: "My Season 1 list",
        icon: "🎧", tags: ["my-season-tag"], wish: [{ t: "old", al: "", ar: "", u: "" }], songs: ownedSongs,
        guide: { note: "old guide", url: "https://example.com/old" } };
      const manualPopular = { id: "pl-manual-lol-popular", cat: "lol:lol-popular-tracks", name: "LoL 人気曲メモ",
        icon: "⭐", tags: ["personal", "tag"], wish: [{ t: "old", al: "", ar: "", u: "" }], songs: manualSongs,
        guide: { note: "old guide", url: "https://example.com/old" } };
      const testSettings = { playlists: [autoExisting, manualPopular] };
      let saveCount = 0;
      const runContext = vm.createContext({
        settings: testSettings,
        ensureTrkFolder: () => {},
        trkCatalog: () => [series],
        TEXT: LIBRARY_TEXT_FOR_CHECK,
        plSanitize: raw => raw,
        saveUserPrefs: () => { saveCount++; },
        trkWishesForSeries: () => []
      });
      new vm.Script(library.slice(library.indexOf("function trkWishFromTrack("), library.indexOf("\nfunction trkWishesFromCatalog")) + "\n" + library.slice(ensureStart, ensureEnd) + "\nensureTrkDistributionPlaylists();").runInContext(runContext);
      const preservesCustomData = autoExisting.name === "My Season 1 list" && autoExisting.icon === "🎧" &&
        JSON.stringify(autoExisting.tags) === JSON.stringify(["my-season-tag"]) && autoExisting.songs === ownedSongs &&
        manualPopular.name === "LoL 人気曲メモ" && manualPopular.icon === "⭐" &&
        JSON.stringify(manualPopular.tags) === JSON.stringify(["personal", "tag"]) && manualPopular.songs === manualSongs;
      const refreshesWishAndGuide = JSON.stringify(autoExisting.wish) === JSON.stringify(wishOf(seasonOne)) &&
        JSON.stringify(manualPopular.wish) === JSON.stringify(wishOf(popular)) &&
        autoExisting.guide.url === seasonOne.soundcloudUrl && manualPopular.guide.url === popular.soundcloudUrl &&
        autoExisting.guide.note.includes("公式SoundCloudアルバム") && manualPopular.guide.note.includes("人気曲ページ") &&
        autoExisting.guide.note.includes("二次利用許諾ではありません") && manualPopular.guide.note.includes("二次利用許諾ではありません") &&
        autoExisting.guide.note.length <= 80 && manualPopular.guide.note.length <= 80;
      const createdAlbums = fixture.albums.slice(1).every(album => {
        const created = testSettings.playlists.find(p => p.id === "trk-" + album.id);
        return created && created.folder === "trk-lol" && created.name === album.name &&
          JSON.stringify(created.wish) === JSON.stringify(wishOf(album)) &&
          created.guide.url === album.soundcloudUrl && created.guide.note.includes("公式SoundCloudアルバム");
      });
      const createdPopular = testSettings.playlists.find(p => p.id === "trk-" + popular.id);
      safeRefreshOk = preservesCustomData && refreshesWishAndGuide && createdAlbums && saveCount > 0 &&
        !!createdPopular && createdPopular.folder === "trk-lol" &&
        JSON.stringify(createdPopular.wish) === JSON.stringify(wishOf(popular)) &&
        createdPopular.guide.url === popular.soundcloudUrl &&
        library.includes("RIOT_GUIDE_KEYS[pl.creatorSafe]");
      /* ガイドは照合状態ごとの key と、その日本語の控え。4言語そろい、旧来の「Riotが権利を持つ曲でCreator-Safe対象」は使わない */
      const guideKeyFor = { verified: "plGuideLolCsVerified", partial: "plGuideLolCsPartial", unverified: "plGuideLolCsUnverified" };
      const wording = { verified: ["照合済み"], partial: ["一部の曲はCreator-Safe対象", "見当たらない・要確認"], unverified: ["未照合"] };
      /* Sessions・公式リンク集（Champion Theme／アンセム／K/DA）も照合状態どおりの鍵と文言（trk116） */
      const createdGuide = id => (testSettings.playlists.find(p => p.id === "trk-" + id) || {}).guide || {};
      const otherGuides = [["lol-svi", "plGuideLolCsVerified", ["公式SoundCloudアルバム", "照合済み"]],
        ["lol-staliyah", "plGuideLolCsVerified", ["公式SoundCloudアルバム", "照合済み"]],
        ["lol-sdiana", "plGuideLolCsPartial", ["公式SoundCloudアルバム", "一部の曲はCreator-Safe対象", "見当たらない"]],
        ["lol-champion-themes", "plGuideRiotLinksPartial", ["公式リンク集", "一部の曲はCreator-Safe対象", "見当たらない"]],
        ["lol-worlds-anthems", "plGuideRiotLinksPartial", ["公式リンク集", "一部の曲はCreator-Safe対象", "見当たらない"]],
        ["lol-msi-anthems", "plGuideRiotLinksAbsent", ["公式リンク集", "見当たらない", "Creator-Safe対象外・要確認"]],
        ["lol-kda-songs", "plGuideRiotLinksAbsent", ["公式リンク集", "見当たらない", "Creator-Safe対象外・要確認"]],
        ...["lol-cs-pentakill", "lol-cs-themes", "lol-cs-esports", "lol-cs-ost-2025"].map(id =>
          [id, "plGuideRiotLinksVerified", ["公式リンク集", "全曲がCreator-Safe対象", "照合済み"]])];
      const otherGuidesOk = otherGuides.every(([id, key, words]) => {
        const guide = createdGuide(id);
        return guide.key === key && guide.note === LIBRARY_TEXT_FOR_CHECK.ja[key] && words.every(word => guide.note.includes(word)) &&
          guide.note.includes("二次利用許諾ではありません");
      });
      const guideOf = album => (album.id === seasonOne.id ? autoExisting : testSettings.playlists.find(p => p.id === "trk-" + album.id) || {}).guide || {};
      const allGuideKeys = [...Object.values(guideKeyFor), "plGuideRiotLinksVerified", "plGuideRiotLinksPartial", "plGuideRiotLinksAbsent", "plGuideLolPopular", "plGuideRiotLinks"];
      guideWordingOk = fixture.albums.every(album => {
        const guide = guideOf(album), status = album.creatorSafe.status;
        return guide.key === guideKeyFor[status] && guide.note === LIBRARY_TEXT_FOR_CHECK.ja[guide.key] &&
          wording[status].every(word => guide.note.includes(word)) && guide.note.includes("二次利用許諾ではありません");
      }) && otherGuidesOk && createdPopular.guide.key === "plGuideLolPopular" && createdPopular.guide.note.includes("人気曲ページ") &&
        createdPopular.guide.note.includes("一部だけCreator-Safe対象") && createdPopular.guide.note.includes("共同制作曲などは対象外・要確認") &&
        manualPopular.guide.key === "plGuideLolPopular" &&
        allGuideKeys.every(key => ["ja", "en", "zh", "ko"].every(lang => typeof LIBRARY_TEXT_FOR_CHECK[lang][key] === "string" && LIBRARY_TEXT_FOR_CHECK[lang][key].length > 20)) &&
        !library.includes("Riotが権利を持つ曲でCreator-Safe対象") &&
        !LIBRARY_TEXT_FOR_CHECK.ja.plGuideLolCsUnverified.includes("可能性が高い") && !LIBRARY_TEXT_FOR_CHECK.ja.plGuideLolCsPartial.includes("可能性が高い") &&
        /* 推測で「可能性が高い」とした likely（trk115で廃止）と、Playlistと未照合だった sessions（trk116で照合済み・部分に
           置き換え）の文言は残さない */
        ["ja", "en", "zh", "ko"].every(lang => ["plGuideLolCsLikely", "plGuideLolSessions"].every(key =>
          !Object.prototype.hasOwnProperty.call(LIBRARY_TEXT_FOR_CHECK[lang], key)));
    }
  } catch (error) {
    console.error(`WARN  LoL SoundCloud album test setup failed: ${error.message}`);
  }
  if (!catalogDataOk) fail("LoL SoundCloud album fixture/catalog mismatch (expected Season 1–9 as nine playlists with 9/30/23/22/25/27/48/39/20 ordered tracks, Warsongs with 11, the 30-track popular-tracks snapshot, official album links, prefix-only aliases, and the rights/scope notice)");
  else if (!capacityOk) fail(`LoL SoundCloud albums must fit the saved-playlist limits (100 wishes per playlist, ${autoCreated} auto-created trk playlists of 100 allowed)`);
  else if (!safeRefreshOk) fail("LoL SoundCloud album imports must refresh wishes/guides, keep owned songs and customized name/icon/tags, create every Season/Warsongs/popular list under trk-lol, and describe the popular-tracks page as a page, not an album");
  else if (!creatorSafeOk) fail("LoL Creator-Safe status: js/catalog.js LOL_CREATOR_SAFE must match every list's creatorSafe in the three LoL fixtures (verified = all found: Season 1–9, Sessions Vi/Taliyah; partial = Warsongs, Sessions Diana; links-partial = Champion Themes, Worlds; links-absent = MSI, K/DA; mixed = popular tracks), with matched counts, notFound titles from the list, evidence (embed/mirror, songdata.io recorded), and a series note that keeps found, partly found and not-found lists apart");
  else if (!guideWordingOk) fail("LoL playlist guides must follow each playlist's Creator-Safe status (照合済み／一部の曲は対象・残りは見当たらない・要確認／公式リンク集の一部・見当たらない; popular tracks: 一部だけ・共同制作曲などは対象外・要確認) in all four languages, never the old blanket claim or the retired 'likely'/'sessions' wording");
  else ok(`LoL SoundCloud albums: Season 1–9 (243 tracks) + Warsongs (11) + popular-tracks snapshot (30), official album/track links, ${autoCreated} auto-created trk playlists within the 100 cap, safe refresh, per-playlist Creator-Safe status for all 22 LoL lists (all found: Season 1–9 + Sessions Vi/Taliyah + the 4 lists built from the playlist; partly: Champion Themes 39/41, Sessions Diana 42/43, Warsongs 10/11, Worlds 1/13, popular 7/30; none: MSI, K/DA)`);
}

// 🛡️ Riot Creator-Safe lists (trk118): lists built from the official Creator-Safe playlists. Every song links to a
// Spotify track ID recorded in tools/riot-games-creator-safe-playlist.json (Riot Games playlist, rows 51–977) or
// tools/valorant-creator-safe.json (VALORANT playlist, all 40 entries) with the same title and artists, and every
// row of the Riot Games playlist is now in some LoL / VALORANT / Riot Games list (by ID, or by title for the album lists).
{
  let csListsOk = false;
  let coverageOk = false;
  let coverageNote = "";
  let songCount = 0;
  try {
    const catalogContext = vm.createContext({});
    new vm.Script(read("js/catalog.js") + "\nglobalThis.__TRK_CATALOG_FOR_CHECK = TRK_CATALOG;").runInContext(catalogContext);
    const all = catalogContext.__TRK_CATALOG_FOR_CHECK;
    const fixture = JSON.parse(read("tools/riot-games-creator-safe-playlist.json"));
    const valFixture = JSON.parse(read("tools/valorant-creator-safe.json"));
    const lol = all.find(item => item.id === "lol"), val = all.find(item => item.id === "valorant"), rg = all.find(item => item.id === "riot-games");
    const riotCs = "https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N", valCsUrl = "https://open.spotify.com/playlist/4tyTLcBxJnf7DcQcHjwt0W";
    const guidelines = "https://www.riotgames.com/en/riot-music-creator-safe-guidelines";
    const spotifyId = url => (/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})$/.exec(url || "") || [])[1];
    const rowById = new Map(fixture.rows.map(row => [row[1], { title: row[2], artists: row[3] }]));
    const valById = new Map(valFixture.creatorSafe.entries.map(entry => [entry[2], { title: entry[0], artists: entry[1] }]));
    const fxLists = new Map(fixture.lists.map(list => [list.id, list]));
    const builtFrom = (pl, byId, sourceUrl) => {
      const ids = pl.songs.map(track => spotifyId(track.u));
      return pl.creatorSafe === "links-verified" && pl.songs.length > 0 && pl.songs.length <= 100 && pl.name.length <= 24 &&
        pl.sourceUrl === sourceUrl && ids.every(Boolean) && new Set(ids).size === ids.length &&
        pl.songs.every((track, i) => { const row = byId.get(ids[i]); return !!row && track.t === row.title && track.ar === row.artists; });
    };
    const recorded = (pl, series) => {
      const listed = fxLists.get(pl.id), c = (listed && listed.creatorSafe) || {};
      return !!listed && listed.series === series && c.status === "links-verified" && c.matchedTracks === pl.songs.length &&
        c.evidence === "mirror" && /^2026-\d{2}-\d{2}$/.test(c.checkedAt || "");
    };
    const lolIds = ["lol-cs-pentakill", "lol-cs-themes", "lol-cs-esports", "lol-cs-ost-2025"];
    const rgIds = ["riot-cs-ruined-king", "riot-cs-mageseeker", "riot-cs-hextech-mayhem", "riot-cs-tft-1", "riot-cs-tft-2", "riot-cs-2xko", "riot-cs-wild-rift"];
    const lolLists = lol ? lol.playlists.slice(-4) : [];
    const rgLists = rg ? rg.playlists : [];
    const valCs = val && val.playlists.find(pl => pl.id === "val-cs");
    songCount = [...lolLists, ...rgLists, ...(valCs ? [valCs] : [])].reduce((sum, pl) => sum + pl.songs.length, 0);
    csListsOk = fixture.playlist === riotCs && Array.isArray(fixture.rows) && fixture.rows.length === 927 &&
      fixture.rows.every(row => Array.isArray(row) && row.length === 4 && Number.isInteger(row[0]) && /^[A-Za-z0-9]{22}$/.test(row[1]) &&
        typeof row[2] === "string" && row[2] && typeof row[3] === "string" && row[3]) &&
      JSON.stringify(lolLists.map(pl => pl.id)) === JSON.stringify(lolIds) && lolLists.every(pl => builtFrom(pl, rowById, riotCs) && recorded(pl, "lol")) &&
      !!rg && rg.url === guidelines && JSON.stringify(rgLists.map(pl => pl.id)) === JSON.stringify(rgIds) &&
      rgLists.every(pl => builtFrom(pl, rowById, riotCs) && recorded(pl, "riot-games")) &&
      fixture.lists.length === lolIds.length + rgIds.length &&
      !!valCs && valCs.songs.length === 39 && builtFrom(valCs, valById, valCsUrl) &&
      ["Riot公式Creator-Safe Playlist", "全曲がCreator-Safe対象", "songdata.io", "二次利用許諾ではありません", "Legal Jibber Jabber"].every(word => rg.note.includes(word)) &&
      lol.note.includes("4リストを作りました") && val.note.includes("「VALORANT Creator-Safe」リスト");
    const normTitle = title => String(title).normalize("NFKC").replace(/[’‘]/g, "'").toLowerCase()
      .replace(/\s*\((?:feat\.|ft\.)[^)]*\)\s*$/, "").replace(/\s*[-–]\s*champion theme\s*$/, "").replace(/\s+/g, " ").trim();
    const catalogSongs = [lol, val, rg].flatMap(item => (item ? item.playlists.flatMap(pl => pl.songs) : []));
    const catalogIds = new Set(catalogSongs.map(track => spotifyId(track.u)).filter(Boolean));
    const catalogTitles = new Set(catalogSongs.map(track => normTitle(track.t)));
    const uncovered = fixture.rows.filter(row => !catalogIds.has(row[1]) && !catalogTitles.has(normTitle(row[2])));
    coverageOk = uncovered.length === 0;
    coverageNote = uncovered.slice(0, 5).map(row => row[0] + ":" + row[2]).join(", ");
  } catch (error) {
    console.error(`WARN  Riot Creator-Safe list test setup failed: ${error.message}`);
  }
  if (!csListsOk) fail("Riot Creator-Safe lists (trk118): the 4 LoL lists, the 7 Riot Games lists and VALORANT Creator-Safe must link only to recorded Spotify track IDs with the same title and artists (≤100 songs, no duplicates, official playlist as the source), be links-verified in the catalog and the fixture, and keep the rights notes");
  else if (!coverageOk) fail(`Riot Creator-Safe coverage: rows of the Riot Games Creator-Safe Playlist that are in no LoL / VALORANT / Riot Games list: ${coverageNote}`);
  else ok(`Riot Creator-Safe lists: 12 lists (${songCount} songs) built from the official Creator-Safe playlists, every song on a recorded Spotify track ID; all 927 recorded rows of the Riot Games playlist are in the catalog`);
}

// ⚠ el(tag, cls, text) は文字を1つしか入れられない（入れ子を渡すと "[object ...]" になる）。
// 引数4つ以上／第3引数がオブジェクト literal は取り違えなので、静的に止める。
{
  const bad = [];
  for (const ent of fs.readdirSync(path.join(root, "js"))) {
    if (!ent.endsWith(".js")) continue;
    const src = read("js/" + ent);
    for (const m of src.matchAll(/(?<![\w.])el\(/g)) {
      const start = m.index + m[0].length;
      let depth = 1, i = start;
      while (i < src.length && depth) {
        if (src[i] === "(") depth += 1;
        else if (src[i] === ")") depth -= 1;
        i += 1;
      }
      const inner = src.slice(start, i - 1);
      const parts = []; let d = 0, cur = "";
      for (const c of inner) {
        if ("([{".includes(c)) d += 1;
        else if (")]}".includes(c)) d -= 1;
        if (c === "," && d === 0) { parts.push(cur); cur = ""; } else cur += c;
      }
      parts.push(cur);
      const args = parts.map(p => p.trim());
      const line = src.slice(0, m.index).split("\n").length;
      if (args.length > 3) bad.push(`js/${ent}:${line} (el() に引数 ${args.length} 個)`);
      else if (args.length === 3 && args[2].startsWith("{")) bad.push(`js/${ent}:${line} (el() の文字にオブジェクト)`);
    }
  }
  if (bad.length) fail("el(tag, cls, text) misuse (children/objects passed as text): " + bad.join(", "));
  else ok("el(tag, cls, text) is only ever given one text node (no [object HTML…] rows)");
}

// 🐔 trk's playlist tab: fixed 🐔 icon + three label choices, no profile editing, long-press = hierarchy.
{
  const library = read("js/library.js");
  const core = read("js/core.js");
  const html = read("index.html");
  const i18n = library;
  /* 名前・アイコン・色は固定（保存データ側も読み込み時にそろえる）。フォルダ名に絵文字を戻すと 🐔🐔 になる */
  const fixedOk = library.includes('const TRK_FOLDER_NAME = "trk\'s playlist"') && library.includes("function trkFolderNormalize(") &&
    library.includes("if (f.name !== TRK_FOLDER_NAME) { f.name = TRK_FOLDER_NAME; ch = true; }") &&
    library.includes("trkFolderNormalize();   /* 旧データの") &&
    !/id: TRK_FOLDER_ID,\s*name: "🐔/.test(library);
  /* カタログは catalog.js の const。⚠ window.TRK_CATALOG は undefined で、Vol が1つも作られない */
  const catalogOk = library.includes("function trkCatalog(") &&
    library.includes("typeof TRK_CATALOG !== \"undefined\"") && !library.includes("window.TRK_CATALOG");
  /* 表示名の3種類（許可リストは core.js の TRK_ENUM_VALUES＝設定Importでも検証する） */
  const labelOk = library.includes("function trkTabLabel(") && library.includes("trkTabNameShort") && library.includes("trkTabNameFull") &&
    library.includes("f.id !== TRK_FOLDER_ID) tabs.push({ id:\"fld:\" + f.id") &&
    library.includes("if (!tabs.some(x => x.id === \"fld:\" + TRK_FOLDER_ID)) tabs.push({ id:\"fld:\" + TRK_FOLDER_ID, icon: TRK_TAB_ICON, label: trkTabLabel()") &&
    /* 🐔 タブを OFF にしたらタブは消える。ただし 🎻 classic が生きていれば、そのタブだけは出す（行き止まりにしない） */
    library.includes("if (trkFolder && settings.trkPlaylist !== false)") &&
    core.includes('trkTabName: ["full", "short", "icon"]') && core.includes('trkTabName: pick(prefs.trkTabName') &&
    core.includes('settings.trkTabName = "full"') && core.includes('"liteMode", "liteFps", "liteMascot", "liteScale", "liteLibRows", "trkTabName"');
  /* 長押し＝階層。プロフィール編集（plMenu／plFolderMenu）へは行かせない */
  const pressOk = library.includes("if (t.trk) plTrkMenu(); else if (t.pl) plMenu(t.pl); else if (t.fld) plFolderMenu(t.fld); else plGlobalMenu();") &&
    library.includes("if (f && f.id === TRK_FOLDER_ID) { plTrkMenu(); return; }") && library.includes("function plTrkMenu(");
  /* 設定欄：3種類の選択と、🎻 trk classic の収納（trkPanel の中の subPanel） */
  const panelOk = html.includes('id="trkTabNameSel"') && html.includes('<option value="short" data-i18n="trkTabNameShort">') &&
    html.includes('<option value="icon" data-i18n="trkTabNameIcon">') &&
    /<details class="panel" id="trkPanel">[\s\S]*<details class="subPanel" id="trkClassicPanel">[\s\S]*?<\/details>\s*<\/details>/.test(html) &&
    html.includes('id="trkSortAbcChk"') && html.includes('id="trkOrderList"') &&
    html.includes('id="trkMusicFolderBtn"') && html.includes('data-i18n="trkMusicFolderHint"') &&
    library.includes('trkMusicFolderBtn.addEventListener("click", openFolder)');
  const keys = ["trkTabNameLabel", "trkTabNameFull", "trkTabNameShort", "trkTabNameIcon", "trkTabNameNote",
    "trkMusicFolderHint", "trkMusicFolderBtn", "trkMenuTitle", "trkMenuHint", "trkMenuOpenFolder", "trkOpenItem", "trkMoveUp", "trkMoveDown", "trkOrderEmpty", "trkOrderAbcOff"];
  const langOk = keys.every(k => (i18n.match(new RegExp("\\b" + k + ":", "g")) || []).length === 4);
  if (!fixedOk) fail("trk's playlist name/icon/colour are not pinned (a 🐔 name brings back the double 🐔 tab)");
  else if (!catalogOk) fail("trk wish lists read window.TRK_CATALOG, which is always undefined — the Vol tabs are never created");
  else if (!labelOk) fail("the trk tab label (full / short / icon) or its allowlist is not wired");
  else if (!pressOk) fail("long-press on the trk tab must open the hierarchy, not the profile editor");
  else if (!panelOk) fail("the trk settings panel is missing the label select, read-only Music/trk folder guide, or nested trk classic panel");
  else if (!langOk) fail("trk tab/menu strings are missing from one of the four languages");
  else ok("🐔 trk's playlist: fixed name/icon, three labels, read-only Music/trk folder guide, long-press hierarchy, trk classic nested in settings");
}

// 🗑 trk114: deleting an automatic trk list leaves a validated marker (settings.trkRemoved) so the next start
// does not recreate it, ♻ in the trk panel restores them, the OST is moved into the trk folder only once, and
// playlist guides / MIDI limit messages exist in all four languages (guides are shown via their key, not a stored
// Japanese sentence).
{
  const library = read("js/library.js"), core = read("js/core.js"), html = read("index.html"), media = read("js/media.js");
  const guideKeys = [...new Set([...library.matchAll(/"(plGuide[A-Za-z0-9]+)"/g)].map(m => m[1]))];
  const fourLanguages = key => (library.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4;
  const stringsOk = guideKeys.length >= 20 && guideKeys.every(fourLanguages) &&
    ["plOfficialLink", "trkRestoreBtn", "trkRestoreHint", "trkRestored", "midiTooDense", "midiRenderingProgress", "midiTooComplex"].every(fourLanguages) &&
    guideKeys.every(key => typeof LIBRARY_TEXT_FOR_CHECK.ja[key] === "string" && typeof LIBRARY_TEXT_FOR_CHECK.en[key] === "string");
  const markerOk = library.includes("trkMarkRemoved(p.id);") && library.includes("if (trkIsRemoved(TRK_PLAYLIST_ID)) return false;") &&
    library.includes("if (trkIsRemoved(TRK_CLASSIC_ID)) return false;") && library.includes("if (trkIsRemoved(TRK_OST_ID)) return false;") &&
    library.includes("if (trkIsRemoved(vid)) continue;") && library.includes("if (trkIsRemoved(d.id)) continue;") &&
    library.includes("if (exist.cat !== TRK_OST_CAT) {") && !library.includes("if (exist.folder !== TRK_FOLDER_ID) { exist.folder = TRK_FOLDER_ID;") &&
    core.includes("trkRemoved: cleanTrkRemoved(prefs.trkRemoved)") && core.includes("settings.trkRemoved = cleanTrkRemoved(data.trkRemoved)") &&
    core.includes("settings.trkRemoved = [];") &&
    html.includes('<button id="trkRestoreBtn" type="button" hidden></button>') && html.includes('data-i18n="trkRestoreHint"') &&
    library.includes('const trkRestoreBtn = $("trkRestoreBtn");') &&
    /* trk217：♻ は出さず、消したリストは設定のリスト選択（trkPickAdd）から1本ずつ戻す */
    library.includes("restore.hidden = true;") && library.includes("function trkPickAdd(entry)") &&
    library.includes("if (!entry || trkPickHas(entry) || settings.playlists.length >= TRK_LIST_MAX) return false;") &&
    library.includes("trkUnmarkRemoved(entry.id);") && html.includes('id="trkPickSelect"');
  const displayOk = library.includes("const guideNote = plGuideText(p.guide);") && library.includes("return tr(guide.key);") &&
    !/note:\s*"\\u975E/.test(library) && !library.includes('guide: { note: "DOWNLOAD規約');
  const namespaceOk = !/window\.Trk(?:EnsureTrkOstPlaylist|OstPlaylistId|TouhouThemeData)\b/.test(library + read("js/catalog.js") + read("js/touhou-theme-data.js")) &&
    library.includes("ensureTrkOstPlaylist, trkOstPlaylistId: TRK_OST_ID, trkRestoreRemoved") &&
    read("js/touhou-theme-data.js").includes("window.Trk.touhouThemeData = Object.freeze({");
  const midiOk = media.includes('error.code === "midi-too-dense" ? "midiTooDense"') && media.includes("shouldAbort:() => token !== loadToken");
  if (!stringsOk) fail("trk114 strings (playlist guides, ♻ restore, MIDI limit/progress) must exist in all four languages");
  else if (!markerOk) fail("deleted automatic trk lists must stay deleted (validated settings.trkRemoved marker, ♻ restore button) and trk's OST Vol.1 may be moved into the trk folder only once");
  else if (!displayOk) fail("playlist guides must be shown from their dictionary key (no hard-coded Japanese guide sentences in library.js)");
  else if (!namespaceOk) fail("TrkEnsureTrkOstPlaylist / TrkOstPlaylistId / TrkTouhouThemeData must live under window.Trk (library, touhouThemeData), not as new window names");
  else if (!midiOk) fail("midi-too-dense needs its own message and loadMedia must abort a render when another song is loaded");
  else ok(`trk114: ${guideKeys.length} playlist-guide keys in four languages, deleted trk lists stay deleted (♻ restore), OST moved once, window.Trk namespace, MIDI density message + abort`);
}

// 👥 Author tools for shared playlists (off by default; search/block/favorite).
if (!read("js/library.js").includes("plAuthorMenu") ||
    !read("js/library.js").includes("plVisible") ||
    !read("js/core.js").includes("plAuthorTools") ||
    !read("js/library.js").includes('author: String(settings.plAuthorName')) {
  fail("shared-playlist author tools are missing");
} else {
  ok("author tools (search / block / favorites, default off) are wired");
}

// ⏯🔊 Song banner: tap-to-pause (default off) + short-tap slider / long-press mute.
{
  const library = read("js/library.js");
  const i18n = read("js/i18n.js");
  const longPressOk = library.includes('bannerVolBtn.addEventListener("pointerdown"') &&
    library.includes("}, 650);") && library.includes("bannerVolLongPressAction()") &&
    library.includes("setBannerMusicVolume(0)") && library.includes("bannerVolRestore") &&
    library.includes("rememberMusicVolume(bannerVolRestore)") && library.includes("bannerVolLongPressed") &&
    library.includes('bannerVolPanel.hidden = !bannerVolPanel.hidden') &&
    read("js/core.js").includes("musicVolumeRestore") && read("js/core.js").includes("out.musicVolumeRestore") &&
    read("js/main.js").includes("rememberMusicVolume(settings.musicVolume)");
  const tipCount = (i18n.match(/bannerVolTip:/g) || []).length;
  if (!library.includes("bannerPauseAction") || !library.includes("bannerVolSlider") ||
      !longPressOk || tipCount !== 4 || !read("index.html").includes('id="bannerPause"') ||
      !read("js/core.js").includes("bannerPause")) {
    fail("song-banner tap-pause / short-tap slider / long-press mute-and-restore wiring is incomplete");
  } else {
    ok("song-banner tap-pause, short-tap slider, and four-language long-press mute/restore are wired");
  }
}

// ⏯ Song banner: the play / pause button sits left of the volume button (same size, trk126).
// The action is a pure function, run here in a VM; the icon, the tip and the
// "a newly chosen song plays again" wiring are checked as text.
{
  const library = read("js/library.js");
  const css = read("css/style.css");
  const i18n = read("js/i18n.js");
  const clickAt = library.indexOf('bannerPlayBtn.addEventListener("click"');
  const clickEnd = clickAt >= 0 ? library.indexOf("\n});", clickAt) : -1;
  const clickBlock = clickEnd > clickAt ? library.slice(clickAt, clickEnd) : "";
  const clickOk = clickBlock.includes("pauseGame()") && clickBlock.includes("resumeGame()") &&
    clickBlock.includes("video.pause()") && clickBlock.includes("video.volume = settings.musicVolume * 0.8;") &&
    clickBlock.includes("video.play().catch(() => {});");
  const wiringOk = library.includes('el("button", "bannerPlayBtn", "▶")') &&
    library.includes("bannerMediaBar.append(bannerPlayBtn, bannerVolBtn)") &&
    library.includes('const showsPause = act === "pause" || act === "preview-pause";') &&
    library.includes('bannerPlayBtn.textContent = showsPause ? "\u23f8" : "\u25b6"') &&
    library.includes('bannerPlayBtn.setAttribute("aria-label", tip)') &&
    library.includes("bannerPlayBtn.disabled = !act") &&
    library.includes('video.addEventListener("play", bannerPlaySync)') &&
    library.includes('video.addEventListener("pause", bannerPlaySync)') &&
    library.includes('on("phase", bannerPlaySync)') && library.includes('on("language", bannerPlaySync)') &&
    library.includes("function bannerPreviewRestart() {\n  if (bannerPlayAction(bannerPlayState()) !== \"preview-play\") return;\n  startPreview();\n}") &&
    library.includes("bannerPreviewRestart(); return; }") && clickOk;
  const cssOk = css.includes(".bannerMediaBar{position:absolute;right:10px;bottom:10px") &&
    css.includes(".bannerVolBtn,.bannerPlayBtn{") && css.includes(".bannerPlayBtn:disabled{");
  const padOk = Number((css.match(/\.bannerText\{[^}]*padding-right:(\d+)px/) || [])[1] || 0) >= 96;
  const tipCount = key => (i18n.match(new RegExp(key + ":", "g")) || []).length;
  const tipsOk = tipCount("bannerPlayPauseTip") === 4 && tipCount("bannerPlayResumeTip") === 4 &&
    tipCount("bannerPlayNoSongTip") === 4 && tipCount("bannerPlayPreviewOffTip") === 4 && tipCount("bannerPlayIdleTip") === 4;
  const start = library.indexOf("function bannerPlayAction(st) {");
  const end = library.indexOf("\nfunction bannerPlayState");
  const source = start >= 0 && end > start ? library.slice(start, end) : "";
  const tipStart = library.indexOf("function bannerPlayTipKey(st, act) {");
  const tipEnd = library.indexOf("\nfunction bannerPlaySync");
  const tipSource = tipStart >= 0 && tipEnd > tipStart ? library.slice(tipStart, tipEnd) : "";
  const context = vm.createContext({});
  let action = null, tipKey = null;
  if (source) {
    new vm.Script(source + "\nglobalThis.__bannerPlayAction = bannerPlayAction;").runInContext(context);
    action = context.__bannerPlayAction;
  }
  if (source && tipSource) {
    new vm.Script(source + "\n" + tipSource + "\nglobalThis.__bannerPlayTipKey = bannerPlayTipKey;").runInContext(context);
    tipKey = context.__bannerPlayTipKey;
  }
  const st = extra => Object.assign({ mediaMode:false, phase:"title", hasSong:true, previewEnabled:true, previewPlaying:true }, extra);
  const results = action ? [
    action(st({ phase:"playing" })), action(st({ phase:"paused" })),
    action(st({})), action(st({ previewPlaying:false })),
    action(st({ previewEnabled:false })), action(st({ hasSong:false })),
    action(st({ mediaMode:true, phase:"playing" })), action(st({ phase:"ended" })),
  ] : [];
  const expected = ["pause", "resume", "preview-pause", "preview-play", null, null, null, null];
  const logicOk = JSON.stringify(results) === JSON.stringify(expected);
  /* 説明の文言：押せるときは押すとどうなるか、押せないときは理由（曲未選択／プレビューオフ／その他） */
  const tipOf = extra => { const s = st(extra); return tipKey(s, action(s)); };
  const tipResults = tipKey ? [
    tipOf({ phase:"playing" }), tipOf({ phase:"paused" }), tipOf({ previewPlaying:false }),
    tipOf({ previewPlaying:true }), tipOf({ hasSong:false }), tipOf({ previewEnabled:false }),
    tipOf({ hasSong:false, previewEnabled:false }), tipOf({ mediaMode:true, phase:"playing" }),
    tipOf({ phase:"ended" }), tipOf({ mediaMode:true, hasSong:false }),
  ] : [];   /* メディアプレーヤー中は押せない（action が null）ので「今は押せない」 */
  const tipExpected = ["bannerPlayPauseTip", "bannerPlayResumeTip", "bannerPlayResumeTip", "bannerPlayPauseTip",
    "bannerPlayNoSongTip", "bannerPlayPreviewOffTip", "bannerPlayNoSongTip", "bannerPlayIdleTip",
    "bannerPlayIdleTip", "bannerPlayIdleTip"];
  const tipLogicOk = JSON.stringify(tipResults) === JSON.stringify(tipExpected) &&
    library.includes("const tip = tr(bannerPlayTipKey(st, act));") && library.includes("bannerPlayBtn.disabled = !act");
  if (!wiringOk || !cssOk || !padOk || !tipsOk || !logicOk || !tipLogicOk) {
    fail("song-banner play/pause button (left of the volume button, same size) is missing or miswired" +
      (logicOk ? "" : ` — actions were ${JSON.stringify(results)}, expected ${JSON.stringify(expected)}`) +
      (tipLogicOk ? "" : ` — tips were ${JSON.stringify(tipResults)}, expected ${JSON.stringify(tipExpected)}`));
  } else {
    ok("song-banner play/pause sits left of the volume button with the same size, pauses preview and game, and a newly chosen song plays again (four-language tip)");
  }
}

// ◀🎲▶ Song banner: the song controls ([◀][🎲][▶]) sit together at the right edge
// so the left ◀ no longer covers the song title. 🎲 is long-press by default
// (mis-tap safety) with an on/off switch and a tap-only option for people who
// like random, and a short tap only shows a hint.
{
  const library = read("js/library.js");
  const html = read("index.html");
  const css = read("css/style.css");
  const core = read("js/core.js");
  const i18n = read("js/i18n.js");
  const layoutOk = library.includes('const bannerSongBar = el("div", "bannerSongBar")') &&
    library.includes("bannerSongBar.append(bannerPrevBtn, bannerRandomBtn, bannerNextBtn)") &&
    !library.includes("bannerPrevBtn.style.left") &&
    css.includes(".bannerSongBar{position:absolute;top:50%;right:10px") &&
    css.includes(".banner.hasSongBtns .bannerText{padding-right:") &&
    library.includes('classList.toggle("hasSongBtns", on)');
  const randomOk = library.includes("function randomSongPick()") &&
    library.includes("function bannerSongRandom()") && library.includes("bannerRandomTapMode") &&
    library.includes("bannerRandLongPressed") && library.includes("}, 650);") &&
    library.includes('plToast(tr("bannerRandomHold"))') &&
    core.includes("bannerRandomBtn: prefs.bannerRandomBtn !== false") &&
    core.includes("bannerRandomTap: prefs.bannerRandomTap === true") &&
    core.includes("settings.bannerRandomBtn = true; settings.bannerRandomTap = false;");
  const uiOk = html.includes('id="bannerRandomBtn"') && html.includes('id="bannerRandomTap"') &&
    ["bannerRandomBtn", "bannerRandomTap", "bannerRandomHoldTip", "bannerRandomTapTip", "bannerRandomHold"]
      .every(key => (i18n.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4);
  if (!layoutOk) fail("banner song controls should sit together at the right edge so they do not cover the song title");
  else if (!randomOk) fail("banner random button (default long press / tap-only option / on-off) is incomplete");
  else if (!uiOk) fail("banner random button UI (checkboxes + four-language strings) is incomplete");
  else ok("banner ◀🎲▶ controls sit at the right edge; 🎲 is long-press by default with on/off and tap-only options");
}

// 🩷 MMD: defaults, grouped 60-motion chooser, facial morphs and original procedural VMD.
{
  const mmd = read("js/mmd.js");
  const core = read("js/core.js");
  const preset = JSON.parse(read("assets/mmd/lat-miku/preset.json"));
  const labelKeys = [
    "mmdMotionWalk", "mmdMotionRun", "mmdMotionSit", "mmdMotionDance", "mmdMotionLegacy",
    "mmdGroupDaily", "mmdGroupDance", "mmdGroupSongs", "mmdGroupMiku", "mmdGroupFaces", "mmdGroupVoice",
    "mmdMotionFaceSmile", "mmdMotionFaceWink", "mmdMotionFaceShy", "mmdMotionFaceAngry", "mmdMotionFaceConfused",
    "mmdMotionFaceSurprise", "mmdMotionFaceSleepy", "mmdMotionFacePout", "mmdMotionFaceLaugh", "mmdMotionFaceSing",
    "mmdMotionPrincess", "mmdMotionLeekShake", "mmdMotionPopipo", "mmdMotionTriple", "mmdMotionNyan", "mmdMotionSalute",
    "mmdMotionDoubleHeart", "mmdMotionPoint", "mmdMotionEncore", "mmdMotionDramatic", "mmdMotionVictory", "mmdMotionPenlight",
    "mmdMotionChibi", "mmdMotionSpin", "mmdMotionGroove", "mmdMotionStepTouch", "mmdMotionShoulderPop", "mmdMotionArmWave",
    "mmdMotionCrossStep", "mmdMotionSoftBow", "mmdMotionMarionette",
    "mmdMotionSongMic", "mmdMotionSongLong", "mmdMotionSongUp", "mmdMotionSongHum", "mmdMotionSongWhisper", "mmdMotionSongCall"
  ];
  const labelsOk = labelKeys.every(key => (mmd.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4);
  const defaultOk = preset.motion === "faceSing" && preset.bpm === 0 &&
    core.includes('prefs.mmdMotionKind : "faceSing"') && core.includes('settings.mmdMotionKind = "faceSing"');
  const chooserOk = mmd.includes('const MOTION_GROUPS = [') && mmd.includes('const MOTION_MENU_IDS = MOTION_GROUPS.flatMap(group => group.ids)') &&
    mmd.includes("const MOTION_MENU_SET = new Set(MOTION_MENU_IDS)") && mmd.includes('visibleMotions: () => MOTION_MENU_IDS.slice()') &&
    mmd.includes('motionGroups: () => MOTION_GROUPS.map') && mmd.includes("for (const group of MOTION_GROUPS)") &&
    mmd.includes("if (BUILTIN[keep] && !MOTION_MENU_SET.has(keep))");
  const motionOk = ["walk112", "run152", "sit10", "dance128", "dreamy128", "melt170", "wedh174", "faceSmile", "faceSing", "songMic", "songCall", "mikuPrincess152", "mikuLeek120"]
    .every(id => mmd.includes(`${id}: {`) || mmd.includes(`${id}: makeGesture(`));
  const morphOk = mmd.includes("const FACE_MORPHS = [") && mmd.includes("dv.setUint32(at, morphCount, true)") &&
    mmd.includes('buildVmd(frames, "trk-builtin-" + id, morphFrames)');
  const docsOk = readReadme().includes("内蔵モーション65種") &&
    read("docs/HANDOFF.md").includes("65種をすべて選択可能") &&
    read("docs/HANDOFF.md").includes("🎤 歌・口パクの6グループ") &&
    read("NOTICE.md").includes("third-party VMD or choreography file is bundled");
  if (!labelsOk || !defaultOk || !chooserOk || !motionOk || !morphOk || !docsOk) {
    fail("MMD defaults, grouped 65-motion chooser, facial morph tracks, original VMD definitions, or rights note is missing");
  } else {
    ok("MMD 65-motion chooser, Lat morph tracks, four-language labels and faceSing default are wired");
  }
}

// 🕹️ Short play mode (last 90/120/180s, silence-aware end, separate records).
if (!read("js/game.js").includes("shortLenActive") ||
    !read("js/game.js").includes("shortSilenceWatch") ||
    !read("js/game.js").includes("c.short") ||
    !read("index.html").includes('id="shortMode"') ||
    !read("js/core.js").includes("shortMode")) {
  fail("short play mode (last 90/120/180s) is missing");
} else {
  ok("short play mode (last 90/120/180s, silence-aware) is wired");
}

// 🥚 Tutorial easter eggs (skip / cheat / god mode in the Seed field).
if (!read("js/main.js").includes("guideEggKind") ||
    !read("js/main.js").includes("GUIDE_EGGS") ||
    !read("css/style.css").includes("eggSkipK") ||
    !read("css/style.css").includes("eggCheatK") ||
    !read("css/style.css").includes("eggGodK")) {
  fail("tutorial easter eggs (skip/cheat/god mode) are missing");
} else {
  ok("tutorial easter eggs (skip / cheat / god mode) are wired");
}

// 🎓 Optional First Spark tutorial audio: lazy-loaded from same origin, removable as one folder.
{
  const html = read("index.html"), library = read("js/library.js"), main = read("js/main.js");
  const i18n = read("js/i18n.js"), notice = read("NOTICE.md"), ignore = read(".gitignore"), readme = readReadme();
  const demoDir = path.join(root, "assets/optional-demo-audio");
  const audio = path.join(demoDir, "first-spark-tutorial.mp3"), manifestFile = path.join(demoDir, "manifest.json");
  let optionalFolderOk = !fs.existsSync(demoDir);
  if (fs.existsSync(demoDir)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      const size = fs.statSync(audio).size;
      optionalFolderOk = fs.existsSync(path.join(demoDir, "README.md")) && size > 0 && size <= 2 * 1024 * 1024 &&
        manifest.version === 1 && manifest.enabled === true && manifest.file === "first-spark-tutorial.mp3";
    } catch { optionalFolderOk = false; }
  }
  const keys = ["demoSongUnavailable", "guideStart", "guideSkip"];   /* trk140: the guide no longer has a demo button; its start/skip are checked here */
  const wired = optionalFolderOk && html.includes('id="guideStartBtn"') && html.includes('id="guideSkip"') && library.includes('source:"builtin"') &&
    library.includes('const FIRST_SPARK_MANIFEST = "./assets/optional-demo-audio/manifest.json";') &&
    library.includes('const FIRST_SPARK_ASSET = "./assets/optional-demo-audio/first-spark-tutorial.mp3";') &&
    library.includes("void initOptionalTutorialDemo()") && library.includes('id === "builtin"') &&
    notice.includes("assets/optional-demo-audio/first-spark-tutorial.mp3") &&
    ignore.includes("!assets/optional-demo-audio/first-spark-tutorial.mp3") &&
    readme.includes("フォルダー全体を削除") && readme.includes("Press **Skip**") &&
    keys.every(k => i18n.split(`${k}:`).length - 1 === 4);
  if (!wired) fail("the optional First Spark demo folder, lazy-load/hide path, tutorial controls, rights note, or four-language labels are missing");
  else ok("First Spark: optional 30-second demo folder is lazy-loaded and can be removed without affecting the media player");
}

// 🎵 trk's OST Vol.1 (trk185): audio separated to music-library (.stpack, CC BY 4.0). The default
// build must not fetch the removed bundled folder, scores stay committed, and the official pack
// fills the playlist through syncTrkOstPackSongs.
{
  const library = read("js/library.js"), notice = read("NOTICE.md"), ignore = read(".gitignore"), readmeRoot = read("README.md");
  const ostDir = path.join(root, "assets/optional-ost-audio");
  const scoreKeys = fs.existsSync(path.join(root, "tools/ost-scores"))
    ? fs.readdirSync(path.join(root, "tools/ost-scores")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)) : [];
  const scoresOk = scoreKeys.length >= 5 && scoreKeys.every(k =>
    fs.existsSync(path.join(root, "tools/ost-scores", `${k}.abc`))) &&
    fs.existsSync(path.join(root, "tools/make-trk-song.mjs"));
  const wired = !fs.existsSync(ostDir) && scoresOk &&
    library.includes("const TRK_OST_MANIFEST_INCLUDED = false;") &&
    library.includes("if (!TRK_OST_MANIFEST_INCLUDED) return;") &&
    library.includes('const TRK_OST_SONG_MANIFEST = "./assets/optional-ost-audio/manifest.json";') &&
    library.includes('const TRK_OST_SONG_KEY_PREFIX = "builtin:trk-ost-song:";') &&
    library.includes("void initTrkOstSongs()") &&
    library.includes("async function materializeTrkOstSong(it)") &&
    library.includes("trkOstSeenKeys") &&
    library.includes("function syncTrkOstPackSongs()") &&
    library.includes('const TRK_OST_PACK_AUTHOR = "TRMTKB";') &&
    library.includes('guide: trkGuide("plGuideTrkOst", TRK_OST_GUIDE_URL)') &&
    readmeRoot.includes("music-library") &&
    readmeRoot.includes("trk-ost-vol1.stpack") &&
    readmeRoot.includes("assets/optional-demo-audio/") &&
    !readmeRoot.includes("assets/optional-ost-audio/") &&
    notice.includes("music-library") &&
    notice.includes("CC BY 4.0") &&
    !notice.includes("assets/optional-ost-audio/") &&
    !ignore.includes("optional-ost-audio");
  if (!wired) fail("the OST separation (no bundled folder/fetch, committed scores, official-pack playlist sync, guide, rights note) is missing");
  else ok("trk's OST Vol.1: audio separated to music-library (.stpack, CC BY 4.0), no runtime fetch, official pack fills the playlist, scores stay committed");
}

// 🎼 First Spark handmade demo charts: easy / normal / hard ship as authored JSON, master stays generated.
{
  const library = read("js/library.js"), core = read("js/core.js"), i18n = read("js/i18n.js");
  const demoDir = path.join(root, "assets/optional-demo-audio");
  const bundled = fs.existsSync(demoDir);   // a lightweight build deletes the whole folder
  const demoReadme = fs.existsSync(path.join(demoDir, "README.md")) ? read("assets/optional-demo-audio/README.md").replace(/\r/g, "") : "";
  const wired =
    library.includes('const FIRST_SPARK_CHART_DIR = "./assets/optional-demo-audio/";') &&
    library.includes('const FIRST_SPARK_CHART_DIFFS = ["easy", "normal", "hard"];') &&
    library.includes("async function firstSparkChartData(diff)") &&
    library.includes('if (response.status === 404) { firstSparkChartCache.set(diff, null); return null; }') &&
    library.includes('applyChartData(data, "custom", "importStatus", false)') &&
    library.includes('s.source === "builtin" && s.key === FIRST_SPARK_KEY && firstSparkChartMap[d]') &&
    library.includes("manifest.charts === false") &&
    core.includes('chartMode === "custom" ? "chartCustom"') &&
    (!bundled || demoReadme.includes("first-spark-tutorial.easy.json")) &&
    ["chartCustom", "builtinChartLoaded"].every(k => i18n.split(`${k}:`).length - 1 === 4);
  if (!wired) fail("First Spark demo charts: lazy fetch, 404 fallback to the generated chart, custom chart mode, folder README or four-language labels are missing");
  else ok("First Spark demo charts are lazy-loaded per difficulty and fall back to the generated chart when absent");

  if (bundled) {
    try {
      const mod = await import("./make-first-spark-charts.mjs");
      const { buildCharts, CHART_DIFFS: diffs, chartFileName, BPM: bpm, BARS: bars } = mod;
      const authored = buildCharts();
      const step = 60000 / bpm / 4, songMs = bars * 4 * 60000 / bpm;
      const counts = {};
      let bad = 0;
      for (const diff of diffs) {
        const file = path.join(demoDir, chartFileName(diff));
        let stored = null;
        try { stored = JSON.parse(fs.readFileSync(file, "utf8")); } catch { bad++; fail(`First Spark chart ${chartFileName(diff)} is missing or not valid JSON`); continue; }
        const notes = Array.isArray(stored.notes) ? stored.notes : [];
        counts[diff] = notes.length;
        const onGrid = notes.every(([t, lane]) => Number.isInteger(t) && t >= 0 && lane >= 0 && lane <= 1 &&
          Math.abs(t - Math.round(t / step) * step) <= 1 && t < songMs);
        const firstHalf = notes.filter(([t]) => t < songMs / 2).length;
        const lanes = new Set(notes.map(n => n[1]));
        if (stored.format !== "shadow-taiko-chart" || stored.difficulty !== diff || stored.bpm !== bpm || Number(stored.offset) !== 0) { bad++; fail(`First Spark chart ${chartFileName(diff)} has the wrong format/bpm/offset fields`); }
        else if (JSON.stringify(stored) !== JSON.stringify(authored[diff])) { bad++; fail(`First Spark chart ${chartFileName(diff)} drifted from tools/make-first-spark-charts.mjs`); }
        else if (!notes.length || !onGrid) { bad++; fail(`First Spark chart ${chartFileName(diff)} has notes off the ${bpm} BPM grid or outside the song`); }
        else if (firstHalf < notes.length * 0.3) { bad++; fail(`First Spark chart ${chartFileName(diff)} packs most notes into the second half (${firstHalf}/${notes.length} before the middle)`); }
        else if (lanes.size < 2 || notes[notes.length - 1][1] !== 0) { bad++; fail(`First Spark chart ${chartFileName(diff)} needs both don and ka, ending on don`); }
        else if (fs.statSync(file).size > 64 * 1024) { bad++; fail(`First Spark chart ${chartFileName(diff)} is bigger than 64 KiB`); }
      }
      if (!bad && !(counts.easy < counts.normal && counts.normal < counts.hard)) fail(`First Spark charts should rise in notes: easy ${counts.easy} < normal ${counts.normal} < hard ${counts.hard}`);
      else if (!bad) ok(`First Spark handmade charts match the generator (easy ${counts.easy} / normal ${counts.normal} / hard ${counts.hard} notes on the 128 BPM grid)`);
      for (const extra of ["master", "rush"]) {
        if (fs.existsSync(path.join(demoDir, `first-spark-tutorial.${extra}.json`))) fail(`First Spark bundled a ${extra} chart - ${extra} must stay generated from the seed`);
      }
    } catch (error) {
      fail(`First Spark chart check could not run: ${error.message}`);
    }
  }
}

// 📊 Spectrum expansion (30 styles / 16 themes) + banner song buttons.
{
  const spec = read("js/spectrum.js");
  const blockCount = (head, tag) => {
    const a = spec.indexOf(head);
    if (a < 0) return 0;
    const b = spec.indexOf("};", a);
    return (spec.slice(a, b).match(new RegExp(':"' + tag, "g")) || []).length;
  };
  const styleCount = blockCount("const STYLE_KEYS", "specStyle");
  const themeCount = blockCount("const THEME_KEYS", "specTheme");
  if (styleCount < 30 || themeCount < 16 ||
      !spec.includes("drawDotgrid") || !spec.includes("drawMatrix") || !spec.includes("drawLightning") ||
      !spec.includes("drawFireworks") || !spec.includes('theme === "synth"') ||
      !spec.includes('onLongPress(zipBtn') ||
      !read("js/library.js").includes("bannerSongStep") ||
      !read("index.html").includes('id="bannerSongBtns"')) {
    fail("spectrum expansion (30 styles / 16 themes) or banner song buttons are missing");
  } else {
    ok(`spectrum has ${styleCount} style labels / ${themeCount} theme labels, long-press settings, banner song buttons`);
  }
}

// 📡 Background antenna placement: dock / top-right corner (left of Language).
// Hiding the dock antenna must not kill background playback, and hiding the
// cast antenna must never hide the playback antenna.
{
  const fx = read("js/fx-dock.js");
  if (!fx.includes("bgAntennaView") || !fx.includes('["off", "antenna", "corner"]') ||
      !fx.includes('cornerAnt.addEventListener("click", () => toggleAntenna())') ||
      !fx.includes("headTools.prepend(cornerAnt)") ||
      !fx.includes('dockBackgroundCorner:"') ||
      !read("js/media-player-mode.js").includes('dockBackgroundCorner:"') ||
      !read("js/core.js").includes('["off", "antenna", "corner"]') ||
      !read("css/style.css").includes(".cornerAnt")) {
    fail("background antenna corner option (top-right, left of Language) is missing");
  } else {
    ok("background antenna can sit in the top-right corner; cast hide never hides the playback antenna");
  }
}

// 🎭 Antenna character skins: original dot characters (ON = awake / OFF = asleep)
// plus a custom two-image option. The Touhou fan-work credit must stay in NOTICE.
{
  const fx = read("js/fx-dock.js");
  const chars = ["truck", "robot", "cat", "slime", "ghost", "reimu", "marisa", "cirno", "flandre", "youmu"];
  const hasAll = chars.every(c => fx.includes(`"${c}", "dockAntChar${c[0].toUpperCase() + c.slice(1)}"`));
  if (!fx.includes("const ANT_CHARS") || !fx.includes("function antCharFrame") ||
      !fx.includes("function drawAntCharMatrix") || !fx.includes("function antCustomOk") ||
      !fx.includes("antCustomRow") || !hasAll || !fx.includes("antTouhou") ||
      !fx.includes('["rod", "loop", "dish", "beam", "truck", "robot", "cat", "slime", "ghost", "reimu", "marisa", "cirno", "flandre", "youmu", "custom"]') ||
      !read("js/core.js").includes('settings.fxAntennaShape = "rod";') ||
      !read("css/style.css").includes(".antChar") ||
      !read("NOTICE.md").includes("Touhou Project fan work") ||
      !read("NOTICE.md").includes("touhou-project.news/guideline/")) {
    fail("antenna character skins (ON=awake / OFF=asleep + custom 2 images) are missing");
  } else {
    ok("antenna character skins (10 dot characters incl. 5 Touhou fan works + custom 2-image ON/OFF) are wired, Touhou credit in NOTICE");
  }
}

// The FX API is intentionally frozen. A strict-mode mutation here aborts the
// remainder of main.js and leaves every primary selection-screen control inert.
{
  const main = read("js/main.js");
  const requiredWiring = [
    '$("language").addEventListener("change"',
    '$("mediaFile").addEventListener("change"',
    '$("openSettingsBtn").addEventListener("click"',
    '$("modePicker").addEventListener("click"'
  ];
  if (requiredWiring.some(fragment => !main.includes(fragment)) ||
      /window\.TrkFX\s*\[[^\]]+\]\s*=/.test(main) ||
      !main.includes('target.closest("#fxPanel .fxGrid .fxSeg button")')) {
    fail("selection-screen startup wiring or immutable TrkFX integration is broken");
  } else {
    ok("language / settings / play-mode / media-file handlers stay wired; frozen TrkFX is not mutated");
  }
}

// 🖥 Full-screen video: the TV dock key right of "next song" and the media
// player button right of "reverse" (wallpaper shifts one step to the right).
{
  const videoMax = read("js/video-max.js");
  const tv = read("js/tv-dock.js");
  const media = read("js/media-player-mode.js");
  if (!videoMax.includes("window.TrkVideoMax = Object.freeze(") || !videoMax.includes("function toggleMax()") ||
      !read("index.html").includes('<script src="js/video-max.js"></script>') ||
      !read("css/style.css").includes("#videoMaxView")) {
    fail("full-screen video viewer (js/video-max.js) is not wired");
  } else if (!tv.includes('btn("tvKey tvPause tvMax"') || !tv.includes("window.TrkVideoMax.toggle()") ||
             !tv.includes('tvVideoMax:"') || !/top\.append\(pow, prevSongBtn, lcd, nextSongBtn, pauseBtn\)/.test(tv)) {
    fail("TV dock video-maximize key (right of the next-song key) is missing");
  } else if (!media.includes("maxNode = makeButton(\"mediaVideoMax\"") ||
             !media.includes("controls.append(prev, playNode, next, reverseNode, maxNode, pipNode, wallNode, restart)") ||
             !media.includes('mediaVideoMax:"')) {
    fail("media player full-screen button (right of reverse, wallpaper shifted right) is missing");
  } else {
    ok("full-screen video viewer is wired (TV dock ⛶ + media player, wallpaper stays one step right)");
  }
}

// trk164: ▶ メディアプレーヤーの🥇4点（📌画中画／🔆Wake Lock／⏪スマート巻き戻し／💤スリープ強化）
// の配線が消えていないことを確認する。決定ロジック本体は tests/trk164-media-controls.test.mjs（実ソースをvmで実行）。
{
  const media = read("js/media-player-mode.js");
  const core = read("js/core.js");
  /* ⚠ read() は `core.X` を正規化したあとの本文を返す（js-source.mjs）＝`core.video` → `video`、
     `core.settings` → `settings` になる。期待文字列は正規化後の綴りで書く（lane sway の検査と同じ慣習）。 */
  const pipOk = media.includes("async function togglePip()") &&
    media.includes("document.pictureInPictureEnabled") &&
    media.includes('pipNode = makeButton("mediaPip", "mediaSmallBtn")') &&
    media.includes('video.addEventListener("enterpictureinpicture"') &&
    media.includes("document.exitPictureInPicture()") &&
    (media.match(/mediaPip:"/g) || []).length >= 4;
  const wakeOk = media.includes("async function updateWakeLock()") &&
    media.includes('navigator.wakeLock.request("screen")') &&
    media.includes("settings.mediaWakeLock !== false") &&
    media.includes('wakePanel.id = "mediaWakePanel"') &&
    (media.match(/mediaWakeLockTitle:"/g) || []).length >= 4 &&
    core.includes("mediaWakeLock: prefs.mediaWakeLock !== false");
  const rewindOk = media.includes("function resumeRewindSeconds(v)") &&
    media.includes("function rewindResumePosition(p, seconds)") &&
    (media.match(/savedMediaPosition\(\{ resume: true \}\)/g) || []).length >= 2 &&
    media.includes("settings.mediaResumeRewind = resumeRewindSeconds(resumeNode.value)") &&
    core.includes("mediaResumeRewind: pick(prefs.mediaResumeRewind, [0, 3, 5, 10, 15, 30], 0)") &&
    (core.match(/settings\.mediaResumeRewind = 0/g) || []).length >= 2;
  const sleepOk = media.includes("function planSleepFade(totalSeconds, fadeSeconds)") &&
    media.includes("sleepTrackMode") &&
    media.includes('o.value = "track"') &&
    media.includes("restoreSleepFadeVolume()") &&
    (media.match(/mediaSleepTrack:"/g) || []).length >= 4;
  if (!pipOk) fail("trk164 📌 picture-in-picture wiring is missing (media-player-mode.js)");
  else if (!wakeOk) fail("trk164 🔆 wake-lock wiring is missing (media-player-mode.js + core.js)");
  else if (!rewindOk) fail("trk164 ⏪ resume-rewind wiring is missing (media-player-mode.js + core.js)");
  else if (!sleepOk) fail("trk164 💤 sleep-timer upgrade wiring is missing (fade + end-of-track)");
  else ok("trk164: media player 📌 PiP / 🔆 Wake Lock / ⏪ resume rewind / 💤 sleep (fade + end of track) are wired, in four languages");
}

// trk165: 📥 OSの共有／「このアプリで開く」（share_target＋file_handlers）の配線。
// ファイルは必ず既存の取り込み経路（library／study-room／custom）へ合流する＝新しい検証入口を作らない。
{
  const html = read("index.html");
  const sw = read("sw.js");
  const share = read("js/share-inbox.js");
  const library = read("js/library.js");
  const study = read("js/study-room.js");
  const custom = read("js/custom.js");
  let manifestOk = false;
  try {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    manifestOk = !!manifest.share_target && manifest.share_target.method === "POST" &&
      manifest.share_target.enctype === "multipart/form-data" &&
      manifest.share_target.action === "./share-target/" &&
      ((manifest.share_target.params || {}).files || []).map(f => f.name).join(",") === "media,packs,books" &&
      Array.isArray(manifest.file_handlers) && manifest.file_handlers.length === 1 &&
      manifest.file_handlers[0].launch_type === "single-client";
  } catch (_) {}
  const shareTag = '<script src="js/share-inbox.js"></script>';
  /* ⚠ read("js/…") は別名正規化後の本文を返す（tools/lib/js-source.mjs）：
     `window.Trk.library.addSongFiles(…)` は `addSongFiles(…)` のように見える。期待文字列は正規化後の綴りで書く */
  if (!manifestOk) fail("manifest share_target / file_handlers (trk165) are missing or malformed");
  else if (!html.includes(shareTag) || html.indexOf(shareTag) < html.indexOf('<script src="js/backup.js"></script>')) fail("js/share-inbox.js must load after js/backup.js (all import entry points ready)");
  else if (!sw.includes("async function handleShareTarget(request)") || !sw.includes('const SHARE_CACHE = "trk-share-inbox-v1"') ||
           !sw.includes("key !== SHARE_CACHE") || !sw.includes('if (request.method === "POST")') ||
           !sw.includes('new URL("share-target/", SCOPE).pathname')) fail("sw.js share-target POST handling / inbox-cache whitelist is missing");
  else if (!share.includes("async function routeInboundFiles(files)") || !share.includes("addSongFiles(groups.audio)") ||
           !share.includes("addVideoFiles(groups.video)") || !share.includes("importArchives(groups.book)") ||
           !share.includes("installAndUse(file)") || !share.includes('window.launchQueue.setConsumer') && !share.includes('"launchQueue" in window') ||
           (share.match(/shareInboundNone:"/g) || []).length < 4 || (share.match(/shareInboundUnsupported:"/g) || []).length < 4) fail("share-inbox.js routing (existing paths only), launchQueue consumer or 4-language strings are missing");
  else if (!library.includes("LIB_SHOW, MEDIA_EXT, VIDEO_EXT, addSongFiles") ||
           !study.includes("importArchives:studyImportArchives") ||
           !custom.includes("updateMascotUI, installAndUse")) fail("import entry points are not exported for the share inbox (library / study / custom)");
  else ok("trk165: 📥 share_target + file_handlers merge into the existing import paths (no new validation entry), in four languages");
}

// trk166: 🎤 歌詞（LRC＋埋め込み歌詞）。読み取り専用＝元ファイルへの書き戻し経路が無く、外へも送らない。
{
  const html = read("index.html");
  const art = read("js/audio-art.js");
  const lyrics = read("js/lyrics.js");
  const player = read("js/media-player-mode.js");
  const library = read("js/library.js");
  const core = read("js/core.js");
  const css = read("css/style.css");
  const sw = read("sw.js");
  const lyricsTag = '<script src="js/lyrics.js"></script>';
  /* ⚠ read("js/…") は `window.Trk.lyrics.` などの接頭辞を落として返す（先頭の trk165 ブロックの注意と同じ） */
  if (!html.includes(lyricsTag) || html.indexOf(lyricsTag) < html.indexOf('<script src="js/audio-art.js"></script>') ||
      html.indexOf(lyricsTag) > html.indexOf('<script src="js/library.js"></script>')) fail("js/lyrics.js must load right after js/audio-art.js (before library.js / media-player-mode.js)");
  else if (!art.includes("extractLyrics") || !art.includes("lyricsBytes:MAX_LYRICS_BYTES") ||   /* ⚠ export 行の完全一致は trk167 で割れたので名前だけで見る */
           !art.includes('type === "\\xA9lyr"') || !art.includes("parseSyltFrame") || !art.includes("parseLyricsTextFrame") ||
           !art.includes("UNSYNCEDLYRICS") || art.includes("createWritable")) fail("audio-art.js extractLyrics (USLT/SYLT/©lyr/Vorbis LYRICS, read-only) is missing");
  else if (!lyrics.includes("function parseLrc(src)") || !lyrics.includes("function activeLineIndex(lines, seconds)") ||
           !lyrics.includes("function normalizeLyrics(source)") || !lyrics.includes("async function resolveLyrics(song)") ||
           !lyrics.includes('const LYRICS_KEY = "trk_lyrics_v1"') || !lyrics.includes("manualLyrics(song.key)") ||
           !lyrics.includes("song.lyricsFile") || !lyrics.includes("extractLyrics(song.file)") ||
           !lyrics.includes("window.Trk.lyrics = Object.freeze({")) fail("lyrics.js parser / manual store / resolution chain is missing");
  else if (!library.includes('it.lyricsFile = lyrics[it.dir + "/" + it.base] || null') || !library.includes('n.endsWith(".lrc")')) fail("the folder scan must attach same-named .lrc files to songs");
  else if (!core.includes("mediaLyricsOpen: prefs.mediaLyricsOpen === true") || (core.match(/settings\.mediaLyricsOpen = false/g) || []).length < 2) fail("mediaLyricsOpen setting (and its two reset paths) is missing in core.js");
  else if (!player.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)") ||
           !player.includes("renderLyrics();   /* 🎤") || !player.includes('lyricsFileNode.accept = ".lrc,.txt,text/plain"') ||
           !player.includes("on(\"songSelected\", () => { renderMedia(); if (lyricsBoxOpen()) loadLyrics();") ||   /* core. は正規化で外れる。末尾は trk169 で loadSubs が増えたので閉じ括弧まで固定しない */
           !player.includes("api.saveManualLyrics(song.key, r.text, file.name)") ||
           (player.match(/mediaLyricsTitle:"/g) || []).length < 4 || (player.match(/mediaLyricsNeedSong:"/g) || []).length < 4) fail("media-player lyrics panel wiring or 4-language strings are missing");
  else if (!css.includes(".mediaLyricsBox") || !css.includes(".lyricLineActive") || !css.includes("body.helpTextOff .mediaLyricsBox>.hint")) fail("lyrics panel styles are missing");
  else ok("trk166: 🎤 lyrics — LRC parser + embedded tags (read-only), folder .lrc, manual pick, synced highlight, in four languages");
  /* sw.js の cache 版数は固定しない：別の「service-worker cache」見張りが現在の版を確認している */
}

// trk167: 🏷 埋め込みテキストタグ（ID3 TIT2/TPE1/TALB/TPE2/TRCK/TCON・MP4 ©nam/©ART/©alb/aART/trkn/©gen・
// Vorbis TITLE/ARTIST/ALBUM/ALBUMARTIST/TRACKNUMBER/TRACKTOTAL/GENRE）の表示。
// 読み取り専用＝書き戻し経路（createWritable）を許さない。カタログ照合キーには触れない。
{
  const art = read("js/audio-art.js");
  const library = read("js/library.js");
  const player = read("js/media-player-mode.js");
  const sw = read("sw.js");
  /* ⚠ read("js/…") は正規化後の本文：`core.emit(` は `emit(`、`window.Trk.media.audioArt` は `media.audioArt` に見える */
  if (!art.includes("extractTags,") || !art.includes("extractLyrics,") || !art.includes("tagText:MAX_TAG_TEXT") ||   /* ⚠ export 行の完全一致は trk170（extractChapters 追加）で再び割れたので名前だけで見る */
      !art.includes("ID3_TAG_FRAMES") || !art.includes("MP4_TAG_BOXES") || !art.includes("VORBIS_TAG_KEYS") ||
      !art.includes("async function extractTags(file)") || art.includes("createWritable")) fail("audio-art.js extractTags (read-only text tags) is missing");
  else if (!library.includes("const songTags = new Map()") ||
           !library.includes("return meta.title || songTagField(it, \"title\") || touhouCatalogTitle(it) || (it && it.title) || \"\"") ||
           !library.includes("async function loadSongTags(it)") || !library.includes("function songDisplayMeta(it)") ||
           !library.includes("void loadSongTags(job.it)") || !library.includes("if (canExtractSongArt(it)) void loadSongTags(it);") ||
           !library.includes("b.dataset.songKey = it.key") || !library.includes("emit(\"songTags\", it)") ||
           !library.includes("window.songDisplayTitle = songDisplayTitle") ||
           !library.includes("songDisplayTitle, songDisplayMeta, songTagsOf, loadSongTags") ||
           !library.includes("plNormTitle((metaOf(it.key) || {}).artist || it.artist)") ||
           library.includes("createWritable")) fail("library.js tag store / display priority / matching separation is missing");
  else if (!player.includes("function trackDisplayMeta(s)") ||
           !player.includes("on(\"songTags\", () => { renderQueue(); if (mediaOpen) renderMedia(); })") ||
           !player.includes("title:d.title || s.title || baseName(mediaName) || \"trk!\"")) fail("the media player must follow the tag display title (header, queue, Media Session)");   /* core. は正規化で外れる */
  else if (!/^const CACHE = "trk-v[\d.]+-trk\d+";$/m.test(sw)) fail("sw.js cache name lost its versioned shape");
  else ok("trk167: 🏷 embedded text tags feed the display-name chain (read-only, catalog matching untouched)");
}

// trk168: 🔊 音量の平準化（ReplayGain方式）。通り道の G.norm（音量 → 平準化 → リミッター/出口）は常設で、
// 材料は「タグの REPLAYGAIN_TRACK_GAIN → 解析の loudness（ゲート付きRMS）」。どちらも無ければ素通し。
// 解析キャッシュは後方互換（analysisCacheValid は loudness を要求しない＝古い記録も読める）で、
// ファイルは読み取りだけ（書き戻しは trk167 の見張りが createWritable 不在で担保）。
{
  const fx = read("js/fx.js");
  const media = read("js/media.js");
  const art = read("js/audio-art.js");
  /* ⚠ read() 正規化後：fx.js の `window.Trk.media.loudnessDb(a)` は `loudnessDb(a)` に見える */
  if (!fx.includes("G.norm = gainN(ac, 1)") || !fx.includes("G.vol.connect(G.norm)") ||
      !fx.includes("G.norm.connect(G.lim); G.lim.connect(G.out)") || !fx.includes("else G.norm.connect(G.out)") ||
      !fx.includes("const NORM_TARGET_DB = -16, NORM_DB_MIN = -18, NORM_DB_MAX = 9, NORM_LIN_CAP = 2;") ||
      !fx.includes("function normPlan(") || !fx.includes("settings.fxNorm = prefs.fxNorm === true") ||
      !fx.includes("on(\"mediaReady\", () => { if (settings.fxNorm && !G.src && G.ok) ensureGraph(); applyNorm(); })") ||
      !fx.includes("on(\"songTags\", () => { if (settings.fxNorm && !G.src && G.ok) ensureGraph(); applyNorm(); })") ||
      !fx.includes("loudnessDb(a) : NaN") || !fx.includes("lib.songTagsOf(song)") ||
      !fx.includes("normInfo:() => ({ on:!!settings.fxNorm") ||
      (fx.match(/sfxNormTitle:/g) || []).length !== 4) fail("fx.js loudness leveling (norm node, plan, hooks, four languages) is missing");
  else if (!media.includes("maxRms: maxRms || 1, scale: scale || 1, loudness, peak") ||
           !media.includes("function loudnessDb(a)") ||
           !media.includes("loudness: a.loudness, peak: a.peak") ||
           !media.includes("loudness: rec.loudness, peak: rec.peak") ||
           !media.includes("loadSE, loudnessDb, playSE")) fail("media.js analysis loudness/peak + cache + loudnessDb export is missing");
  else if (/function analysisCacheValid\(r\) \{[\s\S]*?\n\}/.exec(media)?.[0].includes("loudness")) fail("analysisCacheValid must stay backward compatible (old cache records without loudness must remain valid)");
  else if (!art.includes("function parseRgDb(") || !art.includes("function parseMp4FreeformRg(") ||
           (art.match(/REPLAYGAIN_TRACK_GAIN/g) || []).length < 3 || !art.includes("out.rgTrackGain")) fail("audio-art.js ReplayGain tag reading (ID3 TXXX / Vorbis / MP4 freeform) is missing");
  else ok("trk168: 🔊 loudness leveling reads ReplayGain tags or measured loudness, applies via the always-in-path norm gain (read-only)");
}

// trk169: 💬 字幕（SRT/VTT）。外部字幕ファイル優先（埋め込み字幕トラックはブラウザ制約で対象外）。
// 優先順：手で選んだファイル → フォルダの同名 .srt/.vtt。表示は DOM オーバーレイ（映像は canvas 描画のため）、
// 画中画だけ同じ内容の WebVTT を <track> で。読み取りだけ＝書き戻し・送信なし。
{
  const subs = read("js/subtitles.js");
  const library = read("js/library.js");
  const player = read("js/media-player-mode.js");
  const max = read("js/video-max.js");
  const html = read("index.html");
  const css = read("css/style.css");
  /* ⚠ read("js/…") は正規化後の本文：`core.on(` は `on(`、`window.Trk.<module>.` 前置は外れて見える */
  if (!subs.includes('const SUBS_KEY = "trk_subs_v1"') || !subs.includes("function parseSubtitles(") ||
      !subs.includes("function stampSeconds(") || !subs.includes("function toVtt(") ||
      !subs.includes("function activeCues(") || !subs.includes("async function resolveSubs(song)") ||
      !subs.includes("function attachTrack(") || !subs.includes("Trk.subtitles = Object.freeze") ||
      subs.includes("createWritable") || subs.includes("fetch(")) fail("subtitles.js parser/store/PiP-track module is missing (or grew a write/network path)");
  else if (!library.includes('} else if (lower.endsWith(".srt") || lower.endsWith(".vtt")) {') ||
           !library.includes('it.subsFile = subs[it.dir + "/" + it.base] || null') ||
           !library.includes('n.endsWith(".srt") || n.endsWith(".vtt")')) fail("library.js must pick up folder sidecar .srt/.vtt into it.subsFile");
  else if (!player.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)") ||
           !player.includes("stageWrap.append(stageCanvas, subsOverlay, stageNote)") ||
           !player.includes("renderSubsOverlay();") ||
           !player.includes("on(\"songSelected\", () => { renderMedia(); if (lyricsBoxOpen()) loadLyrics(); loadSubs(true); });") ||
           !player.includes("subsBox.hidden = !subsAllowed();") ||
           !player.includes("attachTrack(video, d.cues, d.offsetMs") ||   /* core.video は正規化で video になる */
           (player.match(/mediaSubsTitle:/g) || []).length !== 4 ||
           (player.match(/mediaSubsOffsetNow:/g) || []).length !== 4) fail("the media player must wire the 💬 panel, overlay, PiP track and four-language texts");
  else if (!max.includes("stage.append(canvas, subsNode, noteNode)") ||
           !max.includes('api.currentTexts(videoEl.currentTime || 0).join("\\n")')) fail("video-max fullscreen must show the subtitle overlay");
  else if (!html.includes('<script src="js/subtitles.js"></script>') ||
           !(html.indexOf("js/lyrics.js") < html.indexOf("js/subtitles.js") && html.indexOf("js/subtitles.js") < html.indexOf("js/judge-match.js"))) fail("subtitles.js must load right after lyrics.js");
  else if (!css.includes(".mediaSubs{") || !css.includes(".videoMaxSubs{") || !css.includes(".mediaSubsBox{")) fail("subtitle overlay/panel styles are missing");
  else ok("trk169: 💬 SRT/VTT subtitles ride the folder pickup, show as a DOM overlay (+ PiP <track>), delay-adjustable, read-only");
}

// trk170: 🔖 M4Bチャプター。chpl(Nero) ボックスを読み取りだけ（js/audio-art.js・FFmpeg mov.c と同じ並び）、
// m4b/m4a/mp4/mov の曲だけチャプターパネルが出る。クリックでジャンプ、いまのチャプターはハイライト。
// 💤 スリープに「チャプターの終わりで止める」を追加。m4b がフォルダ取込の対象（MEDIA_EXT）。書き戻し・送信なし。
{
  const art = read("js/audio-art.js");
  const library = read("js/library.js");
  const player = read("js/media-player-mode.js");
  const css = read("css/style.css");
  /* ⚠ read() は正規化後の本文：window.Trk.audioArt. 前置は外れ、core.video は video に見える */
  if (!art.includes("function parseChplBox(") || !art.includes("function findChpl(") ||
      !art.includes("function extractChapters(") || !art.includes("extractChapters,") ||
      !art.includes("chapters:MAX_CHAPTERS") || !art.includes('mode === "chapters"') ||
      art.includes("createWritable") || art.includes("fetch(")) fail("audio-art.js chpl chapter reader/export is missing (or grew a write/network path)");
  else if (!/const MEDIA_EXT = \[[^\]]*"m4b"[^\]]*\]/.test(library)) fail("library.js MEDIA_EXT must include m4b (audiobook folder)");
  else if (!player.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)") ||
           !player.includes("function chapsAllowed()") || !player.includes("async function ensureChapters()") ||
           !player.includes("function renderChapters()") || !player.includes("function renderChaptersActive()") ||
           !player.includes("function seekToChapter(t)") || !player.includes("function stepChapter(delta)") ||
           !player.includes("function checkChapterSleep()") ||
           !player.includes("api.extractChapters(s.file)") || !player.includes("sleepChapterEnd") ||
           !player.includes("renderChaptersActive();") || !player.includes("checkChapterSleep();") ||
           !player.includes('on("songSelected", () => { loadChapters(true); });') ||
           !player.includes("chapBox.hidden = !chapsAllowed();") ||
           (player.match(/mediaChapTitle:/g) || []).length !== 4 ||
           (player.match(/mediaSleepChapter:/g) || []).length !== 4) fail("the media player must wire the 🔖 chapter panel, tick hooks, chapter sleep and four-language texts");
  else if (!css.includes(".mediaChapBox{") || !css.includes(".mediaChapList{") || !css.includes(".chapLine{") || !css.includes(".chapLineActive")) fail("chapter panel styles are missing");
  else ok("trk170: 🔖 M4B chapters (chpl, read-only) show in a jump-list panel, highlight the current chapter, and feed a \"sleep: end of chapter\" mode; m4b joins MEDIA_EXT");
}

// trk171: 💿🎤 アルバム別／アーティスト別のグループ表示＋トラック番号順（PLAYER-ROADMAP #16・trk167 のタグ土台の上）。
// 棚はアルバム名／アーティスト名を持つ曲があれば出る。グループの無い曲は「タグなし」で最後。表示だけ＝保存データもタグも触らない。
{
  const library = read("js/library.js");
  const css = read("css/style.css");
  /* ⚠ read() は正規化後の本文：core.settings は settings に、window.Trk.library 前置は外れて見える */
  if (!library.includes("function libTrackNoOf(it)") || !library.includes("function libGroupKeyOf(it, mode)") ||
      !library.includes("function libGroupCmp(mode, fallback)") ||
      !library.includes("function libEnsureGroupTags(items)") || !library.includes("function libGroupRerenderSoon()") ||
      !library.includes('tabs.push({ id:"albums", icon:"💿", label:tr("libTabAlbums"), n:shelfN });') ||
      !library.includes('tabs.push({ id:"artists", icon:"🎤", label:tr("libTabArtists"), n:shelfN });') ||
      !library.includes('if (id === "albums" || id === "artists") return true;') ||
      !library.includes('const grouped = tabId === "albums" || tabId === "artists";') ||
      !library.includes("items.sort(libGroupCmp(tabId, cmp));") ||
      !library.includes('el("div", "libGroupHead")') || !library.includes("libEnsureGroupTags(items);") ||
      !library.includes('if (settings.libTab === "albums" || settings.libTab === "artists") libGroupRerenderSoon();') ||
      (library.match(/libTabAlbums:/g) || []).length !== 4 ||
      (library.match(/libNoTagsGroup:/g) || []).length !== 4 ||
      (library.match(/libGroupTagsLoading:/g) || []).length !== 4) fail("library.js album/artist group shelves (sorting, sticky headers, tag pre-load, four-language texts) are missing");
  else if (!css.includes(".libGroupHead{position:sticky;top:0;") || !css.includes(".libGroupName{") || !css.includes(".libGroupN{")) fail("group header styles are missing");
  else ok("trk171: 💿🎤 album/artist shelves group the song list (track-number order inside, no-tags group last, sticky headers, tag pre-load)");
}

// trk172: ⚡ スマート棚（PLAYER-ROADMAP #11）。材料は端末内の記録だけ（PLAYED・records・songDB の addedAt）＝送信なし。
// 🎧 プレーヤー再生は PLAYED.media に別途計上（30秒/半分ルール）。証明（plProof＝共有の ▶AUTO 印）は auto/manual のまま＝media を知らない。
{
  const library = read("js/library.js");
  const player = read("js/media-player-mode.js");
  /* ⚠ read() は正規化後の本文：core.on( は on( 、window.Trk.play. 前置は外れて見える */
  if (!library.includes("function libSmartLast(x)") || !library.includes("function libSmartPlays(x)") ||
      !library.includes("function libSmartSections(items, labeler, cap = 50)") ||
      !library.includes("function noteMediaPlayed(key)") || !library.includes("function libSectionHead(label, n)") ||
      !library.includes('tabs.push({ id:"smart", icon:"⚡", label:tr("libTabSmart"), n:nSmart });') ||
      !library.includes('if (id === "smart") return true;') ||
      !library.includes('const smartSections = tabId === "smart" ? libSmartSections(items, k => tr(k)) : null;') ||
      !library.includes("if (row.sec) { pendingSec = row; continue; }") ||
      !library.includes("box.append(libSectionHead(pendingSec.sec, pendingSec.n))") ||
      !library.includes("if (r.it && !seenKeys.has(r.it.key))") ||
      !library.includes("function addedItem(file, video, addedAt, flags = {})") ||
      !library.includes("initLibrary, nextSong, noteMediaPlayed, onLongPress") ||
      (library.match(/libTabSmart:/g) || []).length !== 4 ||
      (library.match(/libSmartRecent:/g) || []).length !== 4 ||
      (library.match(/libSmartTop:/g) || []).length !== 4 ||
      (library.match(/libSmartAdded:/g) || []).length !== 4) fail("library.js smart shelf (sections, media-play counter, addedAt carry, four-language texts) is missing");
  else if (/function plProof\(it, idx\) \{[\s\S]*?\n\}/.exec(library)[0].includes("media")) fail("plProof must not learn about PLAYED.media (player listens are not a share proof)");
  else if (!player.includes("let mediaPlayNotedKey") || !player.includes("function noteMediaPlay()") ||
           !player.includes("noteMediaPlay();") || !player.includes("noteMediaPlayed(s.key)") ||
           !player.includes('on("songSelected", () => { mediaPlayNotedKey = ""; });')) fail("the media player must count real listens (30s/half rule) into library.noteMediaPlayed");
  else ok("trk172: ⚡ smart shelf (recently played / most played / recently added) runs on device-only records; player listens count separately and never become a share proof");
}

// trk173: 🌊 波形シークバー（PLAYER-ROADMAP #14）。解析キャッシュ（core.analysis＝端末内）の rms 包絡を range の上に
// canvas で重ねる（pointer-events:none＝操作は range のまま）。ホバーは時刻の吹き出し（動画フレームのサムネは見送り）。
// 解析が無い曲・設定オフでは隠す＝ふつうのバーのまま。新しい読み取り・送信なし（描画は既存の解析を読むだけ）。
{
  const player = read("js/media-player-mode.js");
  const core = read("js/core.js");
  const css = read("css/style.css");
  /* ⚠ read() は正規化後の本文：core.settings は settings に、window.devicePixelRatio は devicePixelRatio に見える */
  if (!player.includes("function waveColumns(a, cols)") || !player.includes("function drawWave()") ||
      !player.includes("waveWrapNode.append(waveNode, progressNode, waveTipNode)") ||
      !player.includes("progressRow.append(waveWrapNode, timeNode)") ||
      !player.includes('waveNode.setAttribute("aria-hidden", "true")') ||
      !player.includes('waveWrapNode.addEventListener("pointermove"') ||
      !player.includes('waveWrapNode.addEventListener("pointerleave"') ||
      !player.includes("new ResizeObserver(() => { waveCols = null; waveSig = \"\"; drawWave(); })") ||
      !player.includes("drawWave();") || !player.includes("settings.mediaWave = waveCheck.checked; saveUserPrefs(); drawWave();") ||
      !player.includes("anchor.after(panel, wallPanel, wakePanel, wavePanel)") ||
      (player.match(/mediaWaveTitle:/g) || []).length !== 4 ||
      (player.match(/mediaWaveHint:/g) || []).length !== 4 ||
      (player.match(/mediaWaveToggle:/g) || []).length !== 4) fail("media-player-mode.js waveform seek bar (envelope, overlay canvas, time bubble, toggle, four-language texts) is missing");
  else if (!core.includes("mediaWave: prefs.mediaWave !== false,") || (core.match(/settings\.mediaWave = true;/g) || []).length !== 2) fail("core.js must default mediaWave on (and both reset lists must restore it)");
  else if (!css.includes(".mediaWave{position:absolute;") || !css.includes(".mediaProgressWrap{position:relative;") || !css.includes(".mediaWaveTip{")) fail("waveform overlay/bubble styles are missing");
  else ok("trk173: 🌊 the seek bar draws the cached rms envelope behind an aria-hidden overlay canvas (time bubble on hover, toggle next to 🔆, plain bar without analysis)");
}

// trk174: 📈 進捗フィルター（PLAYER-ROADMAP #15・未聴/継続/完了）。**表示層だけ**＝行を絞るだけで保存データは触らない。
// 判定は位置記憶（trk_media_positions_v1・曲キー or 指紋 keyFp）→ 再生回数（PLAYED manual/auto/media・records plays）。
// library.js が位置記憶へ書き込むようになったら失敗（読み取り専用の表示層であることの監視）。
{
  const library = read("js/library.js");
  const core = read("js/core.js");
  const i18n = read("js/i18n.js");
  const html = read("index.html");
  /* ⚠ read() は正規化後の本文：core.$( は $( 、core.settings は settings 、core.saveUserPrefs() は saveUserPrefs() に見える */
  if (!library.includes("function libPositions()") || !library.includes("function libProgressOf(x, positions)") ||
      !library.includes('const progMode = settings.libProgress || "all";') ||
      !library.includes("items = items.filter(x => libProgressOf(x, pos) === progMode);") ||
      !library.includes('$("libProgress").addEventListener("change", e => { settings.libProgress = e.target.value; saveUserPrefs(); renderLib(); });') ||
      !library.includes('$("libProgress").value = settings.libProgress || "all";') ||
      library.includes('localStorage.setItem("trk_media_positions_v1"')) fail("library.js progress filter (display-layer only) is missing or grew a write into the position store");
  else if (!html.includes('<select id="libProgress" data-i18n-aria="libProgressLabel">') ||
           !html.includes('<option value="progress" data-i18n="progProgress">') ||
           !(html.indexOf('id="libSort"') < html.indexOf('id="libProgress"'))) fail("the 📈 select must sit right after the sort select in libTools");
  else if (!core.includes('libProgress: pick(prefs.libProgress, ["all", "new", "progress", "done"], "all"),') ||
           (core.match(/settings\.libProgress = "all";/g) || []).length !== 2) fail("core.js must validate the libProgress default and restore it in both reset lists");
  else if ((i18n.match(/progAll:/g) || []).length !== 4 || (i18n.match(/progNew:/g) || []).length !== 4 ||
           (i18n.match(/progProgress:/g) || []).length !== 4 || (i18n.match(/progDone:/g) || []).length !== 4 ||
           (i18n.match(/libProgressLabel:/g) || []).length !== 4) fail("progress filter texts must exist in all four languages");
  else ok("trk174: 📈 progress filter (unplayed / in progress / finished) narrows the row list from position memory + play counts — display layer only, never writes");
}

// trk175: 📜 書斎の自動スクロール（PLAYER-ROADMAP #12・ハンズフリー縦読み）。縦読み漫画モードだけの等速スクロール。
// 開始/停止は ⏩ ボタンと A キー、停止はタップ（pointerdown）・ホイール・移動キーでも起きる。下端で自動停止。
// 表示だけの機能＝栞・位置・DB 保存には触れない。A は予約キー（割り当て変更できない）。
{
  const study = read("js/study-room.js");
  const html = read("index.html");
  const css = read("css/study-room.css");
  /* ⚠ read() は正規化後の本文：core.$( は $( に見える */
  if (!study.includes("const STUDY_AUTO_SCROLL_SPEEDS = [20, 45, 75, 120, 180], STUDY_AUTO_SCROLL_SPEED_DEFAULT = 75;") ||
      !study.includes('"KeyA", "KeyB"') ||
      !study.includes("function studyAutoScrollFrame(now)") || !study.includes("function studyToggleAutoScroll()") ||
      !study.includes("if (!eligible) studyAutoScrollHalt();") ||
      !study.includes('studyNotify("studyAutoScrollEnd")') ||
      !study.includes("STUDY_AUTO_SCROLL_STOP_CODES.has(event.code) || event.code === studyPrefs.studyNextKey || event.code === studyPrefs.studyPreviousKey") ||
      !study.includes('function studyImagePointerDown(event) {\n  studyStopAutoScroll();') ||
      !study.includes('addEventListener("wheel", event => {\n  studyStopAutoScroll();') ||
      !study.includes('$("studyAutoScrollBtn").addEventListener("click", studyToggleAutoScroll);') ||
      !study.includes('studyBindPref("studyAutoScrollSpeed", "studyAutoScrollSpeed", node => {') ||
      (study.match(/studyStopAutoScroll\(\);/g) || []).length < 5 ||
      (study.match(/studyAutoScrollStart:"/g) || []).length !== 4 ||
      (study.match(/studyAutoScrollEnd:"/g) || []).length !== 4 ||
      (study.match(/studyAutoScrollNeedVertical:"/g) || []).length !== 4 ||
      (study.match(/studyHelpAuto:"/g) || []).length !== 4) fail("study-room.js auto-scroll (vertical-mode constant speed, tap/wheel/key stop, bottom auto-stop, four-language texts) is missing");
  else if (!html.includes('<button id="studyAutoScrollBtn"') || !html.includes('<select id="studyAutoScrollSpeed"') ||
           !html.includes('<option value="180" data-i18n="studyAutoSpeedFastest">') ||
           !html.includes('<dt>A</dt><dd data-i18n="studyHelpAuto"></dd>') ||
           !(html.indexOf('id="studyZoomGroup"') < html.indexOf('id="studyAutoScrollBtn"'))) fail("the ⏩ auto-scroll button (toolbar), speed select (settings) and A row (help) are missing");
  else if (!css.includes('.study-auto-scroll-btn[aria-pressed="true"]{')) fail("the running-state style for the auto-scroll button is missing");
  else ok("trk175: 📜 study auto-scroll — constant-speed hands-free vertical reading (⏩ button / A key, speed setting, tap·wheel·navigation keys stop it, auto-stop at the last page)");
}

// trk176: 🌗 書斎の明るさ/コントラスト調整（PLAYER-ROADMAP #13・読書用フィルタ）。
// 読書面（.study-image-stage / .study-text-stage）だけに CSS filter＝本棚やメニューは変わらない。
// 全画面フィット・拡大率とは独立。初期値（100/100/none）は "none" を入れるので見た目のコストゼロ。
{
  const study = read("js/study-room.js");
  const html = read("index.html");
  const css = read("css/study-room.css");
  if (!study.includes('const STUDY_READ_SPECIALS = ["none", "invert", "grayscale", "sepia"];') ||
      !study.includes("function studyReadFilterPercent(value)") || !study.includes("function studyReadFilterCss()") ||
      !study.includes("function studyApplyReadFilter()") ||
      !study.includes('if (studyPrefs.readBrightness === 100 && studyPrefs.readContrast === 100 && studyPrefs.readSpecial === "none") return "none";') ||
      !study.includes('room.style.setProperty("--study-read-filter", studyReadFilterCss())') ||
      !study.includes('readBrightness:100, readContrast:100, readSpecial:"none",') ||
      !study.includes("studyPrefs.readBrightness = Number.isFinite(rawBrightness) ? Math.min(150, Math.max(50, Math.round(rawBrightness))) : 100;") ||
      !study.includes('studyBindPref("studyReadSpecial", "readSpecial", () => studyApplyReadFilter());') ||
      !study.includes('for (const [id, key] of [["studyReadBrightness", "readBrightness"], ["studyReadContrast", "readContrast"]]) {') ||
      !study.includes('node.addEventListener("input", () => {') ||
      !study.includes("studyPrefs[key] = studyReadFilterPercent(node.value); studySavePrefs(); studyApplyReadFilter();") ||
      (study.match(/studyReadFilterHint:"/g) || []).length !== 4 ||
      (study.match(/studyReadSpecialSepia:"/g) || []).length !== 4) fail("study-room.js read filter (brightness/contrast clamped 50–150, invert/grayscale/sepia, default none, live input + saved change) is missing");
  else if (!html.includes('<input id="studyReadBrightness" type="range" min="50" max="150" step="5"') ||
           !html.includes('<input id="studyReadContrast" type="range" min="50" max="150" step="5"') ||
           !html.includes('<select id="studyReadSpecial"') ||
           !html.includes('<option value="sepia" data-i18n="studyReadSpecialSepia">') ||
           !html.includes('<span id="studyReadBrightnessValue" class="study-read-filter-value">')) fail("the 🌗 read-filter controls (two ranges + special select + value labels) are missing from the settings dialog");
  else if (!css.includes(".study-image-stage,.study-text-stage{filter:var(--study-read-filter,none)}") ||
           !css.includes(".study-read-filter-row input[type=range]{")) fail("the read filter must apply to the reading surfaces only (.study-image-stage / .study-text-stage)");
  else ok("trk176: 🌗 study read filter — brightness/contrast sliders + invert/grayscale/sepia on the reading surfaces only, independent of full-screen fit and zoom, none by default");
}

// 🌀 Lane sway: on by default for TRUCK and ORBIT only, each with its own
// "don't sway" option, plus the ❓ mystery switch that outranks both.
{
  const truck = read("js/truck.js");
  const modes = read("js/modes.js");
  const options = read("js/i18n-options.js");
  const main = read("js/main.js");
  const html = read("index.html");
  const swayOk = truck.includes("function swayModeOn(mode)") &&
    truck.includes('if (settings.swayAllModes) return true;') &&
    truck.includes('if (m === "truck") return settings.swayTruck !== false;') &&
    truck.includes('if (m === "orbit") return settings.swayOrbit !== false;') &&
    truck.includes("if (reduceMotion.matches || !swayModeOn()) return 0;") &&
    truck.includes('settings.swayTruck = prefs.swayTruck !== false;') &&
    truck.includes('settings.swayOrbit = prefs.swayOrbit !== false;') &&
    truck.includes("settings.swayAllModes = prefs.swayAllModes === true;");
  const uiOk = html.includes('id="swayTruck"') && html.includes('id="swayAllModes"') &&
    modes.includes('makeCheck("swayOrbit", "swayOrbit", "swayOrbit")') &&
    main.includes('["swayAllModes", "swayAllModes"]') &&
    ["ja", "en", "zh", "ko"].every(l => options.includes(`swayAllModes:"`)) &&
    (options.match(/swayAllModes:"/g) || []).length >= 4;
  if (!swayOk) fail("lane sway gating (TRUCK / ORBIT by default, mystery override) is broken");
  else if (!uiOk) fail("lane sway options (TRUCK / ORBIT checkboxes + ❓ mystery switch) are missing");
  else ok("lane sway defaults to TRUCK / ORBIT with per-mode off switches; ❓ mystery switch overrides all modes");
}

// ✨ Frame interpolation (js/frame-interp.js): opt-in motion-compensated
// interpolation for the media player and the full-screen viewer. WebGL2 only,
// fully offline, and the settings must sit directly above the A-B loop box.
{
  const fi = read("js/frame-interp.js");
  const player = read("js/media-player-mode.js");
  const core = read("js/core.js");
  const html = read("index.html");
  const max = read("js/video-max.js");
  const settingsOk =
    core.includes('frameInterp: pick(prefs.frameInterp, ["off", "blend", "flow"], "off")') &&
    core.includes("frameInterpStrength: num(prefs.frameInterpStrength, 0, 1, .85)") &&
    fi.includes('const MODES = ["off", "blend", "flow"];') &&
    fi.includes("const FLOW_LAMBDA = 0.010;") &&
    fi.includes("const FLOW_RANGE = 64;") &&
    fi.includes("settings.frameInterp = next;") && fi.includes("saveUserPrefs();");
  const glOk =
    fi.includes('getContext("webgl2"') &&
    fi.includes('getExtension("EXT_color_buffer_float")') &&
    fi.includes("gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])") &&
    fi.includes("gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)") &&
    fi.includes("requestVideoFrameCallback") &&
    fi.includes("float costF(") && fi.includes("float costB(");
  const offlineOk = !fi.includes("fetch(") && !fi.includes("import ") && !fi.includes("Worker(");
  const uiOk = html.includes('<script src="js/frame-interp.js"></script>') &&
    player.includes("const FI = window.TrkFrameInterp;") &&
    player.includes("body.append(display, stageWrap, controls, progressRow, lyricsBox, subsBox, chapBox, interpBox, loopBox, options, queuePanel, footer)") &&
    player.includes('FI.attach("media", stageCanvas)') && player.includes('FI.detach("media")') &&
    max.includes('window.TrkFrameInterp.attach("max", canvas)') && max.includes('window.TrkFrameInterp.detach("max")');
  const langOk = (fi.match(/mediaInterpTitle:/g) || []).length === 4 &&
    (fi.match(/mediaInterpHint:/g) || []).length === 4 &&
    (fi.match(/mediaInterpFlow:/g) || []).length === 4 &&
    (fi.match(/mediaInterpBlocked:/g) || []).length === 4;
  if (!settingsOk) fail("frame interpolation settings / flow constants are missing");
  else if (!glOk) fail("frame interpolation must run on WebGL2 (MRT flow passes, video frame callbacks)");
  else if (!offlineOk) fail("frame interpolation must stay offline (no fetch, imports or workers)");
  else if (!uiOk) fail("frame interpolation must be wired into the media player above the A-B loop box");
  else if (!langOk) fail("frame interpolation strings are missing from one of the four languages");
  else ok("frame interpolation is opt-in, WebGL2-only, offline, above the A-B loop box, in four languages");
}

// 🪶 Lite mode for phones / tablets / apps (js/lite.js): the settings panel in
// the bottom-right of ⚙ settings, the auto probe, and the draw-only gates. The
// important contract is that judging and the clock stay OUTSIDE the gate.
{
  const lite = read("js/lite.js");
  const html = read("index.html");
  const core = read("js/core.js");
  const css = read("css/style.css");
  const i18n = read("js/i18n.js");
  const render = read("js/render.js");
  const spectrum = read("js/spectrum.js");
  const mmd = read("js/mmd.js");
  const vrm = read("js/vrm.js");
  const media = read("js/media-player-mode.js");
  const tv = read("js/tv-dock.js");
  const songMedia = read("js/media.js"), fxDock = read("js/fx-dock.js"), library = read("js/library.js");
  const ids = ["litePanel", "liteMode", "liteFps", "liteMascot", "liteScale", "liteSpecOff", "liteFx", "liteBlur", "liteState", "liteDevice", "liteRecheckBtn", "litePreset", "liteGameFull",
    "liteDecor", "liteLibRows", "liteNoAnalyze", "liteMascotNoLoad"];
  const settingsKeys = ["liteMode", "liteFps", "liteMascot", "liteScale", "liteSpectrumOff", "liteFx", "liteBlur", "liteGameFull",
    "liteDecor", "liteLibRows", "liteNoAnalyze", "liteMascotNoLoad"];
  const wiringOk = ["window.TrkLite = Object.freeze({", "function liteActive()", "function liteProbe()", "liteBatteryProbe",
    "navigator.connection", "deviceMemory", "liteGate(", "function litePixelRatio(", "liteBlurCap", "liteSpecBlocked",
    "liteMascotAllow", "classList.toggle(\"trkLite\"", "classList.toggle(\"trkLiteFx\"", "classList.toggle(\"trkLiteStill\"", "classList.toggle(\"trkNoMascot\"",
    /* ④「読む量をへらす」枠（曲リスト・音声解析・3Dマスコットのモデル）。既定値をプリセットに全部並べ、
       liteValueOf は既定オンのキー名で判定する（settings[key] !== false を素の値に混ぜると Object.prototype が通る） */
    "liteDecorBlocked", "liteDecorAllow", "liteLibRowsValue", "function liteLibRows(max)", "liteNoAnalyze", "liteMascotNoLoad",
    "LITE_DEFAULT_ON", 'liteLibRows:"150"', 'liteNoAnalyze:true', 'liteMascotNoLoad:true']
    .every(token => lite.includes(token));
  /* 🎯 プリセット（ゲーム優先＝ノーツ・反応はそのまま、他だけ軽くする） */
  const presetOk = lite.includes("const LITE_PRESETS = [") && ["balanced", "game", "max", "off"].every(id => lite.includes(`id:"${id}"`)) &&
    lite.includes("function litePresetId()") && lite.includes("function liteApplyPreset(id)") && lite.includes("allowGame: liteAllowGame") &&
    lite.includes("function liteAllowGame(now)") && lite.includes("settings.liteGameFull === true") &&
    html.includes('<option value="game" data-i18n="litePresetGame">') && html.includes('id="liteGameFull"') &&
    core.includes("liteGameFull: prefs.liteGameFull === true");
  const uiOk = ids.every(id => html.includes(`id="${id}"`) && (id === "litePanel" || lite.includes(`"${id}"`))) &&
    html.includes('<script src="js/lite.js"></script>') &&
    html.indexOf('<script src="js/lite.js"></script>') > html.indexOf('<script src="js/core.js"></script>') &&
    settingsKeys.every(key => core.includes(`lite${key.slice(4)}: `) || core.includes(`${key}: `)) &&
    core.includes("function resetLitePrefs()") && core.includes('["lite","light"].includes(r)') &&
    core.includes('["lite","light"].includes(k)') && core.includes("resetLitePrefs();") &&
    core.includes("TrkLite.blurCap") && tv.includes("TrkLite.blurCap") &&
    css.includes("body.trkLiteFx") && css.includes("body.trkNoMascot #mmdCanvas") && css.includes("#litePanel.liteOn");
  /* 判定・時計（tickClock／sweepMisses）は 🪶 ゲートより前にあること */
  const gateAt = render.indexOf("TrkLite.allowGame(");
  const gateOk = gateAt > 0 && gateAt > render.indexOf("tickClock();") && gateAt > render.indexOf("sweepMisses(now)") &&
    gateAt > render.indexOf("truckJudge(now)") &&
    spectrum.includes('TrkLite.allow("spec"') && spectrum.includes("const specLive = () => settings.specOn && !isSafe() && !liteOff();") &&
    mmd.includes('TrkLite.mascotAllow("mmd"') && mmd.includes('TrkLite.noMascot("mmd")') &&
    vrm.includes('TrkLite.mascotAllow("vrm"') && vrm.includes('TrkLite.noMascot("vrm")') &&
    media.includes('TrkLite.allow("media"') && tv.includes('TrkLite.allow("tv"') && tv.includes('TrkLite.allow("tvCheck"') &&
    read("js/video-max.js").includes("TrkLite.pixelRatio(2)") && read("js/video-max.js").includes('TrkLite.allow("max"') &&
    read("js/synth-mode.js").includes("TrkLite.pixelRatio(2)") && read("js/synth-mode.js").includes("TrkLite.decorBlocked") &&
    /* 📡 選曲中も動き続けていたドックの装飾、📜 曲リストの行数、🧠 曲の解析、🩷 3Dモデルの自動読み込み */
    fxDock.includes("TrkLite.decorAllow(") && library.includes("TrkLite.libRows(LIB_SHOW)") &&
    songMedia.includes("TrkLite.noAnalyze()") && songMedia.includes("analysisSkippedLite") &&
    mmd.includes("TrkLite.mascotNoLoad") && mmd.includes('on("mascot"') && mmd.includes('$("mmdPanel").addEventListener("toggle"') &&
    vrm.includes("TrkLite.mascotNoLoad") && vrm.includes('on("mascot"') && read("js/custom.js").includes('emit("mascot")');
  const langKeys = ["secLite", "liteHint", "liteNote", "liteMode", "liteModeAuto", "liteModeOn", "liteModeOff", "liteFps",
    "liteDecor", "liteLibRows", "liteLibRowsDevice", "liteLibRows150", "liteLibRows60", "liteLibRowsDeviceShort", "liteLibRowsSet",
    "liteNoAnalyze", "liteMascotNoLoad", "liteLeanNote", "liteAnalyzeOffNow", "liteAnalyzeOnNow", "liteMascotSkipOn", "liteMascotSkipOff",
    "liteFps60", "liteFps30", "liteFps20", "liteMascot", "liteMascot60", "liteMascot30", "liteMascot15", "liteMascotOff",
    "liteMascotOffNote", "liteScale", "liteScaleDevice", "liteScale15", "liteScale10", "liteSpecOff", "liteFx", "liteBlur",
    "liteStateOn", "liteStateOff", "liteDevice", "liteCores", "liteMem", "liteApp", "liteBrowser", "liteBattery",
    "liteWhyManual", "liteWhyOff", "liteWhySaveData", "liteWhyBattery", "liteWhyMotion", "liteWhyLow", "liteWhyAutoOff",
    "liteWhyDesktop", "liteRecheck", "liteNowOn", "liteNowOff", "liteFpsSet", "liteMascotSet", "liteToast", "specLiteOff",
    "litePreset", "litePresetBalanced", "litePresetGame", "litePresetMax", "litePresetOff", "litePresetCustom", "litePresetSet",
    "liteGameFull", "liteGameFullNote", "liteGameFullOn", "liteGameFullOff"];
  const langOk = langKeys.every(key => (i18n.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4);
  if (!wiringOk) fail("lite mode module (js/lite.js) is missing its probe / gates / body classes");
  else if (!uiOk) fail("lite-mode settings panel, script order, defaults or reset path is incomplete");
  else if (!presetOk) fail("lite-mode presets (balanced / game-first / maximum saving / off) are incomplete");
  else if (!gateOk) fail("lite-mode draw gates are missing (or the game clock/judging slipped behind the gate)");
  else if (!langOk) fail("lite-mode strings are missing from one of the four languages");
  else ok("lite mode (phones/apps): auto probe, presets incl. game-first, draw/size/loading gates in 4 languages");
}

// 🎮 Gamepads, controllers and TV remotes (js/pad.js): the ⚙ → ⌨ Controls
// sub-panel, button/axis bindings, menu focus and the keyboard-side extras
// (media keys / remote "back" keys) that make a remote usable.
{
  const pad = read("js/pad.js");
  const html = read("index.html");
  const core = read("js/core.js");
  const main = read("js/main.js");
  const media = read("js/media-player-mode.js");
  const i18n = read("js/i18n.js");
  const actions = ["left", "right", "confirm", "back", "pause"];
  const wiringOk = ["window.TrkPad = Object.freeze({", "function updatePadUI()", "getGamepads", "function padRawEdges(",
    "function padAssign(", "function padMoveFocus(", "function padActivate()", "function padTap(", "function padPressed(",
    "requestAnimationFrame(padTick)", "window.Trk.overlay.any()", "catchState", "stageInput", "handleInput("]
    .every(token => pad.includes(token)) &&
    ["function keyCodeOf(e)", "const validPadBind =", "const PAD_DEFAULTS =", "function formatPadBind(",
     "function resetKeysPrefs()", "if (typeof updatePadUI === \"function\") updatePadUI();"]
    .every(token => core.includes(token));
  const uiOk = ["padPanel", "padEnabled", "padMenuNav", "padStatus", "padPresets"].every(id => html.includes(`id="${id}"`)) &&
    actions.every(a => html.includes(`data-padbind="${a}"`) && html.includes(`data-padvalue="${a}"`)) &&
    ["ab", "dpad", "stick"].every(p => html.includes(`data-padpreset="${p}"`)) &&
    ["standard", "taiko", "arcade", "remote"].every(p => html.includes(`data-keypreset="${p}"`)) &&
    html.includes('<script src="js/pad.js"></script>') &&
    html.indexOf('<script src="js/pad.js"></script>') > html.indexOf('<script src="js/main.js"></script>') &&
    core.includes("padEnabled: prefs.padEnabled !== false") && core.includes('arcade:  { label:"keyPresetArcade"') &&
    core.includes('remote:  { label:"keyPresetRemote"') && core.includes("resetKeysPrefs();") &&
    core.includes('["keys","key","pad","controller","input"].includes(r)') && core.includes('["keys","key","pad","controller","input"].includes(k)') &&
    main.includes("const code = keyCodeOf(e);") && main.includes("captureKey(code)") && main.includes("captureMenuKey(code)") &&
    main.includes('code === "BrowserBack"') && media.includes("captureMediaExitKey(code)") && media.includes("keyCodeOf(e)");
  const langKeys = ["keyPresetArcade", "keyPresetRemote", "padPanelTitle", "padHint", "padEnable", "padEnableOn", "padEnableOff",
    "padMenuNav", "padMenuNavHint", "padMenuNavOn", "padMenuNavOff", "padPresetAB", "padPresetDpad", "padPresetStick", "padPresetSet",
    "padActLeft", "padActRight", "padActConfirm", "padActBack", "padActPause", "padConnected", "padNone", "padCapture",
    "padBindSet", "padConnectedToast", "padGoneToast", "padRemoteHint", "padBtn", "padAxis"];
  const langOk = langKeys.every(key => (i18n.match(new RegExp("\\b" + key + ":", "g")) || []).length === 4);
  if (!wiringOk) fail("gamepad module (js/pad.js) is missing its probe, bindings or play/menu helpers");
  else if (!uiOk) fail("gamepad / TV-remote settings panel, presets, script order or reset path is incomplete");
  else if (!langOk) fail("gamepad / TV-remote strings are missing from one of the four languages");
  else ok("gamepads and TV remotes: button+axis key config, menu focus, media keys, four languages");
}

// A cache name is deliberately checked for existence, not for a guessed
// date, because the service worker is manually bumped for every release.
const sw = read("sw.js");
const cacheMatch = sw.match(/CACHE\s*=\s*["']([^"']+)["']/);
if (!cacheMatch) fail("sw.js cache name could not be read");
else if (!/^trk-v\d{4}\.\d{1,2}\.\d{1,2}[-\w]*$/.test(cacheMatch[1])) fail(`unexpected service-worker cache name: ${cacheMatch[1]}`);
else ok(`service-worker cache: ${cacheMatch[1]}`);

for (const rel of [
  "docs/HANDOFF.md",
  "docs/pack-format.md",
  "docs/android.md",
  "NOTICE.md",
  "README.md",
  "privacy.html",
  "credits.html",
  "css/privacy.css",
  "package.json",
  "capacitor.config.ts",
  "tools/prepare-mobile-web.mjs",
  "tools/check-mmd-motion-data.mjs"
]) {
  if (!exists(rel)) fail(`required project file is missing: ${rel}`);
}
if (exists("README.md") && !read("README.md").includes("docs/pack-format.md")) {
  fail("README.md does not link to docs/pack-format.md");
} else if (exists("README.md")) {
  ok("pack format documentation is linked from README.md");
}
if (exists("README.md") && !read("README.md").includes("privacy.html")) fail("README.md does not link to privacy.html");
if (exists("README.md") && !read("README.md").includes("credits.html")) fail("README.md does not link to credits.html");
if (exists("index.html") && !read("index.html").includes('href="privacy.html"')) fail("index.html does not link to privacy.html");
if (exists("index.html") && !read("index.html").includes('href="credits.html"')) fail("index.html does not link to credits.html");
else ok("privacy and credits pages are linked from the app");
try {
  const pkg = JSON.parse(read("package.json"));
  for (const script of ["prepare:mobile", "cap:add:android", "cap:sync", "cap:build:android"]) {
    if (!pkg.scripts || !pkg.scripts[script]) fail(`package.json is missing script: ${script}`);
  }
  if (pkg.scripts && pkg.scripts["prepare:mobile"] && exists("tools/prepare-mobile-web.mjs")) ok("Capacitor preparation scripts are present");
} catch (error) {
  fail(`package.json is not valid JSON: ${error.message}`);
}

/* 差し替えの回帰（名前空間 B の欠陥の再発防止）：後から読み込まれるファイルが代入で上書きする関数は、
   正規の公開先（window.Trk.core等）をアクセサ（get/set）で持つ。値のコピーだと内部呼び出しへ届かない。 */
const PATCHED_FUNCTIONS = {
  "js/core.js": ["activeMods", "applySkin", "videoFilter"],
  "js/custom.js": ["installPackFile", "sanitizeSong", "getPackSongs", "renderPackList"],
  "js/game.js": ["showJudge", "gameTime"],
  "js/library.js": ["renderLib", "renderBanner"],
  "js/media.js": ["chartToData", "applyChartData"],
  "js/render.js": ["drawVideo"],
};
for (const [rel, name] of Object.entries(PATCHED_FUNCTIONS).flatMap(([r, ns]) => ns.map(n => [r, n]))) {
  const owner = exists(rel) ? read(rel) : "";
  const accessorTarget = rel === "js/core.js" ? "window\\.Trk\\.core" : "window";
  const accessor = new RegExp(`Object\\.defineProperty\\(${accessorTarget}, "${name}", \\{[^}]*get:\\(\\) => ${name}, set:v => \\{ ${name} = v; \\} \\}\\)`);
  const patchedElsewhere = walk(path.join(root, "js")).filter(f => f.endsWith(".js") && path.relative(root, f) !== rel)
    .some(f => new RegExp(`^\\s*(?:window\\.(?:Trk\\.[\\w]+\\.)?)?${name} = (?:async )?(?:function|\\(|[A-Za-z_$][\\w$]* =>|[A-Za-z_$][\\w$]*;)`, "m").test(read(path.relative(root, f))));
  if (!patchedElsewhere) fail(`${name}: no later file overrides it (remove it from PATCHED_FUNCTIONS if this is intended)`);
  else if (!accessor.test(owner)) fail(`${name} is overridden by a later file but ${rel} does not expose it as a ${rel === "js/core.js" ? "Trk.core" : "window"} accessor`);
  else ok(`${name} override reaches internal calls (${rel === "js/core.js" ? "Trk.core" : "window"} accessor in ${rel})`);
}

/* 名前空間 D：領域の公開名は window.Trk.<領域> にも載る（旧名 window.X は別名として残す）。
   登録元の包みの末尾に、窓へ出している名前（window.X = X・defineProperty(window, …)）がすべて
   window.Trk.<領域> の登録に入っていることを確かめる。登録が無い・抜けると失敗する。 */
const TRK_REGISTRARS = {
  "js/chart-gen.js": "chart",
  "js/judge-match.js": "judge",
  "js/pad.js": "pad",
  "js/lite.js": "lite",
  "js/main.js": "main",
  "js/custom.js": "custom",
  "js/library.js": "library",
  "js/media.js": "media",
  "js/data.js": "data",
  "js/render.js": "play",
  "js/catch.js": "modes",
  "js/core.js": "core",
};
const TRK_NOT_REGISTERED = { "js/core.js": ["_trkStudyRoomOpen"] }; // 互換の読み取り専用アクセサ（宣言ではない）
const TRK_EXTRAS = {
  "js/library.js": { files: ["js/title-match.js"], functions: true },  // 関数は領域へ出す（plTitleKeys など。窓へは出していない）
  "js/render.js": { files: ["js/game.js"], functions: false },        // 同じ領域の別ファイル：窓へ出している名前だけ
  "js/catch.js": { files: ["js/modes.js", "js/truck.js", "js/stage.js"], functions: false },
};
for (const [rel, area] of Object.entries(TRK_REGISTRARS)) {
  const src = exists(rel) ? read(rel) : "";
  // 同じ領域の別ファイル（TRK_EXTRAS）：その関数と、窓へ出している名前も登録の対象
  const extra = TRK_EXTRAS[rel] || { files: [], functions: false };
  const extraNames = extra.files.flatMap(f => {
    const t = read(f);
    return [
      ...(extra.functions ? [...t.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map(m => m[1]) : []),
      ...[...t.matchAll(/^window\.([A-Za-z_$][\w$]*) = \1;/gm)].map(m => m[1]),
      ...[...t.matchAll(/^Object\.defineProperty\(window, "([^"]+)"/gm)].map(m => m[1]),
    ];
  });
  const exported = [
    ...[...src.matchAll(/^window\.([A-Za-z_$][\w$]*) = \1;/gm)].map(m => m[1]),
    ...[...src.matchAll(/^Object\.defineProperty\(window, "([^"]+)"/gm)].map(m => m[1]),
    ...extraNames,
  ].filter((n, i, all) => all.indexOf(n) === i && !(TRK_NOT_REGISTERED[rel] || []).includes(n));
  const tail = src.slice(src.indexOf(`window.Trk.${area} = `));
  const missing = exported.filter(n => !new RegExp(`[{,]\\s*${n.replace(/\$/g, "\\$")}\\s*[,}]|window\\.Trk\\.${area}, "${n.replace(/\$/g, "\\$")}"`).test(tail));
  if (src.indexOf(`window.Trk.${area} = `) < 0) fail(`${rel}: window.Trk.${area} is not registered`);
  else if (missing.length) fail(`${rel}: not registered under window.Trk.${area}: ${missing.join(", ")}`);
  else ok(`${rel} registers ${exported.length} public name(s) under window.Trk.${area}`);
}

/* 名前空間 D：書斎の公開面（凍結の window.TrkStudyRoom）と同じ参照を、領域の名前 window.Trk.study でも出す */
{
  const studySrc = exists("js/study-room.js") ? read("js/study-room.js") : "";
  if (!/^window\.Trk\.study = window\.TrkStudyRoom;$/m.test(studySrc)) fail("js/study-room.js does not alias window.Trk.study to window.TrkStudyRoom");
  else ok("window.Trk.study is the same frozen object as window.TrkStudyRoom");
}

/* 利用者の決定（2026-10-08）：ブラウザ標準の window.screen を上書きしない。
   内部の画面状態は window.Trk.core.screen だけで読む（窓の別名は作らない）。 */
{
  const coreSrc = read("js/core.js");
  if (/defineProperty\(window, "screen"|window\.screen = /.test(coreSrc)) fail("js/core.js sets window.screen (the browser's own screen object must not be replaced)");
  else ok("window.screen is left to the browser (the app state is window.Trk.core.screen only)");
}

/* trk100 の回帰ガード：画面状態を裸の名前 screen で読まないこと。
   core.js は screen を大域へ出さないので、他ファイルの裸の screen はブラウザ標準の
   window.screen（オブジェクト）に静かに当たり、比較が常に false になる（選曲画面のTVの
   映像・確認タブ・メニュー再生がまとめて止まった trk100 の不具合と同型）。
   読むときは core.screen（＝window.Trk.core.screen）。局所変数にも screen という名前を
   使わない（定義元の js/core.js だけが私有の let screen を持てる）。
   走査は index.html の classic script 順（インライン含む）で、文字列・コメントは除去済み。
   オブジェクトリテラルの鍵（screen:"#…" など、直後が : のもの）は状態の読み書きではないので許す。 */
{
  const offenders = [];
  /* 生の本文で見る（read() は core.X を元の綴りへ戻すので、core.screen が裸の screen に見えてしまう） */
  const rawOf = rel => fs.readFileSync(path.join(root, rel), "utf8");
  for (const unit of classicScriptOrder(rawOf("index.html"))) {
    if (unit.kind === "file" && unit.name === "js/core.js") continue;   // 定義元（IIFE の私有状態）
    const stripped = stripCode(unit.kind === "file" ? rawOf(unit.name) : unit.body);
    const re = /(^|[^.\w$])screen(?![\w$])/g;
    let m;
    while ((m = re.exec(stripped))) {
      if (/^\s*:/.test(stripped.slice(m.index + m[0].length))) continue;   // オブジェクトリテラルの鍵
      const line = stripped.slice(0, m.index).split("\n").length;
      offenders.push(`${unit.name}:${line}`);
    }
  }
  if (offenders.length) fail(`bare \`screen\` reads the browser's window.screen, not the app state (use core.screen): ${offenders.join(", ")}`);
  else ok("no bare `screen` identifier outside js/core.js (the app screen state is read via core.screen only)");
}

/* アドオンの api（js/addons.js の makeApi）の鍵は、docs/ADDONS.md に `api.<鍵>` として載っていること。
   載っていない鍵は、使ってよい窓口として約束していないので、増やすときは文書も増やす。 */
{
  const addonsSrc = fs.readFileSync(path.join(root, "js/addons.js"), "utf8");
  const block = (addonsSrc.match(/function makeApi\(id\) \{[\s\S]*?\n\}\n/) || [""])[0];
  /* 鍵は字下げ4の行にある（同じ行に , で続くものも含む）。メソッド形式（addStyle(css)）も含む */
  const keys = [];
  for (const line of block.split("\n")) {
    if (!/^\s{4}\S/.test(line)) continue;
    const m1 = line.match(/^\s{4}([A-Za-z_$][\w$]*)\s*\(/); if (m1) keys.push(m1[1]);
    const m2 = line.match(/^\s{4}([A-Za-z_$][\w$]*),\s*$/); if (m2) keys.push(m2[1]);   /* 省略記法（id,） */
    for (const m of line.matchAll(/(?:^\s{4}|,\s+)([A-Za-z_$][\w$]*)\s*:/g)) keys.push(m[1]);
  }
  const docs = fs.readFileSync(path.join(root, "docs/ADDONS.md"), "utf8");
  const missing = [...new Set(keys)].filter(k => !new RegExp("api\\." + k.replace("$", "\\$") + "(?![\\w$])").test(docs));
  if (!block || keys.length < 10) fail("js/addons.js: makeApi の鍵を読めませんでした（" + keys.length + "件）");
  else if (missing.length) fail("docs/ADDONS.md に載っていない api の鍵: " + missing.join(", "));
  else ok("アドオンの api の鍵（" + keys.length + "件）は docs/ADDONS.md に全て載っている");
}

/* 互換名の段階的廃止：tools/compat-names.json を正とし、現存する window 別名・Trk.core の正規 accessor・
   js/fx.js（trk113まで凍結。trk114で解除したが、読み手はまだ移行していない）の実際の読者を照合する。一覧は文書の文言からは読まず JSON から読む
   （レビュー4回目の指摘：ADDONS.md の見出しを正規表現で拾っていたため、文を直すだけで検査が落ちた）。
   fx.js が5名を読むため、fx.js を書き換えるまでその5名だけは保留する。 */
{
  const coreSrc = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
  const fxSrc = fs.readFileSync(path.join(root, "js/fx.js"), "utf8");
  let compat = null;
  try { compat = JSON.parse(fs.readFileSync(path.join(root, "tools/compat-names.json"), "utf8")); }
  catch (e) { fail("tools/compat-names.json を読めません: " + e.message); }
  if (compat) {
    const exempt = new Set((compat.exempt || []).map(r => r.name));
    const actual = [...coreSrc.matchAll(/defineProperty\(window, "([A-Za-z_$][\w$]*)"/g)].map(m => m[1]).filter(n => !exempt.has(n));
    const docs = fs.readFileSync(path.join(root, "docs/ADDONS.md"), "utf8");
    const removed = Array.isArray(compat.removed) ? compat.removed : [];
    const retained = Array.isArray(compat.retained) ? compat.retained.map(r => r && r.name) : [];
    const former = [...removed, ...retained];
    const coreMembers = new Set([...coreSrc.matchAll(/defineProperty\(window\.Trk\.core, "([A-Za-z_$][\w$]*)"/g)].map(m => m[1]));
    const currentSorted = [...new Set(actual)].sort();
    const retainedSorted = [...new Set(retained)].sort();
    const missingCore = former.filter(n => !n || !coreMembers.has(n));
    const missingFrozenConsumer = retained.filter(n => !n || !new RegExp(`(?<![\\w$.])${n}(?![\\w$])`).test(fxSrc));
    const docsRefOk = /### 互換名の廃止状況/.test(docs) && /tools\/compat-names\.json/.test(docs);
    if (!docsRefOk) fail("docs/ADDONS.md の「互換名の廃止状況」節が tools/compat-names.json を参照していません");
    else if (JSON.stringify(currentSorted) !== JSON.stringify(retainedSorted)) fail("現存する core.js のwindow別名と tools/compat-names.json の保留一覧が不一致");
    else if (new Set(former).size !== 33 || removed.length !== 28 || retained.length !== 5) fail("trk90廃止分と保留分が、従来の33互換名を重複なく網羅していません（廃止" + removed.length + "件・保留" + retained.length + "件）");
    else if (missingCore.length) fail("廃止済み／保留の名前が window.Trk.core にありません: " + missingCore.join(", "));
    else if (missingFrozenConsumer.length) fail("保留する名前が frozen js/fx.js に実際にはありません: " + missingFrozenConsumer.join(", "));
    else ok("互換名: tools/compat-names.json を正に、28件を廃止・5件を保留（Trk.core は全33件を維持）");
  }
}

/* 項目 5（README の分割）：README は概要に絞る（上限 12KB）。docs/guide/ の全ファイルは目次（index.md）に載せる。 */
{
  const readmeBytes = fs.statSync(path.join(root, "README.md")).size;
  const guideFiles = fs.readdirSync(path.join(root, "docs/guide")).filter(f => f.endsWith(".md") && f !== "index.md");
  const guideIndex = read("docs/guide/index.md");
  const notListed = guideFiles.filter(f => !guideIndex.includes("(" + f + ")"));
  if (readmeBytes > 12 * 1024) fail("README.md が 12KB を超えています（" + readmeBytes + " bytes）。くわしい説明は docs/guide/ へ");
  else if (notListed.length) fail("docs/guide/index.md に載っていないガイド: " + notListed.join(", "));
  else ok("README は " + readmeBytes + " bytes（上限 12KB）。docs/guide/ の " + guideFiles.length + " 件は全て目次に載っている");
}

/* 項目 6（長押しの代わり）：長押しでしか開けない「曲のプロフィール」「メディアプレーヤー」に、見えるボタンと
   設定（showMoreBtns）が付いていること。ボタンの有無は headless の確認（/tmp の probe）でも見ている。 */
{
  const libSrc = read("js/library.js"), tvSrc = read("js/tv-dock.js"), idx = read("index.html");
  const songBtn = /pb\.addEventListener\("click"[^\n]*songProfile\(it\)/.test(libSrc) && libSrc.includes('"libFav moreBtn"');
  const tvBtn = /mediaBtn\.addEventListener\("click"[^\n]*TrkMediaPlayer\.open\(\)/.test(tvSrc) && /window\.TrkMediaPlayer = \{ open:openMedia/.test(read("js/media-player-mode.js")) && tvSrc.includes('"inline tight moreBtn"');
  const toggle = idx.includes('id="showMoreBtns"') && libSrc.includes("syncMoreBtns") && /body\.noMoreBtns \.moreBtn/.test(read("css/style.css"));
  if (!songBtn || !tvBtn || !toggle) fail("長押しの代わりのボタン（曲の🎶・TVの▶）か、設定 showMoreBtns の配線が無い");
  else ok("長押しの代わりのボタン（曲の🎶・TVの▶）と設定 showMoreBtns が付いている");
}

/* 項目 6（表示の並び・開発者表示）：かんたん／全部の並び替えと、開発者表示（devView）で隠すものの配線。
   TV の並びは起動時に組み立てるので、切り替えは次の読み込みで反映（index の説明文に書いてある）。 */
{
  const idx = read("index.html"), libUi = read("js/library.js"), libSkins = read("js/lib-skins.js");
  const tvSrc = read("js/tv-dock.js"), mediaSrc = read("js/media-player-mode.js"), i18n = read("js/i18n.js");
  const arr = (src, name) => { const m = src.match(new RegExp("const " + name + " = \\[([^\\]]*)\\]")); return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : null; };
  const groups = arr(tvSrc, "TV_GROUPS"), simpleGroups = arr(tvSrc, "TV_GROUPS_SIMPLE");
  const sameGroups = groups && simpleGroups && groups.length === simpleGroups.length && groups.every(g => simpleGroups.includes(g));
  const top = arr(libSkins, "LIB_SKIN_SIMPLE_TOP");
  const wired = idx.includes('id="displayMode"') && idx.includes('id="devView"') && libUi.includes("syncDisplayUi") && /body\.noDev \.devOnly/.test(read("css/style.css"));
  const orders = (libSkins.match(/for \(const id of libSkinOrder\(\)\)/g) || []).length === 2 && (tvSrc.match(/for \(const cat of tvGroups\(\)\)/g) || []).length === 2 && tvSrc.includes("TV_RECOMMENDED");
  const hides = mediaSrc.includes('"mediaLoopLab devOnly"') && libUi.includes('el("div", "devOnly")') && idx.includes('id="skinMaker" class="subPanel devOnly"') && tvSrc.includes('"fxMini slim devOnly"');
  const keys = ["displayModeLabel:", "displaySimple:", "displayFull:", "displayModeHint:", "devViewLabel:"].every(k => (i18n.match(new RegExp(k, "g")) || []).length === 4);
  if (!sameGroups || !top || top.length !== 6 || !wired || !orders || !hides || !keys) fail("表示の並び（かんたん／全部）か開発者表示（devView）の配線が欠けている");
  else ok("表示の並び（かんたん／全部）と開発者表示（ループ・ラボ、投稿者ツールを隠す）が配線されている");
}

/* 項目 6（一部／要確認の4件）：長押しの見える代わり。タブ設定（⚙）、スペクトラム（⚙ くわしい設定）、書斎（📚 書斎）、
   緊急復旧（既存の 🛟 セーフモード）。それぞれ呼び出し先が同じ関数であることと、隠せるかを見る。
   📚 書斎（trk125）だけは、長押しに気づかなくても入れるように、設定 showMoreBtns に関係なく常に出します。 */
{
  const libSrc = read("js/library.js"), specSrc = read("js/spectrum.js"), studySrc = read("js/study-room.js");
  const idx = read("index.html"), coreSrc = read("js/core.js");
  const tabGear = libSrc.includes('"libTab plPlus moreBtn"') && libSrc.includes("onLongPress(b, () => tabSettingsMenu(t))") && libSrc.includes("tabSettingsMenu(activeTab)");
  const specBtn = specSrc.includes('"specNext moreBtn"') && specSrc.includes("onLongPress(zipBtn, openSpecSettings)") && specSrc.includes("specMore.addEventListener(\"click\", openSpecSettings)");
  const studyBtn = idx.includes('id="studyOpenBtn"') && studySrc.includes('getElementById("studyOpenBtn")') &&
    idx.includes('id="studyOpenBtn" class="libSkinBtn studyHeadBtn"') && !/id="studyOpenBtn"[^>]*moreBtn/.test(idx) &&
    studySrc.includes('studyOpenBtn.title = tr("studyOpenBtnHint")');
  const emergency = idx.includes('id="emergencySafeBtn"') && coreSrc.includes('bind("emergencySafeBtn"');
  const keys = (src, k) => (src.match(new RegExp("\\b" + k + ":", "g")) || []).length === 4;
  const i18nOk = keys(libSrc, "tabSettingsBtn") && keys(specSrc, "specOpenSettings") && keys(studySrc, "studyOpenBtn") && keys(studySrc, "studyOpenBtnHint");
  if (!tabGear || !specBtn || !studyBtn || !emergency || !i18nOk) fail("一部／要確認の4件の見える代わり（タブの⚙・スペクトラムのくわしい設定・書斎ボタン・緊急復旧）の配線が欠けている");
  else ok("一部／要確認の4件に見える代わりがある（タブの⚙・くわしい設定・📚書斎・🛟緊急復旧）");
}

/* 項目 7（Service Worker）：ハッシュ固定の vendor は cache-first。キャッシュの中身は SHA-384 の照合が通ったものだけ使う。
   VENDOR_PINS は tools/vendor-lock.json から生成（ずれたら失敗）。セーフモードはキャッシュを読まない（F-19）。 */
{
  const swSrc = read("sw.js");
  const pins = spawnSync(process.execPath, [path.join(root, "tools", "sw-vendor-pins.mjs")], { encoding: "utf8" });
  const pinsFresh = pins.status === 0;
  const cacheFirst = /const pinned = pinnedPath\(url\);/.test(swSrc) && /if \(pinned && !safeClient\)/.test(swSrc) && /if \(hit && await pinnedMatches\(hit, pinned\)\) return hit;/.test(swSrc);
  const offlineVerified = /if \(cached && \(!pinned \|\| await pinnedMatches\(cached, pinned\)\)\) return cached;/.test(swSrc);
  const digestUsed = /crypto\.subtle\.digest\("SHA-384"/.test(swSrc);
  const safeIdFromNavigation = swSrc.includes("safeClients.add(event.resultingClientId)") && !swSrc.includes("safeClients.add(event.clientId)");
  const safeInitialNavigation = /const safeClient = safeClients\.has\(event\.clientId\)\s*\|\|\s*\(request\.mode === "navigate" && safeWanted\(url\)\);/.test(swSrc);
  if (!pinsFresh || !cacheFirst || !offlineVerified || !digestUsed || !safeIdFromNavigation || !safeInitialNavigation) fail("sw.js の vendor の cache-first（SHA-384 照合・初回ナビゲーションを含めセーフモードはキャッシュを読まない）が欠けている、または VENDOR_PINS が lock とずれている");
  else ok("sw.js: ハッシュ固定の vendor は cache-first で、SHA-384 が合うものだけ使う（VENDOR_PINS は vendor-lock.json と一致）");
}

/* 🗂 一回限りの移行・印・旧名の登録簿（docs/MIGRATIONS.md）。表とコードのずれは失敗、期限切れは警告。 */
{
  const registry = fs.readFileSync(path.join(root, "docs/MIGRATIONS.md"), "utf8");
  const jsAll = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"))
    .map(f => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
  const rows = registry.split("\n").filter(line => /^\|\s*`[^`]+`\s*\|/.test(line)).map(line => {
    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    return { id: cells[0].replace(/`/g, ""), kind: cells[1], date: cells[3] };
  });
  const today = new Date().toISOString().slice(0, 10);
  let registryOk = rows.length >= 4;
  for (const row of rows) {
    if (!jsAll.includes(row.id)) { registryOk = false; fail(`登録簿の「${row.id}」がコードに見つからない（表を直すか、コードの名前を確かめる）`); }
    const needsDate = /一回限り|旧名/.test(row.kind || "");
    if (needsDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.date || "")) { registryOk = false; fail(`登録簿の「${row.id}」に削除予定日（YYYY-MM-DD）がない`); }
    if (needsDate && row.date < today) warn(`「${row.id}」の削除予定日（${row.date}）を過ぎています。消すか、理由を書いて日付を延ばしてください（docs/MIGRATIONS.md）`);
  }
  if (registryOk) ok(`一回限りの移行の登録簿（${rows.length}項目）とコードが一致し、削除予定日がそろっている`);
}

console.log(`\nStatic check: ${failures ? "FAILED" : "passed"} · ${failures} failure(s) · ${warnings} warning(s)`);
if (failures) process.exitCode = 1;
