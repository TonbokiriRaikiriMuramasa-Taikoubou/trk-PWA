// SPDX-License-Identifier: GPL-3.0-or-later
/* 🧭 trk223（2026-10-31 レビュー）：指摘された5点のうち、機械で確かめられるものを「規則と数値」で見る。

   ① スマホ型のエフェクトのタブで ▶ TV が出ない／.songCol の gap が消える
   ② 拡大率 125% でカードの下端が再生バーの裏へ入る（倍率の基準が 1080 固定だった）
   ③ 手渡し用ZIPに vendor（three-mmd-loader の dist/）が入らない
   ④ 同じオリジンに2つの trk! を置くと、片方の更新がもう片方のキャッシュを消す
   ⑤ 古い版が保存すると、新しい版の設定（uiScale・uiMode など）が消える

   文字列の includes ではなく、css の規則を当てて勝つ値を出し（tests/helpers/css-rules.mjs）、
   JS は vm で動かして数値を確かめます。ブラウザの実装ではないので、実機の見た目は別に確かめます。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";
import { readRules, parseRules, computed, el } from "./helpers/css-rules.mjs";
import { runBar } from "./helpers/player-bar-harness.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const shellCss = read("css/mobile-shell.css");
const styleCss = read("css/style.css");
const barCss = read("css/player-bar.css");
const swSrc = read("sw.js");
const coreSrc = read("js/core.js");
const shellSrc = read("js/mobile-shell.js");

const html = el("html");

/* ---------- ① スマホ型：エフェクトのタブ ---------- */
describe("trk223 ① スマホ型のエフェクトのタブで、▶ TV と欄が出る", () => {
  const rules = [...readRules("css/mobile-shell.css", ROOT), ...readRules("css/style.css", ROOT)];
  const bodyFor = ({ view = "library", fxInLibrary = false } = {}) =>
    el("body", { classes: ["trk-mobile", ...(fxInLibrary ? ["trk-fx-in-library"] : [])], attrs: { "data-trk-view": view } });
  const displayOf = (target, { view, fxInLibrary } = {}) => {
    const win = computed(rules, "display", target, [html, bodyFor({ view, fxInLibrary }), el("div", { classes: ["songCol"] })]);
    return win ? win.value : "";
  };

  test("▶ TV（#tvDock）は、エフェクトのタブでは隠さない", () => {
    const tv = el("div", { id: "tvDock", classes: ["fxDock"] });
    assert.notEqual(displayOf(tv, { view: "effects" }), "none", "エフェクトのタブでは出す");
    assert.notEqual(displayOf(tv, { view: "effects", fxInLibrary: true }), "none");
  });

  test("ライブラリのタブでは、設定（ライブラリにも出す）がオフなら隠す", () => {
    const tv = el("div", { id: "tvDock" });
    const win = computed(rules, "display", tv, [html, bodyFor({ view: "library" }), el("div", { classes: ["songCol"] })]);
    assert.equal(win.value, "none");
    assert.equal(win.important, true, "ほかの display 指定に負けない（!important）");
    assert.notEqual(displayOf(el("div", { id: "fxDock" }), { view: "effects" }), "none", "🎛 エフェクトも出る");
  });

  test("エフェクトのタブでも .songCol は flex のまま（gap が消えない）", () => {
    const songCol = el("div", { classes: ["songCol"] });
    const win = computed(rules, "display", songCol, [html, bodyFor({ view: "effects" })]);
    assert.equal(win.value, "flex", "trk222 の display:block をやめた");
    /* 列の向きと gap は css/style.css の .songCol から引き継ぐ */
    const base = computed(parseRules(styleCss, { file: "css/style.css" }), "gap", songCol, [html, bodyFor({ view: "effects" })]);
    assert.equal(base.value, "14px", "欄の間隔は 14px のまま");
    const baseDisplay = computed(parseRules(styleCss, { file: "css/style.css" }), "display", songCol, [html]);
    assert.equal(baseDisplay.value, "flex");
  });

  test("エフェクトのタブでも、曲リストと検索は隠す（欄だけ残す）", () => {
    const rulesOnly = readRules("css/mobile-shell.css", ROOT);
    const body = bodyFor({ view: "effects" });
    const hidden = id => {
      const win = computed(rulesOnly, "display", el("section", { id }), [html, body, el("div", { classes: ["songCol"] })]);
      return win ? win.value : "";
    };
    assert.equal(hidden("libPanel"), "none", "曲リストは隠す");
    assert.notEqual(hidden("fxDock"), "none", "🎛 エフェクトの欄は残す");
    assert.notEqual(hidden("tvDock"), "none", "▶ TV の欄は残す");
    assert.notEqual(hidden("ampPanel"), "none", "TRKアンプの欄は残す");
    /* 検索・並べ替えは曲リスト（#libPanel）の中なので、曲リストを隠せば一緒に隠れる */
  });
});

