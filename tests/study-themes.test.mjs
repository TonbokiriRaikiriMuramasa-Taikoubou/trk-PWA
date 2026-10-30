// SPDX-License-Identifier: GPL-3.0-or-later
/* 書斎の文字スキンのうち、trk86で足した6種の文字と背景の対比を node --test で検査する。
 *   本文（ink と page）・編集欄（editor-ink と editor）ともに 4.5:1 以上（WCAG の本文の基準）。
 *   対象は css/study-room.css の `.study-text-stage[data-theme="…"]` の不透明な #rrggbb だけ。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers/browser-data.mjs";

const css = fs.readFileSync(path.join(ROOT, "css/study-room.css"), "utf8");
const NEW = ["sticky", "letter", "diary", "haiku", "newspaper", "staff"];

function vars(id) {
  const m = css.match(new RegExp(`\\.study-text-stage\\[data-theme="${id}"\\]\\{([^}]*)\\}`));
  assert.ok(m, `${id}: CSS ブロックが見つからない`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--study-theme-([a-z-]+):\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}
function lum(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  assert.ok(m, `不透明な #rrggbb ではない色: ${hex}`);
  const c = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("書斎の文字スキン（trk86の6種）", () => {
  for (const id of NEW) {
    test(`${id}：本文と編集欄の文字が 4.5:1 以上`, () => {
      const v = vars(id);
      assert.ok(ratio(v.ink, v.page) >= 4.5, `${id} 本文 ${ratio(v.ink, v.page).toFixed(2)}`);
      assert.ok(ratio(v["editor-ink"], v.editor) >= 4.5, `${id} 編集欄 ${ratio(v["editor-ink"], v.editor).toFixed(2)}`);
    });
  }
});
