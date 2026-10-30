// SPDX-License-Identifier: GPL-3.0-or-later
/* 曲名の照合（js/title-match.js）を node --test で検査する（依存パッケージ不要）。
 *
 *   node --test tests/        または   npm test
 *
 * 入出力で確かめる：ファイル名（08_sometimes.fla・SEARCH LIGHT.ogg など）と、カタログの見出し（08 sometimes・SEARCH RIGHT）が
 * 同じ曲として当たること、別の曲や同名の別アルバムを取り違えないこと。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const titleMatchSrc = fs.readFileSync(path.join(ROOT, "js/title-match.js"), "utf8");
const libSrc = fs.readFileSync(path.join(ROOT, "js/library.js"), "utf8");
/* plWishMatch は library.js に残っている（metaOf を使う）。その定義だけを切り出して同じ文脈で動かす */
const wishMatchSrc = (libSrc.match(/function plWishMatch[\s\S]*?(?=\nfunction plSyncWishes)/) || [""])[0];
if (!wishMatchSrc) throw new Error("plWishMatch が library.js から見つからない");

/* 各テストで作り直す文脈。metaOf は曲ごとのアルバム・アーティストを返す（無ければ null） */
function context(meta = {}) {
  const ctx = { metaOf: key => meta[key] || null };
  vm.createContext(ctx);
  vm.runInContext(`${titleMatchSrc}\n${wishMatchSrc}\n` +
    "globalThis.__keys = plTitleKeys; globalThis.__song = plSongMatchKeys; globalThis.__wish = plWishTitleKeys; globalThis.__match = plWishMatch;", ctx);
  return ctx;
}
/* media 曲のファイル名（＋任意のメモ）から、照合用の byTitle を作る（library.js の byTitleAdd と同じ形） */
function library(ctx, items) {
  const byTitle = new Map();
  for (const it of items) {
    for (const key of ctx.__song(it.title, it.hint || "")) {
      const hits = byTitle.get(key) || [];
      if (!hits.includes(it)) hits.push(it);
      byTitle.set(key, hits);
    }
  }
  return byTitle;
}

describe("曲名の照合キー（plTitleKeys）", () => {
  const ctx = context();
  test("ファイル名の番号・拡張子を外した別表記が候補に入る（08_sometimes.fla ↔ 08 sometimes）", () => {
    const keys = [...ctx.__keys("08_sometimes.fla")];
    assert.equal(keys[0], "08_sometimes.fla", "先頭はそのままの小文字");
    assert.ok(keys.includes("08 sometimes"), "区切りを空白にした形");
    assert.ok(keys.includes("sometimes"), "番号を外した形");
  });
  test("カタログ側の見出し（08 sometimes）は番号を外した形を含む", () => {
    assert.deepEqual([...ctx.__keys("08 sometimes")], ["08 sometimes", "sometimes"]);
  });
  test("大文字小文字と空白の差は同じキーになる", () => {
    assert.ok(ctx.__keys("  Up_to   YOU ").includes("up to you"));
    assert.equal(ctx.__keys("").length, 0, "空の名前は候補なし");
  });
  test("区切りの違い（ _ ・ - ・ / ）は空白に揃う", () => {
    assert.ok(ctx.__keys("Comet-Hime").includes("comet hime"));
    assert.ok(ctx.__keys("Sora／Up_to_you.ogg").includes("sora up to you"));
  });
});

describe("カタログの別表記（matchAliases）", () => {
  const ctx = context();
  test("SEARCH RIGHT（公式表記）は SEARCH LIGHT（配布ファイル名）の別表記として照合できる", () => {
    const wish = { t: "SEARCH RIGHT", al: "", ar: "初星学園", matchAliases: ["SEARCH LIGHT"] };
    const file = { key: "local-search-light", title: "SEARCH LIGHT.ogg", artist: "not 初星学園" };
    assert.equal(ctx.__match(wish, library(ctx, [file])), file);
  });
  test("TouhouThemeDBの曲IDでローカルMIDIを対応づける（th06_05.mid → おてんば恋娘）", () => {
    const wish = { t:"おてんば恋娘", al:"東方紅魔郷", ar:"ZUN", matchAliases:["th06_05"] };
    const file = { key:"local-th06-05", title:"th06_05.mid" };
    assert.equal(ctx.__match(wish, library(ctx, [file])), file);
  });
  test("th06_15.midもU.N.オーエンは彼女なのか？のカタログIDで照合する", () => {
    const wish = { t:"U.N.オーエンは彼女なのか？", al:"東方紅魔郷", ar:"ZUN", matchAliases:["th06_15"] };
    const file = { key:"local-th06-15", title:"th06_15.mid" };
    assert.equal(ctx.__match(wish, library(ctx, [file])), file);
  });
  test("別表記が無ければ SEARCH LIGHT は当たらない（別名を勝手に作らない）", () => {
    const wish = { t: "SEARCH RIGHT", al: "", ar: "" };
    const file = { key: "x", title: "SEARCH LIGHT.ogg", artist: "" };
    assert.equal(ctx.__match(wish, library(ctx, [file])), null);
  });
  test("別表記は8件まで（それ以上は読まない）", () => {
    const aliases = Array.from({ length: 9 }, (_, i) => `alias ${i}`);
    const keys = [...ctx.__wish({ t: "Main", matchAliases: aliases })];
    assert.ok(keys.includes("alias 7"));
    assert.ok(!keys.includes("alias 8"));
  });
});

