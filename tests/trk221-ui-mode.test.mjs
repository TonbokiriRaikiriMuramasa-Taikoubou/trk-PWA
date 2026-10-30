// SPDX-License-Identifier: GPL-3.0-or-later
/* trk221: 🖥 画面の形の切り替え（自動／PC型／スマホ型）。

   ・PC でも「スマホ型」を選べる（縦型のスタンド・小さい窓）
   ・スマホ・大きいタブレットでも「PC型」を選べる
   ・選んだ形は、開き直さずにその場で効く（enable／disable）
   ・保存は本体の設定（core.settings.uiMode）へ。新しい保存キーは増やさない
   ・PC の既定（auto・マウスの PC）では今までどおり何もしない */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const shellSrc = read("js/mobile-shell.js");
const coreSrc = read("js/core.js");
const html = read("index.html");
const i18nSrc = read("js/i18n.js");

/* ---------- 偽の DOM（mobile-shell.js が使う範囲だけ） ---------- */
function fakeDom() {
  const created = [];
  function makeNode(tagName) {
    const node = {
      tagName: String(tagName).toUpperCase(), id: "", className: "", type: "",
      textContent: "", hidden: false, disabled: false, open: false, value: "", title: "",
      parentNode: null, childNodes: [], dataset: {}, attributes: {},
      style: { setProperty() {}, removeProperty() {} },
      classList: {
        set: new Set(),
        add(c) { this.set.add(c); },
        remove(c) { this.set.delete(c); },
        toggle(c, on) { if (on === undefined ? !this.set.has(c) : on) this.set.add(c); else this.set.delete(c); },
        contains(c) { return this.set.has(c); }
      },
      isConnected: true,
      append(...kids) { for (const kid of kids) { kid.parentNode = node; node.childNodes.push(kid); } },
      appendChild(kid) { node.append(kid); return kid; },
      insertBefore(kid) { node.append(kid); return kid; },
      replaceChildren() { node.childNodes.length = 0; },
      remove() {  /* 本物と同じく、外したら parentNode も空になる */
        if (!node.parentNode) return;
        node.parentNode.childNodes = node.parentNode.childNodes.filter(k => k !== node);
        node.parentNode = null;
      },
      setAttribute(name, value) { node.attributes[name] = String(value); },
      removeAttribute(name) { delete node.attributes[name]; },
      __events: {},
      addEventListener(name, fn) { (node.__events[name] = node.__events[name] || []).push(fn); },
      removeEventListener() { }, focus() {}, scrollIntoView() {},
      querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const found = [];
        const walk = parent => {
          for (const kid of parent.childNodes) {
            if (matches(kid, sel)) found.push(kid);
            walk(kid);
          }
        };
        walk(node);
        return found;
      },
      closest: () => null,
      matches: () => false
    };
    created.push(node);
    return node;
  }
  function matches(candidate, sel) {
    if (!candidate || !sel) return false;
    if (sel.startsWith(".")) return String(candidate.className || "").split(/\s+/).includes(sel.slice(1));
    if (sel.startsWith("#")) return candidate.id === sel.slice(1);
    return false;
  }
  const body = makeNode("body");
  const headTools = makeNode("div");
  headTools.className = "headTools";
  const grid = makeNode("div");
  grid.className = "selectGrid";
  const card = makeNode("div");
  card.className = "card";
  const selectScreen = makeNode("section");
  selectScreen.id = "selectScreen";
  selectScreen.append(card);
  const document = {
    body,
    documentElement: makeNode("html"),
    readyState: "complete",
    createElement: tag => makeNode(tag),
    createTextNode: text => ({ textContent: text }),
    getElementById: id => body.childNodes.find(n => n.id === id) || null,
    querySelector(sel) {
      if (sel === "#selectScreen .selectGrid") return grid;
      if (sel === "#selectScreen .headTools") return headTools;
      if (sel === "#selectScreen .card") return card;
      if (sel === "#selectScreen") return selectScreen;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener() {},
    activeElement: null
  };
  return { document, body, created, makeNode, headTools, grid };
}

/* 押したことにする（偽の DOM には本物のクリックが無いため） */
function fire(node, name) {
  for (const fn of (node && node.__events && node.__events[name]) || []) fn({ target: node, preventDefault() {} });
}

