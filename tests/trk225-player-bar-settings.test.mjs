// SPDX-License-Identifier: GPL-3.0-or-later
/* 🎵 trk225: 下の再生バーの「置き場所」と「隠さない」設定。

   実機の相談（2026-10-31）から：
   ・スマホ型では、バーが下部ナビ（ライブラリ・エフェクト…）に押し上げられて画面の途中に浮いて見える。
     → 置き場所を選べるようにする（既定は「画面のいちばん下」。ナビはバーの上へ）。
   ・再生時間をいつも見たい人が、バーの ✕ を誤って押して消してしまう。
     → 「再生バーを隠さない（✕ を出さない）」を足す。

   確かめ方の方針（レビューの指摘⑫）：文字列の `includes` ではなく、
   ・純粋関数の戻り値（数値・真偽）
   ・偽 DOM での実測（--trk-playerbar-offset に入る px、body の印、✕ の表示）
   ・CSS を規則として当てた「カスケードで勝つ値」
   で見ます。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers/browser-data.mjs";
import { runBar, fire, barOf } from "./helpers/player-bar-harness.mjs";
import { parseRules, computed, el } from "./helpers/css-rules.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const coreSrc = read("js/core.js");
const i18nSrc = read("js/i18n.js");
const html = read("index.html");
const barCss = read("css/player-bar.css");
const shellCss = read("css/mobile-shell.css");

/* index.html の読み込み順（style → study-room → mobile-shell → player-bar）で1本の規則にする */
const rules = [
  ...parseRules(read("css/style.css"), { file: "css/style.css" }),
  ...parseRules(shellCss, { file: "css/mobile-shell.css" }),
  ...parseRules(barCss, { file: "css/player-bar.css" })
];

const barParts = dom => {
  const bar = barOf(dom);
  const actions = bar.childNodes.find(n => n.className === "trk-pb-actions");
  return { bar, actions, hide: actions.childNodes.find(n => n.className === "trk-pb-hide") };
};

describe("trk225 置き場所の判断（純粋関数）", () => {
  test("既定は「画面のいちばん下」。知らない値もそこへ寄せる", () => {
    const { window } = runBar({ mobile: true, navHeight: 66 });
    assert.deepEqual([...window.Trk.playerBar.positions], ["bottom", "above"]);
    assert.equal(window.Trk.playerBar.position(), "bottom", "未設定なら bottom");
  });

  test("設定の値がそのまま判断になる（above／bottom）", () => {
    const above = runBar({ mobile: true, navHeight: 66, playerBarPos: "above" });
    assert.equal(above.window.Trk.playerBar.position(), "above");
    const odd = runBar({ mobile: true, navHeight: 66, playerBarPos: "sideways" });
    assert.equal(odd.window.Trk.playerBar.position(), "bottom", "知らない値は bottom");
  });

  test("持ち上げるのは「ナビの上」のときだけ（px）", () => {
    const { window } = runBar();
    const offset = window.Trk.playerBar.offset;
    assert.equal(offset(66.4, "above"), 66, "丸める");
    assert.equal(offset(66.4, "bottom"), 0);
    assert.equal(offset(0, "above"), 0, "ナビが無ければ 0");
    assert.equal(offset(-10, "above"), 0, "負の値は 0");
  });
});

