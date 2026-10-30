// SPDX-License-Identifier: GPL-3.0-or-later
/* ⭐ trk215：お気に入りの4フォルダ（⭐1軍／⭐2軍／🧊フリーズ／📤元お気に入り）を、どれも正常に使えるようにする。
   ・2軍／フリーズ（0個のタブ）を選ぶと、お気に入りが消えたように見えた（タブごと消えていた）
   ・1軍から2軍へ入れて読み込み直すと、その曲のお気に入りが外れて2軍の登録も消えていた（保存していなかった）
   ・🧊フリーズ／📌ピンの状態がタブに出ていなかった
   ・凍結の解除は、🧊／🔒 を3秒長押し（❓謎設定「フリーズの解除をワンタップにする」＝既定オフで1タップにもできる）
   ここで確かめるのは、DOM も実ブラウザーも要らない部分（保存の形・純関数・配線・4言語）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const coreSrc = read("js/core.js");
const favsSrc = read("js/favs.js");
const libSrc = read("js/library.js");
const optSrc = read("js/i18n-options.js");
const htmlSrc = read("index.html");
const mainSrc = read("js/main.js");
const swSrc = read("sw.js");

const between = (src, start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `slice ${start}`);
  return src.slice(a, b);
};

/* ---------- 1. 設定の形：謎設定は真偽値1つ（既定オフ）・フォルダの状態は settings.favs ---------- */
test("trk215: the quick-unfreeze escape hatch is a single opt-in boolean, off by default", () => {
  assert.ok(coreSrc.includes("favQuickUnfreeze: prefs.favQuickUnfreeze === true"),
    "true 以外（未設定・旧版の 1）はオフ＝誤って解除しない側に倒す");
  const reset = between(coreSrc, "function resetAllPrefs()", "\n}");
  assert.ok(/settings\.favQuickUnfreeze = false;/.test(reset), "全部リセットで既定（オフ）へ戻る");
});

test("trk215: favorite folders are stored in settings.favs (object only) and reset with everything else", () => {
  assert.ok(/favs: \(prefs\.favs && typeof prefs\.favs === "object" && !Array\.isArray\(prefs\.favs\)\) \? prefs\.favs : \{\}/.test(coreSrc),
    "object 以外（配列・文字列）は捨てる");
  const reset = between(coreSrc, "function resetAllPrefs()", "\n}");
  assert.ok(/settings\.favs = \{\};/.test(reset), "2軍〜元お気に入り・ピン・凍結もリセットで消える");
  assert.ok(/settings\.songFav = \[\];/.test(reset), "1軍（曲）もリセットで消える");
});

/* ---------- 2. favs.js の中のしくみを、DOM 無しで動かす ---------- */
const mechSrc = between(favsSrc, "/* ---------- しくみ ---------- */", "function total(kind)");
const mechEnd = favsSrc.slice(favsSrc.indexOf("function total(kind)"));
const totalSrc = mechEnd.slice(0, mechEnd.indexOf("\n}") + 2);

function sandbox({ settings = {}, prefs = {} } = {}) {
  const calls = { saves: 0 };
  const core = {
    settings,
    prefs,
    saveUserPrefs: () => { calls.saves++; },
    emit: () => {},
  };
  const context = vm.createContext({
    core, window: { Trk: { core } }, document: undefined, console,
    ftr: (k, vars) => k, fEl: () => ({}), TIMEOUT_MS: 1600,
    calls, saveUserPrefs: core.saveUserPrefs,
  });
  vm.runInContext(`${mechSrc}\n${totalSrc}\nglobalThis.__fav = { tidy, rewrite, boot, stored, state, save, snapshot, add, remove, move, restore, togglePin, toggleLock, has, inGroup, groupOf, pinned, locked, activeOf, setActive, pool, total, quickUnfreeze, HOLD_UNFREEZE_MS };`, context);
  return { fav: context.__fav, context, core, calls, settings };
}

test("trk215: a fresh install freezes nothing (the 🧊 folder is usable right away)", () => {
  const { fav } = sandbox();
  assert.deepEqual(Array.from(fav.state("song").locks), [], "凍結は最初からオンにしない");
  assert.equal(fav.locked("song", "frozen"), false, "🧊フリーズは凍結されていない");
  const r = fav.add("song", "1|a.mp3", { group: "frozen", append: false });
  assert.equal(r.ok, true, "🧊フリーズへ入れられる");
  assert.equal(fav.inGroup("song", "frozen", "1|a.mp3"), true);
});