function runShell({ mobile = false, uiMode = "auto", uiModeLock = true, language = "ja" } = {}) {
  const dom = fakeDom();
  const events = [];
  let saves = 0;
  const core = {
    settings: { language, uiMode, uiModeLock },
    phase: "title",
    on(name, fn) { events.push({ name, fn }); },
    video: null,
    currentSong: null,
    videoReady: false,
    openSettings() {},
    saveUserPrefs() { saves += 1; }
  };
  const window = {
    Trk: { core },
    TrkLite: { info: () => ({ mobile, standalone: false }) },
    TrkFX: { list: () => [], select() {}, off() {}, prev() {}, next() {} },
    TrkTV: { list: () => [], current: () => "", select() {}, filter: () => "none" },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    addEventListener() {},
    MutationObserver: class { observe() {} disconnect() {} },
    document: dom.document,
    navigator: { userAgent: mobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X)" : "Mozilla/5.0 (X11; Linux x86_64)" },
    setTimeout: () => 0
  };
  window.window = window;
  const context = vm.createContext({
    window, document: dom.document, navigator: window.navigator, console,
    MutationObserver: window.MutationObserver, setTimeout: window.setTimeout,
    matchMedia: window.matchMedia,
    tr: key => `T:${key}`
  });
  vm.runInContext(shellSrc, context, { filename: "js/mobile-shell.js" });
  return { dom, core, events, window, saves: () => saves };
}

describe("trk221 画面の形の判断（純粋関数）", () => {
  test("自動は端末に合わせる／スマホ型・PC型は端末を問わず選んだ側になる", () => {
    const { window } = runShell({ mobile: false });
    const wanted = window.TrkUiShellWanted;
    assert.equal(typeof wanted, "function", "判断は window.TrkUiShellWanted に出している（テストで確かめる）");
    assert.equal(wanted("auto", true), true, "自動・スマホ → スマホ型");
    assert.equal(wanted("auto", false), false, "自動・PC → PC型");
    assert.equal(wanted("mobile", false), true, "PC でもスマホ型を選べる（縦型のスタンド）");
    assert.equal(wanted("mobile", true), true, "スマホでスマホ型");
    assert.equal(wanted("desktop", true), false, "大きいタブレットでも PC型を選べる");
    assert.equal(wanted("desktop", false), false, "PC で PC型");
  });

  test("知らない値は自動として扱う（保存が壊れても PC の見た目を変えない）", () => {
    const { dom, window } = runShell({ mobile: false, uiMode: "banana" });
    assert.equal(window.Trk.mobileShell.mode(), "auto", "知らない値は auto");
    assert.equal(dom.body.classList.contains("trk-mobile"), false, "PC では何もしない");
  });
});