describe("trk225 実測（偽 DOM で測った値を配る）", () => {
  test("既定（いちばん下）：バーの下余白は0で、body に印が付く", () => {
    const { dom, window } = runBar({ mobile: true, navHeight: 66, stage: { designH: 1080, screenH: 1080 } });
    window.Trk.playerBar.sync();
    assert.equal(dom.document.documentElement.style.values["--trk-playerbar-offset"], "0px");
    assert.equal(dom.document.documentElement.style.values["--trk-playerbar-h"], "60px", "バーの実寸");
    assert.equal(dom.body.classList.contains("trk-playerbar-at-bottom"), true, "ナビを上へ動かす印");
  });

  test("「ナビの上」を選ぶと、ナビの高さぶん持ち上がり、印も外れる", () => {
    const { dom, window } = runBar({ mobile: true, navHeight: 66, playerBarPos: "above", stage: { designH: 1080, screenH: 1080 } });
    window.Trk.playerBar.sync();
    assert.equal(dom.document.documentElement.style.values["--trk-playerbar-offset"], "66px");
    assert.equal(dom.body.classList.contains("trk-playerbar-at-bottom"), false);
  });

  test("置き場所を変えると、その場で測り直す（開き直さない）", () => {
    const { dom, window, core } = runBar({ mobile: true, navHeight: 66, controls: true, stage: { designH: 1080, screenH: 1080 } });
    window.Trk.playerBar.sync();
    assert.equal(dom.document.documentElement.style.values["--trk-playerbar-offset"], "0px");
    const pos = dom.controls.pos;
    pos.value = "above";
    fire(pos, "change");
    assert.equal(core.settings.playerBarPos, "above", "設定に書く");
    assert.equal(dom.document.documentElement.style.values["--trk-playerbar-offset"], "66px", "その場で反映");
    assert.equal(dom.body.classList.contains("trk-playerbar-at-bottom"), false);
  });

  test("バーを出していないときは、印も残さない（次に出すときに測り直す）", () => {
    const { dom, window, core } = runBar({ mobile: true, navHeight: 66, stage: { designH: 1080, screenH: 1080 } });
    window.Trk.playerBar.sync();
    assert.equal(dom.body.classList.contains("trk-playerbar-at-bottom"), true);
    core.phase = "playing";
    window.Trk.playerBar.sync();
    assert.equal(barOf(dom).hidden, true, "プレイ中は出さない");
    assert.equal(dom.body.classList.contains("trk-playerbar-at-bottom"), false, "印も外す");
  });

  test("置き場所の印を付けてから高さを測る（safe-area の下余白を測り落とさない）", () => {
    /* 印が付くと、バー自身が env(safe-area-inset-bottom) のぶん下余白を空ける。
       先に高さを測ると、iPhone でナビがバーに重なる。順番を記録して確かめる。 */
    const { dom, window } = runBar({ mobile: true, navHeight: 66, stage: { designH: 1080, screenH: 1080 } });
    dom.log.length = 0;
    window.Trk.playerBar.sync();
    const mark = dom.log.indexOf("toggle:trk-playerbar-at-bottom");
    const measured = dom.log.findIndex(entry => entry === "rect:trkPlayerBar");
    assert.ok(mark >= 0, "印を付ける");
    assert.ok(measured >= 0, "バーの高さを測る");
    assert.ok(mark < measured, `印（${mark}）が測定（${measured}）より先`);
  });

  test("設定の欄は、いまの値を映す（開き直さなくても合う）", () => {
    const { dom, window } = runBar({ mobile: true, navHeight: 66, controls: true, playerBarPos: "above" });
    window.Trk.playerBar.sync();
    assert.equal(dom.controls.pos.value, "above");
    assert.equal(dom.controls.mode.value, "auto");
    assert.equal(dom.controls.lock.checked, false);
  });
});

describe("trk225 「再生バーを隠さない」", () => {
  test("オンのときは ✕ を出さない（押せないボタンではなく、無い）", () => {
    const { dom, window } = runBar({ playerBarLock: true, controls: true });
    window.Trk.playerBar.sync();
    const { hide } = barParts(dom);
    assert.ok(hide, "ボタン自体は作られている（設定を戻せば出る）");
    assert.equal(hide.hidden, true, "隠す");
    assert.equal(dom.controls.lock.checked, true, "設定の欄はオン");
  });

  test("オフのときは ✕ が出る（これまでどおり）", () => {
    const { dom, window } = runBar({ playerBarLock: false });
    window.Trk.playerBar.sync();
    const { hide } = barParts(dom);
    assert.equal(hide.hidden, false);
  });

  test("✕ を押しても「表示しない」にならず、案内を出す", () => {
    const { dom, window, core, calls } = runBar({ playerBarLock: true });
    window.Trk.playerBar.sync();
    const { hide } = barParts(dom);
    fire(hide, "click");
    assert.equal(core.settings.playerBar, "auto", "設定は変えない");
    assert.equal(calls.save, 0, "保存もしない");
    assert.equal(barOf(dom).hidden, false, "バーは出たまま");
    assert.equal(calls.toast.length, 1, "理由を1回だけ知らせる");
    assert.equal(calls.toast[0], "T:barLocked");
    assert.equal(core.settings.playerBarLock, true, "鍵もそのまま");
  });

  test("鍵が無ければ、✕ はこれまでどおり隠して知らせる", () => {
    const { dom, window, core, calls } = runBar({ playerBarLock: false });
    window.Trk.playerBar.sync();
    const { hide } = barParts(dom);
    fire(hide, "click");
    assert.equal(core.settings.playerBar, "off", "off になる");
    assert.equal(calls.save, 1, "保存する");
    assert.equal(calls.toast[0], "T:barHidden");
  });

  test("設定の欄で切り替えると、その場で ✕ が消える・戻る", () => {
    const { dom, window, core } = runBar({ playerBarLock: false, controls: true });
    window.Trk.playerBar.sync();
    const { hide } = barParts(dom);
    assert.equal(hide.hidden, false);
    const lock = dom.controls.lock;
    lock.checked = true;
    fire(lock, "change");
    assert.equal(core.settings.playerBarLock, true);
    assert.equal(hide.hidden, true, "その場で消える");
    lock.checked = false;
    fire(lock, "change");
    assert.equal(hide.hidden, false, "戻すと出る");
  });
});

