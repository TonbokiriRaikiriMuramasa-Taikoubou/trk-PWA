// SPDX-License-Identifier: GPL-3.0-or-later
/* ❓ trk227: リピートの段と、シャッフルの範囲を選べるようにする（2026-10-31）

   利用者からの相談（言い間違いの訂正つき）:
     ・シャッフルではなく **リピート** に好みがある。既定は「なし → 1曲 → 全曲 → なし」でよい
     ・でも「なし → 1曲 → なし」だけで使いたい人のために、
       ❓謎設定「リピートボタンを単曲リピートのみにする」（既定オフ）を作る
     ・プレイリスト内のシャッフルも選べるように（❓謎設定「シャッフルは、いまの一覧（プレイリスト）の中から選ぶ」・既定オフ）

   文字列の `includes` ではなく、純粋関数の戻り値・偽 DOM の実測・抜き出した関数の実行結果で見ます。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";
import { runBar, fire, barOf } from "./helpers/player-bar-harness.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const coreSrc = read("js/core.js");
const barSrc = read("js/player-bar.js");
const playerSrc = read("js/media-player-mode.js");
const librarySrc = read("js/library.js");
const prefsSrc = read("js/ui-prefs.js");
const i18nSrc = read("js/i18n.js");
const html = read("index.html");

const transportOf = dom => barOf(dom).childNodes.find(n => n.className === "trk-pb-transport");
const repeatButtonOf = dom => transportOf(dom).childNodes.find(n => n.className === "trk-pb-repeat");

/* 関数だけを抜き出して、その場で動かす小さな道具（大きなファイルを丸ごと読み込まない） */
function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} がある`);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  assert.notEqual(end, -1, `${endMarker} がある`);
  return source.slice(start, end);
}
/* 関数ひとつを、閉じかっこまで含めて抜き出す（`\n}` の手前までだと構文エラーになる） */
function extractFn(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} がある`);
  const end = source.indexOf("\n}", start);
  assert.notEqual(end, -1, `${marker} の閉じかっこがある`);
  return source.slice(start, end + 2);
}
function runIn(code, globals) {
  const sandbox = { ...globals, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

/* ---------- 1. リピートの段（純粋関数） ---------- */
describe("trk227 リピートの段：既定は3段、謎設定で2段", () => {
  test("既定（引数なし）は、これまでどおり なし → 1曲 → 全曲 → なし", () => {
    const { window } = runBar();
    const next = window.Trk.playerBar.nextRepeat;
    assert.equal(next("off"), "one");
    assert.equal(next("one"), "all");
    assert.equal(next("all"), "off");
    assert.equal(next("なにか"), "off", "知らない値は先頭へ");
  });

  test("単曲リピートのみ（2段）は なし ⇄ 1曲 で、全曲へは進まない", () => {
    const { window } = runBar();
    const next = window.Trk.playerBar.nextRepeat;
    assert.equal(next("off", true), "one");
    assert.equal(next("one", true), "off");
    assert.equal(next("all", true), "off", "残っていた「全曲」は「なし」へ寄せる");
    assert.equal(next("なにか", true), "off");
    /* 段の並びそのもの（数として見る） */
    const choices = window.Trk.playerBar.repeatChoices;
    assert.deepEqual([...choices(false)], ["off", "one", "all"]);
    assert.deepEqual([...choices(true)], ["off", "one"]);
  });

  test("保存に「全曲」が残っていても、謎設定がオンなら「なし」として扱う", () => {
    const on = runBar({ mediaRepeat: "all", repeatOneOnly: true });
    assert.equal(on.window.Trk.playerBar.repeatMode(), "off");
    const off = runBar({ mediaRepeat: "all", repeatOneOnly: false });
    assert.equal(off.window.Trk.playerBar.repeatMode(), "all", "設定がオフなら全曲のまま");
  });

  test("実測：謎設定オンで 🔁 を押すと、1曲 ⇄ なし を往復し、全曲にならない", () => {
    const { dom, window, core, calls } = runBar({ mediaRepeat: "all", repeatOneOnly: true });
    window.Trk.playerBar.sync();
    const button = repeatButtonOf(dom);
    assert.equal(button.textContent, "🔁", "「なし」として見えている");

    fire(button, "click");
    assert.equal(core.settings.mediaRepeat, "one");
    assert.equal(button.textContent, "🔂");
    assert.equal(button.attributes["aria-pressed"], "true");

    fire(button, "click");
    assert.equal(core.settings.mediaRepeat, "off");
    assert.equal(button.textContent, "🔁");

    fire(button, "click");
    assert.equal(core.settings.mediaRepeat, "one", "3回目も全曲へは行かない");
    assert.equal(calls.save, 3, "毎回保存する");
    assert.deepEqual(calls.emitted.map(e => e.name), ["mediaOptions", "mediaOptions", "mediaOptions"]);
    assert.equal(calls.toast.some(m => m.includes("全曲")), false, "「全曲」の案内は出ない");
  });

  test("実測：謎設定オフなら、これまでどおり全曲まで回る", () => {
    const { dom, window, core } = runBar({ mediaRepeat: "off", repeatOneOnly: false });
    window.Trk.playerBar.sync();
    const button = repeatButtonOf(dom);
    fire(button, "click");
    fire(button, "click");
    assert.equal(core.settings.mediaRepeat, "all", "2回で全曲");
  });
});

/* ---------- 2. シャッフルの範囲 ---------- */
function clickNext(dom) { fire(transportOf(dom).childNodes[2], "click"); }
const wait = () => new Promise(resolve => setTimeout(resolve, 10));

describe("trk227 シャッフルの範囲：全体／いまの一覧", () => {
  const songs = [{ key: "song-a" }, { key: "song-b" }, { key: "song-c" }, { key: "song-d" }];
  const view = [{ key: "song-c" }, { key: "song-d" }];

  test("謎設定オンなら、いまの一覧（プレイリスト）の中から選ぶ", async () => {
    const on = runBar({ mediaShuffle: true, shuffleInList: true, songs, view });
    on.window.Trk.playerBar.sync();
    clickNext(on.dom);
    await wait();
    assert.equal(on.calls.select.length, 1);
    assert.ok(["song-c", "song-d"].includes(on.calls.select[0]), `一覧の中から選ぶ（選んだ: ${on.calls.select[0]}）`);
  });

  test("謎設定オフなら、これまでどおりライブラリの全曲から選ぶ", async () => {
    const off = runBar({ mediaShuffle: true, shuffleInList: false, songs, view });
    off.window.Trk.playerBar.sync();
    const picked = new Set();
    for (let i = 0; i < 24; i += 1) {
      clickNext(off.dom);
      await wait();
    }
    for (const key of off.calls.select) picked.add(key);
    assert.ok([...picked].every(k => k !== "song-a"), "いまの曲は除く");
    assert.ok([...picked].some(k => k === "song-b"), `一覧の外の曲も選ばれる（選んだ: ${[...picked].join(",")}）`);
  });

  test("シャッフルの範囲の判断は純粋関数（設定をそのまま返す）", () => {
    assert.equal(runBar({ shuffleInList: true }).window.Trk.playerBar.shuffleInList(), true);
    assert.equal(runBar({ shuffleInList: false }).window.Trk.playerBar.shuffleInList(), false);
    assert.equal(runBar().window.Trk.playerBar.shuffleInList(), false, "未設定はオフ");
  });

  test("ライブラリの対象：一覧があればその写し、無ければ全曲", () => {
    const src = librarySrc;
    const code = extract(src, "function shufflePool()", "\nfunction nextSong()");
    const all = [{ key: "a" }, { key: "b" }];
    const shown = [{ key: "x" }];
    const empty = runIn(`${code}\n;globalThis.__pool = shufflePool;`, { libView: [], allSongs: () => all });
    assert.deepEqual(empty.__pool(), all, "一覧が空なら全曲");
    const full = runIn(`${code}\n;globalThis.__pool = shufflePool;`, { libView: shown, allSongs: () => all });
    const pool = full.__pool();
    assert.deepEqual(pool, shown, "一覧の中身");
    pool.push({ key: "y" });
    assert.equal(full.libView.length, 1, "写しなので、一覧そのものは変わらない");
    /* 曲送りも同じ並びを使う（見えている順番の中でランダム、が成り立つ） */
    for (const fnName of ["function nextSong()", "function prevSong()"]) {
      const body = extract(src, fnName, "\n}\n");
      assert.match(body, /const list = shufflePool\(\)/, `${fnName} が同じ並びを使う`);
    }
    assert.match(src, /previewRestartFor, shufflePool \}\);/, "Trk.library から読める");
  });
});