describe("trk221 PC でもスマホ型へ、その場で切り替えられる", () => {
  test("PC・自動では今までどおり（印もナビも無い）", () => {
    const { dom } = runShell({ mobile: false, uiMode: "auto" });
    assert.equal(dom.body.classList.contains("trk-mobile"), false);
    assert.equal(dom.created.some(n => n.className === "trk-mobile-nav"), false);
  });

  test("スマホ型を選ぶと、PC でも下部ナビがその場で出る／PC型へ戻すと消える", () => {
    const { dom, window, saves } = runShell({ mobile: false, uiMode: "auto" });
    window.Trk.mobileShell.setMode("mobile");
    assert.equal(dom.body.classList.contains("trk-mobile"), true, "スマホ型になる");
    assert.ok(dom.body.childNodes.includes(dom.created.find(n => n.className === "trk-mobile-nav")), "ナビが出る");
    assert.equal(window.Trk.mobileShell.enabled(), true);
    assert.ok(saves() >= 1, "選んだ形は本体の設定へ保存する");

    window.Trk.mobileShell.setMode("desktop");
    assert.equal(dom.body.classList.contains("trk-mobile"), false, "PC型へ戻る");
    assert.equal(dom.body.childNodes.some(n => n.className === "trk-mobile-nav"), false, "ナビは片付ける");
    assert.equal(window.Trk.mobileShell.enabled(), false);
  });

  test("スマホ型 → PC型 → スマホ型 と往復しても、ナビと縦向きの案内が戻る（作るのは1回だけ）", () => {
    const { dom, window } = runShell({ mobile: false, uiMode: "auto" });
    window.Trk.mobileShell.setMode("mobile");
    const navs = dom.created.filter(n => n.className === "trk-mobile-nav");
    assert.equal(navs.length, 1, "ナビは1つだけ作る");

    window.Trk.mobileShell.setMode("desktop");
    assert.equal(dom.body.childNodes.includes(navs[0]), false, "PC型では外す");

    window.Trk.mobileShell.setMode("mobile");
    assert.ok(dom.body.childNodes.includes(navs[0]), "戻したときは同じナビをつなぎ直す");
    assert.equal(dom.created.filter(n => n.className === "trk-mobile-nav").length, 1, "作り直さない");
    assert.ok(dom.body.childNodes.some(n => n.className === "rotateHint"), "縦向きの案内も戻る");
  });

  test("保存された「スマホ型」は、次の起動でもそのまま効く", () => {
    const { dom, window } = runShell({ mobile: false, uiMode: "mobile" });
    assert.equal(dom.body.classList.contains("trk-mobile"), true);
    assert.equal(window.Trk.mobileShell.mode(), "mobile");
  });

  /* trk222：3択（自動・PC・スマホ）をやめて、押すたびに PC ↔ スマホ が入れ替わる2択にした */
  test("選曲画面の右上のボタンは、押すたびに PC型 ↔ スマホ型 を入れ替える", () => {
    const { dom, window } = runShell({ mobile: false, uiMode: "auto" });
    const button = dom.headTools.childNodes.find(n => n.id === "uiModeBtn");
    assert.ok(button, "右上に切り替えのボタンを置く");
    assert.equal(button.type, "button", "ボタン");
    assert.ok(String(button.attributes["aria-label"] || "").includes("T:uiModeButton"), "説明は読み上げ名にも入れる");

    const seen = [];
    for (let i = 0; i < 4; i++) {
      fire(button, "click");
      seen.push(window.Trk.mobileShell.enabled() ? "mobile" : "desktop");
    }
    assert.deepEqual(seen, ["mobile", "desktop", "mobile", "desktop"], "2回で一往復する");
  });

  test("❓謎設定「常に選んだものを使う」がオフなら、その場だけ変えて保存しない", () => {
    const { window, saves } = runShell({ mobile: false, uiMode: "desktop", uiModeLock: false });
    const before = saves();
    window.Trk.mobileShell.toggle();
    assert.equal(window.Trk.mobileShell.enabled(), true, "その場ではスマホ型になる");
    assert.equal(saves(), before, "保存はしない（次に開いたら端末に合わせて選び直す）");
  });
});

describe("trk221 設定と保存", () => {
  test("設定の既定は auto（画面の形）と on（再生バー）で、値は決まった選択肢だけ", () => {
    assert.ok(coreSrc.includes('uiMode: pick(prefs.uiMode, ["auto", "desktop", "mobile"], "auto")'), "画面の形：3つの値");
    assert.ok(coreSrc.includes('playerBar: pick(prefs.playerBar, ["on", "auto", "off"], "on")'), "再生バー：既定はつねに表示");
    assert.ok(coreSrc.includes('settings.uiMode = "auto"; settings.playerBar = "on";'), "工場出荷状態では既定へ戻す");
  });

  test("設定画面に「🖥 画面と再生バー」の欄がある（4言語そろっている）", () => {
    assert.ok(html.includes('<details class="panel" id="uiPanel">'), "設定の欄");
    assert.ok(html.includes('<select id="uiMode">'), "画面の形の選択");
    assert.ok(html.includes('<select id="playerBarMode">'), "再生バーの選択");
    for (const key of ["secUi", "uiModeLabel", "uiModeAuto", "uiModeDesktop", "uiModeMobile", "uiModeHint", "playerBarLabel", "playerBarOn", "playerBarAuto", "playerBarOff", "playerBarHint", "uiModeButton"]) {
      const count = (i18nSrc.match(new RegExp(`\\b${key}:`, "g")) || []).length;
      assert.equal(count, 4, `${key} は4言語（ja/en/zh/ko）`);
    }
    for (const value of ['value="auto"', 'value="desktop"', 'value="mobile"']) assert.ok(html.includes(value), value);
    for (const value of ['value="on"', 'value="auto"', 'value="off"']) assert.ok(html.includes(value), value);
  });

  test("新しい保存キーを増やさない（本体の設定に載せる）", () => {
    assert.equal(shellSrc.includes("localStorage"), false, "シェル自身は保存しない");
    assert.ok(shellSrc.includes("core.saveUserPrefs()"), "保存は本体の窓口を通す");
    assert.ok(!/shadow_taiko_preferences_v2/.test(shellSrc), "保存キーの名前は書かない");
  });
});