/* ---------- ② 再生バーとカードの重なり ---------- */
describe("trk223 ② 拡大率を変えても、カードの下端が再生バーの裏に入らない", () => {
  const barRules = readRules("css/player-bar.css", ROOT);
  const styleRules = parseRules(styleCss, { file: "css/style.css" });
  const body = el("body", { classes: ["trk-playerbar"] });
  const stage = el("div", { id: "stage" });
  const screen = el("div", { classes: ["screen"] });

  test("css：ステージの高さから決める（1020px の決め打ちをやめた）", () => {
    const maxHeight = computed(barRules, "max-height", el("div", { classes: ["card"] }), [html, body, stage, screen]);
    assert.equal(maxHeight.value, "100%", "カードは .screen の内容の高さに収める");
    const padding = computed(barRules, "padding-bottom", screen, [html, body, stage]);
    assert.equal(padding.value, "calc(30px + var(--trk-playerbar-stage-h, 64px))", "バーの高さぶん下を空ける");
    /* もとの余白（30px）と、カードの overflow:auto はそのまま */
    const basePadding = computed(styleRules, "padding", screen, [html, body, stage]);
    assert.equal(basePadding.value, "30px");
    const overflow = computed(styleRules, "overflow", el("div", { classes: ["card"] }), [html, body, stage, screen]);
    assert.equal(overflow.value, "auto");
    assert.ok(!/calc\(1020px/.test(barCss), "1020px の決め打ちが残っていない");
  });

  /* 画面 1440×900・再生バーの実寸 60px のとき、4段の拡大率で重ならないか（設計座標で計算） */
  const cases = [
    /* 拡大率, ステージの設計の高さ, 画面に出ている高さ */
    { percent: 50, designH: 2160 },
    { percent: 75, designH: 1440 },
    { percent: 100, designH: 1080 },
    { percent: 125, designH: 864 }
  ];
  const barReal = 60;
  const screenH = 810;  /* min(1440/1920, 900/1080) = 0.75 → 1080 × 0.75 */

  for (const { percent, designH } of cases) {
    test(`拡大率 ${percent}%：カードの下端はバーの上端より上`, () => {
      const { dom } = runBar({ stage: { designH, screenH } });
      const vars = dom.document.documentElement.style.values;
      const stageHVar = Number(String(vars["--trk-playerbar-stage-h"]).replace("px", ""));
      const scale = screenH / designH;
      assert.equal(stageHVar, Math.ceil(barReal / scale), "バーの高さを設計の座標に直して配る");

      /* css の規則（.screen の余白 30px＋バー、カードは内容の高さまで）をそのまま計算する */
      const cardMaxDesign = designH - 30 - (30 + stageHVar);
      const cardBottomReal = (30 + cardMaxDesign) * scale;
      const barTopReal = screenH - barReal;
      assert.ok(cardBottomReal <= barTopReal + 0.001,
        `カードの下端 ${cardBottomReal.toFixed(1)}px はバーの上端 ${barTopReal}px より上`);
      assert.ok(cardMaxDesign > 0, "カードの高さが残る");
    });
  }

  test("倍率の基準はステージの設計の高さ（transform の影響を受けない offsetHeight）", () => {
    /* 同じ「画面に出ている高さ」でも、設計の高さが違えば配る値も変わる */
    const a = runBar({ stage: { designH: 1080, screenH: 810 } });
    const b = runBar({ stage: { designH: 864, screenH: 810 } });
    assert.equal(a.dom.document.documentElement.style.values["--trk-playerbar-stage-h"], "80px");
    assert.equal(b.dom.document.documentElement.style.values["--trk-playerbar-stage-h"], "64px");
  });

  test("ステージが無い・スマホ型・極端に小さいときの控え", () => {
    const noStage = runBar();
    assert.equal(noStage.dom.document.documentElement.style.values["--trk-playerbar-stage-h"], "60px", "ステージが無ければ 1080 として扱う");
    const mobile = runBar({ mobile: true, stage: { designH: 812, screenH: 812 } });
    assert.equal(mobile.dom.document.documentElement.style.values["--trk-playerbar-stage-h"], "60px", "スマホ型は拡大しない（等倍）");
    const tiny = runBar({ stage: { designH: 1080, screenH: 1 } });
    const value = Number(String(tiny.dom.document.documentElement.style.values["--trk-playerbar-stage-h"]).replace("px", ""));
    assert.equal(value, 1200, "倍率の下限 0.05 で頭打ち（60 / 0.05）");
  });

  test("拡大率が変わったら測り直す（uiscale を購読している）", () => {
    const { events } = runBar();
    const names = events.map(e => e.name);
    assert.ok(names.includes("uiscale"), "uiscale で sync（＝測り直し）する");
    assert.ok(swSrc.length > 0);
  });
});

/* ---------- ④ キャッシュの持ち主 ---------- */
describe("trk223 ④ 自分のスコープのキャッシュだけを片付ける", () => {
  const scopeTagFn = swSrc.match(/function scopeTagOf\(pathname\) \{[\s\S]*?\n\}/)[0];
  const cacheIsOursFn = swSrc.match(/async function cacheIsOurs\(key\) \{[\s\S]*?\n\}/)[0];

  /* 🧭 trk224：版は sw.js の CACHE から読む（テストに書き写すと、版を上げるたびに直すことになる）。
     形（trk-v<日付>-trk<番号>）と、trk223 以降であることは別に確かめる。 */
  const CACHE_IN_SW = (swSrc.match(/^const CACHE = "([^"]+)";$/m) || [])[1];

  function harness({ scope = "https://x/trk-PWA/", keys = [], contents = {} } = {}) {
    const deleted = [];
    const caches = {
      keys: async () => [...keys],
      open: async key => ({ keys: async () => (contents[key] || []).map(url => ({ url })) }),
      delete: async key => { deleted.push(key); return true; }
    };
    const sandbox = { caches, URL, self: { registration: { scope }, clients: { claim: async () => {} } }, console };
    vm.createContext(sandbox);
    vm.runInContext(`
${scopeTagFn}
const SCOPE = new URL(self.registration.scope);
const SCOPE_TAG = scopeTagOf(SCOPE.pathname);
const CACHE = ${JSON.stringify(CACHE_IN_SW)};
const CACHE_PREFIX = "trk-";
const CACHE_NAME = CACHE + "@" + SCOPE_TAG;
const VENDOR_CACHE_BASE = "trk-vendor-v1";
const VENDOR_CACHE = VENDOR_CACHE_BASE + "@" + SCOPE_TAG;
const SHARE_CACHE = "trk-share-inbox-v1";
const SHARE_CACHE_NAME = SHARE_CACHE + "@" + SCOPE_TAG;
${cacheIsOursFn}
globalThis.__isOurs = cacheIsOurs;
globalThis.__names = { CACHE_NAME, VENDOR_CACHE, SHARE_CACHE_NAME, SCOPE_TAG };
`, sandbox, { filename: "sw.js#cache-owner" });
    return { sandbox, deleted, isOurs: sandbox.__isOurs, names: sandbox.__names };
  }

  test("名前の印：スコープのパスから作る（/ は root）", async () => {
    const h = harness({ scope: "https://x/trk-PWA/" });
    assert.match(CACHE_IN_SW, /^trk-v\d{4}\.\d{2}\.\d{2}-trk\d+$/, "CACHE の形は変えない（検査と同じ）");
    assert.ok(Number(CACHE_IN_SW.match(/-trk(\d+)$/)[1]) >= 223, "trk223 以降");
    assert.equal(h.names.CACHE_NAME, `${CACHE_IN_SW}@trk-pwa`);
    assert.equal(h.names.SHARE_CACHE_NAME, "trk-share-inbox-v1@trk-pwa");
    assert.equal(h.names.VENDOR_CACHE, "trk-vendor-v1@trk-pwa");
  });

  test("別のスコープのキャッシュは、自分のものと認めない", async () => {
    const h = harness({ scope: "https://x/trk-PWA/" });
    assert.equal(await h.isOurs(`${CACHE_IN_SW}@trk`), false, "trk! の trk223");
    assert.equal(await h.isOurs(`${CACHE_IN_SW}@trk-pwa`), true);
    assert.equal(await h.isOurs("trk-vendor-v1@trk-pwa"), true);
    assert.equal(await h.isOurs("trk-share-inbox-v1@trk-pwa"), true);
    assert.equal(await h.isOurs("trk-vendor-v1@trk"), false, "vendor も取り違えない");
  });

  test("印の無い古い名前は、中身に自分のパスの URL があるかで見分ける", async () => {
    const h = harness({
      scope: "https://x/trk-PWA/",
      contents: {
        "trk-v2026.10.30-trk222": ["https://x/trk-PWA/js/core.js"],
        "trk-v2026.10.30-trk221": ["https://x/trk/js/core.js"]
      }
    });
    assert.equal(await h.isOurs("trk-v2026.10.30-trk222"), true, "自分のパスを持つ旧キャッシュは片付ける");
    assert.equal(await h.isOurs("trk-v2026.10.30-trk221"), false, "別のスコープの旧キャッシュは残す");
  });

  test("ルート（/）のアプリは、印の無い名前を自分のものとして片付ける", async () => {
    const h = harness({ scope: "https://x/", contents: { "trk-v2026.10.30-trk222": [] } });
    assert.equal(h.names.SCOPE_TAG, "root");
    assert.equal(await h.isOurs("trk-v2026.10.30-trk222"), true);
  });
});

/* ---------- ⑤ 設定の保存（マージ） ---------- */
describe("trk223 ⑤ 古い版が保存しても、新しい版の設定を消さない", () => {
  function prefsHarness({ stored = null } = {}) {
    const store = { [stored ? "shadow_taiko_preferences_v2" : "__none__"]: stored ? JSON.stringify(stored) : undefined };
    const localStorage = {
      getItem: key => (store[key] === undefined ? null : store[key]),
      setItem: (key, value) => { store[key] = String(value); }
    };
    const sandbox = { localStorage, PREFS_KEY: "shadow_taiko_preferences_v2", settings: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(`
${coreSrc.match(/function storedPrefsRaw\(\) \{[\s\S]*?\n\}/)[0]}
${coreSrc.match(/function saveUserPrefs\(\{ fresh = false \} = \{\}\) \{[\s\S]*?\n\}/)[0]}
function prefsForSave() { return settings; }
globalThis.__save = saveUserPrefs;
globalThis.__raw = () => JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
`, sandbox, { filename: "js/core.js#prefs" });
    return { sandbox, save: sandbox.__save, raw: sandbox.__raw, store };
  }

  test("知らないキー（新しい版の設定）は残したまま、自分の値を重ねる", () => {
    const h = prefsHarness({ stored: { uiScale: 125, playerBar: "on", skin: "old-skin", uiMode: "mobile" } });
    h.sandbox.settings = { skin: "shadow", playerBar: "auto" };
    h.save();
    const saved = h.raw();
    assert.equal(saved.uiScale, 125, "新しい版の拡大率が残る");
    assert.equal(saved.uiMode, "mobile", "画面の形も残る");
    assert.equal(saved.skin, "shadow", "自分が知っている値は上書きする");
    assert.equal(saved.playerBar, "auto");
  });

  test("壊れた保存値（配列・文字列・JSON でない）でも落ちない", () => {
    for (const stored of ["[1,2,3]", "\"text\"", "{broken"]) {
      const store = { shadow_taiko_preferences_v2: stored };
      const sandbox = {
        localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
        PREFS_KEY: "shadow_taiko_preferences_v2", settings: { skin: "shadow" }, console
      };
      vm.createContext(sandbox);
      vm.runInContext(`
${coreSrc.match(/function storedPrefsRaw\(\) \{[\s\S]*?\n\}/)[0]}
${coreSrc.match(/function saveUserPrefs\(\{ fresh = false \} = \{\}\) \{[\s\S]*?\n\}/)[0]}
function prefsForSave() { return settings; }
saveUserPrefs();
`, sandbox);
      const saved = JSON.parse(store.shadow_taiko_preferences_v2);
      assert.equal(saved.skin, "shadow", `${stored} から作り直す`);
    }
  });

  test("工場出荷に戻したとき（fresh）は、きれいに置き換える", () => {
    const h = prefsHarness({ stored: { uiScale: 125, playerBar: "on" } });
    h.sandbox.settings = { skin: "shadow" };
    h.save({ fresh: true });
    /* vm の別世界のオブジェクトなので、こちら側の作り直してから比べる */
    assert.deepEqual({ ...h.raw() }, { skin: "shadow" }, "知らないキーを残さない（初期化の意味を保つ）");
  });
});

describe("trk223 ⑤ 画面の形の固定がオフなら、保存値をそのまま使わない", () => {
  const uiModeFn = shellSrc.match(/function uiMode\(\) \{[\s\S]*?\n  \}/)[0];
  function run({ lock, stored, session = null }) {
    const sandbox = { core: { settings: { uiMode: stored, uiModeLock: lock } }, UI_MODES: ["auto", "desktop", "mobile"] };
    vm.createContext(sandbox);
    vm.runInContext(`let sessionMode = ${JSON.stringify(session)};\n${uiModeFn}\nglobalThis.__mode = uiMode();`, sandbox);
    return sandbox.__mode;
  }
  test("固定がオン：保存した形を使う", () => {
    assert.equal(run({ lock: true, stored: "mobile" }), "mobile");
  });
  test("固定がオフ：保存した形は使わず、端末に合わせる（auto）", () => {
    assert.equal(run({ lock: false, stored: "mobile" }), "auto");
  });
  test("固定がオフでも、その場で選んだ形は使う", () => {
    assert.equal(run({ lock: false, stored: "mobile", session: "desktop" }), "desktop");
  });
  test("壊れた保存値は auto", () => {
    assert.equal(run({ lock: true, stored: "tablet" }), "auto");
  });
});

/* ---------- F2（trk223 レビュー）：ZIPの中の文書は、ZIP自身のハッシュを書かない ----------
   ZIP に入る文書に「そのZIPの sha256」を書くと、固めた瞬間に古くなる（実際に、依頼書と HANDOFF に
   1回目のZIPのハッシュが残り、2回目のZIPと食い違った）。ハッシュは外側の README にだけ書く。
   ⚠ 「同じ行に両方あるとき」だけを見ると、行が折り返された版を見逃す（実際にそうなっていた）。
   ハッシュの前後2行までに手渡し用ZIPの名前があれば違反とする。上流 trk の配布ZIPのハッシュ
   （`trk-slim-*` や 1.1.x の表）は、このリポジトリのZIPではないので対象外。 */
const OUR_ZIP_NAME = /trk-(?:standalone|handover)-\d{4}-\d{2}-\d{2}/;
const HEX64_ALL = /\b[0-9a-f]{64}\b/g;
/** その文書の中で「手渡し用ZIPの名前の近く」にある64桁hexを返す（違反の一覧） */
function hashesNearHandoverZip(text) {
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(HEX64_ALL)) {
      const around = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
      if (OUR_ZIP_NAME.test(around)) hits.push(`${i + 1}: ${m[0].slice(0, 8)}…`);
    }
  });
  return hits;
}

