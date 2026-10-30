// SPDX-License-Identifier: GPL-3.0-or-later
/* trk172: ⚡ スマート棚（PLAYER-ROADMAP #11・「最近再生」「よく再生」「最近追加」）。
   library.js からセクション部品（libSmartLast/libSmartPlays/libSmartSections）と 🎧 再生計数（noteMediaPlayed）を、
   media-player-mode.js から「ちゃんと聴いた」判定（noteMediaPlay＝30秒/半分ルール）を vm で抜き出して実動検証し、
   棚の出現条件・renderLib のセクション描画・addedAt の引き回し・4言語テキスト・証明（plProof）が不変なことを確認する。
   材料は端末内の記録だけ（PLAYED・records・songDB の addedAt）＝外部への送信なし・保存データは PLAYED への追記だけ。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

const grabFrom = (src, pattern, label) => {
  const m = src.match(pattern);
  assert.ok(m, `${label} can be isolated`);
  return m[0];
};
const fnLast = grabFrom(librarySrc, /function libSmartLast\(x\) \{[\s\S]*?\n\}/, "libSmartLast()");
const fnPlays = grabFrom(librarySrc, /function libSmartPlays\(x\) \{[\s\S]*?\n\}/, "libSmartPlays()");
const fnSections = grabFrom(librarySrc, /function libSmartSections\(items, labeler, cap = 50\) \{[\s\S]*?\n\}/, "libSmartSections()");
const fnNoteMedia = grabFrom(librarySrc, /function noteMediaPlayed\(key\) \{[\s\S]*?\n\}/, "noteMediaPlayed()");
const fnNotePlay = grabFrom(playerSrc, /let mediaPlayNotedKey = "";\nfunction noteMediaPlay\(\) \{[\s\S]*?\n\}/, "noteMediaPlay()");

/* ---------- セクションの材料（libSmartLast / libSmartPlays / libSmartSections） ---------- */
function smartSandbox(played = {}) {
  const sandbox = { window: {}, PLAYED: played, Math, Number, String, console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnLast}\n${fnPlays}\n${fnSections}\nwindow.__last = libSmartLast; window.__plays = libSmartPlays; window.__secs = libSmartSections;`,
    sandbox, { filename: "js/library.js#smart" });
  return sandbox.window;
}
const item = (key, { info = null, addedAt = 0 } = {}) => ({ it: { key, addedAt }, info });

test("libSmartLast/Plays(): records と PLAYED の大きい方＋🎧 media ぶん（二重計上しない）", () => {
  const api = smartSandbox({ A: { last: 600, manual: 1, auto: 1, media: 2 } });
  const a = item("A", { info: { last: 500, plays: 3 } });
  assert.equal(api.__last(a), 600, "the newer of records.lastPlayed and PLAYED.last");
  assert.equal(api.__plays(a), 5, "max(records.plays=3, manual+auto=2) + media=2");
  const b = item("B", { info: { last: 700, plays: 9 } });
  assert.equal(api.__plays(b), 9, "records win when PLAYED has no entry");
  const c = item("C");
  assert.equal(api.__last(c), 0);
  assert.equal(api.__plays(c), 0);
  const d = item("D", { info: null });
  assert.equal(api.__plays({ ...d, it: { key: "D", addedAt: 0 } }), 0, "never NaN");
});

test("libSmartSections(): 🕒最近再生 → 🔥よく再生 → ➕最近追加 の順、空セクションは出ない、cap で切れる", () => {
  const api = smartSandbox({ A: { last: 600, manual: 1, auto: 1, media: 2 } });
  const items = [
    item("A", { info: { last: 500, plays: 3 } }),     /* 最近(600)＋よく(4) */
    item("B", { info: { last: 700, plays: 0 } }),     /* 最近(700)だけ */
    item("C", { addedAt: 999 }),                       /* 最近追加だけ */
    item("D"),                                          /* どこにも出ない */
  ];
  const secs = api.__secs(items, k => "L:" + k);
  assert.deepEqual(Array.from(secs).map(s => s.label), ["L:libSmartRecent", "L:libSmartTop", "L:libSmartAdded"]);
  assert.deepEqual(Array.from(secs[0].rows).map(r => r.it.key), ["B", "A"], "recent is newest-first");
  assert.deepEqual(Array.from(secs[1].rows).map(r => r.it.key), ["A"], "only songs with plays > 0");  assert.deepEqual(Array.from(secs[2].rows).map(r => r.it.key), ["C"], "addedAt newest-first");
  assert.equal(secs[0].rows.length + secs[1].rows.length + secs[2].rows.length, 4, "D appears nowhere");

  const capped = api.__secs([item("X1", { info: { last: 1 } }), item("X2", { info: { last: 2 } }), item("X3", { info: { last: 3 } })],
    k => k, 2);
  assert.equal(capped[0].rows.length, 2, "cap parameter slices each section");

  const none = api.__secs([item("Z")], k => k);
  assert.equal(Array.from(none).length, 0, "no material → no sections");
});

/* ---------- 🎧 再生計数（noteMediaPlayed） ---------- */
test("noteMediaPlayed(): PLAYED に media を足すだけ（auto/manual＝証明は触らない）", () => {
  const saves = [];
  const sandbox = {
    window: {}, PLAYED: { old: { last: 5, auto: 2, manual: 1 } },
    Date: { now: () => 1234 },
    playedSave: () => saves.push(1),
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${fnNoteMedia}\nwindow.__note = noteMediaPlayed;`, sandbox, { filename: "js/library.js#notemedia" });
  sandbox.window.__note("old");
  assert.deepEqual({ ...sandbox.PLAYED.old }, { last: 1234, auto: 2, manual: 1, media: 1 }, "auto/manual untouched, media starts at 1");
  sandbox.window.__note("old");
  assert.equal(sandbox.PLAYED.old.media, 2);
  sandbox.window.__note("fresh");
  assert.deepEqual({ ...sandbox.PLAYED.fresh }, { last: 1234, auto: 0, manual: 0, media: 1 }, "new entries keep the classic shape");
  sandbox.window.__note("");
  assert.equal(saves.length, 3, "the empty key is ignored (no save)");
});

