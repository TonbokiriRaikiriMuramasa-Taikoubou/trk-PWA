// SPDX-License-Identifier: GPL-3.0-or-later
/* 🎵 trk226: 下の再生バーを「プレイヤー」にする（実機の相談から・2026-10-31）

   1. 位置の線を、ライブラリの画面（試聴中）でも触って動かせる（これまではプレイ中だけ）
   2. ❓謎設定「バーに触れても位置を移動しない」（既定オフ）で、触れても動かないようにできる
   3. 🎲 シャッフル・🔁 リピート（なし／1曲／全曲）をバーに足す（再生画面と同じ設定を共有）
   4. ⧉ 操作パネルを別窓に出す（PC型のみ。Document PiP が無ければ小窓）

   文字列の `includes` ではなく、純粋関数の戻り値・偽 DOM の実測・組み立てた中身の値で見ます。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";
import { runBar, fire, barOf } from "./helpers/player-bar-harness.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const barSrc = read("js/player-bar.js");
const panelSrc = read("js/player-panel.js");
const playerSrc = read("js/media-player-mode.js");
const librarySrc = read("js/library.js");
const i18nSrc = read("js/i18n.js");
const html = read("index.html");
const coreSrc = read("js/core.js");

const transportOf = dom => barOf(dom).childNodes.find(n => n.className === "trk-pb-transport");
const buttonIn = (dom, cls) => barOf(dom).childNodes
  .flatMap(n => n.childNodes)
  .find(n => n.className === cls);

/* ---------- 1. 位置の線を触れるか（純粋関数） ---------- */
describe("trk226 位置の線を触れる状態か", () => {
  test("読み込み済みで長さが分かっていれば、ライブラリの画面でも触れる", () => {
    const { window } = runBar();
    const ok = window.Trk.playerBar.seekEnabled;
    assert.equal(ok({ phase: "title", ready: true, duration: 180, locked: false }), true, "試聴中（title）");
    assert.equal(ok({ phase: "playing", ready: true, duration: 180, locked: false }), true, "プレイ中");
    assert.equal(ok({ phase: "paused", ready: true, duration: 180, locked: false }), true, "一時停止中");
  });

  test("リザルト・未読み込み・長さ0・謎設定オンのときは触れない", () => {
    const { window } = runBar();
    const ok = window.Trk.playerBar.seekEnabled;
    assert.equal(ok({ phase: "ended", ready: true, duration: 180, locked: false }), false, "リザルト");
    assert.equal(ok({ phase: "title", ready: false, duration: 180, locked: false }), false, "未読み込み");
    assert.equal(ok({ phase: "title", ready: true, duration: 0, locked: false }), false, "長さ0");
    assert.equal(ok({ phase: "title", ready: true, duration: NaN, locked: false }), false, "長さ不明");
    assert.equal(ok({ phase: "title", ready: true, duration: 180, locked: true }), false, "謎設定オン");
    assert.equal(ok(null), false, "引数なし");
  });

  test("実測：ライブラリの画面でも線が有効になり、謎設定で無効になる", () => {
    const free = runBar({ phase: "title" });
    free.window.Trk.playerBar.sync();
    assert.equal(free.dom.body.childNodes.find(n => n.id === "trkPlayerBar").childNodes[0].disabled, false, "触れる");

    const locked = runBar({ phase: "title", playerBarSeekLock: true });
    locked.window.Trk.playerBar.sync();
    const seek = locked.dom.body.childNodes.find(n => n.id === "trkPlayerBar").childNodes[0];
    assert.equal(seek.disabled, true, "触れても動かない");
    assert.equal(seek.classList.contains("is-locked"), true, "見た目でも分かる");
  });

  test("実測：線を動かすと、映像の位置が動く（ライブラリの画面）", () => {
    const { dom, window, core } = runBar({ phase: "title" });
    window.Trk.playerBar.sync();
    const seek = barOf(dom).childNodes[0];
    seek.value = "500";                       /* 半分 */
    fire(seek, "change");
    assert.equal(core.video.currentTime, 50, "100秒の半分＝50秒（play.seekTo は使わない）");
  });

  test("実測：謎設定がオンのときは、線を動かしても位置が変わらない", () => {
    const { dom, window, core } = runBar({ phase: "title", playerBarSeekLock: true });
    window.Trk.playerBar.sync();
    const seek = barOf(dom).childNodes[0];
    core.video.currentTime = 10;
    seek.value = "900";
    fire(seek, "change");
    assert.equal(core.video.currentTime, 10, "そのまま");
    assert.equal(window.Trk.playerBar.seekToRatio(0.9), false, "パネルからの操作も断る");
  });

  test("プレイ中は本体の seekTo を通す（ゲームの進行に任せる）", () => {
    const { dom, window, calls } = runBar({ phase: "playing" });
    window.Trk.playerBar.sync();
    const seek = barOf(dom).childNodes[0];
    seek.value = "250";
    fire(seek, "change");
    assert.deepEqual(calls.seek, [25], "本体の seekTo(秒)");
  });
});

