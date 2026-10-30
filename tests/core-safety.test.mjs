// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreSource = fs.readFileSync(path.join(root, "js/core.js"), "utf8");

function sourceBetween(start, end) {
  const a = coreSource.indexOf(start);
  assert.notEqual(a, -1, `core.js start marker not found: ${start}`);
  const b = coreSource.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `core.js end marker not found: ${end}`);
  return coreSource.slice(a, b);
}

const safeModeSource = sourceBetween("let safeModeOn = false;", "function resetKeysPrefs() {");
const urlCommandsSource = sourceBetween("function parseHashParams(hash)", "\n\nconst skin =");

function safeModeContext(mascot) {
  const settings = {
    videoStyle:"mono", videoZoom:1.4, castPolicy:"on", backgroundPolicy:"on", fxAntenna:true,
    bgDim:.4, bgBlur:8, tvParamFavs:["saved"], tvDockSkin:"custom", tvDockFive:true,
    tvOrder:"fx-first", tvOverlay:true, previewEnabled:true, tvMenuPreview:true, tvMenuVideo:true,
    tvSongWhilePlaying:true, specOn:true, specTv:true, specSkin:true, specSkinOpen:true,
    synthModeKeyboardLock:false, synthModeWideKeyboard:true, libKeepShared:true,
    fxPower:1, gameFxMode:"full", hideGameplayUI:true, fxRack:[{ id:"kept-effect" }],
    fxRackOn:true, ampOpen:true, tvRichOpen:true, mascot,
  };
  const marked = [];
  const sandbox = {
    settings,
    window:{},
    markAmpReset:value => marked.push(value),
    view:{ style:{ filter:"blur(4px)" } },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(safeModeSource, context, { filename:"js/core.js#safeMode" });
  return { context, settings, marked, sandbox };
}

function urlCommandContext(href) {
  const calls = { resetAll:0, resetVideo:0, resetAudio:0, resetNotes:0, resetLite:0, resetKeys:0, resetAmp:0, safe:0, save:0, reload:0, prompts:0 };
  const scheduled = [];
  const dialog = { yes:null, no:null };
  const replaced = [];
  const location = {
    href,
    hash:new URL(href).hash,
    reload() { calls.reload++; },
  };
  const element = () => ({
    style:{}, dataset:{}, textContent:"", type:"button",
    append() {}, appendChild() {}, setAttribute() {}, addEventListener() {}, remove() {}, focus() {},
  });
  const sandbox = {
    URL, URLSearchParams,
    location,
    history:{ replaceState(_state, _title, url) { replaced.push(String(url)); } },
    settings:{ videoStyle:"mono" },
    VIDEO_STYLE_IDS:["color", "mono", "dim", "off"],
    window:{},
    document:{
      body:{ append() {}, appendChild() {} },
      documentElement:{ append() {}, appendChild() {} },
      createElement:element,
      addEventListener() {}, removeEventListener() {},
    },
    performance:{ now:() => 123 },
    setTimeout(fn, ms) { scheduled.push({ fn, ms }); return scheduled.length; },
    resetAllPrefs() { calls.resetAll++; },
    resetVideoPrefs() { calls.resetVideo++; },
    resetAudioPrefs() { calls.resetAudio++; },
    resetNotesPrefs() { calls.resetNotes++; },
    resetLitePrefs() { calls.resetLite++; },
    resetKeysPrefs() { calls.resetKeys++; },
    resetAmpPrefs() { calls.resetAmp++; },
    enterSafeMode() { calls.safe++; },
    saveUserPrefs() { calls.save++; },
    exportPrefs() {},
    askFactoryReset(yes, no) { calls.prompts++; dialog.yes = yes; dialog.no = no; },
    tr:key => key,
    console:{ error() {} },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(urlCommandsSource, context, { filename:"js/core.js#urlCommands" });
  return { context, calls, scheduled, dialog, replaced, sandbox };
}

test("URL hash parser lowercases command keys but preserves values", () => {
  const parser = sourceBetween("function parseHashParams(hash)", "\n// URLパラメータを解釈して即時実行");
  const context = vm.createContext({ URLSearchParams });
  vm.runInContext(`${parser}\nglobalThis.parsed = Array.from(parseHashParams("#RESET=ALL&FoRcE=1&Skin=MiXeD"));`, context);
  assert.deepEqual(Array.from(context.parsed, pair => Array.from(pair)), [["reset", "ALL"], ["force", "1"], ["skin", "MiXeD"]]);
});

test("factory reset waits for explicit confirmation; only force=1 skips it", () => {
  const safe = urlCommandContext("https://trk.example/?reset=all");
  assert.equal(safe.calls.resetAll, 0);
  assert.equal(safe.calls.save, 0, "pending confirmation must not persist a reset");
  assert.deepEqual(safe.scheduled.map(x => x.ms), [300, 400]);
  assert.doesNotMatch(safe.replaced.at(-1), /[?&](reset|force)=/);
  safe.scheduled.find(x => x.ms === 300).fn();
  assert.equal(safe.calls.prompts, 1);
  assert.equal(safe.calls.resetAll, 0);
  safe.dialog.no();
  assert.equal(safe.calls.resetAll, 0, "Cancel must leave all preferences untouched");
  assert.equal(safe.calls.save, 0);

  const confirmed = urlCommandContext("https://trk.example/?reset=all&force=1");
  assert.equal(confirmed.calls.resetAll, 1);
  assert.equal(confirmed.calls.save, 1);
  assert.equal(confirmed.calls.prompts, 0);

  const promptOnly = urlCommandContext("https://trk.example/?reset=all&force=01");
  assert.equal(promptOnly.calls.resetAll, 0, "force values other than exactly 1 must not bypass confirmation");
  assert.equal(promptOnly.calls.save, 0);
  assert.equal(promptOnly.scheduled.some(x => x.ms === 300), true);

  const hashForce = urlCommandContext("https://trk.example/#RESET=ALL&FORCE=1");
  assert.equal(hashForce.calls.resetAll, 1, "hash command keys are case-insensitive too");
  assert.equal(hashForce.calls.prompts, 0);
});

test("?factory enters safe mode, not a destructive factory reset", () => {
  const result = urlCommandContext("https://trk.example/?factory");
  assert.equal(result.calls.safe, 1);
  assert.equal(result.calls.resetAll, 0);
  assert.equal(result.calls.save, 1);
});

test("safe mode disables risky output without deleting the saved FX rack", () => {
  for (const mascot of ["mmd", "vrm"]) {
    const { context, settings, marked, sandbox } = safeModeContext(mascot);
    vm.runInContext("enterSafeMode()", context);
    assert.equal(sandbox.window.TrkSafeMode(), true);
    assert.equal(settings.videoStyle, "off");
    assert.equal(settings.bgDim, 0);
    assert.equal(settings.bgBlur, 0);
    assert.equal(settings.tvMenuVideo, false);
    assert.equal(settings.specOn, false);
    assert.equal(settings.synthModeKeyboardLock, true);
    assert.equal(settings.libKeepShared, false);
    assert.equal(settings.fxRackOn, false);
    assert.deepEqual(settings.fxRack, [{ id:"kept-effect" }], "safe mode stops the rack but preserves its saved contents");
    assert.equal(settings.mascot, "skin");
    assert.deepEqual(marked, ["off"]);
    assert.equal(sandbox.view.style.filter, "none");
  }
});
