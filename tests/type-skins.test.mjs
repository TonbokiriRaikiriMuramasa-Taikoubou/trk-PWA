// SPDX-License-Identifier: GPL-3.0-or-later
/* 書体（フォント）スキン（trk228）の検査。
 *
 *   方針：フォントは同梱せず、外部からも読みません（CDN・外部APIの禁止）。
 *   端末に入っている書体を名前で指定し、書体そのものが無い端末でも
 *   太さ・字間・行間・大文字化の違いが出るようにしてあります。
 *
 *   node --test tests/    または   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const sandbox = {
  console, Math, Array, Object, Number, String, JSON, Set, Map, Date,
  window: {},
  TEXT: { ja:{}, en:{}, zh:{}, ko:{} },
  tr: () => "",
  document: { getElementById: () => null },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8"), sandbox, { filename: "js/data.js" });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/characters/miku.js"), "utf8"), sandbox, { filename: "js/characters/miku.js" });
const { SKINS } = sandbox.window.Trk.data;

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const css = read("css/style.css");
const core = read("js/core.js");
const i18n = read("js/i18n.js");

const TYPE_IDS = Object.keys(SKINS).filter(id => Array.isArray(SKINS[id].cat) && SKINS[id].cat.includes("type"));
const PLAIN_IDS = Object.keys(SKINS).filter(id => !TYPE_IDS.includes(id));

describe("書体スキン（trk228）", () => {
  test("9種が登録され、すべてカテゴリ type に入る", () => {
    assert.deepEqual(TYPE_IDS.sort(), [
      "typeGothicHeavy", "typeKaisho", "typeKyokasho", "typeMarugo", "typeMincho",
      "typeNewspaper", "typeOldstyle", "typePop", "typeTypewriter",
    ]);
  });

  test("既存のスキンには type が付かない（見た目はこれまでどおり）", () => {
    assert.equal(PLAIN_IDS.length, 44);
    for (const id of PLAIN_IDS) assert.equal(SKINS[id].type, undefined, `${id} に type が付いています`);
  });

  test("どの書体スキンにも本文の書体と見本の文字がある", () => {
    for (const id of TYPE_IDS) {
      const s = SKINS[id];
      assert.ok(typeof s.font === "string" && s.font.length > 0, `${id}: font がない`);
      assert.ok(typeof s.type.mark === "string" && s.type.mark.length > 0, `${id}: 見本の文字がない`);
      assert.match(s.type.mark, /[ぁ-んァ-ヶ一-龠]/, `${id}: 見本に和文がない`);
      assert.match(s.type.mark, /[A-Za-z]/, `${id}: 見本に欧文がない`);
    }
  });

  test("書体の指定に外部URL・@font-face を含まない（CDNを読みに行かない）", () => {
    for (const id of TYPE_IDS) {
      const s = SKINS[id];
      for (const v of [s.font, s.type.title, s.type.mark]) {
        if (typeof v !== "string") continue;
        assert.doesNotMatch(v, /https?:|url\(|@font-face|fonts\.googleapis/i, `${id}: 外部から書体を読もうとしています`);
      }
    }
    assert.doesNotMatch(JSON.stringify(SKINS), /@font-face/, "SKINS に @font-face を書かない（同梱するときは css 側で別に足す）");
  });

  test("書体が無い端末でも差が出るよう、太さ・字間・行間を持つ", () => {
    for (const id of TYPE_IDS) {
      const t = SKINS[id].type;
      assert.match(String(t.lh), /^\d(\.\d+)?$/, `${id}: 行間が数値文字列でない`);
      assert.match(String(t.weight), /^\d{3}$/, `${id}: 本文の太さが 100〜900 の数値でない`);
      assert.match(String(t.titleWeight), /^\d{3}$/, `${id}: 見出しの太さが 100〜900 の数値でない`);
      assert.match(String(t.titleSpace), /^-?[\d.]+(em|px)$/, `${id}: 見出しの字間が em/px でない`);
      if (t.titleTransform !== undefined) assert.match(t.titleTransform, /^(none|uppercase|lowercase)$/, `${id}: 大文字化の値`);
      if (t.title !== undefined) assert.equal(typeof t.title, "string", `${id}: 見出しの書体が文字列でない`);
    }
  });

  test("棚のチップに書体のカテゴリがあり、4言語の名前がある", () => {
    assert.match(core, /\["type","catType"\]/, "SKIN_CATS に type がない");
    for (const lang of ["ja", "en", "zh", "ko"]) {
      assert.match(i18n, new RegExp(`catType:"[^"]+"`), `${lang}: catType がない`);
    }
    assert.equal((i18n.match(/catType:/g) || []).length, 4, "catType は4言語ぶん");
  });

  test("スキンの棚カードに見本の文字を出し、カードの中だけ書体を変える", () => {
    assert.match(core, /function skinSpecNode\(/, "見本の文字を作る関数がない");
    assert.match(core, /skinSpecNode\(s\)/, "棚カードが見本の文字を出していない");
    assert.match(core, /--sk-font/, "棚カードに本文の書体を渡していない");
    assert.match(css, /\.skinSpec\{[^}]*font-family:var\(--sk-title/, "見本に書体が効かない");
    assert.match(css, /\.skinCard\{[^}]*font-family:var\(--sk-font/, "棚カードに書体が効かない");
    assert.match(core, /--sk-note", "var\(--font\)"/, "書体スキンの説明文が本文の書体に戻っていない");
    assert.match(css, /\.skinCard small\{[^}]*font-family:var\(--sk-note,inherit\)/, "説明文の書体が切り替えられない");
  });

  test("スキンを当てると見出しと本文の書体変数が切り替わる", () => {
    for (const key of ["--font-title", "--font-title-weight", "--font-title-space", "--font-title-transform", "--font-weight", "--font-lh"]) {
      assert.ok(core.includes(`setProperty("${key}"`), `applySkin が ${key} を設定していない`);
    }
    assert.match(css, /h1,h2,\.bannerTitle\{[^}]*font-family:var\(--font-title\)/, "見出しに書体が効かない");
    assert.match(css, /body\{font-weight:var\(--font-weight\);line-height:var\(--font-lh\)\}/, "本文の太さ・行間が効かない");
    // 持っていないスキンは inherit（＝これまでと同じ見た目）に戻す。
    // 見出しの太さだけは `revert`（h1/h2 のブラウザ既定の太字に戻す。inherit だと細くなる）
    for (const key of ["--font-title", "--font-title-space", "--font-weight", "--font-lh"]) {
      assert.ok(new RegExp(`setProperty\\("${key}"[^;]*\\|\\| "inherit"`).test(core), `${key} の既定が inherit でない`);
    }
    assert.match(core, /setProperty\("--font-title-weight"[^;]*\|\| "revert"/, "--font-title-weight の既定が revert でない");
    assert.match(css, /--font-title-weight:revert/, ":root の --font-title-weight が revert でない");
  });

  test("見本の文字は、書体スキンでだけ出す", () => {
    for (const id of PLAIN_IDS) {
      const spec = typeof SKINS[id].type === "object" ? SKINS[id].type.mark : undefined;
      assert.equal(spec, undefined, `${id}: 書体スキンではないのに見本がある`);
    }
  });
});
