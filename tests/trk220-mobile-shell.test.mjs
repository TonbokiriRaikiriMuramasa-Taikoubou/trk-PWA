// SPDX-License-Identifier: GPL-3.0-or-later
/* trk220: 📱 スマホ用の画面シェル（iPhone / Android）。
   ・PC では何もしない（body に trk-mobile を付けない・ナビを作らない・CSS も当たらない）
   ・スマホでは下部ナビの5つの行き先（ライブラリ／エフェクト／再生／書斎／ゲーム）を出す
   ・保存キーを増やさない（設定の欄の記憶だけ trk_mobile_settings_panels_v1）
   ・「＋ コンテンツを追加」の折りたたみは、中の id を変えない（library.js の配線を壊さない） */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const shellSrc = read("js/mobile-shell.js");
const panelsSrc = read("js/mobile-settings-panels.js");
const cssSrc = read("css/mobile-shell.css");
const html = read("index.html");
const i18nSrc = read("js/i18n.js");

/* ---------- 偽の DOM（mobile-shell.js が使う範囲だけ） ---------- */
function fakeDom() {
  const created = [];
  function makeNode(tagName) {
    const node = {
      tagName: String(tagName).toUpperCase(), id: "", className: "", type: "",
      textContent: "", hidden: false, disabled: false, open: false, value: "", parentNode: null,
      childNodes: [], dataset: {}, attributes: {}, style: { setProperty() {} },
      classList: {
        set: new Set(),
        add(c) { this.set.add(c); },
        remove(c) { this.set.delete(c); },
        toggle(c, on) { if (on === undefined ? !this.set.has(c) : on) this.set.add(c); else this.set.delete(c); },
        contains(c) { return this.set.has(c); }
      },
      append(...kids) { for (const kid of kids) { kid.parentNode = node; node.childNodes.push(kid); } },
      appendChild(kid) { node.append(kid); return kid; },
      insertBefore(kid) { node.append(kid); return kid; },
      replaceChildren() { node.childNodes.length = 0; },
      remove() { if (node.parentNode) node.parentNode.childNodes = node.parentNode.childNodes.filter(k => k !== node); },
      setAttribute(name, value) { node.attributes[name] = String(value); },
      removeAttribute(name) { delete node.attributes[name]; },
      addEventListener() {},
      removeEventListener() {},
      focus() {},
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
      matches: () => false,
      scrollIntoView() {}
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
  body.classList.add("apk-free");
  const document = {
    body,
    readyState: "complete",
    createElement: tag => makeNode(tag),
    createTextNode: text => ({ textContent: text }),
    getElementById: id => body.childNodes.find(n => n.id === id) || null,
    querySelector: sel => {
      if (sel === "#selectScreen .selectGrid") return makeNode("div");
      if (sel && sel.startsWith("#fxPanel")) return null;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener() {},
    activeElement: null
  };
  return { document, body, created, makeNode };
}

function runShell({ mobile = true } = {}) {
  const dom = fakeDom();
  const events = [];
  const core = {
    settings: { language: "ja" },
    phase: "title",
    on(name, fn) { events.push({ name, fn }); },
    video: null,
    currentSong: null,
    videoReady: false,
    openSettings() {}
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
    matchMedia: window.matchMedia
  });
  vm.runInContext(shellSrc, context, { filename: "js/mobile-shell.js" });
  return { dom, core, events, window };
}

describe("trk220 スマホ用シェルは、スマホのときだけ働く", () => {
  test("PC（粗いポインタでない・モバイルの UA でない）では body に印を付けず、ナビも作らない", () => {
    const { dom } = runShell({ mobile: false });
    assert.equal(dom.body.classList.contains("trk-mobile"), false, "PC では trk-mobile を付けない");
    const nav = dom.created.find(n => n.className === "trk-mobile-nav");
    assert.equal(nav, undefined, "ナビを作らない");
    assert.equal(dom.created.some(n => n.className === "trk-effects"), false, "エフェクト画面も作らない");
  });

  test("スマホでは印を付け、下部ナビに5つの行き先を並べる", () => {
    const { dom } = runShell({ mobile: true });
    assert.ok(dom.body.classList.contains("trk-mobile"), "trk-mobile を付ける");
    const nav = dom.body.childNodes.find(n => n.className === "trk-mobile-nav");
    assert.ok(nav, "ナビを body に付ける");
    assert.deepEqual(nav.childNodes.map(b => b.dataset.destination), ["library", "effects", "player", "study", "game"]);
    for (const button of nav.childNodes) {
      assert.equal(button.type, "button", "ボタン");
      assert.ok(button.childNodes.some(child => child.className === "trk-mobile-nav-label"), "文字のラベル");
    }
  });

  test("行き先の文字は4言語そろっている", () => {
    for (const key of ["navLabel", "import", "game", "sound", "eq", "video", "advanced", "play", "pause", "noTrack", "rotateTitle", "rotateHint"]) {
      const count = (shellSrc.match(new RegExp(`\\b${key}: `, "g")) || []).length;
      assert.equal(count, 4, `${key} は4言語（ja/en/zh/ko）`);
    }
  });

  test("端末の判定は TrkLite.info() を1か所だけ使い、二重に持たない", () => {
    assert.ok(shellSrc.includes("TrkLite.info"), "軽量化の判定を借りる");
    const uaChecks = (shellSrc.match(/pointer:coarse/g) || []).length;
    assert.equal(uaChecks, 1, "控えの判定は1か所だけ");
  });

  test("新しい保存キーを増やさない（本体の設定キーにも触らない）", () => {
    assert.equal(shellSrc.includes("localStorage"), false, "シェル自身は保存しない");
    assert.ok(panelsSrc.includes('const storageKey = "trk_mobile_settings_panels_v1";'), "欄の記憶だけ専用のキー");
    assert.equal(/localStorage\.setItem\("(?!trk_mobile_settings_panels_v1)/.test(panelsSrc), false, "ほかのキーへ書かない");
    assert.equal(/shadow_taiko_preferences_v2/.test(panelsSrc.replace(/\/\*[\s\S]*?\*\//g, "")), false, "本体の設定は触らない");
  });

  test("CSS はスマホのときだけ効く（PC の見た目を変えない）", () => {
    const allowed = [
      /^\.trk-mobile/, /^body\.ios/, /^\.ios-?[A-Za-z]/, /^\.trk-import( |$)/, /^\.rotateHint/,
      /^\.trk-effects/, /^\.trk-effect-/, /^\.trk-eq-/, /^\.trk-media-effects/, /^#mediaPlayerMode \.trk-/,
      /^#trkEqReset/, /^@media/, /^\/\*/, /^\s*\*/, /^\s*$/, /^}/
    ];
    const rules = cssSrc.split("\n").filter(line => /\{\s*$/.test(line.trim()) || /^[.#\[]/.test(line));
    for (const line of rules) {
      const selector = line.trim();
      if (!selector || selector.startsWith("/*") || selector.startsWith("*")) continue;
      assert.ok(allowed.some(rule => rule.test(selector) || rule.test(selector.split("{")[0].trim())),
        `スマホ以外にも当たる規則は書かない: ${selector}`);
    }
    /* 端末の高さ・幅でなく、body の印で切り替える */
    assert.ok(cssSrc.includes(".trk-mobile #stage[data-phase=\"title\"]"), "タイトル画面だけ実ピクセルにする");
    assert.ok(cssSrc.includes("env(safe-area-inset-bottom)"), "セーフエリアを避ける");
  });

  test("ゲーム中のステージ（1920×1080）は触らない", () => {
    assert.ok(cssSrc.includes('[data-phase="title"]'), "タイトル画面だけを対象にする");
    const rules = cssSrc.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.equal(/\[data-phase="(play|pause|result)"\]/.test(rules), false, "プレイ中の見た目は変えない");
  });
});

describe("trk220 index.html の配線", () => {
  test("CSS と JS を読み、順番が正しい（core と lite の後、body の最後）", () => {
    assert.ok(html.includes('<link rel="stylesheet" href="css/mobile-shell.css">'), "CSS");
    assert.ok(html.includes('<script src="js/mobile-shell.js"></script>'), "JS");
    assert.ok(html.includes('<script src="js/mobile-settings-panels.js"></script>'), "設定の欄の記憶");
    const lite = html.indexOf('<script src="js/lite.js"></script>');
    const shell = html.indexOf('<script src="js/mobile-shell.js"></script>');
    const media = html.indexOf('<script src="js/media-player-mode.js"></script>');
    assert.ok(lite > 0 && media > 0 && shell > media, "lite.js とメディアプレーヤーの後に読む");
  });

  test("「＋ コンテンツを追加」の折りたたみは、中の id をそのまま残す", () => {
    const start = html.indexOf('<details class="trk-import" id="trkImportDetails"');
    const end = html.indexOf("</details>", start);
    assert.ok(start > 0 && end > start, "折りたたみがある");
    const block = html.slice(start, end);
    for (const id of ["libOpenBtn", "libShareBtn", "libReconnectBtn", "libRescanBtn", "mediaFile", "videoFile", "songPackFile", "trkImportSummary"]) {
      assert.ok(block.includes(`id="${id}"`), `${id} は折りたたみの中`);
    }
    assert.ok(/<details class="trk-import" id="trkImportDetails" open>/.test(html), "PC では開いた状態から始める");
    assert.ok(block.includes('class="miniActions"'), "並びは今までどおり miniActions");
  });

  test("ライブラリの操作ボタンは、これまでと同じ場所（songCol の libPanel）にある", () => {
    const lib = html.indexOf('id="libPanel"');
    assert.ok(lib > 0);
    const libOpen = html.indexOf('id="libOpenBtn"');
    assert.ok(libOpen > lib, "libPanel の中");
    assert.ok(libOpen < html.indexOf('id="libList"'), "曲リストより前");
  });
});

/* ---------- 設定の欄の記憶（js/mobile-settings-panels.js） ---------- */
function panelsHarness(saved = {}, { searching = "" } = {}) {
  const store = new Map();
  if (Object.keys(saved).length) store.set("trk_mobile_settings_panels_v1", JSON.stringify(saved));
  const listeners = {};
  function makePanel(id, key, open = false) {
    const summary = { tagName: "SUMMARY", dataset: key ? { i18n: key } : {}, querySelector: () => null };
    const panel = {
      tagName: "DETAILS", id, open, children: [summary],
      closest: () => null,
      contains: () => true
    };
    summary.parentElement = panel;
    return panel;
  }
  const panels = [makePanel("soundPanel", null, true), makePanel("", "secDisplay", true), makePanel("fxEq", null, true)];
  const search = { value: searching };
  const settingsScreen = {
    contains: () => true,
    querySelectorAll: () => panels,
    addEventListener: (type, fn) => { listeners[type] = fn; }
  };
  const timers = [];
  const context = vm.createContext({
    console,
    document: {
      body: { classList: { contains: c => c === "trk-mobile" } },
      readyState: "complete",
      getElementById: id => (id === "settingsScreen" ? settingsScreen : id === "settingsSearch" ? search : null),
      addEventListener() {}
    },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value)
    },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    JSON, Array, Object, String
  });
  vm.runInContext(panelsSrc, context, { filename: "js/mobile-settings-panels.js" });
  return { panels, listeners, timers, search, store };
}

describe("trk220 設定で開いた欄を覚える（スマホだけ）", () => {
  test("保存した欄だけを開き、そのほかは閉じる", () => {
    const { panels } = panelsHarness({ "label:secDisplay": true, "id:fxEq": false });
    assert.equal(panels[0].open, false, "id:soundPanel は記録が無いので閉じる");
    assert.equal(panels[1].open, true, "label:secDisplay は保存どおり開く");
    assert.equal(panels[2].open, false, "閉じた記録も再現する");
  });

  /* ブラウザでは、summary を押すと click の後に details が開閉する。偽の DOM では同じ順番を手で作る。 */
  function press(panel, listeners, { open }) {
    listeners.click({ target: { closest: () => panel.children[0] }, defaultPrevented: false });
    panel.open = open;
  }

  test("利用者が押して実際に変わったときだけ保存する", () => {
    const { panels, listeners, timers, store } = panelsHarness({});
    assert.equal(panels[1].open, false, "記録が無いので閉じている");
    press(panels[1], listeners, { open: true });
    assert.equal(timers.length, 1, "details の既定動作の後に確かめる");
    timers[0]();
    assert.deepEqual(JSON.parse(store.get("trk_mobile_settings_panels_v1")), { "label:secDisplay": true });
  });

  test("閉じた操作も覚える（次に開いたとき、その欄は閉じたまま）", () => {
    const { panels, listeners, timers, store } = panelsHarness({ "label:secDisplay": true });
    assert.equal(panels[1].open, true);
    press(panels[1], listeners, { open: false });
    timers[0]();
    assert.deepEqual(JSON.parse(store.get("trk_mobile_settings_panels_v1")), { "label:secDisplay": false });
  });

  test("設定の絞り込み（🔍）が開いた欄は覚えない", () => {
    const { listeners, timers, store } = panelsHarness({}, { searching: "音量" });
    assert.equal(timers.length, 0, "絞り込み中は記録しない");
    assert.equal(store.has("trk_mobile_settings_panels_v1"), false);
    assert.ok(listeners.click, "押しても");
  });

  test("変わっていないクリック（開閉が動かなかったとき）は保存しない", () => {
    const { panels, listeners, timers, store } = panelsHarness({});
    listeners.click({ target: { closest: () => panels[1].children[0] }, defaultPrevented: false });
    timers[0]();   /* details が動かなかった（検索の取り消しなど） */
    assert.equal(store.has("trk_mobile_settings_panels_v1"), false, "開閉が変わっていない");
  });

  test("プリセットの折りたたみ（.fxGrid）は対象にしない", () => {
    const { panels, listeners, timers } = panelsHarness({});
    const inGrid = { tagName: "DETAILS", id: "presetX", children: [{ tagName: "SUMMARY", dataset: {} }], closest: sel => (sel === ".fxGrid" ? {} : null) };
    inGrid.children[0].parentElement = inGrid;
    listeners.click({ target: { closest: () => inGrid.children[0] }, defaultPrevented: false });
    assert.equal(timers.length, 0, "エフェクトのプリセットは覚えない");
    assert.ok(panels.length === 3);
  });
});

describe("trk220 文言（4言語）", () => {
  test("画面シェルが使う文言は、すべて4言語そろっている", () => {
    const keys = ["navLabel", "import", "game", "noTrack"];
    for (const key of keys) assert.ok(shellSrc.includes(`${key}:`), `${key} がある`);
  });

  test("「＋ コンテンツを追加」の文言は i18n に4言語ぶんある", () => {
    assert.equal((i18nSrc.match(/\blibImportToggle:"/g) || []).length, 4);
  });

  test("iOS 向けの言い換え（フォルダを選ぶ）も4言語ぶんある", () => {
    for (const key of ["libPickFolderIos", "libShareHintIos"]) {
      assert.equal((i18nSrc.match(new RegExp(`\\b${key}:"`, "g")) || []).length, 4, key);
    }
  });
});

describe("trk220 逃げ道と重なりを残す", () => {
  test("🛟 セーフモードの浮きボタンは、窓が開いたときだけ引っ込める（プレイ中も残す）", () => {
    assert.ok(/floatingButton\.hidden = blockingModal;/.test(shellSrc), "窓が開いたときだけ隠す");
    assert.equal(/floatingButton\.hidden = core\.phase !== "title"/.test(shellSrc), false, "プレイ中でも消さない");
  });

  test("ナビは、別の窓（プレイリスト・ようこそ・インストール案内）が開いたら引っ込める", () => {
    assert.ok(shellSrc.includes("nav.hidden = core.phase !== \"title\""), "タイトル画面のときだけ出す");
    assert.ok(shellSrc.includes("blockingModal"), "窓が開いているかを見る");
    assert.ok(shellSrc.includes(".plOverlay,[role=\"dialog\"][aria-modal=\"true\"]"), "モーダルを数える");
  });

  test("再生画面の開閉は、core の overlay の窓口を包んで受け取る（メディアプレーヤーはイベントを出さない）", () => {
    assert.ok(shellSrc.includes("watchOverlay"), "包む関数がある");
    assert.ok(shellSrc.includes("original.call(overlay, name, open)"), "元の動きはそのまま");
    assert.ok(shellSrc.includes('if (name === "media") sync();'), "メディアのときだけ同期");
  });
});