describe("trk223 F2 配布物の中の文書は、ZIP自身のハッシュを書かない", () => {
  const shipped = [
    "docs/HANDOFF.md",
    "docs/HANDOFF-ARCHIVE.md",
    "docs/REVIEW-REQUEST-TRK223-2026-10-31.md",
    "docs/REVIEW-RESPONSE-2026-10-31.md",
    "docs/REVIEW-FIX-TRK224-2026-10-31.md",
    "release/README-standalone.txt"
  ];
  for (const rel of shipped) {
    test(`${rel}：手渡し用ZIPの名前の近くに 64桁のハッシュを書かない`, () => {
      assert.deepEqual(hashesNearHandoverZip(read(rel)), []);
    });
  }
  test("依頼書は、ハッシュの置き場所（外側の README）を指している", () => {
    const text = read("docs/REVIEW-REQUEST-TRK223-2026-10-31.md");
    /* 版は上がるので、名前の形で見る（trk223 → trk224 → trk225 …） */
    assert.match(text, /README-まず読む-2026-10-31-trk\d+\.txt/, "外側の README の名前を書く");
    assert.match(text, /ZIP自身のハッシュは書きません/, "理由も書く");
  });
  test("この検査は、直す前の文面なら落ちる（検査が空回りしていない）", () => {
    /* 実際に食い違っていた当時の2行（ハッシュとZIPの名前が別の行）を持ってくる */
    const before = [
      "  - **手渡し用ZIP**：264ファイル・`sha256 a6134a0c5d35c6a2fb2ebabd91c6559fee345b849391e789540ce9d83ee36dbb`",
      "  - **配布の扱い**：`trk-standalone-2026-10-31-trk223.zip` を Drive に置いた。"
    ].join("\n");
    assert.equal(hashesNearHandoverZip(before).length, 1);
    /* 上流 trk の配布ZIPのハッシュは対象外（誤検知しない） */
    const upstream = "| 配布ZIP（1.1.8） | 227エントリ・`sha256 8075ce5bc3a15af65273455b5f29ed9be9657283ecf9b61dedda9d80274be9c2` |";
    assert.deepEqual(hashesNearHandoverZip(upstream), []);
  });
});