describe("trk225 CSS を規則として当てる（ナビの位置・隠した ✕・下の余白）", () => {
  const body = extra => el("body", { classes: ["trk-mobile", "trk-playerbar", ...extra] });
  const navOf = () => el("nav", { classes: ["trk-mobile-nav"] });

  test("既定（いちばん下）のとき、ナビの下端はバーの高さぶん上", () => {
    const got = computed(rules, "bottom", navOf(), [body(["trk-playerbar-at-bottom"])], { allowMedia: () => true });
    assert.ok(got, "ナビの bottom を決める規則がある");
    assert.equal(got.value, "var(--trk-playerbar-h, 56px)", "バーの実寸だけ上へ（safe-area を足し直さない）");
  });

  test("いちばん下のとき、バー自身はホームバー（safe-area）のぶんを空ける", () => {
    const got = computed(rules, "padding-bottom", el("section", { classes: ["trk-playerbar"] }),
      [body(["trk-playerbar-at-bottom"])], { allowMedia: () => true });
    assert.ok(got, "padding-bottom を決める規則がある");
    assert.match(got.value, /env\(safe-area-inset-bottom/, "iPhone のホームバーを避ける");
  });

  test("「ナビの上」のときは、ナビを動かさない（0 のまま）", () => {
    const got = computed(rules, "bottom", navOf(), [body([])], { allowMedia: () => true });
    assert.equal(got.value, "0", "mobile-shell.css の 0 が勝つ");
  });

  test("隠した ✕ は、display:grid に負けずに消える", () => {
    const hide = el("button", { classes: ["trk-pb-hide"], attrs: { hidden: "" } });
    const got = computed(rules, "display", hide, [body([]), el("section", { classes: ["trk-playerbar"] }),
      el("div", { classes: ["trk-pb-actions"] })], { allowMedia: () => true });
    assert.ok(got, "display を決める規則がある");
    assert.equal(got.value, "none", "隠す");
    assert.equal(got.important, true, "ほかの規則に負けない");
  });

  test("カードの下余白は、バー＋ナビの段（実測 56＋66＝122px）より広い", () => {
    const got = computed(rules, "padding-bottom", el("div", { classes: ["card"] }),
      [body([]), el("div", { id: "stage", attrs: { "data-phase": "title" } }),
       el("div", { classes: ["screen"] })], { allowMedia: () => true });
    assert.ok(got, "カードの padding-bottom を決める規則がある");
    const numbers = (got.value.match(/\d+/g) || []).map(Number);
    const base = numbers[0];                                  /* 100px（ナビの段） */
    const barH = Number((got.value.match(/--trk-playerbar-h,\s*(\d+)px/) || [])[1]);
    assert.equal(barH, 56, "バーの既定の高さ");
    assert.ok(base + barH >= 56 + 66, `${base} + ${barH} はバー56＋ナビ66より広い`);
  });
});

describe("trk225 設定の置き場所と、保存の初期値", () => {
  test("core の既定は「いちばん下」と「隠さない＝オフ」。工場出荷状態でも同じ", () => {
    assert.match(coreSrc, /playerBarPos: pick\(prefs\.playerBarPos, \["bottom", "above"\], "bottom"\)/);
    assert.match(coreSrc, /playerBarLock: prefs\.playerBarLock === true/);
    assert.match(coreSrc, /settings\.playerBarPos = "bottom"; settings\.playerBarLock = false;/,
      "工場出荷状態で戻す（戻し忘れると、前の設定が残る）");
  });

  test("設定の欄（⚙ → 🖥 画面と再生バー）にある", () => {
    assert.match(html, /<select id="playerBarPos">/);
    assert.match(html, /<option value="bottom" data-i18n="playerBarPosBottom">/);
    assert.match(html, /<option value="above" data-i18n="playerBarPosAbove">/);
    assert.match(html, /<input id="playerBarLock" type="checkbox">/);
  });

  test("文言は4言語ぶんある（日本語だけ書いて終わりにしない）", () => {
    for (const key of ["playerBarPosLabel", "playerBarPosBottom", "playerBarPosAbove", "playerBarPosHint",
      "playerBarLockLabel", "playerBarLockHint", "barLocked"]) {
      const count = (i18nSrc.match(new RegExp(`\\b${key}:`, "g")) || []).length;
      assert.equal(count, 4, `${key} は4言語`);
    }
    const m = i18nSrc.match(/playerBarLockLabel:"([^"]+)"/);
    assert.ok(m && /✕/.test(m[1]), "何が起きない設定かが名前で分かる（✕ を出さない）");
  });
});
