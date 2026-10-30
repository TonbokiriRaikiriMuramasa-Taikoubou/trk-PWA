// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/study-room.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = name => {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, name);
  return match[0];
};
function harness() {
  const context = vm.createContext({ clearTimeout() {} });
  vm.runInContext(source.slice(source.indexOf("const STUDY_SHELF_MAX"), source.indexOf("/* ============ 保存")) + `
    ${fn("studyReadPrefs")}
    ${fn("studySavePrefs")}
    ${fn("studyBindPref")}
    ${fn("studyRefreshPrefsUI")}
    ${fn("studySettingsOpen")}
    ${fn("studyCloseSettings")}
    ${fn("studyKeyDown")}
    ${fn("studyHandleKeyCapture")}
    ${fn("studyFullscreenFitActive")}
    ${fn("studyApplyZoomValue")}
    ${fn("studySetZoom")}
    ${fn("studySyncZoomRow")}
    let studySettingsReturnFocus = null;
    const elements = new Map();
    const shell = { inert:false };
    const document = { activeElement:null };
    const core = { $: id => {
      if (!elements.has(id)) elements.set(id, {
        id, hidden:id === 'studySettings' || id === 'studyHelp', checked:false,
        type:'checkbox', getClientRects:() => [1],
        dataset:{}, style:{ setProperty(key, value) { this[key] = value; } },
        classList:{ values:new Set(), contains(key) { return this.values.has(key); }, add(key) { this.values.add(key); }, remove(key) { this.values.delete(key); } },
        focus() { document.activeElement = this; },
        addEventListener(type, handler) { this[type] = handler; },
        querySelector:() => shell
      });
      return elements.get(id);
    }};
    let saved = null, steps = [], edges = [];
    function studyDBRun(store, mode, operation) {
      operation({ put(value, key) { saved = JSON.parse(JSON.stringify(value)); } });
      return Promise.resolve();
    }
    function studyFail(error) { throw error; }
    function studySyncZoomStepRow() {}
    function studyRefreshEditedTextFolderSelect() {}
    function studyRefreshExportFolderUI() {}
    function studyApplyShelfVisibility() {}
    function studyRefreshKeyAssignments() {}
    function studySyncLook() {}
    function studySyncCurrentBookControls() {}
    function studySetStatus() {}
    function studyNotify() {}
    function tr(key) { return key; }
    function studyEditorHandleTab() { return false; }
    function studyTypingTarget() { return false; }
    function studyAutoScrollActive() { return false; }
    function studyStopAutoScroll() {}
    function studyToggleAutoScroll() {}
    function studyApplyReadFilter() {}
    function studyStep(dir) { steps.push(dir); }
    function studyJumpZoomEdge(dir, repeat) { edges.push([dir, repeat]); return true; }
    function studyCloseRoom() { studyRoomOpen = false; }
    function key(code, extra = {}) {
      const event = { code, repeat:false, target:document.activeElement,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; }, ...extra };
      studyKeyDown(event); return event;
    }
    studyRoomOpen = true;
  `, context);
  return code => vm.runInContext(code, context);
}

test("Study page-key preference defaults, legacy migration, validation and persistence", () => {
  const run = harness();
  assert.equal(run("studyPrefs.pageKeysTurnPages"), false);
  for (const [raw, expected] of [
    [{}, false], [{ zoomEdgeKeys:true }, false], [{ zoomEdgeKeys:false }, true],
    [{ zoomEdgeKeys:"false" }, false], [{ pageKeysTurnPages:true }, true],
    [{ pageKeysTurnPages:false, zoomEdgeKeys:false }, false],
    [{ pageKeysTurnPages:"true" }, false], [{ pageKeysTurnPages:1 }, false]
  ]) {
    run(`studyReadPrefs(${JSON.stringify(raw)})`);
    assert.equal(run("studyPrefs.pageKeysTurnPages"), expected, JSON.stringify(raw));
  }
  run('studyBindPref("studyPageKeysTurnPages", "pageKeysTurnPages"); core.$("studyPageKeysTurnPages").checked = true; core.$("studyPageKeysTurnPages").change();');
  assert.equal(run("saved.pageKeysTurnPages"), true);
  assert.equal(run("'zoomEdgeKeys' in saved"), false, "save only the new setting");
  run("studyReadPrefs(saved); studyRefreshPrefsUI();");
  assert.equal(run('core.$("studyPageKeysTurnPages").checked'), true);
  run('core.$("studyPageKeysTurnPages").checked = false; core.$("studyPageKeysTurnPages").change(); studyReadPrefs(saved); studyRefreshPrefsUI();');
  assert.equal(run('core.$("studyPageKeysTurnPages").checked'), false);
});

test("Study dispatches page keys to edges by default and directly to pages when enabled", () => {
  const run = harness();
  run('key("PageDown"); key("PageUp");');
  assert.equal(run("JSON.stringify(edges)"), "[[1,false],[-1,false]]");
  assert.equal(run("steps.length"), 0);
  run('studyPrefs.pageKeysTurnPages = true; key("PageDown"); key("PageUp");');
  assert.equal(run("JSON.stringify(steps)"), "[1,-1]");
  assert.equal(run("edges.length"), 2);
  run('studyPrefs.studyNextKey = "PageUp"; key("PageUp");');
  assert.equal(run("steps.at(-1)"), 1, "explicit custom navigation bindings keep priority");
});