/* ---------- 2. 🎲 シャッフル・🔁 リピート ---------- */
describe("trk226 シャッフルとリピート（再生画面と同じ設定を1つだけ使う）", () => {
  test("リピートは なし → 1曲 → 全曲 → なし の3段", () => {
    const { window } = runBar();
    const next = window.Trk.playerBar.nextRepeat;
    assert.equal(next("off"), "one");
    assert.equal(next("one"), "all");
    assert.equal(next("all"), "off");
    assert.equal(next("なにか"), "off", "知らない値は「なし」と同じ扱い（先頭に戻る）");
  });

  test("シャッフルの曲選び：いまの曲を除いた中から選ぶ（純粋関数）", () => {
    const { window } = runBar();
    const pick = window.Trk.playerBar.shufflePick;
    const list = [{ key: "a" }, { key: "b" }, { key: "c" }];
    assert.equal(pick(list, "a", () => 0).key, "b", "いまの曲は選ばない");
    assert.equal(pick(list, "a", () => 0.99).key, "c", "乱数の位置がそのまま効く");
    assert.equal(pick([{ key: "a" }], "a", () => 0.5).key, "a", "1曲しか無ければその曲");
    assert.equal(pick([], "a", () => 0.5), null, "一覧が空");
    assert.equal(pick(null, "a", () => 0.5), null);
  });

  test("🎲 を押すと設定が反転して保存され、再生画面へ合図が出る", () => {
    const { dom, window, core, calls } = runBar({ mediaShuffle: false });
    window.Trk.playerBar.sync();
    const shuffle = transportOf(dom).childNodes.find(n => n.className === "trk-pb-shuffle");
    assert.equal(shuffle.attributes["aria-pressed"], "false");
    fire(shuffle, "click");
    assert.equal(core.settings.mediaShuffle, true, "設定を書く");
    assert.equal(calls.save, 1, "保存する");
    assert.deepEqual(calls.emitted.map(e => e.name), ["mediaOptions"], "再生画面へ知らせる");
    assert.equal(shuffle.attributes["aria-pressed"], "true", "押されている状態を読み上げにも出す");
    assert.equal(shuffle.classList.contains("is-on"), true, "見た目にも出す");
    fire(shuffle, "click");
    assert.equal(core.settings.mediaShuffle, false, "もう一度で戻る");
  });

  test("🔁 を押すと なし → 1曲 → 全曲 と回り、アイコンも変わる", () => {
    const { dom, window, core, calls } = runBar({ mediaRepeat: "off" });
    window.Trk.playerBar.sync();
    const repeat = transportOf(dom).childNodes.find(n => n.className === "trk-pb-repeat");
    assert.equal(repeat.textContent, "🔁", "なしは 🔁");
    fire(repeat, "click");
    assert.equal(core.settings.mediaRepeat, "one");
    assert.equal(repeat.textContent, "🔂", "1曲は 🔂");
    assert.equal(repeat.attributes["aria-pressed"], "true");
    fire(repeat, "click");
    assert.equal(core.settings.mediaRepeat, "all");
    assert.equal(repeat.textContent, "🔁", "全曲は 🔁");
    fire(repeat, "click");
    assert.equal(core.settings.mediaRepeat, "off");
    assert.equal(calls.save, 3, "毎回保存する");
    assert.deepEqual(calls.emitted.map(e => e.name), ["mediaOptions", "mediaOptions", "mediaOptions"]);
  });

  test("シャッフル中の ⏭ は、一覧の前後ではなく「ほかの曲」を選ぶ", async () => {
    /* ハーネスの再生中の曲は song-a。一覧には song-a も入れておく */
    const songs = [{ key: "song-a" }, { key: "song-b" }, { key: "song-c" }];
    const on = runBar({ mediaShuffle: true, songs, hasSong: true });
    on.window.Trk.playerBar.sync();
    fire(transportOf(on.dom).childNodes[2], "click");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(on.calls.select.length, 1, "1曲だけ選ぶ");
    assert.notEqual(on.calls.select[0], "song-a", "いまの曲は選ばない");
    assert.ok(["song-b", "song-c"].includes(on.calls.select[0]), "一覧の中から選ぶ");
  });

  test("シャッフルがオフなら、これまでどおり一覧の前後", async () => {
    const songs = [{ key: "song-a" }, { key: "song-b" }];
    const off = runBar({ mediaShuffle: false, songs, hasSong: true });
    off.window.Trk.playerBar.sync();
    fire(transportOf(off.dom).childNodes[2], "click");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(off.calls.select, ["song-next"], "ライブラリの nextSong に任せる");
  });

  test("再生画面は、バーからの合図で手元の値を読み直す（配線）", () => {
    /* media-player-mode.js は大きく、単体で動かせないので、配線と中身を分けて確かめる */
    assert.match(playerSrc, /if \(typeof core\.on === "function"\) core\.on\("mediaOptions", pullMediaOptions\);/,
      "合図を受け取る");
    const fn = playerSrc.slice(playerSrc.indexOf("function pullMediaOptions"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    assert.match(body, /repeatMode = \["off", "one", "all"\]\.includes\(core\.settings\.mediaRepeat\)/, "リピートを写す");
    assert.match(body, /shuffle = core\.settings\.mediaShuffle === true/, "シャッフルを写す");
    /* 再生画面で変えたときも、バーへ知らせる（同じ設定を共有していることを保つ） */
    for (const fnName of ["function setRepeat", "function setShuffle"]) {
      const block = playerSrc.slice(playerSrc.indexOf(fnName));
      const end = block.indexOf("\n}");
      assert.match(block.slice(0, end), /announceMediaOptions\(\)/, `${fnName} も合図を出す`);
    }
  });

  test("ライブラリの試聴が終わったとき、リピート「1曲」なら頭から（純粋関数）", () => {
    const start = librarySrc.indexOf("function previewRestartFor");
    const end = librarySrc.indexOf("\n}", start);
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(librarySrc.slice(start, end + 2) + "\n;globalThis.__r = previewRestartFor;", sandbox);
    const restart = sandbox.__r;
    assert.equal(restart("one", 42), 0, "1曲は頭から");
    assert.equal(restart("off", 42), 42, "それ以外は試聴の開始位置");
    assert.equal(restart("all", 42), 42, "全曲も同じ（試聴は曲を送らない）");
    assert.equal(restart("one", undefined), 0);
    assert.equal(restart("off", undefined), 0, "数でない値は0");
    assert.match(librarySrc, /video\.currentTime = previewRestartFor\(core\.settings\.mediaRepeat, previewStartFor\(\)\)/,
      "試聴の終わりで使っている");
  });
});

/* ---------- 3. ⧉ 操作パネル（別窓） ---------- */
/* 偽の文書（パネルは「本物の document でも偽物でも同じ関数」で組み立てる） */
function fakeDoc() {
  const make = (tag) => {
    const node = {
      tagName: String(tag).toUpperCase(), className: "", textContent: "", title: "", type: "", value: "",
      hidden: false, disabled: false, childNodes: [], attributes: {},
      style: { values: {}, setProperty(k, v) { this.values[k] = v; } },
      classList: {
        set: new Set(),
        add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); },
        toggle(c, on) { if (on === undefined ? !this.set.has(c) : on) this.set.add(c); else this.set.delete(c); }
      },
      append(...kids) { for (const kid of kids) { node.childNodes.push(kid); kid.parentNode = node; } },
      setAttribute(name, value) { node.attributes[name] = String(value); },
      getAttribute(name) { return node.attributes[name]; },
      addEventListener(name, fn) { (node.__events = node.__events || {})[name] = fn; },
      __events: {}
    };
    return node;
  };
  const doc = {
    title: "", body: make("body"), head: make("head"), documentElement: make("html"),
    createElement: make, make
  };
  return doc;
}
const fireEl = (node, name) => { if (node && node.__events && node.__events[name]) node.__events[name]({ target: node }); };

