// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ROOT } from './helpers/browser-data.mjs';
const src = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, 'utf8');

test('Base entry uses the existing media player and an accessible button beside Study Room', () => {
  const html = fs.readFileSync(`${ROOT}/index.html`, 'utf8');
  assert.match(html, /id="mediaOpenBtn"[^>]*type="button"[^>]*aria-haspopup="dialog"[^>]*aria-controls="mediaPlayerMode"/);
  assert.ok(html.indexOf('id="mediaOpenBtn"') < html.indexOf('id="studyOpenBtn"'));
  assert.match(src, /mediaOpenBtn.addEventListener\("click", openMedia\)/);
  assert.match(src, /core.on\("language", \(\) => \{\s*syncMediaOpenBtn\(\)/);
  assert.match(src, /if \(!overlay \|\| mediaOpen \|\|/);
  assert.match(src, /mediaReturnFocus.isConnected\) mediaReturnFocus.focus\(\)/);
});

test('Base label and hint follow all four languages, with a missing-button guard', () => {
  const fn = src.match(/function syncMediaOpenBtn\(\) \{[\s\S]*?\n\}/)[0];
  let button = {};
  const context = vm.createContext({ document: { getElementById: () => button }, tr: null });
  vm.runInContext(fn, context);
  for (const lang of ['ja', 'en', 'zh', 'ko']) {
    const block = src.split(`Object.assign(TEXT.${lang}, {`)[1].split('\n});')[0];
    const label = block.match(/mediaOpenBtn:"([^"]+)"/)[1];
    const hint = block.match(/mediaOpenBtnHint:"([^"]+)"/)[1];
    context.tr = key => key === 'mediaOpenBtn' ? label : hint;
    vm.runInContext('syncMediaOpenBtn()', context);
    assert.equal(button.textContent, label);
    assert.equal(button.title, hint);
  }
  button = null;
  assert.doesNotThrow(() => vm.runInContext('syncMediaOpenBtn()', context));
});