describe("メモ（matchHint）と「キャラ名 - 曲名」の見出し", () => {
  const ctx = context();
  test("タイトルだけで BELIEVE.ogg が「Suguri - BELIEVE」に当たる", () => {
    const it = { key: "BELIEVE.ogg", title: "BELIEVE.ogg" };
    assert.equal(ctx.__match({ t: "Suguri - BELIEVE", al: "", ar: "" }, library(ctx, [it])), it);
  });
  test("メモ単独（Suguri）でも、タイトルが別でも当たる", () => {
    const it = { key: "unrelated.ogg", title: "unrelated.ogg", hint: "Suguri" };
    assert.equal(ctx.__match({ t: "Suguri - BELIEVE", al: "", ar: "" }, library(ctx, [it])), it);
  });
  test("メモ＋タイトルの組み合わせ（Hime - Comet）", () => {
    const it = { key: "Comet.ogg", title: "Comet.ogg", hint: "Hime" };
    assert.equal(ctx.__match({ t: "Hime - Comet", al: "", ar: "" }, library(ctx, [it])), it);
  });
  test("無関係なメモ・タイトルは当たらない", () => {
    const it = { key: "unrelated.ogg", title: "unrelated.ogg", hint: "other hint" };
    assert.equal(ctx.__match({ t: "Suguri - BELIEVE", al: "", ar: "" }, library(ctx, [it])), null);
  });
});

describe("同名の曲が複数あるとき（plWishMatch）", () => {
  test("候補が1つならそれを返す", () => {
    const ctx = context();
    const it = { key: "a", title: "Comet.ogg" };
    assert.equal(ctx.__match({ t: "Comet", al: "", ar: "" }, library(ctx, [it])), it);
  });
  test("候補が複数ならアルバム名で当たりを付ける", () => {
    const ctx = context({ a: { album: "Live" }, b: { album: "Studio" } });
    const live = { key: "a", title: "Song.ogg" }, studio = { key: "b", title: "Song.ogg" };
    assert.equal(ctx.__match({ t: "Song", al: "Studio", ar: "" }, library(ctx, [live, studio])), studio);
  });
  test("アルバムが合わなければアーティストで当たりを付ける", () => {
    const ctx = context({ a: { artist: "X" }, b: { artist: "Y" } });
    const x = { key: "a", title: "Song.ogg" }, y = { key: "b", title: "Song.ogg" };
    assert.equal(ctx.__match({ t: "Song", al: "", ar: "Y" }, library(ctx, [x, y])), y);
  });
});

