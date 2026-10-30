// SPDX-License-Identifier: GPL-3.0-or-later
/* tools/globals-audit.mjs（名前空間の棚卸し）の字句処理を node --test で検査する。
 * 監査の結果が信用できないと、名前空間の移行で「使われていない」と誤判定して壊すため、先に字句処理を固める。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stripCode, topLevelNames, identifiers, classicScriptOrder } from "../tools/globals-audit.mjs";

describe("字句処理（stripCode）", () => {
  test("コメントと文字列の中の名前は参照に数えない", () => {
    const ids = identifiers(stripCode(`// hidden
/* alsoHidden */
const s = "quotedName"; const t = 'singleName';
realName();`));
    assert.ok(ids.has("realName"));
    assert.ok(!ids.has("hidden") && !ids.has("alsoHidden") && !ids.has("quotedName") && !ids.has("singleName"));
  });
  test("テンプレート文字列の ${ } の中の名前は参照に数える", () => {
    const ids = identifiers(stripCode("const x = `plain text ${insideTemplate} more ${tr(\"k\")}`;"));
    assert.ok(ids.has("insideTemplate") && ids.has("tr"));
    assert.ok(!ids.has("plain") && !ids.has("text"));
  });
  test("プロパティ参照（a.b の b）は参照に数えない", () => {
    const ids = identifiers(stripCode("obj.propName = realFn(other.x);"));
    assert.ok(!ids.has("propName") && !ids.has("x"));
    assert.ok(ids.has("realFn") && ids.has("obj"));
  });
  test("正規表現リテラルの中の文字は名前として数えない（割り算とは区別する）", () => {
    const ids = identifiers(stripCode("const re = /fakeName\\/x[/]y/g; const q = total / divisor;"));
    assert.ok(!ids.has("fakeName"));
    assert.ok(ids.has("total") && ids.has("divisor"));
  });
});

describe("トップレベル宣言（topLevelNames）", () => {
  test("深さ0の function／const／let／class を拾う", () => {
    const names = topLevelNames(stripCode(`function alpha() {}
const beta = 1;
let gamma = () => { const inner = 2; };
class Delta {}
`));
    assert.deepEqual(names, ["Delta", "alpha", "beta", "gamma"]);
  });
  test("即時関数で包んだファイルは、包みの中身も包みの外も、トップレベルとして数える", () => {
    const names = topLevelNames(stripCode(`(() => {
const hiddenInIife = 1;
function alsoHidden() {}
})();
const visible = 2;
`));
    assert.deepEqual(names, ["alsoHidden", "hiddenInIife", "visible"]);
  });
  test("カンマで続く宣言（const a = 1, b = 2;）の2つ目も拾う", () => {
    const names = topLevelNames(stripCode("const first = 1, second = [3, 4], third = { k: 5 };"));
    assert.deepEqual(names, ["first", "second", "third"]);
  });
  test("式の中の function 式は、宣言として数えない", () => {
    const names = topLevelNames(stripCode("const handler = function namedExpr() { return 1; };"));
    assert.deepEqual(names, ["handler"]);
  });
  test("分割代入の名前も拾う", () => {
    const names = topLevelNames(stripCode("const { aa, bb: renamed } = source;"));
    assert.ok(names.includes("aa") && names.includes("bb"));
  });
});

describe("index.html の読み込み順（classicScriptOrder）", () => {
  test("module／importmap は除き、HTML コメント内の例は読まない", () => {
    const html = `<script type="importmap">{}</script>
<!-- <script src="js/example-only.js"></script> -->
<script src="js/a.js"></script>
<script type="module" src="js/m.js"></script>
<script>const inlineOne = 1;</script>
<script src="https://cdn.example/x.js"></script>
<script src="js/b.js"></script>`;
    const names = classicScriptOrder(html).map(s => s.name);
    assert.deepEqual(names, ["js/a.js", "index.html(inline)", "js/b.js"]);
  });
});
