// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ROOT } from './helpers/browser-data.mjs';
const src = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, 'utf8');
const css = fs.readFileSync(`${ROOT}/css/style.css`, 'utf8');

test('media exit names its destination in all four languages', () => {
  for (const [lang, label] of [['ja', '曲リストに戻る'], ['en', 'Back to song list'], ['zh', '返回歌曲列表'], ['ko', '곡 목록으로 돌아가기']]) {
    const block = src.split(`Object.assign(TEXT.${lang}, {`)[1].split('\n});')[0];
    assert.ok(block.includes(`mediaClose:"← ${label}"`));
  }
  assert.match(src, /closeNode = makeButton\("mediaClose", "instClose mediaExitBtn"\);[\s\S]{0,200}?closeNode\.addEventListener\("click", \(\) => closeMedia\(\)\)/);
});

test('media header remains outside the scrollable body', () => {
  assert.match(src, /const body = core.el\("div", "instBody mediaBody"\)/);
  assert.match(src, /body.append\(display,[^;]+footer\);\s*dialog.append\(header, body\)/);
  assert.match(css, /\.mediaHeader\{flex:none;/);
  assert.match(css, /\.mediaExitBtn\{min-height:44px;/);
  assert.match(css, /\.instBody\{overflow-y:auto;min-height:0;/);
});

test('keyboard exit keeps confirmation cancellation and opt-out behavior', () => {
  const fn = src.match(/function requestMediaExit\(\) \{[\s\S]*?\n\}/)[0];
  let closed = 0, prompts = 0, accepted = false;
  const settings = { mediaExitConfirm: true };
  const context = vm.createContext({ core: { settings }, closeMedia: () => closed++, tr: x => x,
    confirm: () => { prompts++; return accepted; } });
  vm.runInContext(fn, context);
  vm.runInContext('requestMediaExit()', context);
  assert.equal(closed, 0);
  accepted = true;
  vm.runInContext('requestMediaExit()', context);
  assert.equal(closed, 1);
  settings.mediaExitConfirm = false;
  vm.runInContext('requestMediaExit()', context);
  assert.equal(closed, 2);
  assert.equal(prompts, 2);
});