describe("クラシックの配布名と作品・楽章の保護", () => {
  const ctx = context();
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/catalog.js"), "utf8") +
    '\nglobalThis.__beethoven = TRK_CATALOG.find(s => s.id === "classical").playlists.find(p => p.id === "classic-beethoven").songs[0];', ctx);
  const wish = ctx.__beethoven;
  const supplied = "Symphony no. 5 in Cm, Op. 67 - I. Allegro con brio";

  for (const title of [
    supplied,
    supplied + ".mp3",
    "01_" + supplied + ".flac",
    "Symphony No.5 in C minor, Op.67 — I. Allegro con brio.ogg",
    "01_Symphony_no.5_in_Cm_Op.67_-_I._Allegro_con_brio.mp3",
    "Symphony no. 5 -  I. Allegro con brio"
  ]) test(`改名・メモなしで照合: ${title}`, () => {
    const file = { key: "local", title };
    const before = JSON.stringify({ wish, file });
    assert.equal(ctx.__match(wish, library(ctx, [file])), file);
    assert.equal(JSON.stringify({ wish, file }), before, "元の曲名・ファイル情報・カタログは書き換えない");
  });

  for (const title of [
    supplied.replace("no. 5", "no. 6"),
    supplied.replace("Op. 67", "Op. 68"),
    supplied.replace("in Cm", "in C major"),
    supplied.replace("in Cm", "in Dm"),
    supplied.replace("I. Allegro", "II. Allegro"),
    supplied.replace("con brio", "con fuoco"),
    supplied + " (arrangement)",
    "I. Allegro con brio.mp3",
    "Symphony No.5.mp3",
    "Symphony no. 5 in Cm, Op. 67.mp3"
  ]) test(`別曲・楽章・不十分な名前は照合しない: ${title}`, () => {
    assert.equal(ctx.__match(wish, library(ctx, [{ key: "wrong", title }])), null);
  });

  test("調・作品番号を捨てる汎用ルールではない（登録した別名だけで結ぶ）", () => {
    assert.equal(ctx.__match({ t: wish.t }, library(ctx, [{ key: "x", title: supplied }])), null);
  });

  test("作品番号で終わるタイトルの数字を拡張子として落とさない", () => {
    const file = { key: "x", title: "Symphony No.5 Op.68" };
    assert.equal(ctx.__match({ t: "Symphony No.5 Op.67" }, library(ctx, [file])), null);
    assert.ok(ctx.__keys("Symphony No.5 Op.67").every(k => k.includes("67")));
  });

  test("既存の完全名を優先し、先にある不十分な作品名を拾わない", () => {
    const short = { key: "short", title: "Symphony No.5" };
    const alias = { key: "alias", title: supplied };
    const exact = { key: "exact", title: wish.t };
    assert.equal(ctx.__match(wish, library(ctx, [short, alias])), alias);
    assert.equal(ctx.__match(wish, library(ctx, [short, alias, exact])), exact);
  });

  test("実カタログのClassic全体で、提示名は対象の1項目だけに当たる", () => {
    const wishes = vm.runInContext('TRK_CATALOG.find(s => s.id === "classical").playlists.flatMap(p => p.songs)', ctx);
    const file = { key: "local", title: supplied + ".mp3" };
    const byTitle = library(ctx, [file]);
    const hits = wishes.filter(w => ctx.__match(w, byTitle));
    assert.equal(hits.length, 1);
    assert.equal(hits[0], wish);
  });

  test("月光の楽章も、速度記号だけでは当てない", () => {
    assert.equal(ctx.__match({ t: "Moonlight Sonata - I. Adagio sostenuto" },
      library(ctx, [{ key: "x", title: "I. Adagio sostenuto.mp3" }])), null);
  });
});

