// SPDX-License-Identifier: GPL-3.0-or-later
/* trk221: 🎵 画面の下に出す再生バー（Clementine／VLC の下部プレイヤー相当）。

   ・出す／出さないは設定の3つ（つねに／曲を選んだら／出さない）
   ・ゲーム中・再生画面・書斎・ほかの窓のときは引っ込める（ステージと操作の邪魔をしない）
   ・再生・曲送り・再生位置・音量は、本体の仕組みをそのまま呼ぶ（独自の状態を持たない）
   ・色はスキンの CSS変数（--ui-*）だけ。バー専用の色は持ち込まない */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const barSrc = read("js/player-bar.js");
const cssSrc = read("css/player-bar.css");
const coreSrc = read("js/core.js");
const html = read("index.html");
const swSrc = read("sw.js");

/* 偽の DOM と実行の道具は tests/helpers/player-bar-harness.mjs（trk223 でも使う） */
import { fakeDom, fire, runBar, barOf } from "./helpers/player-bar-harness.mjs";

describe("trk221 再生バーを出すかどうかの判断（純粋関数）", () => {
  test("off は出さない／on は曲が無くても出す／auto は曲を選んだら出す", () => {
    const { window } = runBar();
    const decide = window.Trk.playerBar.decide;
    const base = { phase: "title", hasSong: true, media: false, study: false, modal: false };
    assert.equal(decide({ ...base, mode: "off" }), false, "off");
    assert.equal(decide({ ...base, mode: "off", hasSong: false }), false, "off は曲が無くても出さない");
    assert.equal(decide({ ...base, mode: "on", hasSong: false }), true, "on は曲が無くても出す（案内を出せる）");
    assert.equal(decide({ ...base, mode: "auto", hasSong: false }), false, "auto は曲が無ければ出さない");
    assert.equal(decide({ ...base, mode: "auto" }), true, "auto は曲があれば出す");
  });

  test("ゲーム中・再生画面・書斎・ほかの窓では引っ込める（on でも）", () => {
    const { window } = runBar();
    const decide = window.Trk.playerBar.decide;
    for (const phase of ["playing", "paused"]) {
      assert.equal(decide({ mode: "on", phase, hasSong: true, media: false, study: false, modal: false }), false, `phase=${phase}`);
    }
    assert.equal(decide({ mode: "on", phase: "ended", hasSong: true, media: false, study: false, modal: false }), true, "リザルトでは出す");
    assert.equal(decide({ mode: "on", phase: "title", hasSong: true, media: true, study: false, modal: false }), false, "再生画面を開いている間");
    assert.equal(decide({ mode: "on", phase: "title", hasSong: true, media: false, study: true, modal: false }), false, "書斎");
    assert.equal(decide({ mode: "on", phase: "title", hasSong: true, media: false, study: false, modal: true }), false, "ほかの窓（プレイリスト・ようこそ）");
  });

  test("スマホのシェルでは、置き場所の設定に合わせて下部ナビとの前後を決める（trk225）", () => {
    const { window } = runBar();
    /* above＝下部ナビの上（trk221〜trk224 までと同じ）／bottom＝画面のいちばん下（trk225 の既定） */
    assert.equal(window.Trk.playerBar.offset(66.4, "above"), 66, "ナビの上に置くときだけ持ち上げる");
    assert.equal(window.Trk.playerBar.offset(66.4, "bottom"), 0, "いちばん下なら持ち上げない");
    assert.equal(window.Trk.playerBar.offset(66.4), 0, "位置を省いたときは重ならない側（いちばん下）");
    assert.equal(window.Trk.playerBar.offset(0, "above"), 0);
    assert.equal(window.Trk.playerBar.offset(undefined, "above"), 0);
  });

  test("時間の表示（1時間を超えたら時:分:秒）", () => {
    const { window } = runBar();
    const fmt = window.Trk.playerBar.formatTime;
    assert.equal(fmt(0), "0:00");
    assert.equal(fmt(65), "1:05");
    assert.equal(fmt(3725), "1:02:05");
    assert.equal(fmt(NaN), "--:--");
    assert.equal(fmt(-1), "--:--");
  });
});