test("trk215: 1軍 → 2軍 keeps the song a favorite (the reload bug)", () => {
  const settings = { songFav: ["1|a.mp3", "1|b.mp3"], favs: null };
  const { fav, core } = sandbox({ settings });
  assert.equal(fav.groupOf("song", "1|a.mp3"), "main");
  const r = fav.move("song", "1|a.mp3", "sub");
  assert.equal(r.ok, true);
  assert.equal(fav.has("song", "1|a.mp3"), true, "2軍もお気に入り（⭐タブから消えない）");
  assert.equal(fav.groupOf("song", "1|a.mp3"), "sub");
  assert.deepEqual(Array.from(core.settings.songFav), ["1|b.mp3"], "1軍からは外れる");
  /* 保存された形から、読み込み直した状態を作る（＝リロード） */
  const again = sandbox({ settings: JSON.parse(JSON.stringify(core.settings)), prefs: {} });
  assert.equal(again.fav.groupOf("song", "1|a.mp3"), "sub", "リロードしても2軍に残る");
  assert.equal(again.fav.has("song", "1|a.mp3"), true, "お気に入りが解除されていない");
  assert.equal(again.fav.activeOf("song"), "main");
});

test("trk215: sub / frozen / former / pins / locks / active survive a reload", () => {
  const { fav, core } = sandbox({ settings: { songFav: ["1|a.mp3"] } });
  fav.add("song", "1|s.mp3", { group: "sub" });
  fav.add("song", "1|f.mp3", { group: "frozen" });
  fav.add("song", "1|x.mp3", { group: "former" });
  fav.togglePin("song", "1|s.mp3");
  fav.toggleLock("song", "frozen");
  fav.setActive("song", "sub");
  assert.ok(core.settings.favs && core.settings.favs.song, "settings.favs に書く");
  const snap = fav.snapshot("song");
  assert.deepEqual(Array.from(snap.sub), ["1|s.mp3"]);
  assert.deepEqual(Array.from(snap.pins), ["1|s.mp3"]);
  assert.deepEqual(Array.from(snap.locks), ["frozen"]);
  assert.equal(snap.active, "sub", "選んでいたフォルダも覚える");
  /* 1軍は従来どおり songFav（settings.favs には入れない） */
  assert.ok(!(snap.main), "1軍は snapshot に入れない（二重持ちしない）");

  const again = sandbox({ settings: JSON.parse(JSON.stringify(core.settings)), prefs: {} });
  assert.equal(again.fav.activeOf("song"), "sub", "選択中のフォルダが残る（0個のタブでも消えない）");
  assert.equal(again.fav.inGroup("song", "sub", "1|s.mp3"), true);
  assert.equal(again.fav.inGroup("song", "frozen", "1|f.mp3"), true);
  assert.equal(again.fav.inGroup("song", "former", "1|x.mp3"), true);
  assert.equal(again.fav.pinned("song", "1|s.mp3"), true);
  assert.equal(again.fav.locked("song", "frozen"), true);
});

test("trk215: tidy edits the saved main array in place (settings.songFav stays the same array)", () => {
  const settings = { songFav: ["1|a.mp3", "1|a.mp3", "1|b.mp3"] };
  const { fav } = sandbox({ settings });
  const st = fav.state("song");
  assert.equal(st.main, settings.songFav, "1軍の配列は settings.songFav そのもの");
  const r = fav.remove("song", "1|b.mp3");
  assert.equal(r.ok, true);
  assert.deepEqual(Array.from(settings.songFav), ["1|a.mp3"], "外した曲は保存される配列からも消える");
  assert.equal(fav.state("song").main, settings.songFav, "外したあとも同じ配列のまま");
  assert.equal(fav.inGroup("song", "former", "1|b.mp3"), true, "外した曲は元お気に入りへ");
});

test("trk215: a locked folder refuses adding and removing (that is what freezing is for)", () => {
  const { fav } = sandbox({ settings: { songFav: ["1|a.mp3"] } });
  fav.toggleLock("song", "main");
  assert.equal(fav.add("song", "1|b.mp3").ok, false, "凍結中は追加できない");
  assert.equal(fav.remove("song", "1|a.mp3").ok, false, "凍結中は外せない");
  const r = fav.toggleLock("song", "main");
  assert.equal(r.locked, false);
  assert.equal(fav.add("song", "1|b.mp3").ok, true, "解除すれば、また使える");
});