function panelSandbox({ pip = null, popup = true, mobile = false } = {}) {
  const document = fakeDoc();
  const registered = [];
  const core = {
    settings: { language: "ja", mediaShuffle: false, mediaRepeat: "off", musicVolume: 0.5 },
    on(name, fn) { registered.push({ name, fn }); },
    emit() {}
  };
  const opened = [];
  const snapshot = {
    title: "曲", artist: "歌手", elapsed: "0:11", total: "3:36", ratio: 0.05,
    playing: true, shuffle: false, repeat: "off", volume: 0.5, canSeek: true, seekLocked: false, canStep: true, hasSong: true
  };
  const barCalls = [];
  const bar = {
    snapshot: () => ({ ...snapshot }),
    playPause: () => barCalls.push("play"),
    step: dir => barCalls.push(`step:${dir}`),
    shuffle: () => barCalls.push("shuffle"),
    repeat: () => barCalls.push("repeat"),
    seekToRatio: ratio => barCalls.push(`seek:${ratio}`),
    setVolume: value => barCalls.push(`vol:${value}`),
    sync: () => barCalls.push("sync")
  };
  const win = {
    document, Trk: { core, playerBar: bar }, getComputedStyle: () => ({ getPropertyValue: name => name === "--ui-panel" ? " #101018 " : "" }),
    open: popup ? (url, name, features) => {
      const child = fakeDoc();
      child.close = () => { child.closed = true; };
      child.open = () => {}; child.write = () => {}; child.closed2 = true;
      opened.push({ url, name, features, win: child });
      /* window.open が返す窓は document を持つ */
      return { document: child, close() { child.closed = true; }, addEventListener() {} };
    } : null,
    setInterval: () => 1, clearInterval: () => {}, addEventListener() {}
  };
  if (mobile) document.body.classList.add("trk-mobile");
  const context = vm.createContext({
    window: win, document, navigator: { userAgent: "test" }, console,
    setInterval: win.setInterval, clearInterval: win.clearInterval,
    tr: key => `T:${key}`
  });
  win.window = win;
  vm.runInContext(panelSrc, context, { filename: "js/player-panel.js" });
  return { win, document, panel: win.Trk.playerPanel, barCalls, opened, registered, core };
}

