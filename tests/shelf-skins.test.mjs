// SPDX-License-Identifier: GPL-3.0-or-later
/* trk87で足した棚スキン6種（色覚配慮3・ビビット3）のタブの文字と背景の対比を node --test で検査する。
 *   css/style.css の #libPanel[data-lib-skin="…"] .libTab の単色（#rrggbb）の background と color を対にして、
 *   4.5:1 以上（WCAG の本文の基準）を確かめる。模様（gradient）の指定は、この検査では扱わない（目視で確認）。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers/browser-data.mjs";

const css = fs.readFileSync(path.join(ROOT, "css/style.css"), "utf8");
const NEW = ["okabe", "pattern", "signage", "popart", "rainbow", "tropical"];

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
/* 棚のタブの規則（.libTab 本体・nth-child・選択中）を、スキンごとに読む */
function tabRules(id) {
  const re = new RegExp(`#libPanel\\[data-lib-skin="${id}"\\] \\.libTab((?::nth-child\\([^)]*\\))?(?:\\[aria-selected="true"\\])?)\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map(m => ({ sel: m[1], body: m[2] }));
}

describe("棚スキン（trk87の6種）のタブの文字", () => {
  test("6種が登録されている（棚は合計30種）", () => {
    for (const id of NEW) assert.ok(tabRules(id).length > 0, `${id} の規則が見つからない`);
  });
  for (const id of NEW) {
    test(`${id}：単色の背景と文字が 4.5:1 以上`, () => {
      for (const { sel, body } of tabRules(id)) {
        const bg = /(?:^|;|\s)background(?:-color)?:\s*(#[0-9a-f]{6})\s*(?:;|$)/i.exec(body);
        const fg = /(?:^|;|\s)color:\s*(#[0-9a-f]{6})\s*(?:;|$)/i.exec(body);
        if (!bg || !fg) continue;
        const r = ratio(fg[1], bg[1]);
        assert.ok(r >= 4.5, `${id} ${sel || "(本体)"}: ${r.toFixed(2)}`);
      }
    });
  }
});

/* 棚の整合性：定義（LIB_SKINS）・並び順（LIB_SKIN_ORDER）・見た目（CSS）が、同じ30種で揃っている */
describe("棚スキンの整合性", () => {
  const lib = fs.readFileSync(path.join(ROOT, "js/lib-skins.js"), "utf8");
  const keys = [...lib.matchAll(/^  ([a-z]+):\s*\{ icon/gm)].map(m => m[1]);
  const order = JSON.parse("[" + lib.match(/const LIB_SKIN_ORDER = \[([^\]]+)\]/)[1] + "]");
  test("定義と並び順が同じ集合で、重複がない", () => {
    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual([...order].sort(), [...keys].sort());
    assert.equal(order.length, 30);
  });
  test("すべての棚に、見た目の CSS がある", () => {
    for (const id of order) assert.ok(css.includes(`data-lib-skin="${id}"`), `${id} に CSS がない`);
  });
  test("かんたん表示の上位6種は、すべて並び順の中にある", () => {
    const top = JSON.parse("[" + lib.match(/const LIB_SKIN_SIMPLE_TOP = \[([^\]]+)\]/)[1] + "]");
    for (const id of top) assert.ok(order.includes(id), id);
    assert.equal(top.length, 6);
  });
});
