// SPDX-License-Identifier: GPL-3.0-or-later
/* Esc長押しで選曲画面へ戻る（❓謎設定 escNoReturn で止められる。既定はオン）。
   js/main.js の該当部分だけを取り出し、疑似タイマーで動きを確かめる。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
const start = mainSource.indexOf("const ESC_HOLD_MS");
const end = mainSource.indexOf('addEventListener("keydown"');
const holdLogic = mainSource.slice(start, end);

function makeHold({ phase = "playing", escNoReturn = false, overlay = false } = {}) {
  const timers = [];
  const calls = { toTitle: 0 };
  const core = { phase, settings: { escNoReturn } };
  const sandbox = {
    core,
    window: { Trk: { overlay: { any: () => overlay }, play: { toTitle() { calls.toTitle++; } } } },
    setTimeout(fn, ms) { timers.push({ fn, ms, cleared: false }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${holdLogic}\nglobalThis.escHoldStart = escHoldStart; globalThis.escHoldCancel = escHoldCancel; globalThis.ESC_HOLD_MS = ESC_HOLD_MS;`, context);
  const fire = () => { for (const t of timers) if (!t.cleared) { t.cleared = true; t.fn(); } };
  return { core, calls, timers, fire, hold: context };
}

test("long press returns to song select by default, without a confirm", () => {
  const s = makeHold();
  s.hold.escHoldStart();
  assert.equal(s.timers.length, 1);
  assert.equal(s.timers[0].ms, 1000);
  s.fire();
  assert.equal(s.calls.toTitle, 1);
});

test("a short press (released before the hold time) does not return", () => {
  const s = makeHold();
  s.hold.escHoldStart();
  s.hold.escHoldCancel();
  s.fire();
  assert.equal(s.calls.toTitle, 0);
});

test("the checkbox 'do not return' turns the hold off entirely", () => {
  const s = makeHold({ escNoReturn: true });
  s.hold.escHoldStart();
  assert.equal(s.timers.length, 0);
  assert.equal(s.calls.toTitle, 0);
});

test("paused and result screens also return; title and open overlays do not", () => {
  for (const phase of ["paused", "ended"]) {
    const s = makeHold({ phase });
    s.hold.escHoldStart(); s.fire();
    assert.equal(s.calls.toTitle, 1, phase);
  }
  const title = makeHold({ phase: "title" });
  title.hold.escHoldStart(); title.fire();
  assert.equal(title.calls.toTitle, 0);
  const study = makeHold({ overlay: true });
  study.hold.escHoldStart(); study.fire();
  assert.equal(study.calls.toTitle, 0);
});

test("starting again replaces the pending timer (no double return)", () => {
  const s = makeHold();
  s.hold.escHoldStart(); s.hold.escHoldStart();
  assert.equal(s.timers[0].cleared, true);
  s.fire();
  assert.equal(s.calls.toTitle, 1);
});

test("the keydown wiring only starts the hold for trusted, non-repeat Escape", () => {
  assert.match(mainSource, /if \(code === "Escape" && e\.isTrusted && !e\.repeat\) escHoldStart\(\);/);
  assert.match(mainSource, /if \(e\.code === "Escape"\) escHoldCancel\(\);/);
  assert.match(mainSource, /addEventListener\("blur", \(\) => \{ cancelRetryHold\(\); escHoldCancel\(\); \}\);/);
});

test("the option is a default-off 'do not return' flag, listed under the mystery settings", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const mysteryAt = html.indexOf('data-i18n="secMystery"');
  const escAt = html.indexOf('id="escNoReturn"');
  assert.ok(mysteryAt >= 0 && escAt > mysteryAt, "the checkbox sits below the mystery heading");
  assert.ok(html.indexOf('id="swayAllModes"') < escAt, "and after the existing mystery option");
  const core = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
  assert.match(core, /escNoReturn: prefs\.escNoReturn === true/);
  const opts = fs.readFileSync(path.join(root, "js/i18n-options.js"), "utf8");
  assert.equal((opts.match(/escNoReturn:"/g) || []).length, 4, "four languages");
  assert.equal((opts.match(/escNoReturnHint:"/g) || []).length, 4, "four languages");
});
