// SPDX-License-Identifier: GPL-3.0-or-later
/* 見やすさのスキン（cat: access）と生活のスキン（cat: life）の配色を node --test で検査する。
 *   見やすさ：文字のコントラスト、形と輝度による区別（色覚配慮）。生活：文字のコントラストだけ。
 *
 *   node --test tests/        または   npm test
 *
 * js/data.js の SKINS を vm で読み込み、WCAG 2.x の相対輝度とコントラスト比で確かめる。
 * 対象は不透明な色（#rrggbb）だけ。rgba の半透明は、この検査では扱わない。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const sb = { console, Math, Array, Object, Number, String, JSON, Set, Map, Date, window: {} };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8"), sb, { filename: "js/data.js" });
const SKINS = sb.window.SKINS;

const ACCESS = Object.keys(SKINS).filter(id => Array.isArray(SKINS[id].cat) && SKINS[id].cat.includes("access"));
const LIFE = Object.keys(SKINS).filter(id => Array.isArray(SKINS[id].cat) && SKINS[id].cat.includes("life"));
/* ①ゲーム画面の追加分（水墨・楽譜・ドット絵の夜・霧の森）。文字のコントラストだけ検査する */
const ART = ["sumi", "score", "dotNight", "mistForest"];

/* WCAG 2.x の相対輝度（#rrggbb） */
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

describe("見やすさのスキン（access）", () => {
  test("3種が登録され、カテゴリ access に入る", () => {
    assert.deepEqual(ACCESS.sort(), ["cbDark", "cbLight", "hc"]);
  });

  test("生活のテーマ6種が登録され、カテゴリ life に入る", () => {
    assert.deepEqual(LIFE.sort(), ["morningKitchen", "nightBath", "rainWindow", "shojiLight", "shoutengai", "stationDusk"]);
  });

  test("本文の文字は背景に対して 4.5:1 以上（WCAG 本文の基準）", () => {
    for (const id of [...ACCESS, ...LIFE, ...ART]) {
      const { ui, game } = SKINS[id];
      assert.ok(ratio(ui["--ui-text"], ui["--ui-bg"]) >= 4.5, `${id}: 本文 ${ratio(ui["--ui-text"], ui["--ui-bg"]).toFixed(2)}`);
      assert.ok(ratio(ui["--ui-muted"], ui["--ui-bg"]) >= 4.5, `${id}: 補足 ${ratio(ui["--ui-muted"], ui["--ui-bg"]).toFixed(2)}`);
      assert.ok(ratio(ui["--ui-on-accent"], ui["--ui-accent"]) >= 4.5, `${id}: ボタンの文字 ${ratio(ui["--ui-on-accent"], ui["--ui-accent"]).toFixed(2)}`);
      assert.ok(ratio(game.ink, game.stage) >= 4.5, `${id}: 譜面の文字 ${ratio(game.ink, game.stage).toFixed(2)}`);
    }
  });

  test("①の追加分4種が登録されている", () => {
    for (const id of ART) assert.ok(SKINS[id], id);
  });

  test("高コントラストは、本文が 7:1 以上（WCAG の強化の基準）", () => {
    const { ui, game } = SKINS.hc;
    assert.ok(ratio(ui["--ui-text"], ui["--ui-bg"]) >= 7);
    assert.ok(ratio(game.ink, game.stage) >= 7);
  });

  test("ノーツの「ドン」と「カッ」は、形を変えて区別する（色だけに頼らない）", () => {
    for (const id of ACCESS) {   // 形の区別は色覚配慮の要件（生活系は対象外）
      const { shapes } = SKINS[id];
      assert.notEqual(shapes[0], shapes[1], `${id}: 形が同じ`);
    }
  });

  test("ノーツの2色は、輝度にも差がある（白黒で見ても区別できる）", () => {
    for (const id of ACCESS) {   // 輝度の差も色覚配慮の要件（生活系は対象外）
      const { don, ka } = SKINS[id].game;
      assert.ok(Math.abs(lum(don) - lum(ka)) >= 0.1 || ratio(don, ka) >= 2, `${id}: ${don} と ${ka} の差が小さい`);
    }
  });

  test("「見やすさ」の表示名は4言語にある（i18n.js の catAccess）", () => {
    const i18n = fs.readFileSync(path.join(ROOT, "js/i18n.js"), "utf8");
    assert.equal((i18n.match(/catAccess:/g) || []).length, 4);
  });
});
