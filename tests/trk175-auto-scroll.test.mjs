// SPDX-License-Identifier: GPL-3.0-or-later
/* trk175: 📜 書斎の自動スクロール（PLAYER-ROADMAP #12・ハンズフリー縦読み）。
   縦読み漫画モードだけの等速スクロール（px/秒）・速度は候補から選ぶ・タップ/ホイール/移動キーで停止・下端で自動停止。
   vm で状態機（開始/停止/等速/下端/速度変更）を実動させ、配線（keydown・wheel・pointerdown・HTML・4言語）は走査で確認する。 */
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
  const rafQueue = [], cancelled = [];
  let rafId = 0;
  const context = vm.createContext({
    clearTimeout() {},
    requestAnimationFrame(handler) { rafQueue.push({ id:++rafId, handler }); return rafId; },
    cancelAnimationFrame(id) { cancelled.push(id); },
    __rafQueue: rafQueue, __cancelled: cancelled,
  });
  vm.runInContext(source.slice(source.indexOf("const STUDY_SHELF_MAX"), source.indexOf("/* ============ 保存")) + `
    ${fn("studyReadPrefs")}
    ${fn("studyAutoScrollSpeedValue")}
    ${fn("studyAutoScrollActive")}
    ${fn("studyAutoScrollEligible")}
    ${fn("studyAutoScrollHalt")}
    ${fn("studySyncAutoScrollBtn")}
    ${fn("studyAutoScrollFrame")}
    ${fn("studyStartAutoScroll")}
    ${fn("studyStopAutoScroll")}
    ${fn("studyToggleAutoScroll")}
    let studyAutoScrollRaf = 0, studyAutoScrollLast = 0, studyAutoScrollCarry = 0;
    const notices = [];
    function studyNotify(key) { notices.push(key); }
    function studyFail(error) { throw error; }
    function tr(key) { return key; }
    function studyZoomPercentStep(value) { return [1, 2, 5, 10, 25].includes(Number(value)) ? Number(value) : 5; }
    const elements = new Map();
    const core = { $: id => {
      if (!elements.has(id)) elements.set(id, {
        id, hidden:false, dataset:{}, textContent:"", scrollTop:0, clientHeight:600, scrollHeight:5000,
        setAttribute(key, value) { this[key] = value; }
      });
      return elements.get(id);
    } };
    function stage() { return core.$("studyImageStage"); }
    function button() { return core.$("studyAutoScrollBtn"); }
    function openVertical() { studyRoomOpen = true; studyCurrentBook = { kind:"image", pages:[1, 2, 3] }; studyPrefs.imageMode = "vertical"; }
    /*  queued な rAF を times 回ぶん、startNow から stepMs 刻みで進める。実際に進めた回数を返す。 */
    function pumpFrames(times, startNow, stepMs) {
      let ran = 0;
      for (let i = 0; i < times; i++) {
        const next = __rafQueue.shift();
        if (!next) break;
        next.handler(startNow + i * stepMs); ran++;
      }
      return ran;
    }
  `, context);
  return code => vm.runInContext(code, context);
}

test("trk175: 速度は候補（20/45/75/120/180）だけ。読み込みは文字列も直し、外れ値は既定（75）に戻る", () => {
  const run = harness();
  assert.equal(run(`studyAutoScrollSpeedValue("120")`), 120);
  assert.equal(run(`studyAutoScrollSpeedValue(999)`), 75);
  assert.equal(run(`studyAutoScrollSpeedValue("very fast")`), 75);
  for (const [raw, expected] of [[{ studyAutoScrollSpeed:180 }, 180], [{ studyAutoScrollSpeed:"45" }, 45],
    [{ studyAutoScrollSpeed:999 }, 75], [{}, 75], [{ studyAutoScrollSpeed:null }, 75], [null, 75]]) {
    run(`studyReadPrefs(${raw === null ? "null" : JSON.stringify(raw)})`);
    assert.equal(run("studyPrefs.studyAutoScrollSpeed"), expected, JSON.stringify(raw));
  }
});