describe("trk221 バーの中身と操作", () => {
  test("はじめは隠れていて、曲を選ぶと出る（auto）", () => {
    const { dom, window } = runBar({ hasSong: false });
    const bar = barOf(dom);
    assert.ok(bar, "バーを作る");
    assert.equal(bar.hidden, true, "曲が無いうちは隠す");
    assert.equal(dom.body.classList.contains("trk-playerbar"), false);

    window.Trk.core.currentSong = { key: "song-b", base: "曲B", artist: "歌手B" };
    window.Trk.playerBar.sync();
    assert.equal(bar.hidden, false, "曲を選んだら出す");
    assert.equal(dom.body.classList.contains("trk-playerbar"), true, "ほかの部品の余白を空ける印");
  });

  test("曲名と歌手を、本体の表示（songDisplayMeta）から写す", () => {
    const { dom, window } = runBar();
    const bar = barOf(dom);
    const title = bar.childNodes.find(n => n.className === "trk-pb-meta").childNodes[0];
    assert.equal(title.textContent, "曲A（表示）", "曲名");
    assert.equal(window.Trk.playerBar.visible(), true);
  });

  test("ゲーム中は引っ込み、リザルトで戻る（phase の知らせで切り替わる）", () => {
    const { dom, core, events } = runBar();
    const bar = barOf(dom);
    core.phase = "playing";
    for (const event of events.filter(e => e.name === "phase")) event.fn();
    assert.equal(bar.hidden, true, "プレイ中は出さない");
    core.phase = "ended";
    for (const event of events.filter(e => e.name === "phase")) event.fn();
    assert.equal(bar.hidden, false, "リザルトでは出す");
  });

  test("再生ボタンは、曲名バナーの本物の ▶ を押す（状態を二重に持たない）", () => {
    const { dom, fire: press, calls, banner } = runBar();
    const bar = barOf(dom);
    const transport = bar.childNodes.find(n => n.className === "trk-pb-transport");
    const play = transport.childNodes[1];
    assert.equal(play.className, "trk-pb-play");
    assert.equal(play.textContent, "▶", "バナーの見た目を写す");
    press(play, "click");
    assert.equal(calls.bannerClick, 1, "バナーの ▶ を押す");
    banner.textContent = "⏸";
    banner.title = "T:bannerPlayPauseTip";
    bar.childNodes.find(n => n.className === "trk-pb-transport");
    press(play, "click");
    assert.equal(calls.bannerClick, 2, "押すたびに本体へ渡す");
  });

  test("曲送りは本体の prevSong／nextSong と selectSong を使う（プレイ中は押せない）", async () => {
    const { dom, fire: press, calls } = runBar();
    const transport = barOf(dom).childNodes.find(n => n.className === "trk-pb-transport");
    const prev = transport.childNodes[0];
    const next = transport.childNodes[2];
    assert.equal(prev.disabled, false, "選曲中は押せる");
    press(next, "click");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(calls.select, ["song-next"], "次の曲を選ぶ");
    press(prev, "click");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(calls.select, ["song-next", "song-prev"]);
  });

  test("再生位置は本体の seekTo へ（0〜1000 を曲の長さに直す）", () => {
    const { dom, fire: press, calls } = runBar({ phase: "playing" });
    const bar = barOf(dom);
    const seek = bar.childNodes.find(n => n.className === "trk-pb-seek");
    assert.equal(seek.disabled, false, "再生中は動かせる");
    seek.value = "500";
    press(seek, "input");
    assert.deepEqual(calls.seek, [50], "100秒の曲の半分＝50秒");
  });

  test("音量は本体の設定（musicVolume）と 設定画面のスライダーへ書き戻す", () => {
    const { dom, core, fire: press, calls } = runBar();
    const bar = barOf(dom);
    const vol = bar.childNodes.find(n => n.className === "trk-pb-actions").childNodes[0].childNodes[1];
    vol.value = "0.25";
    press(vol, "input");
    assert.equal(core.settings.musicVolume, 0.25);
    assert.equal(core.video.volume, 0.25, "鳴っている音にもすぐ効く");
    assert.ok(calls.save >= 1, "設定として保存する");
  });

  test("✕ は「表示しない」にして、設定の欄にも同じ値を見せる", () => {
    const { dom, core, fire: press } = runBar();
    const bar = barOf(dom);
    const hide = bar.childNodes.find(n => n.className === "trk-pb-actions").childNodes[2];
    press(hide, "click");
    assert.equal(core.settings.playerBar, "off");
    assert.equal(bar.hidden, true);
  });

  test("⛶ は本体の再生画面を開く", () => {
    const { dom, fire: press, calls } = runBar();
    const open = barOf(dom).childNodes.find(n => n.className === "trk-pb-actions").childNodes[1];
    press(open, "click");
    assert.equal(calls.openPlayer, 1);
  });
});

