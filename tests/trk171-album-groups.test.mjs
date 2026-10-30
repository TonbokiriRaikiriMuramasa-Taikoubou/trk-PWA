// SPDX-License-Identifier: GPL-3.0-or-later
/* trk171: 💿🎤 アルバム別／アーティスト別のグループ表示＋トラック番号順（PLAYER-ROADMAP #16）。
   library.js から純粋な並び替え部品（libTrackNoOf／libGroupKeyOf／libGroupCmp）と
   タグ先読みの部品（libGroupRerenderSoon／libEnsureGroupTags）を vm で抜き出して実動検証し、
   棚（libTabsOf）・フィルター（libTabMatch）・renderLib の配線・4言語テキスト・CSS を走査する。
   グループ化は表示だけ：タグは読み取り専用で、曲の保存データもプレイリストも触らない。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

const grab = (pattern, label) => {
  const m = librarySrc.match(pattern);
  assert.ok(m, `${label} can be isolated from js/library.js`);
  return m[0];
};
const fnTrackNo = grab(/function libTrackNoOf\(it\) \{[\s\S]*?\n\}/, "libTrackNoOf()");
const fnGroupKey = grab(/function libGroupKeyOf\(it, mode\) \{[\s\S]*?\n\}/, "libGroupKeyOf()");
const fnGroupCmp = grab(/function libGroupCmp\(mode, fallback\) \{[\s\S]*?\n\}/, "libGroupCmp()");
const fnRerenderSoon = grab(/let libGroupRerenderTimer = 0;\nfunction libGroupRerenderSoon\(\) \{[\s\S]*?\n\}/, "libGroupRerenderSoon()");
const fnEnsure = grab(/function libEnsureGroupTags\(items\) \{[\s\S]*?\n\}/, "libEnsureGroupTags()");

/* ---------- 並び替え（libGroupCmp） ---------- */
function cmpSandbox() {
  const sandbox = {
    window: {},
    songTagsOf: it => (it && it._tags) || null,
    songDisplayMeta: it => (it && it._meta) || { title:"", artist:"", album:"" },
    Number, Math, String, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${fnTrackNo}\n${fnGroupKey}\n${fnGroupCmp}\nwindow.__cmp = libGroupCmp; window.__key = libGroupKeyOf; window.__track = libTrackNoOf;`,
    sandbox, { filename: "js/library.js#groups" });
  return sandbox.window;
}
/* it = {key, _meta:{title,artist,album}, _tags:{track,…}, title} */
const song = (key, { album = "", artist = "", track = null, title = key } = {}) => ({
  key, title, _meta: { title, artist, album }, _tags: track == null ? null : { track },
});
const entries = list => list.map(it => ({ it, info: null }));
const keysOf = list => list.map(x => x.it.key);

test("libTrackNoOf(): 0・負数・NaN・大きすぎは「番号なし」、正常な番号はそのまま", () => {
  const api = cmpSandbox();
  assert.equal(api.__track(song("a", { track: 4 })), 4);
  assert.equal(api.__track(song("a", { track: 0 })), null, "TRCK 0 is not a real position");
  assert.equal(api.__track(song("a", { track: -3 })), null);
  assert.equal(api.__track(song("a", { track: NaN })), null);
  assert.equal(api.__track(song("a", { track: 99999 })), null, "garbage protection");
  assert.equal(api.__track(song("a")), null, "no tags at all");
});

test("アルバム棚：アルバム名の辞書順（数字つき）、「タグなし」は最後、アルバム内はトラック番号順", () => {
  const api = cmpSandbox();
  const A = song("A", { album: "Best Vol.2", artist: "X", track: 1 });
  const C = song("C", { album: "Best Vol.2", artist: "X", track: 10 });
  const B = song("B", { album: "Best Vol.10", artist: "X", track: 1 });
  const D = song("D");   /* タグなし */
  const sorted = entries([D, B, C, A]).sort(api.__cmp("albums", () => 0));
  assert.deepEqual(keysOf(sorted), ["A", "C", "B", "D"],
    "Vol.2 (1→10) before Vol.10 (numeric-aware), no-tags last");
  const numbered = song("N1", { album: "Mix", track: 7 });
  const plain = song("N2", { album: "Mix" });
  const s2 = entries([plain, numbered]).sort(api.__cmp("albums", () => 0));
  assert.deepEqual(keysOf(s2), ["N1", "N2"], "numbered tracks come before unnumbered inside the album");
});

test("アーティスト棚：アーティスト順 → 中でアルバム順 → トラック番号順、無しグループは最後", () => {
  const api = cmpSandbox();
  const E = song("E", { album: "Solo", artist: "A-First", track: 5 });
  const A = song("A", { album: "Vol.2", artist: "X", track: 1 });
  const C = song("C", { album: "Vol.2", artist: "X", track: 10 });
  const B = song("B", { album: "Vol.10", artist: "X", track: 1 });
  const loose = song("L", { artist: "X" });            /* アルバム名の無い曲（アーティスト内では後） */
  const D = song("D");                                  /* どちらも無し */
  const sorted = entries([D, loose, B, C, A, E]).sort(api.__cmp("artists", () => 0));
  assert.deepEqual(keysOf(sorted), ["E", "A", "C", "B", "L", "D"]);
});

test("同じグループ・同じ番号のときは、選んでいる並び順（fallback）が効く", () => {
  const api = cmpSandbox();
  const p = song("P", { album: "Same", track: 1 });
  const q = song("Q", { album: "Same", track: 1 });
  const byPlays = (a, b) => (b.info ? b.info.plays : 0) - (a.info ? a.info.plays : 0);
  const list = [{ it: p, info: { plays: 2 } }, { it: q, info: { plays: 9 } }];
  list.sort(api.__cmp("albums", byPlays));
  assert.deepEqual(keysOf(list), ["Q", "P"], "the user's chosen sort breaks exact ties");
});

/* ---------- タグ先読みと並び直し（libEnsureGroupTags／libGroupRerenderSoon） ---------- */
function tagLoadSandbox({ libTab = "albums" } = {}) {
  const state = { renders: 0, loaded: [] };
  const timers = { timeouts: [], nextId: 1 };
  const sandbox = {
    window: {},
    core: { settings: { libTab } },
    LIB_SHOW: 300,
    songTags: new Map(),
    songTagsPending: new Map(),
    canExtractSongArt: it => !!(it && it.file),
    loadSongTags: it => { state.loaded.push(it.key); return Promise.resolve({ title: "t" }); },
    renderLib: () => { state.renders++; },
    setTimeout: (fn, ms) => { const id = timers.nextId++; timers.timeouts.push({ id, ms, fn, cleared: false }); return id; },
    clearTimeout: id => { const t = timers.timeouts.find(x => x.id === id); if (t) t.cleared = true; },
    Number, Math, String, Promise, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${fnRerenderSoon}\n${fnEnsure}\nwindow.__ensure = libEnsureGroupTags; window.__soon = libGroupRerenderSoon;`,
    sandbox, { filename: "js/library.js#grouptags" });
  const fire = () => { for (const t of timers.timeouts.filter(x => !x.cleared)) { t.cleared = true; t.fn(); } };
  return { state, sandbox: sandbox.window, fire, timers };
}

