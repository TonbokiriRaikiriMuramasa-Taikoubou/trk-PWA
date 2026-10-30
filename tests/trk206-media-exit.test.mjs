// SPDX-License-Identifier: GPL-3.0-or-later
/* 🚪 trk206: メディアプレイヤーを抜けたとき、曲を読み込み直さずにそのまま流す（既定）。
   2026-10-27 のプレイフィール改善。プレイヤーへ入るときと同じで曲が途切れないので、
   曲リストでエフェクトや設定を触っても音が消えない。
   昔の動き（閉じると止めてプレビューの開始位置から鳴らし直す）は、
   ❓謎設定「メディアプレイヤーを抜けた時に曲を再読込する」（既定オフ）で再現できる。
   tests で確かめること：抜け方の決定（純粋関数）・closeMedia の分岐（止める/流す/鳴らし直す）・
   流すときの音量（位置は動かさない）・設定の既定と配線・4言語の文言・cache名 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const src = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const mainSrc = fs.readFileSync(`${ROOT}/js/main.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const i18nOptions = fs.readFileSync(`${ROOT}/js/i18n-options.js`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

function plan(over = {}) {
  const fn = src.match(/function mediaExitPlan\(st\) \{[\s\S]*?\n\}/)[0];
  const context = vm.createContext({});
  vm.runInContext(fn, context);
  context.st = { close: true, phase: "title", reloadOnExit: false, previewEnabled: true, ...over };
  return vm.runInContext("mediaExitPlan(st)", context);
}

test("trk206: leaving the player keeps the song playing by default", () => {
  assert.equal(plan(), "keep", "既定はそのまま流す");
  assert.equal(plan({ reloadOnExit: true }), "reload", "❓謎設定で昔の動き（鳴らし直す）");
  assert.equal(plan({ previewEnabled: false }), "pause", "プレビューがオフならタイトルでは鳴らさない");
  assert.equal(plan({ close: false }), "pause", "ゲーム開始などで閉じるときは止める");
  assert.equal(plan({ phase: "playing" }), "pause", "タイトル以外では止める");
  assert.equal(plan({ close: false, reloadOnExit: true }), "pause", "謎設定でもゲーム開始は止める");
  assert.equal(plan({ reloadOnExit: "yes" }), "keep", "真偽値以外は謎設定と見なさない");
  assert.equal(plan({ previewEnabled: undefined }), "pause", "プレビューの設定が読めなければ鳴らさない");
  assert.equal(plan({ reloadOnExit: true, previewEnabled: false }), "reload", "再読込はプレビューの有無より優先（昔の動きの再現）");
});

test("trk206: closeMedia pauses only when the plan says so, and reloads only for the mystery setting", () => {
  const body = src.match(/function closeMedia\(restore = true\) \{[\s\S]*?\n\}/)[0];
  assert.match(body, /const exitPlan = mediaExitPlan\(\{[\s\S]{0,240}?close: restore === true, phase: core\.phase,[\s\S]{0,160}?reloadOnExit: core\.settings\.mediaReloadOnExit === true,[\s\S]{0,160}?previewEnabled: core\.settings\.previewEnabled === true,/);
  assert.match(body, /if \(exitPlan !== "keep"\) core\.video\.pause\(\);/, "流すときは止めない");
  assert.ok(!/saveMediaPosition\(\); core\.video\.pause\(\);/.test(body), "閉じるたびに必ず止める古い行は消す");
  assert.match(body, /if \(exitPlan === "reload" && typeof startPreview === "function"\) setTimeout\(window\.Trk\.library\.startPreview, 50\);/, "鳴らし直すのは再読込のときだけ");
  assert.match(body, /else if \(exitPlan === "keep" && window\.Trk\.library && typeof window\.Trk\.library\.previewContinue === "function"\) window\.Trk\.library\.previewContinue\(\);/, "流すときは音量だけ戻す");
  assert.ok(!/if \(restore && core\.phase === "title" && core\.settings\.previewEnabled/.test(src), "古い「閉じたら必ずプレビューを鳴らし直す」分岐は残さない");
  assert.match(src, /mediaExitPlan \};/, "テスト用に公開する（window.TrkMediaPlayer.mediaExitPlan）");
});

test("trk206: previewContinue never seeks — it only eases the volume to the preview level", () => {
  const fn = librarySrc.match(/function previewContinue\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!/currentTime\s*=/.test(fn), "位置を書き換えない（＝読み込み直さない）");
  assert.ok(!/\.play\(\)/.test(fn), "止まっている曲を勝手に鳴らさない");
  const run = (over = {}) => {
    const s = { phase: "title", previewEnabled: true, musicVolume: 0.5, paused: false, src: "song.mp3", song: true, mediaMode: false, muted: false, ...over };
    const calls = { fades: [], cancels: 0 };
    const video = { paused: s.paused, src: s.src, muted: s.muted };
    const context = vm.createContext({
      window: { _trkMediaPlayerMode: s.mediaMode },
      core: { phase: s.phase, settings: { previewEnabled: s.previewEnabled, musicVolume: s.musicVolume }, currentSong: s.song ? { name: "x" } : null },
      video,
      fadeTo: (to, ms) => calls.fades.push([to, ms]),
      cancelAnimationFrame: () => { calls.cancels++; },
    });
    vm.runInContext("let fadeRaf = 0;", context);   /* library.js のフェード用の番号（関数の外にある） */
    vm.runInContext(fn, context);
    const result = vm.runInContext("previewContinue()", context);
    return { result, calls, muted: video.muted };
  };
  const ok = run();
  assert.equal(ok.result, true, "タイトルで再生中なら続ける");
  assert.deepEqual([...ok.calls.fades.at(-1)], [0.4, 600], "音量はプレビュー相当（musicVolume×0.8）へ静かに");
  assert.equal(ok.calls.cancels, 1, "前のフェードは止める");
  assert.equal(run({ paused: true }).result, false, "止まっているときは何もしない");
  assert.equal(run({ previewEnabled: false }).result, false, "プレビューがオフなら何もしない");
  assert.equal(run({ phase: "playing" }).result, false, "タイトル以外では何もしない");
  assert.equal(run({ mediaMode: true }).result, false, "プレイヤーを開いているときは何もしない");
  assert.equal(run({ src: "" }).result, false, "音源が無ければ何もしない");
  assert.equal(run({ song: false }).result, false, "曲が選ばれていなければ何もしない");
  assert.equal(run({ paused: true }).calls.fades.length, 0, "何もしないときはフェードもしない");
  assert.equal(run({ muted: true }).muted, false, "プレイヤーで消音していたときも、曲リストでは鳴らす");

  const exported = librarySrc.match(/window\.Trk\.library = Object\.assign\(window\.Trk\.library \|\| \{,?([\s\S]*?)\}\);/);
  assert.ok(exported, "window.Trk.library の公開一覧がある");
  assert.match(exported[1], /\bpreviewContinue\b/, "previewContinue を公開する（media-player-mode.js から呼ぶ）");
});

