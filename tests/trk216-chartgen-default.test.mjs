// SPDX-License-Identifier: GPL-3.0-or-later
/* 🎼 trk216：譜面生成方式の既定を **Bタイプ（方式4）** にする。
   ・触った感触で B のほうが良い、という利用者の判断（2026-10-29）
   ・既定が A だったころに保存された "3" は「自分で選んだ」とみなさない＝アップデート後は B へ移る
   ・一度でも設定で選んだ人（chartGenChosen）は、その選択をそのまま使う（Aのままにしたい人を勝手に動かさない）
   ・旧方式1・2（過去の譜面の再現）と Aタイプ（方式3）は、これまでどおり選べる
   ここで確かめるのは、DOM も実ブラウザーも要らない部分（既定の決まり方・初期化・配線・4言語）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const coreSrc = read("js/core.js");
const mainSrc = read("js/main.js");
const i18nSrc = read("js/i18n.js");
const htmlSrc = read("index.html");
const chartGenSrc = read("js/chart-gen.js");
const mediaSrc = read("js/media.js");
const swSrc = read("sw.js");

const between = (src, start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `slice ${start}`);
  return src.slice(a, b);
};

/* ---------- 1. 既定の決まり方（core.js の2行をそのまま動かす） ---------- */
const declSrc = coreSrc.match(/chartGenChosen:[^\n]*\n\s*chartGen:[^\n]*/);
assert.ok(declSrc, "core.js に chartGenChosen / chartGen の宣言がある");

function resolve(prefs) {
  const context = vm.createContext({ prefs, pick: (v, list, def) => (list.includes(v) ? v : def) });
  return vm.runInContext(`({ ${declSrc[0]} })`, context);
}

test("trk216: new installs (and old saved defaults) start on B = 4", () => {
  assert.equal(resolve({}).chartGen, "4", "未設定なら B");
  assert.equal(resolve({ chartGen: "3" }).chartGen, "4", "既定が A だったころの保存値は B へ移す");
  assert.equal(resolve({ chartGen: "1" }).chartGen, "4", "選んだ印が無ければ、既定へ");
  assert.equal(resolve({}).chartGenChosen, false);
});

test("trk216: an explicit choice is kept (A stays A for people who picked it)", () => {
  for (const g of ["1", "2", "3", "4"]) {
    assert.equal(resolve({ chartGenChosen: true, chartGen: g }).chartGen, g, `選んだ ${g} はそのまま`);
  }
  assert.equal(resolve({ chartGenChosen: true }).chartGen, "4", "印だけあって値が無効なら既定へ");
  assert.equal(resolve({ chartGenChosen: "yes", chartGen: "3" }).chartGen, "4", "ゆるい値は印とみなさない");
});

test("trk216: the setting is written when the select changes, and a factory reset goes back to B", () => {
  const handler = between(mainSrc, 'core.$("chartGen").addEventListener("change"', "});");
  assert.ok(handler.includes("core.settings.chartGenChosen = true"), "選んだら印を付ける");
  assert.ok(/\[\s*"1", "2", "3", "4"\]|\["1", "2", "3", "4"\]/.test(handler), "値は4つだけ受ける");
  assert.ok(handler.includes(': "4"'), "想定外の値は B に寄せる");
  const reset = between(coreSrc, "function resetAllPrefs()", "\n}");
  assert.ok(/settings\.chartGen = "4";/.test(reset), "工場出荷状態は B");
  assert.ok(/settings\.chartGenChosen = false;/.test(reset), "印も消す");
});

/* ---------- 2. ほかの場所の「既定」の説明がそろっている ---------- */
test("trk216: comments in chart-gen.js and media.js no longer call method 3 the default", () => {
  assert.ok(chartGenSrc.includes('アプリ設定の既定は "4"'), "chart-gen.js の説明");
  assert.ok(!/アプリ設定の既定は "3"/.test(chartGenSrc), "古い説明を残さない");
  assert.ok(mediaSrc.includes('既定 "4" = Bタイプ'), "media.js の説明");
  assert.ok(!/既定 "3" = 新方式/.test(mediaSrc), "古い説明を残さない");
});

test("trk216: the ☑ select labels B as the standard and A as the previous method", () => {
  assert.ok(htmlSrc.includes('<option value="4" data-i18n="chartGen4">Bタイプ（標準・方式4）</option>'), "並びはそのまま・名前を入れ替える");
  assert.ok(htmlSrc.includes('<option value="3" data-i18n="chartGen3">Aタイプ（方式3・従来）</option>'));
  assert.ok(!htmlSrc.includes("試験中"), "B はもう試験中ではない");
});

test("trk216: the four languages say B is the standard (and A is the previous one)", () => {
  const grab = key => [...i18nSrc.matchAll(new RegExp(`${key}:"((?:[^"\\\\]|\\\\.)*)"`, "g"))].map(m => m[1]);
  const b = grab("chartGen4"), a = grab("chartGen3"), hint = grab("chartGenHint");
  assert.equal(b.length, 4, "chartGen4 は4言語");
  assert.equal(a.length, 4, "chartGen3 は4言語");
  assert.equal(hint.length, 4, "chartGenHint は4言語");
  for (const s of b) assert.ok(/標準|standard|标准|표준/.test(s), `B を標準と呼ぶ: ${s}`);
  for (const s of a) assert.ok(/従来|previous|以往|이전/.test(s), `A を従来と呼ぶ: ${s}`);
  for (const s of hint) {
    assert.ok(/方式4|method 4|方式4|방식 4/.test(s), "ヒントに方式4");
    assert.ok(!/^Aタイプ（方式3）は標準/.test(s), "A を標準と言わない");
  }
});

test("trk216: the service worker cache name moves on for this release", () => {
  assert.ok(/const CACHE = "trk-v[\d.]+-trk\d+"/.test(swSrc), "cache 名がある");
  assert.ok(!swSrc.includes('trk-v2026.10.27-trk214"'), "1.1.4 の cache のままにしない");
});