test("Study settings isolates shortcuts, traps Tab, closes on Esc and restores launcher focus", () => {
  const run = harness();
  run('core.$("studySettingsBtn").focus(); studyHeldCode = "Space"; studySettingsOpen({ currentTarget:core.$("studySettingsBtn") });');
  assert.equal(run("shell.inert"), true);
  assert.equal(run("studyHeldCode"), "");
  assert.equal(run("document.activeElement.id"), "studySettingsCloseBtn");
  assert.equal(run('key("PageDown").stopped'), true);
  assert.equal(run("edges.length + steps.length"), 0, "no reader actions behind the panel");
  run('shell.querySelectorAll = () => [core.$("studySettingsCloseBtn"), core.$("studyPageKeysTurnPages")]; key("Tab", { shiftKey:true });');
  assert.equal(run("document.activeElement.id"), "studyPageKeysTurnPages");
  run('key("Tab");');
  assert.equal(run("document.activeElement.id"), "studySettingsCloseBtn");
  run('studyKeyCaptureAction = "next"; key("KeyQ");');
  assert.equal(run("saved.studyNextKey"), "KeyQ", "key assignment works inside the panel");
  assert.equal(run('core.$("studySettings").hidden'), false);
  run('studyKeyCaptureAction = "next"; key("Escape");');
  assert.equal(run('core.$("studySettings").hidden'), false, "first Escape cancels capture only");
  assert.equal(run("studyKeyCaptureAction"), "");
  run('key("Escape");');
  assert.equal(run('core.$("studySettings").hidden'), true);
  assert.equal(run("shell.inert"), false);
  assert.equal(run("studyKeyCaptureAction"), "");
  assert.equal(run("studyRoomOpen"), true, "Esc closes only settings, not Study");
  assert.equal(run("document.activeElement.id"), "studySettingsBtn");
  run('studySettingsOpen({ currentTarget:core.$("studyShelfSettingsBtn") }); studyCloseSettings();');
  assert.equal(run("document.activeElement.id"), "studyShelfSettingsBtn");
  run('studySettingsOpen({ currentTarget:core.$("studyShelfSettingsBtn") }); core.$("studyShelfSettingsBtn").getClientRects = () => []; core.$("studySettingsBtn").getClientRects = () => []; studyCloseSettings();');
  assert.equal(run("document.activeElement.id"), "studyHeaderSettingsBtn", "hidden launchers fall back to the always-visible header settings");
});