/* ---------- メディアプレーヤーの「ちゃんと聴いた」判定（noteMediaPlay） ---------- */
function playNoteSandbox({ currentTime = 0, duration = 0, videoReady = true, reverse = false } = {}) {
  const calls = [];
  const state = { currentTime, duration, videoReady, reverse, song: { key: "k1" } };
  const sandbox = {
    window: { Trk: { library: { noteMediaPlayed: k => calls.push(k) } } },
    core: {
      get currentSong() { return state.song; },
      get videoReady() { return state.videoReady; },
      video: { get currentTime() { return state.currentTime; }, get duration() { return state.duration; } },
    },
    get reverseActive() { return state.reverse; },
    get reverseLoading() { return false; },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(fnNotePlay + "\nwindow.__note = noteMediaPlay; window.__reset = () => { mediaPlayNotedKey = \"\"; };",
    sandbox, { filename: "js/media-player-mode.js#noteplay" });
  return { calls, state, api: sandbox.window };
}

test("noteMediaPlay(): 30秒（短い曲は半分）を超えたら1曲1回だけ数える。逆再生・未準備では数えない", () => {
  const h = playNoteSandbox({ currentTime: 29.9, duration: 300 });
  h.api.__note();
  assert.deepEqual(h.calls, [], "29.9s of a 5-minute song is a skip, not a listen");
  h.state.currentTime = 30;
  h.api.__note(); h.api.__note();
  assert.deepEqual(h.calls, ["k1"], "counted once at 30s, and only once per song");

  const short = playNoteSandbox({ currentTime: 21, duration: 40 });
  short.api.__note();
  assert.deepEqual(short.calls, ["k1"], "a 40s song counts at its halfway point (21 ≥ 20)");

  const rev = playNoteSandbox({ currentTime: 90, duration: 300, reverse: true });
  rev.api.__note();
  assert.deepEqual(rev.calls, [], "reverse playback has a different clock — never counted");

  const notReady = playNoteSandbox({ currentTime: 90, duration: 300, videoReady: false });
  notReady.api.__note();
  assert.deepEqual(notReady.calls, [], "nothing counts before the media element is ready");

  const next = playNoteSandbox({ currentTime: 31, duration: 300 });
  next.api.__note();
  next.state.song = { key: "k2" }; next.state.currentTime = 0;
  next.api.__note();
  next.state.currentTime = 45;
  next.api.__note();
  assert.deepEqual(next.calls, ["k1", "k2"], "each song gets its own single count");
});

/* ---------- 配線の走査 ---------- */
test("library.js: ⚡ 棚の配線（タブ・フィルター・セクション描画・addedAt・書き出し・証明は不変）", () => {
  assert.ok(librarySrc.includes('tabs.push({ id:"smart", icon:"⚡", label:tr("libTabSmart"), n:nSmart });'), "smart shelf joins the tab bar");
  assert.ok(librarySrc.includes('if (id === "smart") return true;'), "the smart shelf scans every song");
  assert.ok(librarySrc.includes('const smartSections = tabId === "smart" ? libSmartSections(items, k => tr(k)) : null;'), "sections are built in renderLib");
  assert.ok(librarySrc.includes("if (row.sec) { pendingSec = row; continue; }"), "section headers ride the row loop");
  assert.ok(librarySrc.includes("box.append(libSectionHead(pendingSec.sec, pendingSec.n))"), "a header is emitted right before its first song");
  assert.ok(librarySrc.includes("function libSectionHead(label, n)") && librarySrc.includes('el("div", "libGroupHead")'), "headers reuse the 💿🎤 sticky look");
  assert.ok(librarySrc.includes("if (r.it && !seenKeys.has(r.it.key))"), "libView dedupes songs that appear in two sections");
  /* 最近追加の材料：addedAt が it まで届く（📄 追加曲と 💾 共有曲） */
  assert.ok(librarySrc.includes("function addedItem(file, video, addedAt, flags = {})"), "addedItem carries addedAt");
  assert.ok(librarySrc.includes("addedAt: Number(r.addedAt) > 0 ? Number(r.addedAt) : 0"), "sharedItem carries addedAt");
  assert.ok(librarySrc.includes(".map(r => addedItem(r.file instanceof File ? r.file : new File([r.file], r.name || \"song\", { type:r.file.type || \"\" }), r.video, r.addedAt, { stored:true }))"), "restart restores addedAt from songDB");
  assert.ok(librarySrc.includes("const it = addedItem(f, false, addedAt, { sessionOnly:true })") && librarySrc.includes("const it = addedItem(f, isVideo, addedAt, { sessionOnly:true })"), "both add paths stamp the same addedAt into the row and songDB");
  /* 書き出しと証明の分離：noteMediaPlayed は公開、plProof は media を知らない（▶AUTO 印の意味は変わらない） */
  assert.ok(librarySrc.includes("initLibrary, nextSong, noteMediaPlayed, onLongPress"), "noteMediaPlayed is exported for the media player");
  const proof = grabFrom(librarySrc, /function plProof\(it, idx\) \{[\s\S]*?\n\}/, "plProof()");
  assert.ok(!proof.includes("media"), "plProof still only knows auto/manual — player listens are not a share proof");
  /* 4言語テキスト */
  for (const key of ["libTabSmart:", "libSmartRecent:", "libSmartTop:", "libSmartAdded:"]) {
    const n = (librarySrc.match(new RegExp(key, "g")) || []).length;
    assert.equal(n, 4, `${key} in 4 languages`);
  }
});

test("media-player-mode.js: 🎧 計数のフック（tick・ended・曲変わり・開き直し）", () => {
  assert.ok(playerSrc.includes("noteMediaPlay();          /* 🎧「ちゃんと聴いた」計数（trk172"), "the 250ms tick counts listens");
  assert.ok(playerSrc.includes('mediaPlayNotedKey = "";   /* 🎧 最後まで再生'), "a finished play counts even for short songs, and repeats re-count");
  assert.ok(playerSrc.includes('on("songSelected", () => { mediaPlayNotedKey = ""; });'), "a new song starts a fresh count (separate subscriber)");
  assert.ok(playerSrc.includes('mediaPlayNotedKey = "";   /* 🎧 開き直しも新しい再生として数え直す'), "re-opening the player counts again");
  assert.ok(playerSrc.includes("lib.noteMediaPlayed(s.key)"), "the count lands in library.noteMediaPlayed");
  assert.match(swSrc, /^const CACHE = "trk-v[\d.]+-trk\d+";$/m);
});
