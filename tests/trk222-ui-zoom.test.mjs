// SPDX-License-Identifier: GPL-3.0-or-later
/* trk222: 🖥 拡大率（50／75／100／125%）と、そのまわりの設定。

   ・拡大率は「ステージの設計サイズを 1/拡大率 に縮めて、その分だけ拡大する」方式。
     中の文字とボタンが同じ比率で大きくなり、ステージ全体は画面に収まったまま（はみ出さない）。
   ・ゲーム中（playing／paused）は 100% のまま。スマホ型も 100% のまま（CSS が実ピクセルで並べる）。
   ・「アイコンの大きさは 100% で固定」がオンのときは、アイコンだけ 1/拡大率 に割り戻す。
   ・保存は core.settings だけ。新しい保存キーは増やさない。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");
const shellCss = fs.readFileSync(`${ROOT}/css/mobile-shell.css`, "utf8");
const barCss = fs.readFileSync(`${ROOT}/css/player-bar.css`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const prefsSrc = fs.readFileSync(`${ROOT}/js/ui-prefs.js`, "utf8");

/* ---------- 拡大率の計算（core.js から切り出して動かす） ---------- */
function between(start, end) {
  const a = coreSrc.indexOf(start);
  assert.ok(a >= 0, `${start} がある`);
  const b = coreSrc.indexOf(end, a);
  assert.ok(b > a, `${end} が後ろにある`);
  return coreSrc.slice(a, b);
}
const zoomBlock = between("const UI_SCALES = [50, 75, 100, 125];", "const SCREENS = [");
const fitBlock = between("function uiZoomFactor() {", "addEventListener(\"resize\", fitStage);");

