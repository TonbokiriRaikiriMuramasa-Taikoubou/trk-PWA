// SPDX-License-Identifier: GPL-3.0-or-later
/* trk198: 🔍 設定の検索（絞り込み）。
   ⚙ 設定は details 13個・入力 104個まで増えたので、言葉で絞れるようにする。
   隠したものは「元の hidden / open」を覚えておき、空にしたら元どおりに戻すこと。
   main.js の3つの関数をそのまま VM で動かし、偽の DOM で確かめる。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const mainSrc = fs.readFileSync(`${ROOT}/js/main.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");

/* ---------- 置き場所 ---------- */
test("trk198: the search box sits at the top of the settings screen", () => {
  const box = html.match(/<input id="settingsSearch"[^>]*>/)[0];
  assert.ok(box.includes('type="search"'), "検索欄");
  assert.ok(box.includes('data-i18n-placeholder="settingsSearchPlaceholder"'), "説明は4言語");
  assert.ok(box.includes('aria-label') || box.includes('data-i18n-aria'), "読み上げ名（aria）");
  assert.ok(html.includes('id="settingsSearchStatus"'), "件数の表示");
  assert.ok(html.indexOf('id="settingsSearch"') > html.indexOf('id="settingsScreen"'), "設定の中");
  assert.ok(html.indexOf('id="settingsSearch"') < html.indexOf('class="grid"', html.indexOf('id="settingsScreen"')), "一覧より前");
  assert.ok(cssSrc.includes(".setSearch input{"), "見た目");
});

test("trk198: placeholders follow the selected language too", () => {
  assert.ok(/\[data-i18n-placeholder\]/.test(coreSrc), "data-i18n-placeholder を訳す");
  assert.ok(/n\.placeholder = tr\(n\.dataset\.i18nPlaceholder\)/.test(coreSrc));
  for (const key of ["settingsSearchPlaceholder", "settingsSearchCount", "settingsSearchNoResults"])
    assert.equal((i18nSrc.match(new RegExp(`\\b${key}:"`, "g")) || []).length, 4, `${key} は4言語`);
});

/* ---------- 動かす（偽の DOM） ---------- */
function harness() {
  const mk = (tagName, text, children = [], subs = []) => ({
    tagName, textContent: text, children, hidden: false, open: tagName === "DETAILS",
    querySelectorAll: sel => (sel === "details.subPanel" ? subs : []),
  });
  const rowVolume = mk("LABEL", "音量");
  const rowKey = mk("LABEL", "キー");
  const subMidi = mk("DETAILS", "MIDI 音色", [], []);
  const rowBright = mk("LABEL", "明るさ");
  const sound = mk("DETAILS", "サウンド 音量 キー MIDI 音色", [rowVolume, rowKey, subMidi], [subMidi]);
  const display = mk("DETAILS", "表示 明るさ", [rowBright], []);
  const panels = [sound, display];
  sound.open = true; display.open = false;   /* 元の開閉：サウンドは開いている、表示は閉じている */

  const box = { value: "" }, status = { textContent: "" };
  const parts = mainSrc.slice(mainSrc.indexOf("const setSearchSaved = new Map();"), mainSrc.indexOf("(() => {\n  const box = core.$(\"settingsSearch\");"));
  const ctx = vm.createContext({
    core: { $: id => id === "settingsSearch" ? box : id === "settingsSearchStatus" ? status : null },
    document: { querySelectorAll: sel => (sel === "#settingsScreen .grid details.panel" ? panels : []) },
    tr: (key, vars) => (vars && vars.n !== undefined ? `${key}:${vars.n}` : key),
  });
  vm.runInContext(`${parts}\nthis.__apply = applySettingsSearch; this.__clear = setSearchClear;`, ctx);
  return { sound, display, rowVolume, rowKey, subMidi, rowBright, box, status, apply: ctx.__apply, clear: ctx.__clear };
}

test("trk198: typing narrows the panels and rows, and opens what matched", () => {
  const h = harness();
  h.box.value = "MIDI";
  h.apply();
  assert.equal(h.sound.hidden, false);
  assert.equal(h.display.hidden, true, "関係ない欄は閉じる");
  assert.equal(h.subMidi.hidden, false);
  assert.equal(h.subMidi.open, true, "見つけた中身は開く");
  assert.equal(h.rowVolume.hidden, true, "関係ない行も隠す");
  assert.equal(h.rowKey.hidden, true);
  assert.equal(h.status.textContent, "settingsSearchCount:1");
});

test("trk198: clearing the box restores everything exactly as it was", () => {
  const h = harness();
  h.box.value = "明るさ";
  h.apply();
  assert.equal(h.sound.hidden, true);
  assert.equal(h.display.hidden, false);
  assert.equal(h.display.open, true);
  h.box.value = "";
  h.apply();
  assert.equal(h.sound.hidden, false, "隠した欄は戻す");
  assert.equal(h.display.hidden, false);
  assert.equal(h.subMidi.hidden, false);
  assert.equal(h.rowVolume.hidden, false);
  assert.equal(h.rowKey.hidden, false);
  assert.equal(h.display.open, false, "元から閉じていた欄は閉じたままに戻す");
  assert.equal(h.status.textContent, "", "件数も消す");
  h.box.value = "zzz";
  h.apply();
  assert.equal(h.status.textContent, "settingsSearchNoResults", "見つからないときの案内");
  h.clear();
  assert.equal(h.box.value, "", "クリアは入力も消す");
  assert.equal(h.display.hidden, false);
});

test("trk198: closing the settings screen throws the filter away", () => {
  assert.ok(/core\.on\("screen", id => \{ if \(id !== "settings"\) setSearchClear\(\); \}\)/.test(mainSrc), "閉じたら戻す（次に開いたとき絞ったままにしない）");
  assert.ok(/box\.addEventListener\("input"/.test(mainSrc), "打つたびに絞る");
  assert.ok(/e\.key === "Escape"/.test(mainSrc), "Esc で解除");
  assert.ok(/core\.on\("language"/.test(mainSrc), "言語を変えたら新しい言葉でやり直す");
  assert.ok(/\[hidden\]\{display:none!important\}/.test(cssSrc), "hidden は確実に消える（他の display 指定に負けない）");
});