describe("trk226 ⧉ 操作パネルを別窓に出す（PC型のみ）", () => {
  test("出せるかの判断：PC型で、Document PiP か小窓があるときだけ", () => {
    const { panel } = panelSandbox();
    assert.equal(panel.panelAllowed({ desktop: true, pip: true, popup: false }), true);
    assert.equal(panel.panelAllowed({ desktop: true, pip: false, popup: true }), true);
    assert.equal(panel.panelAllowed({ desktop: true, pip: false, popup: false }), false, "手段が無い");
    assert.equal(panel.panelAllowed({ desktop: false, pip: true, popup: true }), false, "スマホ型では出さない");
    assert.equal(panel.panelAllowed(null), false);
  });

  test("Document PiP は「窓口の形」まで見る（あるだけでは使わない）", () => {
    const { panel } = panelSandbox();
    assert.equal(panel.pipUsable({ documentPictureInPicture: { requestWindow() {} } }), true);
    assert.equal(panel.pipUsable({ documentPictureInPicture: {} }), false);
    assert.equal(panel.pipUsable({}), false);
    assert.equal(panel.popupUsable({ open() {} }), true);
    assert.equal(panel.popupUsable({}), false);
  });

  test("中身：曲名・時間・再生・前後・シャッフル・リピート・音量・閉じるがそろう", () => {
    const { panel } = panelSandbox();
    const actions = [];
    const doc = fakeDoc();
    const { root, parts } = panel.buildPanel(doc, {
      play: () => actions.push("play"), prev: () => actions.push("prev"), next: () => actions.push("next"),
      shuffle: () => actions.push("shuffle"), repeat: () => actions.push("repeat"),
      seek: r => actions.push(`seek:${r}`), volume: v => actions.push(`vol:${v}`), close: () => actions.push("close")
    });
    for (const key of ["title", "artist", "seek", "prev", "play", "next", "shuffle", "repeat", "time", "volume", "close"]) {
      assert.ok(parts[key], `${key} がある`);
    }
    assert.equal(parts.seek.attributes["aria-label"], "T:barSeek", "読み上げ名");
    assert.equal(root.childNodes.length, 4, "上段・線・操作・下段");

    fireEl(parts.play, "click"); fireEl(parts.prev, "click"); fireEl(parts.next, "click");
    fireEl(parts.shuffle, "click"); fireEl(parts.repeat, "click"); fireEl(parts.close, "click");
    parts.seek.value = "250"; fireEl(parts.seek, "change");
    parts.volume.value = "0.3"; fireEl(parts.volume, "input");
    assert.deepEqual(actions, ["play", "prev", "next", "shuffle", "repeat", "close", "seek:0.25", "vol:0.3"]);
  });

  test("中身：状態を写す（時間・再生中・押されている状態・触れるか）", () => {
    const { panel } = panelSandbox();
    const doc = fakeDoc();
    const { parts } = panel.buildPanel(doc, { play() {}, prev() {}, next() {}, shuffle() {}, repeat() {}, seek() {}, volume() {}, close() {} });
    panel.paintParts(parts, {
      title: "曲A", artist: "歌手A", elapsed: "1:00", total: "3:36", ratio: 0.5,
      playing: true, shuffle: true, repeat: "one", volume: 0.25, canSeek: false, seekLocked: true, canStep: false, hasSong: true
    });
    assert.equal(parts.title.textContent, "曲A");
    assert.equal(parts.artist.textContent, "歌手A");
    assert.equal(parts.time.textContent, "1:00 / 3:36");
    assert.equal(parts.seek.value, "500", "位置を写す");
    assert.equal(parts.seek.disabled, true, "触れない");
    assert.equal(parts.seek.classList.contains("is-locked"), true);
    assert.equal(parts.play.textContent, "⏸", "再生中は一時停止の絵");
    assert.equal(parts.prev.disabled, true);
    assert.equal(parts.next.disabled, true);
    assert.equal(parts.shuffle.attributes["aria-pressed"], "true");
    assert.equal(parts.repeat.textContent, "🔂");
    assert.equal(parts.volume.value, "0.25");
  });

  test("スキンの色を写す（写せなくても既定色で出る）", () => {
    const { panel, win } = panelSandbox();
    const vars = panel.skinVars(win);
    assert.equal(vars["--ui-panel"], "#101018", "前後の空白は落とす");
    assert.equal(panel.varsCss(vars), ":root{--ui-panel:#101018;}");
    assert.equal(panel.varsCss({}), "", "何も無ければ空");
    assert.equal(panel.varsCss(null), "");
  });

  test("小窓（window.open）の道：窓を開いて中身を組み立て、閉じられる", async () => {
    const { panel, opened, barCalls } = panelSandbox({ popup: true });
    const ok = await panel.open();
    assert.equal(ok, true);
    assert.equal(opened.length, 1, "1つだけ開く");
    assert.equal(opened[0].name, "trkPlayerPanel");
    assert.match(opened[0].features, /width=560/);
    assert.equal(panel.isOpen(), true);
    assert.equal(panel.kind(), "popup");
    const childDoc = opened[0].win;
    assert.ok(childDoc.body.childNodes.some(n => n.className === "trk-pp-root"), "中身を入れた");
    assert.ok(childDoc.head.childNodes.length >= 1, "スタイルを写した");
    await panel.open();
    assert.equal(opened.length, 1, "二重には開かない");
    panel.close();
    assert.equal(panel.isOpen(), false);
    assert.ok(barCalls.includes("sync"), "バーの ⧉ の見た目を戻す");
  });

  test("開く手段が無い／スマホ型では、開かない（何も壊さない）", async () => {
    const none = panelSandbox({ popup: false });
    assert.equal(none.panel.available(), false);
    assert.equal(await none.panel.open(), false);
    assert.equal(none.opened.length, 0);

    const phone = panelSandbox({ popup: true, mobile: true });
    assert.equal(phone.panel.available(), false, "スマホ型では出さない");
    assert.equal(await phone.panel.open(), false);
  });

  test("バーの ⧉ は、出せる PC 型のときだけ出る（スマホ型では隠す）", () => {
    const stub = { available: () => true, isOpen: () => false, open() {}, close() {} };
    const pc = runBar({ panel: stub });
    pc.window.Trk.playerBar.sync();
    const panelBtn = buttonIn(pc.dom, "trk-pb-panel");
    assert.equal(panelBtn.hidden, false, "PC 型なら出す");

    const phone = runBar({ panel: stub, mobile: true });
    phone.window.Trk.playerBar.sync();
    assert.equal(buttonIn(phone.dom, "trk-pb-panel").hidden, true, "スマホ型では出さない");
  });

  test("バーの ⧉ は、押すと開き、もう一度押すと閉じる", () => {
    let open = 0, close = 0, isOpen = false;
    const stub = {
      available: () => true, open() { open += 1; isOpen = true; }, close() { close += 1; isOpen = false; },
      isOpen: () => isOpen
    };
    const { dom, window } = runBar({ panel: stub });
    window.Trk.playerBar.sync();
    const panelBtn = buttonIn(dom, "trk-pb-panel");
    fire(panelBtn, "click");
    assert.equal(open, 1);
    window.Trk.playerBar.sync();
    assert.equal(panelBtn.attributes["aria-pressed"], "true", "開いていることを読み上げにも出す");
    fire(panelBtn, "click");
    assert.equal(close, 1);
  });
});

