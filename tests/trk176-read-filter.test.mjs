// SPDX-License-Identifier: GPL-3.0-or-later
/* trk176: 🌗 書斎の明るさ/コントラスト調整（PLAYER-ROADMAP #13・読書用フィルタ）。
   読書面（.study-image-stage / .study-text-stage）だけに CSS filter。全画面フィット・拡大率とは独立。
   初期値（100/100/なし）は "none"＝見た目のコストゼロ。vm で css 構築と保存値のクランプを実動検証し、配線は走査する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/study-room.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/study-room.css", import.meta.url), "utf8");
const fn = name => {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, name);
  return match[0];
};
function harness() {
  const context = vm.createContext({ clearTimeout() {} });
  vm.runInContext(source.slice(source.indexOf("const STUDY_SHELF_MAX"), source.indexOf("/* ============ 保存")) + `
    ${fn("studyReadPrefs")}
    ${fn("studyReadFilterPercent")}
    ${fn("studyReadFilterCss")}
    ${fn("studyApplyReadFilter")}
    function studyFail(error) { throw error; }
    function studyZoomPercentStep(value) { return [1, 2, 5, 10, 25].includes(Number(value)) ? Number(value) : 5; }
    const elements = new Map();
    const core = { $: id => {
      if (!elements.has(id)) elements.set(id, {
        id, textContent:"", value:"", checked:false,
        style:{ setProperty(key, value) { this[key] = value; } }
      });
      return elements.get(id);
    } };
    function room() { return core.$("studyRoom"); }
  `, context);
  return code => vm.runInContext(code, context);
}

test("trk176: 百分率は 50〜150 にクランプ。数値以外は 100 に戻る", () => {
  const run = harness();
  assert.equal(run(`studyReadFilterPercent("80")`), 80);
  assert.equal(run(`studyReadFilterPercent(10)`), 50);
  assert.equal(run(`studyReadFilterPercent(999)`), 150);
  assert.equal(run(`studyReadFilterPercent("bright")`), 100);
  assert.equal(run(`studyReadFilterPercent(undefined)`), 100);
});

test("trk176: 保存値の読み込み（クランプ・文字列・壊れた候補は none）", () => {
  const run = harness();
  for (const [raw, expected] of [
    [{ readBrightness:80, readContrast:120, readSpecial:"sepia" }, [80, 120, "sepia"]],
    [{ readBrightness:"65", readContrast:"200", readSpecial:"invert" }, [65, 150, "invert"]],
    [{ readBrightness:1, readContrast:-40, readSpecial:"xray" }, [50, 50, "none"]],
    [{}, [100, 100, "none"]],
    [null, [100, 100, "none"]]]) {
    run(`studyReadPrefs(${raw === null ? "null" : JSON.stringify(raw)})`);
    assert.deepEqual(run(`JSON.stringify([studyPrefs.readBrightness, studyPrefs.readContrast, studyPrefs.readSpecial])`),
      JSON.stringify(expected), JSON.stringify(raw));
  }
});

test("trk176: filter の css 構築。初期値は \"none\"＝コストゼロ", () => {
  const run = harness();
  assert.equal(run(`studyReadFilterCss()`), "none");
  run(`studyPrefs.readBrightness = 80;`);
  assert.equal(run(`studyReadFilterCss()`), "brightness(80%) contrast(100%)");
  run(`studyPrefs.readContrast = 120; studyPrefs.readSpecial = "invert";`);
  assert.equal(run(`studyReadFilterCss()`), "brightness(80%) contrast(120%) invert(1)");
  run(`studyPrefs.readSpecial = "grayscale";`);
  assert.equal(run(`studyReadFilterCss()`), "brightness(80%) contrast(120%) grayscale(1)");
  run(`studyPrefs.readSpecial = "sepia";`);
  assert.equal(run(`studyReadFilterCss()`), "brightness(80%) contrast(120%) sepia(.8)");
  run(`studyPrefs.readBrightness = 100; studyPrefs.readContrast = 100; studyPrefs.readSpecial = "none";`);
  assert.equal(run(`studyReadFilterCss()`), "none");
});

test("trk176: 適用＝#studyRoom に --study-read-filter、横の % 表示も同期", () => {
  const run = harness();
  run(`studyPrefs.readBrightness = 70; studyPrefs.readContrast = 130; studyPrefs.readSpecial = "sepia"; studyApplyReadFilter();`);
  assert.equal(run(`room().style["--study-read-filter"]`), "brightness(70%) contrast(130%) sepia(.8)");
  assert.equal(run(`core.$("studyReadBrightnessValue").textContent`), "70%");
  assert.equal(run(`core.$("studyReadContrastValue").textContent`), "130%");
  run(`studyPrefs.readBrightness = 100; studyPrefs.readContrast = 100; studyPrefs.readSpecial = "none"; studyApplyReadFilter();`);
  assert.equal(run(`room().style["--study-read-filter"]`), "none");
});

test("trk176: 配線＝設定UI（スライダー2本＋特殊フィルタ）・バインド・CSS・4言語テキスト", () => {
  assert.ok(html.includes(`<input id="studyReadBrightness" type="range" min="50" max="150" step="5" value="100" aria-labelledby="studyReadBrightnessLabel" aria-describedby="studyReadFilterHint">`));
  assert.ok(html.includes(`<input id="studyReadContrast" type="range" min="50" max="150" step="5" value="100" aria-labelledby="studyReadContrastLabel" aria-describedby="studyReadFilterHint">`));
  assert.ok(html.includes(`<select id="studyReadSpecial" aria-labelledby="studyReadSpecialLabel" aria-describedby="studyReadFilterHint">`));
  for (const [value, key] of [["none", "studyReadSpecialNone"], ["invert", "studyReadSpecialInvert"],
    ["grayscale", "studyReadSpecialGrayscale"], ["sepia", "studyReadSpecialSepia"]]) {
    assert.ok(html.includes(`<option value="${value}" data-i18n="${key}">`), value);
  }
  assert.ok(html.includes(`<span id="studyReadBrightnessValue" class="study-read-filter-value">100%</span>`));
  assert.ok(html.includes(`<span id="studyReadContrastValue" class="study-read-filter-value">100%</span>`));
  assert.ok(html.includes(`<p id="studyReadFilterHint" class="study-advanced-hint" data-i18n="studyReadFilterHint">`));
  /* CSS：読書面だけ（本棚やメニューは含まない）。初期値は var のフォールバック none */
  assert.ok(css.includes(`.study-image-stage,.study-text-stage{filter:var(--study-read-filter,none)}`));
  assert.ok(css.includes(`.study-read-filter-row input[type=range]{`));
  assert.ok(css.includes(`.study-read-filter-value{`));
  /* JS 配線：バインド（ドラッグ中は input で見た目だけ・change で保存）と UI 同期 */
  assert.ok(source.includes(`studyBindPref("studyReadSpecial", "readSpecial", () => studyApplyReadFilter());`));
  assert.ok(source.includes(`for (const [id, key] of [["studyReadBrightness", "readBrightness"], ["studyReadContrast", "readContrast"]]) {`));
  assert.match(source, /node\.addEventListener\("input", \(\) => \{[\s\S]{0,180}?studyApplyReadFilter\(\);/);
  assert.match(source, /node\.addEventListener\("change", \(\) => \{ studyPrefs\[key\] = studyReadFilterPercent\(node\.value\); studySavePrefs\(\); studyApplyReadFilter\(\); \}\);/);
  assert.match(source, /core\.\$\("studyReadSpecial"\)\.value = studyPrefs\.readSpecial;\n\s*studyApplyReadFilter\(\);/);
  assert.ok(source.includes(`readBrightness:100, readContrast:100, readSpecial:"none",`));
  assert.ok(source.includes(`const STUDY_READ_SPECIALS = ["none", "invert", "grayscale", "sepia"];`));
  for (const key of ["studyReadBrightnessLabel", "studyReadContrastLabel", "studyReadSpecialLabel", "studyReadSpecialNone",
    "studyReadSpecialInvert", "studyReadSpecialGrayscale", "studyReadSpecialSepia", "studyReadFilterHint"]) {
    assert.equal((source.match(new RegExp(`${key}:"`, "g")) || []).length, 4, key);
  }
});