/* ---------- 3. 再生画面（メディアプレイヤー）も同じ設定に従う ---------- */
describe("trk227 再生画面のリピートと🎲も、同じ謎設定に従う", () => {
  const helpers = extract(playerSrc, "const repeatOneOnly = () =>", "if (repeatOneOnly() && repeatMode === \"all\") repeatMode = \"off\";");

  test("リピートの選択肢：オフなら3つ、オンなら「なし／1曲」の2つ", () => {
    const three = runIn(`${helpers}\n;globalThis.__o = repeatOptions;`, { core: { settings: {} } });
    assert.deepEqual(Array.from(three.__o(), ([value]) => value), ["off", "one", "all"]);
    const two = runIn(`${helpers}\n;globalThis.__o = repeatOptions;`, { core: { settings: { playerBarRepeatOneOnly: true } } });
    assert.deepEqual(Array.from(two.__o(), ([value]) => value), ["off", "one"], "「全曲」を出さない");
    assert.deepEqual(Array.from(two.__o(), ([, key]) => key), ["mediaRepeatOff", "mediaRepeatOne"], "文言のキーも2つ");
  });

  test("setRepeat：オンなら「全曲」を受けず、「なし」になる（保存もし直す）", () => {
    const fn = extractFn(playerSrc, "function setRepeat(value)");
    const sandbox = {
      core: { settings: { playerBarRepeatOneOnly: true }, saveUserPrefs() {} },
      repeatMode: "off", renderMedia() {}, announceMediaOptions() {}, tr: k => k
    };
    const s = runIn(`${helpers}\nlet repeatMode = "off";\n${fn}\n;globalThis.__set = setRepeat;`, sandbox);
    s.__set("all");
    assert.equal(s.core.settings.mediaRepeat, "off", "全曲は受けない");
    s.__set("one");
    assert.equal(s.core.settings.mediaRepeat, "one", "1曲は受ける");
  });

  test("pullMediaOptions：バーや設定で変わったら、こちらも2段に寄せて保存し直す", () => {
    const fn = extractFn(playerSrc, "function pullMediaOptions()");
    assert.match(fn, /if \(repeatOneOnly\(\) && repeatMode === "all"\) repeatMode = "off";/, "全曲を「なし」へ");
    assert.match(fn, /fillRepeatOptions\(\);/, "選択肢を作り直す");
    assert.match(fn, /core\.settings\.mediaRepeat !== repeatMode/, "保存の値と食い違ったら書き直す");
    /* 選択肢の作り直しは、要る数が変わったときだけ中身を入れ替える */
    const fill = extractFn(playerSrc, "function fillRepeatOptions()");
    assert.match(fill, /const have = Array\.from\(repeatNode\.childNodes \|\| \[\]\)/, "いまの選択肢を数える");
    assert.match(fill, /if \(have !== want\)/, "同じなら作り直さない");
  });

  test("🎲 の対象：オンなら Trk.library.shufflePool() を使い、空なら全曲へ戻す", () => {
    const fn = extractFn(playerSrc, "function shuffleCandidates(list)");
    assert.match(fn, /if \(!shuffleInList\(\)\) return list;/, "オフならこれまでどおり");
    const sandbox = {
      core: { settings: { playerBarShuffleInList: true } },
      window: { Trk: { library: { shufflePool: () => [] } } }
    };
    const s = runIn(`const shuffleInList = () => core.settings.playerBarShuffleInList === true;\n${fn}\n;globalThis.__pick = shuffleCandidates;`, sandbox);
    assert.deepEqual([...s.__pick([{ key: "all-1" }])], [{ key: "all-1" }], "一覧が空なら全曲");
    sandbox.window.Trk.library.shufflePool = () => [{ key: "in-list" }];
    assert.deepEqual([...s.__pick([{ key: "all-1" }])], [{ key: "in-list" }], "一覧があればその中");
    const off = runIn(`const shuffleInList = () => false;\n${fn}\n;globalThis.__pick = shuffleCandidates;`, sandbox);
    assert.deepEqual([...off.__pick([{ key: "all-1" }])], [{ key: "all-1" }], "オフなら全曲のまま");
    /* 曲送り（🎲）は、この対象から選ぶ */
    const candidates = extractFn(playerSrc, "function mediaCandidates()");
    assert.match(candidates, /const pool = shuffleCandidates\(list\);/, "mediaCandidates が使う");
  });
});