test("Study settings markup has one copy of every advanced control and the requested button order", () => {
  assert.match(html, /id="studySettingsBtn"[^>]+aria-controls="studySettings"[^]*?<\/button>\s*<button id="studyFullscreenBtn"/);
  const settings = html.slice(html.indexOf('<div id="studySettings"'), html.indexOf('<div id="studyHelp"'));
  for (const id of ["studyShelfVisible", "studyManualShelfOrder", "studyFoldersFirst", "studySkipDeleteConfirm",
    "studyNextKeyBtn", "studyPreviousKeyBtn", "studyVerticalImageKeys", "studyZoomPercentStep",
    "studyFullscreenFit", "studyPageKeysTurnPages", "studyCloseOnLastPageDown", "studyMouseClickPages", "studyMouseClickFlip", "studyMiddleClickAction",
    "studyAlbumNesting", "studyEditedTextFolder", "studyChooseExportFolderBtn", "studyClearExportFolderBtn"]) {
    assert.ok(settings.includes(`id="${id}"`), id);
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} must not be duplicated`);
  }
  assert.match(settings, /role="dialog" aria-modal="true" aria-labelledby="studySettingsTitle"/);
});


test("Last-page closing defaults on, validates booleans and persists both choices", () => {
  const run = harness();
  assert.equal(run("studyPrefs.closeOnLastPageDown"), true);
  for (const [raw, expected] of [[{}, true], [{closeOnLastPageDown:false}, false],
    [{closeOnLastPageDown:true}, true], [{closeOnLastPageDown:"false"}, true], [{closeOnLastPageDown:0}, true]]) {
    run(`studyReadPrefs(${JSON.stringify(raw)}); studyRefreshPrefsUI();`);
    assert.equal(run("studyPrefs.closeOnLastPageDown"), expected);
    assert.equal(run('core.$("studyCloseOnLastPageDown").checked'), expected);
  }
  run('studyBindPref("studyCloseOnLastPageDown", "closeOnLastPageDown");');
  for (const value of [false, true]) {
    run(`core.$("studyCloseOnLastPageDown").checked = ${value}; core.$("studyCloseOnLastPageDown").change(); studyReadPrefs(saved); studyRefreshPrefsUI();`);
    assert.equal(run("saved.closeOnLastPageDown"), value);
    assert.equal(run('core.$("studyCloseOnLastPageDown").checked'), value);
  }
  assert.match(html, /id="studyCloseOnLastPageDown" type="checkbox" checked/);
  assert.ok(source.includes('studyBindPref("studyCloseOnLastPageDown", "closeOnLastPageDown")'));
});

test("Header settings opens without a selected book, even with the shelf hidden", () => {
  const run = harness();
  const header = html.slice(html.indexOf('<header class="study-header">'), html.indexOf('<div class="study-workspace">'));
  assert.match(header, /<button id="studyHeaderSettingsBtn"[^>]*aria-controls="studySettings"/);
  assert.doesNotMatch(header.match(/<button id="studyHeaderSettingsBtn"[^>]*>/)[0], /hidden|disabled/);
  assert.ok(source.includes('core.$("studyHeaderSettingsBtn").addEventListener("click", studySettingsOpen)'));
  run('studyCurrentBook = null; studyPrefs.shelfVisible = false; studySettingsOpen({ currentTarget:core.$("studyHeaderSettingsBtn") });');
  assert.equal(run('core.$("studySettings").hidden'), false);
  assert.equal(run("shell.inert"), true);
  run('key("Escape");');
  assert.equal(run("document.activeElement.id"), "studyHeaderSettingsBtn");
  assert.equal(run("studyRoomOpen"), true);
});


test("Full-screen fit is first in settings, opt-in, boolean-validated and persisted", () => {
  const run = harness();
  assert.equal(run("studyPrefs.fullscreenFit"), false);
  for (const [raw, expected] of [[{}, false], [{fullscreenFit:true}, true],
    [{fullscreenFit:false}, false], [{fullscreenFit:"true"}, false], [{fullscreenFit:1}, false]]) {
    run(`studyReadPrefs(${JSON.stringify(raw)}); studyRefreshPrefsUI();`);
    assert.equal(run('core.$("studyFullscreenFit").checked'), expected);
  }
  run('studyBindPref("studyFullscreenFit", "fullscreenFit");');
  for (const value of [true, false]) {
    run(`core.$("studyFullscreenFit").checked = ${value}; core.$("studyFullscreenFit").change(); studyReadPrefs(saved); studyRefreshPrefsUI();`);
    assert.equal(run('core.$("studyFullscreenFit").checked'), value);
  }
  assert.match(html, /class="study-settings-options">\s*<label[^>]*>\s*<input id="studyFullscreenFit" type="checkbox" aria-describedby="studyFullscreenFitHint">/);
  assert.ok(source.includes('studyBindPref("studyFullscreenFit", "fullscreenFit", () => studyApplyZoom(false))'));
});

test("Forced full-screen fit preserves the saved zoom and blocks every zoom path until exit", () => {
  const run = harness();
  run('studyCurrentBook = {kind:"image"}; studyPrefs.zoom = 2.35; studySyncZoomRow();');
  assert.equal(run('core.$("studyImageStage").style["--study-zoom"]'), '2.35');
  run('core.$("studyRoom").classList.add("study-fullimage"); studySyncZoomRow();');
  assert.equal(run('core.$("studyImageStage").dataset.fullscreenFit'), '0', 'off keeps existing full-screen zoom');
  run('studyPrefs.fullscreenFit = true; studySyncZoomRow();');
  assert.equal(run('core.$("studyImageStage").style["--study-zoom"]'), '1');
  assert.equal(run('core.$("studyImageStage").dataset.fullscreenFit'), '1');
  assert.equal(run('core.$("studyImageStage").dataset.zoomed'), '0');
  assert.equal(run('core.$("studyZoomLabel").textContent'), 'studyZoomFit');
  assert.equal(run('core.$("studyZoomIn").disabled && core.$("studyZoomOut").disabled'), true);
  run('studySetZoom(4); studySetZoom(0.5); studySetZoom(1); studyApplyZoomValue(3.141); studySavePrefs();');
  assert.equal(run("saved.zoom"), 2.35, 'buttons / wheel / keys / pinch never overwrite the original zoom');
  run('studyPrefs.imageMode = "vertical"; studySyncZoomRow();');
  assert.equal(run('core.$("studyImageStage").dataset.fullscreenFit'), '1', 'vertical mode also synchronizes the fit state');
  run('core.$("studyRoom").classList.remove("study-fullimage"); studySyncZoomRow();');
  assert.equal(run('core.$("studyImageStage").dataset.fullscreenFit'), '0');
  assert.equal(run('core.$("studyImageStage").style["--study-zoom"]'), '2.35');
  run('studySetZoom(1.5);');
  assert.equal(run("saved.zoom"), 1.5, 'zoom is usable again outside full screen');
  run('core.$("studyRoom").classList.add("study-fullimage"); studySyncZoomRow(); studyPrefs.fullscreenFit = false; studySyncZoomRow();');
  assert.equal(run('core.$("studyImageStage").dataset.fullscreenFit'), '0', 'disabling takes effect immediately');
  assert.equal(run('core.$("studyImageStage").style["--study-zoom"]'), '1.5');
});