test("libEnsureGroupTags(): ファイルの曲だけ先読みし、全部片付いたら1回だけ並び直す（デバウンス）", async () => {
  const h = tagLoadSandbox();
  const items = entries([
    { ...song("F1"), file: {} },        /* 読む */
    { ...song("F2"), file: {} },        /* 読む */
    song("P1"),                          /* パック曲（file なし）は読まない */
  ]);
  h.sandbox.__ensure(items);
  assert.deepEqual(h.state.loaded, ["F1", "F2"]);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  h.fire();
  assert.equal(h.state.renders, 1, "exactly one debounced re-render");
  /* 2回目は全部キャッシュ済み（songTags に入っている想定）なので読み直さない */
});

test("libGroupRerenderSoon(): グループ棚以外のタブでは描き直さない", () => {
  const h = tagLoadSandbox({ libTab: "all" });
  h.sandbox.__soon();
  h.fire();
  assert.equal(h.state.renders, 0);
  const g = tagLoadSandbox({ libTab: "artists" });
  g.sandbox.__soon(); g.sandbox.__soon(); g.sandbox.__soon();
  g.fire();
  assert.equal(g.state.renders, 1, "debounced into one render even for a burst of tag arrivals");
});

/* ---------- 配線の走査 ---------- */
test("library.js: 💿🎤 棚の配線（タブ・フィルター・renderLib・タグ到着フック）", () => {
  assert.ok(librarySrc.includes('tabs.push({ id:"albums", icon:"💿", label:tr("libTabAlbums"), n:shelfN });'), "albums shelf appears when any song has an album");
  assert.ok(librarySrc.includes('tabs.push({ id:"artists", icon:"🎤", label:tr("libTabArtists"), n:shelfN });'), "artists shelf appears when any song has an artist");
  assert.ok(librarySrc.includes('if (id === "albums" || id === "artists") return true;'), "group shelves show every song");
  assert.ok(librarySrc.includes('const grouped = tabId === "albums" || tabId === "artists";'), "renderLib knows the group shelves");
  assert.ok(librarySrc.includes("items.sort(libGroupCmp(tabId, cmp));"), "group order wins over the plain sort");
  assert.ok(librarySrc.includes('el("div", "libGroupHead")'), "group header rows are rendered");
  assert.ok(librarySrc.includes("libEnsureGroupTags(items);"), "tags are pre-loaded on the group shelves");
  assert.ok(librarySrc.includes('if (core.settings.libTab === "albums" || core.settings.libTab === "artists") libGroupRerenderSoon();'), "tag arrivals re-sort the open group shelf");
  assert.ok(librarySrc.includes("libNoTagsGroup"), "no-tags group has a name");
  /* 4言語テキスト */
  for (const key of ["libTabAlbums:", "libTabArtists:", "libNoTagsGroup:", "libGroupCount:", "libGroupTagsLoading:"]) {
    const n = (librarySrc.match(new RegExp(key, "g")) || []).length;
    assert.equal(n, 4, `${key} in 4 languages`);
  }
});

test("css/style.css と sw.js: グループ見出しの見た目（sticky）とキャッシュ更新", () => {
  assert.ok(cssSrc.includes(".libGroupHead{position:sticky;top:0;"), "headers stick to the top while scrolling");
  assert.ok(cssSrc.includes(".libGroupName{") && cssSrc.includes(".libGroupN{"), "header parts are styled");
  assert.match(swSrc, /^const CACHE = "trk-v[\d.]+-trk\d+";$/m);
});