function stageCtx({ classList = [], phase = "title", scale = 100, width = 1440, height = 900 } = {}) {
  const sets = Object.create(null);
  const stage = { dataset: { phase }, style: { width: "", height: "", transform: "" } };
  const body = { classList: { contains: c => classList.includes(c), toggle() {} } };
  const sandbox = {
    // innerWidth/innerHeight はグローバル変数のように読む（core.js と同じ書き方）
    innerWidth: width, innerHeight: height,
    document: { body, documentElement: { style: { setProperty(k, v) { sets[k] = v; } } } },
    stage,
    settings: { uiScale: scale, fixedIconSize: true },
    window: { Trk: { data: { W: 1920, H: 1080 } } },
    saveUserPrefs() { sandbox.saved = (sandbox.saved || 0) + 1; },
    emit() {},
    body,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${zoomBlock}\n${fitBlock}\n;globalThis.__fit = fitStage; globalThis.__apply = applyUiScale; globalThis.__scale = uiScaleValue;`, context);
  return { sandbox, stage, sets, fit: () => sandbox.__fit(), apply: opts => sandbox.__apply(opts) };
}

describe("trk222 拡大率の計算", () => {
  test("100% のときは、これまでどおり 1920×1080 を画面に合わせるだけ", () => {
    const { stage, fit } = stageCtx({ scale: 100 });
    fit();
    assert.equal(stage.style.width, "", "幅は固定しない");
    assert.equal(stage.style.height, "", "高さも固定しない");
    assert.equal(stage.style.transform, "translate(-50%,-50%) scale(0.75)", "1440×900 なら 0.75");
  });

  test("125% は設計サイズを 1536×864 にして、1.25 倍で描く（はみ出さない）", () => {
    const { stage, fit } = stageCtx({ scale: 125, classList: ["trk-zoom"] });
    fit();
    assert.equal(stage.style.width, "1536px");
    assert.equal(stage.style.height, "864px");
    assert.equal(stage.style.transform, "translate(-50%,-50%) scale(0.9375)", "0.75 × 1.25");
    assert.ok(0.9375 * 1536 <= 1440, "幅はみ出しなし");
    assert.ok(0.9375 * 864 <= 900, "高さはみ出しなし");
  });

  test("75% / 50% は、設計サイズを広げて小さく描く", () => {
    const seventyFive = stageCtx({ scale: 75, classList: ["trk-zoom"] });
    seventyFive.fit();
    assert.equal(seventyFive.stage.style.width, `${1920 / 0.75}px`);
    assert.equal(seventyFive.stage.style.transform, "translate(-50%,-50%) scale(0.5625)");   /* 0.75 × 0.75 */

    const fifty = stageCtx({ scale: 50, classList: ["trk-zoom"] });
    fifty.fit();
    assert.equal(fifty.stage.style.width, "3840px");
    assert.equal(fifty.stage.style.transform, "translate(-50%,-50%) scale(0.375)");
  });

  test("ゲーム中（playing／paused）は 100% のまま（盤面を欠けさせない）", () => {
    for (const phase of ["playing", "paused"]) {
      const { stage, fit } = stageCtx({ scale: 125, classList: ["trk-zoom"], phase });
      fit();
      assert.equal(stage.style.width, "", `${phase} では設計サイズを変えない`);
      assert.equal(stage.style.transform, "translate(-50%,-50%) scale(0.75)", `${phase} では等倍`);
    }
    const ended = stageCtx({ scale: 125, classList: ["trk-zoom"], phase: "ended" });
    ended.fit();
    assert.equal(ended.stage.style.width, "1536px", "リザルトでは拡大する");
  });

  test("スマホ型ではステージを拡大しない（CSS が実ピクセルで並べる）", () => {
    const { stage, fit } = stageCtx({ scale: 125, classList: ["trk-zoom", "trk-mobile"] });
    fit();
    assert.equal(stage.style.width, "", "幅を固定しない");
    assert.equal(stage.style.transform, "translate(-50%,-50%) scale(0.75)", "等倍のまま");
  });

  test("知らない拡大率は 100% として扱う（壊れた設定で崩れない）", () => {
    for (const value of [37, 0, -100, NaN, undefined, 125.5]) {
      const { sandbox } = stageCtx({ scale: value, classList: ["trk-zoom"] });
      assert.equal(sandbox.__scale(), 100, `${value} は 100 として扱う`);
    }
    const { sandbox } = stageCtx({ scale: 75 });
    assert.equal(sandbox.__scale(), 75, "選択肢の中はそのまま");
    const text = stageCtx({ scale: "125" });
    assert.equal(text.sandbox.__scale(), 125, "保存が文字列でも読める（書き出し・読み戻しのため）");
  });

  test("アイコンの大きさを固定すると、アイコンだけ 1/拡大率 に割り戻す", () => {
    const on = stageCtx({ scale: 125 });
    on.apply();
    assert.equal(on.sets["--trk-ui-zoom"], "1.25");
    assert.equal(on.sets["--trk-icon-zoom"], "0.8", "1 / 1.25");

    const off = stageCtx({ scale: 125 });
    off.sandbox.settings.fixedIconSize = false;
    off.apply();
    assert.equal(off.sets["--trk-icon-zoom"], "1", "固定しないときは割り戻さない");

    const normal = stageCtx({ scale: 100 });
    normal.apply();
    assert.equal(normal.sets["--trk-icon-zoom"], "1");
    assert.equal(normal.sandbox.body.classList.contains("trk-zoom"), false);
  });
});

describe("trk222 設定と保存", () => {
  test("既定は 100%・アイコン固定オン・画面の形の固定オン・エフェクト欄はライブラリに出さない", () => {
    assert.ok(coreSrc.includes('uiScale: pick(prefs.uiScale, [50, 75, 100, 125], 100)'), "拡大率は4択・既定100");
    assert.ok(coreSrc.includes("fixedIconSize: prefs.fixedIconSize !== false"), "アイコン固定は既定オン");
    assert.ok(coreSrc.includes("uiModeLock: prefs.uiModeLock !== false"), "画面の形の固定は既定オン");
    assert.ok(coreSrc.includes("fxInLibrary: prefs.fxInLibrary === true"), "ライブラリへのエフェクト欄は既定オフ");
    assert.ok(coreSrc.includes('settings.uiScale = 100; settings.fixedIconSize = true; settings.uiModeLock = true; settings.fxInLibrary = false;'),
      "工場出荷状態では既定へ戻す");
  });

  test("設定画面に、拡大率・アイコン固定・エフェクト欄の項目がある（4言語そろっている）", () => {
    assert.ok(html.includes('<select id="uiScale">'), "拡大率の選択");
    for (const value of ['value="50"', 'value="75"', 'value="100"', 'value="125"']) assert.ok(html.includes(value), value);
    assert.ok(html.includes('<input id="fixedIconSize" type="checkbox">'), "アイコンの大きさを固定");
    assert.ok(html.includes('<input id="fxInLibrary" type="checkbox">'), "ライブラリにもエフェクト欄を出す");
    /* ❓謎設定の中に「常に選んだものを使う」 */
    const mystery = html.slice(html.indexOf('data-i18n="secMystery"'));
    assert.ok(mystery.indexOf('<input id="uiModeLock" type="checkbox">') >= 0, "画面の形の固定は ❓謎設定にある");
    for (const key of ["uiScaleLabel", "uiScaleNormal", "uiScaleHint", "fixedIconSize", "fixedIconSizeHint", "fxInLibrary", "fxInLibraryHint", "uiModeLock", "uiModeLockHint"]) {
      const count = (i18nSrc.match(new RegExp(`\\b${key}:`, "g")) || []).length;
      assert.equal(count, 4, `${key} は4言語（ja/en/zh/ko）`);
    }
  });

  test("新しい保存キーを増やさない（配線は core.settings と core.saveUserPrefs だけ）", () => {
    assert.equal(prefsSrc.includes("localStorage"), false, "保存キーは書かない");
    assert.ok(prefsSrc.includes("core.saveUserPrefs"), "保存は本体の窓口を通す");
    assert.ok(prefsSrc.includes("core.applyUiScale"), "見た目の計算は core に任せる");
  });
});

describe("trk222 見た目（CSS）", () => {
  test("拡大率は CSS 変数（--trk-ui-zoom）で、アイコンは割り戻し（--trk-icon-zoom）", () => {
    assert.ok(cssSrc.includes(":root{--trk-ui-zoom:1;--trk-icon-zoom:1}"), "既定は 1");
    assert.ok(cssSrc.includes("body.trk-zoom #stage .card{max-height:100%;max-width:100%}"), "拡大してもカードははみ出さない");
    assert.ok(/body\.trk-zoom\.trk-icon-fixed[\s\S]*--trk-icon-zoom/.test(cssSrc), "アイコンの割り戻し");
  });

  test("再生バーにも拡大率が効く", () => {
    assert.ok(barCss.includes("body.trk-zoom .trk-playerbar { zoom: var(--trk-ui-zoom, 1); }"), "バーの文字とつまみも大きくなる");
  });

  test("スマホ型では、エフェクトの欄をタブで分ける（DOM は動かさない）", () => {
    assert.ok(shellCss.includes('.trk-mobile[data-trk-view="effects"] .songCol > *:not(#fxDock)'), "エフェクトのタブでは曲リストを隠す");
    assert.ok(shellCss.includes('.trk-mobile[data-trk-view="library"]:not(.trk-fx-in-library) #fxDock'), "ライブラリのタブでは欄を隠す（設定オンなら出す）");
    const shellSrc = fs.readFileSync(`${ROOT}/js/mobile-shell.js`, "utf8");
    assert.ok(!/col\.append\(/.test(shellSrc), "シェルは列の中身を動かさない（tv-dock・fx-dock と取り合わない）");
    assert.ok(shellSrc.includes('document.body.classList.toggle("trk-fx-in-library"'), "印だけを切り替える");
  });
});