/* ---------- 4. 設定・文言・読み込み ---------- */
describe("trk226 設定と文言", () => {
  test("❓謎設定「バーに触れても位置を移動しない」は既定オフ。工場出荷状態でもオフ", () => {
    assert.match(coreSrc, /playerBarSeekLock: prefs\.playerBarSeekLock === true/);
    assert.match(coreSrc, /settings\.playerBarSeekLock = false;/);
    assert.match(html, /<input id="playerBarSeekLock" type="checkbox">/, "❓謎設定の欄にある");
    assert.match(html, /<script src="js\/player-panel\.js"><\/script>/, "パネルを読み込む");
    assert.ok(html.indexOf("js/player-bar.js") < html.indexOf("js/player-panel.js"), "バーの後に読む");
  });

  test("設定の欄（ui-prefs）は、既定がオンのものとオフのものを取り違えない", () => {
    const prefs = read("js/ui-prefs.js");
    assert.match(prefs, /DEFAULT_ON = new Set\(\["fixedIconSize", "uiModeLock"\]\)/);
    assert.match(prefs, /playerBarSeekLock: "playerBarSeekLock"/);
  });

  test("文言は4言語ぶん（バーのボタン・謎設定・パネル）", () => {
    for (const key of ["playerBarSeekLock", "playerBarSeekLockHint", "barSeekLocked",
      "barShuffle", "barShuffleOn", "barShuffleOff", "barRepeat", "barRepeatOff", "barRepeatOne", "barRepeatAll",
      "barPanel", "barPanelClose", "barShuffleOnToast", "barRepeatOneToast", "barRepeatOffToast"]) {
      const count = (i18nSrc.match(new RegExp(`\\b${key}:`, "g")) || []).length;
      assert.equal(count, 4, `${key} は4言語`);
    }
  });

  test("CSS：押されている状態・触れる線・狭い画面での詰め方を規則で持つ", () => {
    const css = read("css/player-bar.css");
    assert.match(css, /\.trk-pb-shuffle\.is-on, \.trk-pb-repeat\.is-on \{/, "オンは色と枠で示す");
    assert.match(css, /\.trk-pb-seek:not\(:disabled\) \{ cursor: pointer; \}/);
    assert.match(css, /\.trk-pb-seek\.is-locked \{ cursor: default; \}/);
    assert.match(css, /@media \(max-width: 430px\) \{\s*\/\*[^]*?\.trk-pb-art \{ display: none; \}/, "狭い画面ではジャケットを譲る");
  });
});