test("trk206: the mystery checkbox exists, starts off, and is wired in four languages", () => {
  assert.match(html, /<label class="check"><input id="mediaReloadOnExit" type="checkbox"><span data-i18n="mediaReloadOnExit"><\/span><\/label>\s*<div class="hint" data-i18n="mediaReloadOnExitHint"><\/div>/);
  const mystery = html.split('data-i18n="secMystery"')[1].split("</section>")[0];
  assert.match(mystery, /id="mediaReloadOnExit"/, "❓謎設定（不具合の再現）の欄に置く");
  assert.match(mystery, /id="judgeOrdered"/, "既存の謎設定の隣");

  assert.match(coreSrc, /mediaReloadOnExit: prefs\.mediaReloadOnExit === true,/, "既定はオフ（そのまま流す）");
  assert.match(coreSrc, /settings\.mediaReloadOnExit = false;/, "全リセットでも初期値（オフ）へ");
  assert.match(mainSrc, /core\.\$\("mediaReloadOnExit"\)\) core\.\$\("mediaReloadOnExit"\)\.checked = !!core\.settings\.mediaReloadOnExit;/, "開いたときに読み戻す");
  assert.match(mainSrc, /\["mediaReloadOnExit", "mediaReloadOnExit"\]/, "チェックの変更を保存する");

  for (const key of ["mediaReloadOnExit", "mediaReloadOnExitHint"]) {
    assert.equal(i18nOptions.split(`\n  ${key}:`).length - 1, 4, `${key} は4言語`);
  }
  assert.match(i18nOptions, /mediaReloadOnExit:"🚪 メディアプレイヤーを抜けた時に曲を再読込する"/, "利用者が指定した名前");
  const jaHint = i18nOptions.match(/mediaReloadOnExitHint:"([^"]*)"/)[1];
  assert.match(jaHint, /そのまま流れ続け/, "既定の動きを説明する");
  assert.match(jaHint, /不具合の再現/, "何のための設定か");
});

test("trk206: the service worker cache is bumped for this change", () => {
  const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "版数つきの名前");
  assert.ok(Number(m[2]) > 205, `trk205 より新しい番号で割る（今は ${m[2]}）`);
});
