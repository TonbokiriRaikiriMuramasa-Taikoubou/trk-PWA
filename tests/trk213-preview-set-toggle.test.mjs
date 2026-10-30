// SPDX-License-Identifier: GPL-3.0-or-later
/* ⏱ trk213：曲名タブの「ここをプレビュー開始位置にする」を、設定で出し入れできるようにする。
   ・使わない人が誤って触り、その曲のプレビュー開始位置を変えてしまうのを避けるため、**初期は出さない**
   ・置き場所は 📊 スペクトラムの設定（⚙ 設定の「📊 スペクトラム（音の見える化）」と、
     ラックの「くわしい設定」の中。どちらも spectrum.js の buildBox が作る）
   ・チェックを入れると、その場で曲名タブのボタンが出る（外すと消え、開いていたバーも閉じる）
   ・「⏮ 常に最初から再生する」は設定とメディアプレーヤーから今までどおり変えられる
   ここで確かめるのは、DOM も実ブラウザーも要らない部分（設定の形・純関数・配線・4言語）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const coreSrc = read("js/core.js");
const libSrc = read("js/library.js");
const specSrc = read("js/spectrum.js");
const swSrc = read("sw.js");
const startMd = read("docs/guide/start.md");
const enMd = read("docs/guide/en.md");

/* ---------- 1. 設定は1つの真偽値・初期オフ・映像の初期化でオフへ戻る ---------- */
test("trk213: the setting is a single opt-in boolean, off by default", () => {
  assert.ok(coreSrc.includes("previewStartShow: prefs.previewStartShow === true"),
    "初期オフ（今までの動き＝出さない、を既定にする）");
  assert.ok(/settings\.previewStartShow = false;/.test(coreSrc),
    "映像まわりの初期化（resetVideoPrefs）でオフへ戻る");
  const reset = coreSrc.slice(coreSrc.indexOf("function resetVideoPrefs()"), coreSrc.indexOf("function resetAudioPrefs()"));
  assert.ok(reset.includes("settings.previewStartShow = false"), "初期化の中に置く");
});

/* ---------- 2. 出すかどうかの判定（純関数） ---------- */
const shownSrc = libSrc.match(/function previewSetShown\(\) \{[\s\S]*?\n\}/);
const syncSrc = libSrc.match(/function syncPreviewSetBtn\(\) \{[\s\S]*?\n\}/);

function shownWith({ on = false, song = true, ready = true } = {}) {
  const context = vm.createContext({
    core: { settings: { previewStartShow: on }, currentSong: song ? { key: "1:2" } : null, videoReady: ready },
  });
  return vm.runInContext(`${shownSrc[0]}; previewSetShown()`, context);
}

test("trk213: the button only shows when the setting is on, a song is picked and the media is ready", () => {
  assert.ok(shownSrc, "previewSetShown がある");
  assert.equal(shownWith({ on: false }), false, "初期は出さない");
  assert.equal(shownWith({ on: true }), true, "オンなら出す");
  assert.equal(shownWith({ on: true, song: false }), false, "曲が無いときは出さない（今までどおり）");
  assert.equal(shownWith({ on: true, ready: false }), false, "音源の準備前は出さない（今までどおり）");
  /* 保存値が「true」以外（旧版の 1 など）なら出さない＝誤って出さない側に倒す */
  const loose = vm.createContext({ core: { settings: { previewStartShow: 1 }, currentSong: {}, videoReady: true } });
  assert.equal(vm.runInContext(`${shownSrc[0]}; previewSetShown()`, loose), false, "true 以外は出さない");
});