test("trk175: 開始できるのは縦読み漫画モードだけ。ほかでは needVertical を言って動かない", () => {
  const run = harness();
  run(`studyRoomOpen = true; studyCurrentBook = { kind:"image", pages:[1] }; studyPrefs.imageMode = "single";`);
  run(`studyStartAutoScroll();`);
  assert.equal(run(`studyAutoScrollActive()`), false);
  run(`studyPrefs.imageMode = "vertical"; studyCurrentBook = { kind:"text" }; studyStartAutoScroll();`);
  assert.equal(run(`studyAutoScrollActive()`), false);
  run(`openVertical(); studyStartAutoScroll();`);
  assert.equal(run(`studyAutoScrollActive()`), true);
  assert.deepEqual(run(`JSON.stringify(notices)`), '["studyAutoScrollNeedVertical","studyAutoScrollNeedVertical","studyAutoScrollStarted"]');
});

test("trk175: 等速スクロール＝px/秒。端数の carry を持ち越して整数 px だけ進める", () => {
  const run = harness();
  run(`openVertical(); studyPrefs.studyAutoScrollSpeed = 75; studyStartAutoScroll();`);
  /* 1コマ目（dt=0）は動かず、以降 100ms ごとに 7.5px → 7,8,7,8…で 4コマで 30px */
  assert.equal(run(`pumpFrames(1, 1000, 100); stage().scrollTop`), 0);
  assert.equal(run(`pumpFrames(2, 1100, 100); stage().scrollTop`), 15);
  assert.equal(run(`pumpFrames(2, 1300, 100); stage().scrollTop`), 30);
  assert.equal(run(`Number.isInteger(stage().scrollTop)`), true);
});

test("trk175: 下端（最後のページ）に着いたら自分で止まり、studyAutoScrollEnd を言う", () => {
  const run = harness();
  run(`openVertical(); stage().scrollHeight = stage().clientHeight + 30; studyPrefs.studyAutoScrollSpeed = 75; studyStartAutoScroll();`);
  assert.equal(run(`pumpFrames(5, 1000, 100); stage().scrollTop`), 30);
  assert.equal(run(`studyAutoScrollActive()`), false);
  assert.equal(run(`__rafQueue.length`), 0);
  assert.equal(run(`notices[notices.length - 1]`), "studyAutoScrollEnd");
});

test("trk175: 停止/トグルで rAF をキャンセルし、ボタンの aria-pressed・ラベル・表示を同期する", () => {
  const run = harness();
  run(`openVertical(); studyStartAutoScroll(); studySyncAutoScrollBtn();`);
  assert.equal(run(`button().hidden`), false);
  assert.equal(run(`button()["aria-pressed"]`), "true");
  assert.equal(run(`button().dataset.i18n`), "studyAutoScrollStop");
  assert.equal(run(`button().textContent`), "studyAutoScrollStop");
  const before = run(`__cancelled.length`);
  run(`studyToggleAutoScroll();`);   /* 動いている → 停止 */
  assert.equal(run(`studyAutoScrollActive()`), false);
  assert.equal(run(`__cancelled.length > ${before}`), true);
  assert.equal(run(`button()["aria-pressed"]`), "false");
  assert.equal(run(`button().dataset.i18n`), "studyAutoScrollStart");
  run(`studyToggleAutoScroll();`);   /* 止まっている → 開始 */
  assert.equal(run(`studyAutoScrollActive()`), true);
  /* 縦読みをやめた（single に戻した）ときの同期＝静かに止まってボタンも隠れる */
  run(`studyPrefs.imageMode = "single"; studySyncAutoScrollBtn();`);
  assert.equal(run(`studyAutoScrollActive()`), false);
  assert.equal(run(`button().hidden`), true);
});

test("trk175: 速度変更は次のコマからすぐ効く（停止しない）", () => {
  const run = harness();
  run(`openVertical(); studyPrefs.studyAutoScrollSpeed = 20; studyStartAutoScroll();`);
  assert.equal(run(`pumpFrames(2, 1000, 100); stage().scrollTop`), 2);
  run(`studyPrefs.studyAutoScrollSpeed = 180;`);
  assert.equal(run(`pumpFrames(1, 1200, 100); stage().scrollTop`), 20);
  assert.equal(run(`studyAutoScrollActive()`), true);
});