test("trk215: the 🎲 pool keeps pinned songs from other folders", () => {
  const { fav } = sandbox({ settings: { songFav: ["1|a.mp3"] } });
  fav.add("song", "1|s.mp3", { group: "sub" });
  fav.togglePin("song", "1|s.mp3");
  assert.deepEqual(Array.from(fav.pool("song")), ["1|a.mp3", "1|s.mp3"], "2軍のピンも候補に入る");
  fav.setActive("song", "former");
  assert.deepEqual(Array.from(fav.pool("song")), ["1|a.mp3", "1|s.mp3"], "元お気に入りを見ているときは1軍で抽選");
});

/* ---------- 3. 凍結の解除は3秒長押し（謎設定で1タップ） ---------- */
test("trk215: unfreezing needs a 3-second hold unless the escape hatch is on", () => {
  assert.ok(favsSrc.includes("const HOLD_UNFREEZE_MS = 3000;"), "長押しは3秒");
  assert.ok(/const quickUnfreeze = \(\) => !!\(core\.settings && core\.settings\.favQuickUnfreeze === true\);/.test(favsSrc),
    "謎設定は true のときだけオン");
  const { fav: off } = sandbox({ settings: {} });
  assert.equal(off.quickUnfreeze(), false, "既定はオフ＝3秒長押し");
  const { fav: on } = sandbox({ settings: { favQuickUnfreeze: true } });
  assert.equal(on.quickUnfreeze(), true, "オンなら1タップ");
  const { fav: loose } = sandbox({ settings: { favQuickUnfreeze: 1 } });
  assert.equal(loose.quickUnfreeze(), false, "1 などのゆるい値ではオンにしない");
  /* チップ・🔒・🧊 のどれも holdButton を通す（押しっぱなしのバーと、離したときの分岐を1か所に） */
  const chipsSrc = between(favsSrc, "function holdButton(", "/* チップを作り直すための小さな合図");
  assert.ok(chipsSrc.includes("function holdButton("), "holdButton がある");
  assert.ok(/pointerdown/.test(chipsSrc) && /keydown/.test(chipsSrc), "マウスとキーボードの両方で長押しできる");
  assert.ok(/quick \? 0 : HOLD_UNFREEZE_MS/.test(chipsSrc), "オンなら0ms＝1タップ");
  assert.ok(/quick \? null : \(\) => toast\(/.test(chipsSrc), "オフのときは、短く押したら解除のしかたを教える");
  assert.ok(chipsSrc.includes("favLockHint"), "凍結中は解除のしかたを title に出す");
  assert.ok(chipsSrc.includes("favLockHintQuick"), "謎設定オンなら「押すと解除」と出す");
  assert.ok(/\+ \(frozenOn \? " locked" : ""\)/.test(chipsSrc), "凍結中のチップは見た目でも分かる");
  assert.ok(/favPinCount/.test(chipsSrc), "📌 は数のバッジにも出す");
  assert.ok(!/favHoldNow/.test(favsSrc), "使わない文言は残さない");
});

test("trk215: holding is cancelled by letting go early (no accidental unfreeze)", () => {
  const holdSrc = between(favsSrc, "function holdButton(", "/* チップを作り直すための小さな合図");
  assert.ok(/pointerup|pointercancel|pointerleave/.test(holdSrc), "離したら取り消す");
  assert.ok(/holding/.test(holdSrc), "押している間の見た目を付ける");
});

/* ---------- 4. ライブラリのタブ：4フォルダのどれかに入っていれば ⭐ を出す ---------- */
const favTabSrc = between(libSrc, "function libFavKeys(all) {", "function libTabsOf(all) {");

test("trk215: the ⭐ tab shows while any of the four folders has songs", () => {
  assert.ok(/function libFavTab\(all\)/.test(favTabSrc), "出すかどうかは1か所で決める");
  const F = {
    _sub: ["1|s.mp3"], _main: [], _frozen: [], _former: [],
    activeOf: () => "sub",
    inGroup: (_k, g, id) => F["_" + g].includes(id),
    has: (_k, id) => F._main.includes(id) || F._sub.includes(id) || F._frozen.includes(id),
  };
  const mk = (settings = { libTab: "all" }) => vm.createContext({
    window: { TrkFavs: F }, core: { settings }, tr: k => k, console,
  });
  const run = (ctx, all) => vm.runInContext(`${favTabSrc}\nlibFavTab(__all)`, Object.assign(ctx, { __all: all }));
  const all = [{ key: "1|s.mp3" }];
  const tab = run(mk(), all);
  assert.ok(tab, "2軍にだけ入っていても ⭐ タブを出す");
  assert.equal(tab.n, 1, "数は、いま選んでいるフォルダの曲数");
  assert.ok(run(mk({ libTab: "fav" }), []), "0曲でも、いま ⭐ を見ているなら出す（選んだ直後に消えない）");
  F._sub = [];
  assert.equal(run(mk(), []), null, "どこにも無く、ほかのタブを見ているなら出さない");
  assert.ok(libSrc.includes("const favTab = libFavTab(all);"), "libTabsOf がこれを使う");
  assert.ok(!libSrc.includes("const favN = libFavKeys(all).n;\n  if (favN) tabs.push("), "旧: フォルダの曲数だけで出し入れしない");
});

test("trk215: an empty favorites folder explains how to leave it (4 languages)", () => {
  assert.ok(libSrc.includes('tabId === "fav" ? "libFavEmpty"'), "⭐ の空表示は専用の文言");
  assert.equal(libSrc.split('libFavEmpty:"').length - 1, 4, "4言語ぶん");
  assert.ok(libSrc.includes("このフォルダは空です"), "何をすればよいかを書く（ja）");
  assert.ok(libSrc.includes("⭐1軍／⭐2軍／🧊フリーズ／📤元お気に入り"), "切り替え先を名指しする");
});

test("trk215: the row ☆ adds to the folder you are looking at", () => {
  const rowSrc = between(libSrc, 'if (inFav) { const r = F.remove("song", it.key);', "renderLib();\n      });");
  assert.ok(rowSrc.includes("F.activeOf(\"song\")"), "いまのフォルダを見る");
  assert.ok(/group:\(g === "sub" \|\| g === "frozen"\) \? g : "main"/.test(rowSrc),
    "2軍・フリーズを見ているなら、そこへ入れる（📤を見ているときは1軍）");
  assert.ok(rowSrc.includes("F.msg(r.why, r.g)"), "凍結中なら、そう伝える");
});

test("trk215: rows show the 📌 / 🧊 state", () => {
  assert.ok(libSrc.includes('F.inGroup("song", "frozen", it.key)'), "🧊フリーズの印");
  assert.ok(libSrc.includes('F.pinned("song", it.key)'), "📌ピンの印");
  assert.ok(libSrc.includes('tr("favFrozenBadge")') && libSrc.includes('tr("favPin")'));
});

/* ---------- 5. 設定の配線と4言語 ---------- */
test("trk215: the ❓ mystery-settings checkbox exists and is wired in main.js", () => {
  assert.ok(/<input id="favQuickUnfreeze" type="checkbox">/.test(htmlSrc), "index.html にチェック");
  const sec = between(htmlSrc, '<h3 data-i18n="secMystery">', '<h3 data-i18n=');
  assert.ok(sec.includes('id="favQuickUnfreeze"'), "❓謎設定の中に置く");
  assert.ok(sec.includes('data-i18n="favQuickUnfreezeHint"'), "説明も出す");
  assert.ok(/core\.\$\("favQuickUnfreeze"\)\.checked = !!core\.settings\.favQuickUnfreeze/.test(mainSrc), "開いたときに戻す");
  assert.ok(mainSrc.includes('["favQuickUnfreeze", "favQuickUnfreeze"]'), "変えたら保存する");
});

test("trk215: the new wording is in all four languages", () => {
  for (const key of ["favQuickUnfreeze", "favQuickUnfreezeHint"]) {
    const hits = optSrc.split(`${key}:"`).length - 1;
    assert.equal(hits, 4, `${key} は4言語`);
  }
  for (const key of ["favIntro", "favLock", "favUnlockHold", "favLockHint", "favLockHintQuick", "favPinCount", "favFrozenBadge"]) {
    assert.equal(favsSrc.split(`${key}:"`).length - 1, 4, `${key} は4言語`);
  }
});

test("trk215: the service worker cache name moves on so the new files are fetched", () => {
  /* trk216 で 1.1.5 の配布に合わせて上げるので、trk215 以降（この変更より新しい）であることだけを見る */
  const m = swSrc.match(/const CACHE = "trk-v(\d{4})\.(\d{2})\.(\d{2})-trk(\d+)";/);
  assert.ok(m, "CACHE がある");
  assert.ok(Number(m[4]) >= 215, `trk215 以降（いまは trk${m[4]}）`);
});