/* ---------- ③ 手渡し用ZIPの中身 ---------- */
describe("trk223 ③ 配布ZIPに vendor（dist/ を含む）が入る", () => {
  test("集める一覧の規則：必要な dist/ は入れ、開発用は入れない", async () => {
    const { includeRel } = await import("../tools/pack-standalone.mjs");
    /* 2026-10-31 のZIPで抜けたもの（レビュー③） */
    assert.equal(includeRel("assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/index.js"), true, "深い dist/ は必要");
    assert.equal(includeRel("assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/skeleton.js"), true);
    assert.equal(includeRel("assets/vendor/@pixiv/three-vrm@3.5.5/lib/three-vrm.module.min.js"), true);
    for (const rel of ["tests/trk223-review.test.mjs", "tools/vendor-lock.json", ".github/workflows/pages.yml",
      "package.json", "capacitor.config.ts", "CONTRIBUTING.md", "docs/HANDOFF.md", "docs/REVIEW-REQUEST-2026-10-31.md",
      "dist/index.js", "node_modules/x/y.js"]) {
      assert.equal(includeRel(rel), false, `${rel} は入れない`);
    }
    assert.equal(includeRel("index.html"), true);
    assert.equal(includeRel("assets/mmd/lat-miku/preset.json"), true);
  });

  test("git が追跡しているファイルの一覧に、vendor-lock の全ファイルが入っている", async () => {
    const { pickFiles, vendorProblems, refProblems } = await import("../tools/pack-standalone.mjs");
    const files = pickFiles();
    assert.deepEqual(vendorProblems(files), [], "vendor が欠けていない");
    assert.deepEqual(refProblems(files), [], "index.html の参照が欠けていない");
    const lock = JSON.parse(read("tools/vendor-lock.json"));
    const expected = Object.values(lock.entries).map(e => e.local);
    assert.ok(expected.length >= 100, `vendor は ${expected.length} 件`);
    for (const rel of expected) assert.ok(files.includes(rel), `${rel} が一覧に入る`);
    assert.ok(!files.some(f => f.startsWith("tests/")), "テストは入れない");
  });
});