test("trk175: 配線＝A でトグル・移動キーで停止・タップ（pointerdown）とホイールで停止・予約キーに KeyA", () => {
  assert.match(source, /if \(studyAutoScrollActive\(\)\) \{\n\s*if \(event\.code === "KeyA"\)/);
  assert.match(source, /STUDY_AUTO_SCROLL_STOP_CODES\.has\(event\.code\) \|\| event\.code === studyPrefs\.studyNextKey \|\| event\.code === studyPrefs\.studyPreviousKey/);
  assert.match(source, /if \(event\.code === "KeyA"\) \{ event\.preventDefault\(\); event\.stopImmediatePropagation\(\); studyToggleAutoScroll\(\); return; \}/);
  assert.ok(source.includes(`"KeyA", "KeyB"`), "KeyA must stay reserved so it cannot be reassigned");
  assert.match(source, /function studyImagePointerDown\(event\) \{\n\s*studyStopAutoScroll\(\);/);
  assert.match(source, /addEventListener\("wheel", event => \{\n\s*studyStopAutoScroll\(\);/);
  assert.match(source, /function studyRenderCurrentBook\(\) \{[\s\S]{0,160}?studyStopAutoScroll\(\);/);
  assert.match(source, /studyEndSearch\(\); studyCurrentBook = null; studyClearPageImages\(\);\n\s*studyStopAutoScroll\(\);/);
  assert.match(source, /studyHeldCode = ""; studyPointerStart = null;\n\s*studyStopAutoScroll\(\);/);
  assert.ok(source.includes(`studyBindPref("studyAutoScrollSpeed", "studyAutoScrollSpeed", node => {`));
  assert.ok(source.includes(`core.$("studyAutoScrollBtn").addEventListener("click", studyToggleAutoScroll);`));
  assert.ok(source.includes(`const STUDY_AUTO_SCROLL_SPEEDS = [20, 45, 75, 120, 180], STUDY_AUTO_SCROLL_SPEED_DEFAULT = 75;`));
  assert.ok(css.includes(`.study-auto-scroll-btn[aria-pressed="true"]{`), "running-state style for the toggle button");
});

test("trk175: HTML（⏩ボタン・速度セレクト・ヘルプのA行）と 4言語テキストがそろっている", () => {
  assert.ok(html.includes(`<button id="studyAutoScrollBtn" type="button" class="study-small-btn study-auto-scroll-btn" aria-pressed="false" data-i18n="studyAutoScrollStart" hidden>`));
  assert.ok(html.indexOf(`id="studyZoomGroup"`) < html.indexOf(`id="studyAutoScrollBtn"`), "the ⏩ button sits in the reader toolbar after the zoom group");
  assert.ok(html.includes(`<select id="studyAutoScrollSpeed" aria-labelledby="studyAutoScrollSpeedLabel" aria-describedby="studyAutoScrollSpeedHint">`));
  for (const [value, key] of [["20", "studyAutoSpeedSlowest"], ["45", "studyAutoSpeedSlow"], ["75", "studyAutoSpeedNormal"],
    ["120", "studyAutoSpeedFast"], ["180", "studyAutoSpeedFastest"]]) {
    assert.ok(html.includes(`<option value="${value}" data-i18n="${key}">`), value);
  }
  assert.ok(html.includes(`<p id="studyAutoScrollSpeedHint" class="study-advanced-hint" data-i18n="studyAutoScrollSpeedHint">`));
  assert.ok(html.includes(`<dt>A</dt><dd data-i18n="studyHelpAuto"></dd>`));
  for (const key of ["studyAutoScrollStart", "studyAutoScrollStop", "studyAutoScrollSpeedLabel", "studyAutoSpeedSlowest",
    "studyAutoSpeedSlow", "studyAutoSpeedNormal", "studyAutoSpeedFast", "studyAutoSpeedFastest", "studyAutoScrollSpeedHint",
    "studyAutoScrollStarted", "studyAutoScrollEnd", "studyAutoScrollNeedVertical", "studyHelpAuto"]) {
    assert.equal((source.match(new RegExp(`${key}:"`, "g")) || []).length, 4, key);
  }
  assert.equal((source.match(/studyVerticalHint:"[^"]*A[^"]*"/g) || []).length, 4, "vertical hint mentions the A key in all four languages");
});
