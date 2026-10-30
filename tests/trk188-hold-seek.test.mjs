// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ROOT } from './helpers/browser-data.mjs';
const src = fs.readFileSync(`${ROOT}/js/video-max.js`, 'utf8');
function setup() {
  let next = 0;
  const timers = new Map();
  const video = { duration: 100, currentTime: 50 };
  const note = { hidden: true };
  const context = vm.createContext({ videoEl: video, document: { hidden: false }, isOn: true,
    playedByUs: true, seekNode: note, pokeChrome() {},
    stage: { getBoundingClientRect: () => ({ left: 0, width: 300 }) },
    setTimeout(fn, ms) { timers.set(++next, { fn, ms }); return next; }, clearTimeout(id) { timers.delete(id); } });
  const seek = src.match(/function seekBy\(delta\) \{[\s\S]*?\n\}/)[0];
  const code = src.slice(src.indexOf('let holdPointer ='), src.indexOf('function pokeChrome()'));
  vm.runInContext(`${seek}\n${code}`, context);
  const run = text => vm.runInContext(text, context);
  const down = (x = 20) => { context.e = { pointerId: 1, clientX: x, clientY: 50, button: 0, isPrimary: true }; run('startHoldSeek(e)'); };
  const tick = () => { const [id, timer] = [...timers][0]; timers.delete(id); timer.fn(); };
  return { context, video, note, timers, run, down, tick };
}
test('hold delays, seeks left/right, accelerates with a cap, and clamps to duration', () => {
  for (const [x, expected] of [[20, 48], [280, 52]]) {
    const s = setup(); s.down(x);
    assert.equal(s.video.currentTime, 50);
    assert.equal([...s.timers.values()][0].ms, 450);
    s.tick(); assert.equal(s.video.currentTime, expected);
    assert.equal(s.note.hidden, false);
    assert.equal(s.run('suppressHoldClick'), true);
    assert.equal([...s.timers.values()][0].ms, 250);
    for (let i = 0; i < 100; i++) s.tick();
    assert.equal(s.video.currentTime, x < 150 ? 0 : 100);
    assert.equal(s.run('holdSeekStep(10000)'), 20);
    assert.equal(s.run('holdSeekStep(0)'), 2);
    assert.equal(s.run('holdSeekStep(8)'), 4);
    assert.equal(s.context.playedByUs, false);
  }
});
test('short taps, release, movement, secondary pointers and hidden page cancel safely', () => {
  const s = setup(); s.down(); s.run('endHoldSeek(e)');
  assert.equal(s.timers.size, 0); assert.equal(s.video.currentTime, 50);
  assert.equal(s.run('suppressHoldClick'), false);
  s.down(); s.tick(); s.run('endHoldSeek(e)');
  assert.equal(s.timers.size, 0); assert.equal(s.note.hidden, true);
  assert.equal(s.run('suppressHoldClick'), true);
  s.down(); s.context.e.clientX += 25; s.run('moveHoldSeek(e)');
  assert.equal(s.timers.size, 0);
  s.down(); s.run('startHoldSeek({...e, pointerId:2, isPrimary:false})');
  assert.equal(s.timers.size, 0);
  s.down(); s.context.document.hidden = true; s.tick();
  assert.equal(s.timers.size, 0);
  s.video.duration = Infinity; s.down(); assert.equal(s.timers.size, 0);
});
test('gesture wiring blocks context menu and click after hold, and cleans up lifecycle events', () => {
  for (const text of ['"contextmenu", e => e.preventDefault()', '"pointercancel"', '"blur", stopHoldSeek', '"visibilitychange"', '"emptied", stopHoldSeek', '"loadstart", stopHoldSeek', 'on("songSelected", stopHoldSeek)', 'e.preventDefault(); e.stopImmediatePropagation();']) assert.ok(src.includes(text), text);
  assert.match(src, /function closeMax\(\) \{[\s\S]*?stopHoldSeek\(\)/);
  const css = fs.readFileSync(`${ROOT}/css/style.css`, 'utf8');
  assert.match(css, /\.videoMaxStage\{[^}]*touch-action:none;[^}]*-webkit-touch-callout:none/s);
  assert.equal((src.match(/videoMaxHint:.*(?:長押し|Hold left|长按|길게 누르기)/g) || []).length, 4);
});