/* ---------- 4. 設定の欄・保存・文言 ---------- */
describe("trk227 設定の欄と保存", () => {
  test("❓謎設定の2つは、どちらも既定オフ（工場出荷状態でもオフ）", () => {
    assert.match(coreSrc, /playerBarRepeatOneOnly: prefs\.playerBarRepeatOneOnly === true/);
    assert.match(coreSrc, /playerBarShuffleInList: prefs\.playerBarShuffleInList === true/);
    assert.match(coreSrc, /settings\.playerBarRepeatOneOnly = false; settings\.playerBarShuffleInList = false;/);
    assert.match(html, /<input id="playerBarRepeatOneOnly" type="checkbox">/);
    assert.match(html, /<input id="playerBarShuffleInList" type="checkbox">/);
    assert.match(html, /data-i18n="playerBarRepeatOneOnlyHint"/);
    assert.match(html, /data-i18n="playerBarShuffleInListHint"/);
  });

  test("設定の配線（ui-prefs）は、既定オンのものと混ざらない", () => {
    assert.match(prefsSrc, /playerBarRepeatOneOnly: "playerBarRepeatOneOnly"/);
    assert.match(prefsSrc, /playerBarShuffleInList: "playerBarShuffleInList"/);
    const defaultOn = prefsSrc.match(/DEFAULT_ON = new Set\(\[([^\]]*)\]\)/)[1];
    assert.equal(defaultOn.includes("playerBarRepeatOneOnly"), false, "既定オフ");
    assert.equal(defaultOn.includes("playerBarShuffleInList"), false, "既定オフ");
    /* 単曲のみにしたら、残っている「全曲」を「なし」へ寄せる（その場で保存する） */
    const wire = extract(prefsSrc, 'if (id === "playerBarRepeatOneOnly" || id === "playerBarShuffleInList")', "\n        }");
    assert.match(wire, /core\.settings\.mediaRepeat = "off";/, "全曲を「なし」へ");
    assert.match(wire, /core\.emit\("mediaOptions"\)/, "バーと再生画面へ合図");
  });

  test("文言は4言語ぶん（2つの設定 × 見出しと説明）", () => {
    for (const key of ["playerBarRepeatOneOnly", "playerBarRepeatOneOnlyHint", "playerBarShuffleInList", "playerBarShuffleInListHint"]) {
      const count = (i18nSrc.match(new RegExp(`\\b${key}:`, "g")) || []).length;
      assert.equal(count, 4, `${key} は4言語`);
    }
  });

  test("バーの 🔁 は、謎設定の値をそのまま見る（純粋関数）", () => {
    assert.equal(runBar({ repeatOneOnly: true }).window.Trk.playerBar.repeatOneOnly(), true);
    assert.equal(runBar({ repeatOneOnly: false }).window.Trk.playerBar.repeatOneOnly(), false);
    assert.equal(runBar().window.Trk.playerBar.repeatOneOnly(), false, "未設定はオフ");
    assert.match(barSrc, /core\.settings\.mediaRepeat = nextRepeat\(repeatNow\(\), repeatOneOnly\(\)\);/);
  });
});