describe("ブルアカの装飾付きファイル名（カタログ限定・一意な救済）", () => {
  const ctx = context();
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/catalog.js"), "utf8") +
    '\nglobalThis.__ba = TRK_CATALOG.find(s => s.id === "bluearchive").playlists.filter(p => /^ba-v[1-8]$/.test(p.id)).flatMap(p => p.songs);', ctx);
  const daily = ctx.__ba.find(w => w.t === "Daily Routine 247");
  const constant = ctx.__ba.find(w => w.t === "Constant Moderato");
  const piano = ctx.__ba.find(w => w.t === "Constant Moderato Piano Arrange");

  for (const [wish, title] of [
    [daily, "Daily Routine 247.m4a"],
    [daily, "Daily Routine 24/7.m4a"],
    [constant, "【高音質】Constant Moderato.m4a"],
    [constant, "[HQ] Constant Moderato.m4a"],
    [daily, "🎧Theme 22 - Daily Routine 247 by Nor"],
    [daily, "🎧Theme 22 - Daily Routine 247 by Nor.m4a"],
    [daily, "🎧Theme 22 - Daily Routine 24/7 by Nor.m4a"],
    [daily, "【高音質】🎧 Theme 22 — Daily Routine 247 by Nor.m4a"],
    [daily, "【高音質】Daily Routine 24/7.m4a"],
    [daily, "[High Quality] Theme 22 - Daily Routine 247.m4a"],
    [piano, "【高音質】Constant Moderato Piano Arrange.m4a"]
  ]) test(`対応できる装飾: ${title}`, () => {
    const file = { key: "local", title };
    const before = JSON.stringify({ wish, file });
    const byTitle = library(ctx, [file]);
    assert.equal(ctx.__match(wish, byTitle), file);
    assert.equal(JSON.stringify({ wish, file }), before, "曲名・ファイル・カタログを変更しない");
    const hits = ctx.__ba.filter(w => ctx.__match(w, byTitle));
    assert.equal(hits.length, 1, "実カタログ225曲のうち対象だけに当たる");
    assert.equal(hits[0], wish);
  });

  for (const title of [
    "【高音質】Constant Moderato.m4a",
    "🎧Theme 22 - Daily Routine 248 by Nor.m4a",
    "🎧Theme 22 - Daily Routine 247 by KARUT.m4a",
    "🎧Theme 22 - Daily Routine 247 by Nor (Cover).m4a",
    "【高音質】Daily Routine 247 (Short).m4a",
    "【高音質】Daily Routine 247 Instrumental Ver..m4a",
    "【Remix】Daily Routine 247.m4a",
    "[Unknown] Daily Routine 247.m4a",
    "🎧Theme 22 - by Nor.m4a",
    "🎧Theme 22.m4a"
  ]) test(`別曲・数字・作者違い・未知の版は認識しない: ${title}`, () => {
    assert.equal(ctx.__match(daily, library(ctx, [{ key: "wrong", title }])), null);
  });

  test("Piano Arrangeを原曲の所持として数えない", () => {
    const file = { key: "piano", title: "【高音質】Constant Moderato Piano Arrange.m4a" };
    assert.equal(ctx.__match(constant, library(ctx, [file])), null);
  });

  test("装飾を外すと2候補なら、順番を変えても決め打ちしない", () => {
    const a = { key: "a", title: "【高音質】Daily Routine 247.m4a" };
    const b = { key: "b", title: "🎧Theme 22 - Daily Routine 247 by Nor.m4a" };
    for (const files of [[a, b], [b, a]]) assert.equal(ctx.__match(daily, library(ctx, files)), null);
  });

  test("候補が多くても元の曲名で一致するものがあればそちらを優先", () => {
    const decorated = { key: "deco", title: "【高音質】Daily Routine 247.m4a" };
    const exact = { key: "exact", title: "Daily Routine 247.m4a" };
    assert.equal(ctx.__match(daily, library(ctx, [decorated, exact])), exact);
  });

  test("未対応の装飾は照合メモで補える（表示名の変更は不要）", () => {
    const file = { key: "local", title: "[Unknown] Daily Routine 247.m4a", hint: "Daily Routine 247" };
    assert.equal(ctx.__match(daily, library(ctx, [file])), file);
  });
});

describe("言語・長さ・Instrumentalを別の版として維持（利用者提示名による仮想wish）", () => {
  const ctx = context();
  const base = "Do you wanna kiss by angel";
  const versions = ["JP Ver.", "JP Ver. (Short)", "CN Ver.", "CN Ver. (Short)", "Instrumental Ver."];
  // この曲を公式カタログに追加したテストではない。作者名も推測しない。
  for (const version of versions) test(`${version} は同じ版だけに一致する`, () => {
    const wish = { t: `${base} - ${version}`, al: "", ar: "" };
    for (const localVersion of versions) {
      for (const prefix of ["", "【高音質】"]) {
        const file = { key: localVersion, title: `${prefix}${base} - ${localVersion}.m4a` };
        assert.equal(ctx.__match(wish, library(ctx, [file])), localVersion === version ? file : null);
      }
    }
    for (const title of [base, version]) {
      assert.equal(ctx.__match(wish, library(ctx, [{ key: "incomplete", title: title + ".m4a" }])), null);
    }
  });

  test("版名のないカタログを、言語・Short・Instrumental付きの音源で埋めない", () => {
    for (const version of versions) {
      const file = { key: version, title: `【高音質】${base} - ${version}.m4a` };
      assert.equal(ctx.__match({ t: base }, library(ctx, [file])), null);
    }
  });

  test("by angelは曲名の一部として保持し、by以下を一律に削らない", () => {
    const file = { key: "local", title: `【高音質】${base}.m4a` };
    assert.equal(ctx.__match({ t: base }, library(ctx, [file])), file);
    assert.equal(ctx.__match({ t: "Do you wanna kiss" }, library(ctx, [file])), null);
    const short = { key: "short", title: "【高音質】Do you wanna kiss.m4a" };
    assert.equal(ctx.__match({ t: base }, library(ctx, [short])), null);
  });
});
