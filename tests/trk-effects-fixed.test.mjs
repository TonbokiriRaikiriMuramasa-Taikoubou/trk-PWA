// SPDX-License-Identifier: GPL-3.0-or-later
/* ✨ TRKエフェクト（js/tv-rich.js の独立カテゴリー）の20種を固定する。
 *   中身は js/tv-presets.js の「人物・肌色／アニメ・セル／質感／スタジオ・高画質」各5種。
 *   ここは増やさず、入れ替えず、並べ替えない。映像フィルターの新しい案は別の分類に入れる。
 *   変えるときは、この一覧と docs/SKIN-PLAN.md §4 を同時に直し、利用者の確認を取る。
 *   node --test tests/ で実行。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const FIXED = [
  "portrait_natural", "portrait_soft", "portrait_warm", "portrait_matte", "portrait_studio",
  "anime_clear", "anime_cel", "anime_pastel", "anime_night", "anime_print",
  "texture_finegrain", "texture_paper", "texture_halftone", "texture_softglow", "texture_velvet",
  "quality_balanced", "quality_clean", "quality_highlight", "quality_open", "quality_cinema",
];
const RICH_CATS = ["portrait", "anime", "texture", "quality"];

const src = fs.readFileSync(path.join(ROOT, "js/tv-presets.js"), "utf8").replace(/^\s*\/\/.*$/gm, "");
const sb = {};
vm.createContext(sb);
vm.runInContext(src + "\n;globalThis.P = TRK_TV_PRESETS;", sb);
const P = [...sb.P];

describe("✨ TRKエフェクトの20種（固定）", () => {
  test("ID と並び順が固定の一覧と一致する", () => {
    const rich = P.filter(p => RICH_CATS.includes(p.cat)).map(p => p.id);
    assert.deepEqual(rich, FIXED);
  });
  test("各分類は5種ずつ（増減しない）", () => {
    for (const cat of RICH_CATS) assert.equal(P.filter(p => p.cat === cat).length, 5, cat);
  });
  test("tv-rich.js は、この20種だけを参照する（別の分類を混ぜない）", () => {
    const rich = fs.readFileSync(path.join(ROOT, "js/tv-rich.js"), "utf8");
    assert.ok(/cat|RICH|portrait|anime|texture|quality/.test(rich), "tv-rich.js の参照の仕組みが見つからない");
    /* skin（スキン標準）と off（切）は、戻り先として参照するだけで、TRKエフェクトの対象ではない */
    const BACK_REFS = new Set(["skin", "off"]);
    for (const p of P.filter(q => !RICH_CATS.includes(q.cat) && !BACK_REFS.has(q.id))) {
      assert.ok(!rich.includes(`"${p.id}"`), `${p.id} は TRKエフェクトに入れない`);
    }
  });
});