describe("trk221 見た目と配線", () => {
  test("色はスキンの CSS変数だけを使う（バー専用の色を持ち込まない）", () => {
    for (const name of ["--ui-panel", "--ui-accent", "--ui-text", "--ui-muted", "--ui-border"]) {
      assert.ok(cssSrc.includes(`var(${name}`), `${name} を使う`);
    }
    /* 独自のアクセント色（#ff…/rgb(…)）は書かない。影の rgba(0,0,0,…) だけは例外 */
    const colors = cssSrc.match(/#[0-9a-fA-F]{3,8}/g) || [];
    assert.deepEqual(colors, [], "決め打ちの色は使わない");
    const rgb = cssSrc.match(/rgba?\(([^)]*)\)/g) || [];
    for (const value of rgb) assert.ok(/^rgba\(0, 0, 0,/.test(value), `影だけ: ${value}`);
  });

  test("セーフエリアと、ほかの部品との重なりを避ける", () => {
    assert.ok(cssSrc.includes("env(safe-area-inset-bottom)"), "スマホの下の余白");
    assert.ok(cssSrc.includes("--trk-playerbar-offset"), "下部ナビの上に載せる");
    assert.ok(cssSrc.includes("body.trk-playerbar #floatingSafeBtn"), "🛟 セーフモードの逃げ道を隠さない");
    assert.ok(cssSrc.includes("body.trk-playerbar .plToast"), "通知がバーに隠れない");
    assert.ok(cssSrc.includes("@media (max-width: 760px)"), "狭い画面では時間と音量を省く");
  });

  test("index.html が CSS と JS を読み、sw.js の殻の先読みに入る", () => {
    assert.ok(html.includes('<link rel="stylesheet" href="css/player-bar.css">'), "CSS");
    assert.ok(html.includes('<script src="js/player-bar.js"></script>'), "JS");
    const media = html.indexOf('<script src="js/media-player-mode.js"></script>');
    const bar = html.indexOf('<script src="js/player-bar.js"></script>');
    assert.ok(media > 0 && bar > media, "メディアプレーヤーの後に読む（窓口を使うため）");
    /* 版ごとにキャッシュ名を上げる（今の名前は trk222。日付ではなく版の名前で見る） */
    assert.ok(/const CACHE = "trk-v[0-9.]+-trk22[0-9]";/.test(swSrc), "キャッシュ名を版ごとに更新する");
    assert.ok(swSrc.includes("index.html"), "殻の一覧は index.html から読む（ファイルを足しても直さなくてよい）");
  });

  test("独自の保存キーや再生状態を持たない", () => {
    assert.equal(barSrc.includes("localStorage"), false, "保存は core.saveUserPrefs だけ");
    assert.equal(/shadow_taiko_preferences_v2/.test(barSrc), false, "保存キーの名前は書かない");
    assert.ok(!/new Audio\(/.test(barSrc), "音の通り道を増やさない（本体の video を使う）");
    /* trk222 で既定を on に変更（前回聞いていた曲をそのままバーに出しておける） */
    assert.ok(coreSrc.includes('playerBar: pick(prefs.playerBar, ["on", "auto", "off"], "on")'), "設定は core に載せる（既定＝つねに表示）");
  });
});
