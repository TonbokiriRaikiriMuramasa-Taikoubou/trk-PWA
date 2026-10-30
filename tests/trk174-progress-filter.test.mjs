// SPDX-License-Identifier: GPL-3.0-or-later
/* trk174: 📈 進捗フィルター（PLAYER-ROADMAP #15・未聴/継続/完了）。**表示層だけ**＝行を絞るだけで保存データは触らない。
   判定（libProgressOf）は位置記憶（trk_media_positions_v1・曲キー or 指紋）→ 再生回数（PLAYED の manual/auto/media・
   records の plays）の順。位置記憶は最後まで聴くと消える設計なので、「完了」は回数で見る。
   libPositions（localStorage の読み方）と判定を vm で抜き出して実動検証し、select・設定・4言語・既定値を走査する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const i18nSrc = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const htmlSrc = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

const grab = (pattern, label) => {
  const m = librarySrc.match(pattern);
  assert.ok(m, `${label} can be isolated from js/library.js`);
  return m[0];
};
const fnPositions = grab(/function libPositions\(\) \{[\s\S]*?\n\}/, "libPositions()");
const fnProgressOf = grab(/function libProgressOf\(x, positions\) \{[\s\S]*?\n\}/, "libProgressOf()");

function filterSandbox({ played = {}, keyFp = {}, stored = null } = {}) {
  const store = { "trk_media_positions_v1": stored };
  const sandbox = {
    window: {},
    PLAYED: played,
    songPrefs: { byFp: {}, keyFp },
    localStorage: { getItem: k => (k in store ? store[k] : null) },
    Number, Math, JSON, Array, Object, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${fnPositions}\n${fnProgressOf}\nwindow.__positions = libPositions; window.__of = libProgressOf;`,
    sandbox, { filename: "js/library.js#progress" });
  return sandbox.window;
}
const x = (key, info = null) => ({ it: { key }, info });

test("libPositions(): 壊れた保存・配列・null でも {} に落ちる（表示層なので絶対に投げない）", () => {
  assert.deepEqual({ ...filterSandbox({ stored: '{"k1": 42}' }).__positions() }, { k1: 42 });
  assert.deepEqual({ ...filterSandbox({ stored: "[1,2]" }).__positions() }, {});
  assert.deepEqual({ ...filterSandbox({ stored: "not json" }).__positions() }, {});
  assert.deepEqual({ ...filterSandbox({ stored: null }).__positions() }, {});
});

test("libProgressOf(): 位置記憶があれば「継続」（曲キー直撃と指紋の両方）", () => {
  const api = filterSandbox({ keyFp: { s2: "1000:120.5" } });
  assert.equal(api.__of(x("s1"), { s1: 33.5 }), "progress", "positions keyed by song key");
  assert.equal(api.__of(x("s2"), { "1000:120.5": 12 }), "progress", "positions keyed by fingerprint via keyFp (media player saves under core.fingerprint)");
  assert.equal(api.__of(x("s2"), { "1000:120.5": 0 }), "new", "a zero/negative position is no position");
});

test("libProgressOf(): 位置が消えていたら回数で「完了」（PLAYED の manual/auto/media・records の plays）", () => {
  assert.equal(filterSandbox({ played: { s: { last: 1, manual: 1, auto: 0 } } }).__of(x("s"), null), "done", "🎮 clear/manual listen");
  assert.equal(filterSandbox({ played: { s: { last: 1, manual: 0, auto: 2 } } }).__of(x("s"), null), "done", "🎮 AUTO/radio watch");
  assert.equal(filterSandbox({ played: { s: { last: 1, manual: 0, auto: 0, media: 1 } } }).__of(x("s"), null), "done", "🎧 player listen (trk172)");
  assert.equal(filterSandbox().__of(x("s", { plays: 3 }), null), "done", "records plays without a PLAYED entry");
  assert.equal(filterSandbox().__of(x("s", { plays: 0 }), null), "new", "a record with zero plays is still unplayed");
});

test("libProgressOf(): 位置が勝つ（聴きかけは完了カウントがあっても「継続」）・何も無ければ「未聴」", () => {
  const api = filterSandbox({ played: { s: { last: 1, manual: 5, auto: 0, media: 2 } } });
  assert.equal(api.__of(x("s"), { s: 40 }), "progress", "half-finished wins over finished-before");
  assert.equal(filterSandbox().__of(x("s"), {}), "new");
});

/* ---------- 配線の走査 ---------- */
test("index.html / library.js: 📈 select と絞り込みの配線（表示層だけ＝書き込み経路なし）", () => {
  assert.ok(htmlSrc.includes('<select id="libProgress" data-i18n-aria="libProgressLabel">'), "the filter select sits in libTools");
  for (const v of ['<option value="all" data-i18n="progAll">', '<option value="new" data-i18n="progNew">',
    '<option value="progress" data-i18n="progProgress">', '<option value="done" data-i18n="progDone">']) {
    assert.ok(htmlSrc.includes(v), v);
  }
  assert.ok(htmlSrc.indexOf('id="libSort"') < htmlSrc.indexOf('id="libProgress"'), "right after the sort select");
  assert.ok(librarySrc.includes('const progMode = core.settings.libProgress || "all";'), "renderLib reads the setting");
  assert.ok(librarySrc.includes("items = items.filter(x => libProgressOf(x, pos) === progMode);"), "filtering happens on the row list only");
  assert.ok(librarySrc.includes('core.$("libProgress").addEventListener("change", e => { core.settings.libProgress = e.target.value; core.saveUserPrefs(); renderLib(); });'), "the select saves and re-renders");
  assert.ok(librarySrc.includes('core.$("libProgress").value = core.settings.libProgress || "all";'), "initLibrary restores the choice");
  assert.ok(!librarySrc.includes('localStorage.setItem("trk_media_positions_v1"'), "the library never writes the position store (display layer only)");
});

test("i18n.js / core.js / sw.js: 4言語テキスト・既定値（all）・リセット・キャッシュ更新", () => {
  for (const key of ["libProgressLabel:", "progAll:", "progNew:", "progProgress:", "progDone:"]) {
    const n = (i18nSrc.match(new RegExp(key, "g")) || []).length;
    assert.equal(n, 4, `${key} in 4 languages`);
  }
  assert.ok(coreSrc.includes('libProgress: pick(prefs.libProgress, ["all", "new", "progress", "done"], "all"),'), "validated default");
  assert.equal((coreSrc.match(/settings\.libProgress = "all";/g) || []).length, 2, "both reset lists restore all");
  assert.match(swSrc, /^const CACHE = "trk-v[\d.]+-trk\d+";$/m);
});