/* ---------- 3. 配線：曲名タブの2か所が同じ関数を通る・外したらバーも閉じる ---------- */
test("trk213: both banner paths use syncPreviewSetBtn, and hiding closes the open start bar", () => {
  assert.ok(syncSrc, "syncPreviewSetBtn がある");
  assert.ok(libSrc.includes("function syncPreviewSetBtn()"), "1か所で決める");
  /* 以前の直書き（曲と準備だけで決めていた）が残っていないこと */
  assert.ok(!libSrc.includes("previewSetBtn.hidden = !(s && core.videoReady)"), "バナーで直に決めていない");
  assert.ok(!libSrc.includes("previewSetBtn.hidden = !(core.currentSong && core.videoReady)"), "曲パックの欄でも直に決めていない");
  const upd = libSrc.match(/function updateSpBuilder\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(upd.includes("syncPreviewSetBtn()"), "曲パックの欄の更新から同じ関数を呼ぶ");
  const banner = libSrc.match(/function renderBanner\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(banner.includes("syncPreviewSetBtn()"), "バナーの描き直しから同じ関数を呼ぶ");
  assert.ok(libSrc.includes("syncPreviewSetBtn, startBarOpen") || libSrc.includes("startBarOpen, syncPreviewSetBtn"),
    "スペクトラムの設定から呼べるよう公開する");

  /* VM：オフにすると hidden=true・開いていたバーは閉じる／オンに戻すと hidden=false */
  const run = ({ on, panelOpen = false }) => {
    const box = {
      core: { settings: { previewStartShow: on }, currentSong: { key: "1:2" }, videoReady: true },
      previewSetBtn: { hidden: false },
      bannerStartPanel: { hidden: !panelOpen },
      closed: 0,
      startBarClose() { box.closed++; box.bannerStartPanel.hidden = true; },
    };
    vm.createContext(box);
    vm.runInContext(`${shownSrc[0]}\n${syncSrc[0]}; syncPreviewSetBtn();`, box);
    return box;
  };
  const off = run({ on: false, panelOpen: true });
  assert.equal(off.previewSetBtn.hidden, true, "オフなら出さない");
  assert.equal(off.closed, 1, "開いていた開始位置のバーを閉じる");

  const on = run({ on: true });
  assert.equal(on.previewSetBtn.hidden, false, "オンなら出す");
  assert.equal(on.closed, 0, "出している間は閉じない");

  const nothing = vm.createContext({
    core: { settings: { previewStartShow: true }, currentSong: null, videoReady: true },
    previewSetBtn: { hidden: false }, bannerStartPanel: { hidden: true }, startBarClose() {},
  });
  vm.runInContext(`${shownSrc[0]}\n${syncSrc[0]}; syncPreviewSetBtn();`, nothing);
  assert.equal(nothing.previewSetBtn.hidden, true, "曲が無いときは出さない");
});

/* ---------- 4. チェックボックスはスペクトラムの設定（2か所とも同じ buildBox） ---------- */
test("trk213: the checkbox lives in the spectrum settings and saves the value", () => {
  const box = specSrc.match(/function buildBox\(host, withCanvas\) \{[\s\S]*?\n\}/)[0];
  assert.ok(box.includes('mkCheck("specPreviewSet", () => core.settings.previewStartShow === true'),
    "スペクトラムの設定にチェックボックス（初期オフ）");
  assert.ok(box.includes("core.settings.previewStartShow = v === true"), "チェックの値を設定へ");
  assert.ok(box.includes("core.saveUserPrefs()"), "その場で保存する");
  assert.ok(box.includes("window.Trk.library.syncPreviewSetBtn"), "曲名タブのボタンをその場で合わせる");
  assert.ok(box.includes('tx("div", "specPreviewSetHint", "hint specPreviewSetHint")'), "説明文を添える");
  /* 設定画面の 📊 スペクトラムと、ラックの「くわしい設定」の両方が buildBox で作られる */
  const calls = specSrc.match(/buildBox\(/g) || [];
  assert.ok(calls.length >= 3, "定義1つ＋呼び出し2か所（設定とラック）");
  assert.ok(specSrc.includes('panel.append(tx("summary", "specTitle"))'), "⚙ 設定のスペクトラムの欄");
});

/* ---------- 5. 4言語 ---------- */
test("trk213: the new labels exist in all four languages", () => {
  for (const key of ["specPreviewSet", "specPreviewSetHint"]) {
    const n = (specSrc.match(new RegExp(`(^|[\\s,{])${key}:`, "g")) || []).length;
    assert.equal(n, 4, `${key} は4言語`);
  }
  /* 既存のボタンの文言はそのまま（trk188/193 の検査と合わせる） */
  const i18nSrc = read("js/i18n.js");
  for (const key of ["previewSet", "previewSetLongPress"]) {
    const n = (i18nSrc.match(new RegExp(`(^|[\\s,{])${key}:`, "g")) || []).length;
    assert.equal(n, 4, `${key} は4言語のまま`);
  }
});

/* ---------- 6. ガイドと cache ---------- */
test("trk213: the guides explain the new switch and the cache moves on", () => {
  assert.ok(startMd.includes("ここをプレビュー開始位置にする」を表示"), "日本語ガイドに設定の名前");
  assert.ok(startMd.includes("初期は出ていません") || startMd.includes("初期状態では出ていません"), "初期は出ないことを書く");
  assert.ok(enMd.includes("Set the preview start here"), "英語ガイドにも書く");
  const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "cache 名の形");
  assert.ok(Number(m[2]) >= 213, `cache は trk213 以降（いまは trk${m[2]}）`);
});
