// SPDX-License-Identifier: GPL-3.0-or-later
/* trk218: trk が追加したリストは、曲画面の「プレイリストに入れる」に初期状態では出さない
 * （並ぶと圧迫するため）。⚙ → 🐔 trk's playlist の 👁／🗑 で出し入れし、📋 で
 * 編集できるコピー（通常のプレイリスト）を作れる。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");

function slice(start, end) {
  const a = library.indexOf(start);
  const b = library.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `slice ${start}`);
  return library.slice(a, b);
}

function sandbox(settings) {
  const calls = { saves: 0, toasts: [] };
  const context = vm.createContext({
    console, settings,
    core: { settings, saveUserPrefs: () => { calls.saves++; } },
    PL_COLORS: { none: "none" },
    plGuideSanitize: g => g,
    plToast: msg => calls.toasts.push(msg),
    tr: key => ({ trkCopySuffix: "（コピー）", trkFixedNotice: "固定の案内" })[key] ?? key
  });
  vm.runInContext([
    `const TRK_LIST_MAX = 200;`,
    slice("const TRK_AUTO_ID", "\nfunction trkMarkRemoved("),
    slice("function plIsTrkManaged(", "\n/* 🐔 trk218：trk が作った"),
    slice("function trkIsFixedList(", "\nfunction renderTrkSettings()"),
    slice("function plSanitize(", "\nconst TRK_PLAYLIST_ID"),
    `globalThis.__api = { trkIsFixedList, trkListShown, trkListSetShown, trkCopyAsUser, trkFixedNoticeOnce };`
  ].join("\n"), context);
  return { api: context.__api, calls, settings };
}
const fresh = () => ({ playlists: [], plFolders: [], trkListed: [], trkRemoved: [], trkFixedNotice: 0 });
const trkPl = (id = "trk-lol-svi", extra = {}) => Object.assign({
  id, name: "Sessions: Vi", icon: "🥊", color: "none", folder: "trk-lol",
  songs: ["k1", "k2"], wish: [{ t: "w1" }], guide: { url: "https://example.com", note: "note" },
  tags: ["Game"], cat: "trk:lol:lol-svi", createdAt: 1
}, extra);

describe("trk218 trk のリストは曲画面の一覧に初期は出さない", () => {
  test("trk が作ったリスト（trk-…）だけが対象。利用者のリストはいつも出す", () => {
    const { api } = sandbox(fresh());
    assert.equal(api.trkIsFixedList(trkPl()), true);
    assert.equal(api.trkIsFixedList({ id: "plabc123", folder: "trk-lol" }), false, "🐔 の中の利用者リストは対象外");
    assert.equal(api.trkIsFixedList(null), false);
    assert.equal(api.trkListShown(trkPl()), false, "初期は出さない");
    assert.equal(api.trkListShown({ id: "plabc123", folder: "" }), true);
  });

  test("👁 で出し、🗑 で隠す。リストそのものは消えない", () => {
    const settings = fresh();
    settings.playlists.push(trkPl());
    const { api, calls } = sandbox(settings);
    api.trkListSetShown(settings.playlists[0], true);
    assert.deepEqual([...settings.trkListed], ["trk-lol-svi"]);
    assert.equal(api.trkListShown(settings.playlists[0]), true);
    assert.equal(calls.saves, 1, "保存する");
    assert.equal(settings.playlists.length, 1, "リストは消えない");
    api.trkListSetShown(settings.playlists[0], false);
    assert.deepEqual([...settings.trkListed], []);
    assert.equal(api.trkListShown(settings.playlists[0]), false);
  });

  test("👁 の記録は trk-… の ID だけ・重複なし・200件まで（設定Importの検証と同じ）", () => {
    const settings = fresh();
    settings.trkListed = ["trk-a", "trk-a", "pl-user", "bad id!"];
    const src = coreSrc.slice(coreSrc.indexOf("function cleanTrkRemoved("), coreSrc.indexOf("\n}", coreSrc.indexOf("function cleanTrkRemoved(")) + 2);
    const ctx = vm.createContext({});
    vm.runInContext(src + "\nglobalThis.__clean = cleanTrkRemoved;", ctx);
    assert.deepEqual([...ctx.__clean(settings.trkListed)], ["trk-a"], "pl-… と不正なIDは落ちる");
    assert.ok(ctx.__clean(Array.from({ length: 250 }, (_, i) => "trk-x" + i)).length === 200);
  });
});

describe("trk218 編集できるコピー（📋）", () => {
  test("通常のプレイリストとして作られ、中身とガイドを引き継ぐ", () => {
    const settings = fresh();
    const original = trkPl();
    settings.playlists.push(original);
    const { api, calls } = sandbox(settings);
    const copy = api.trkCopyAsUser(original);
    assert.ok(copy, "作れる");
    assert.match(copy.id, /^pl[a-z0-9]+$/, "trk- で始まらない＝利用者のリスト");
    assert.equal(copy.name, "Sessions: Vi（コピー）");
    assert.equal(copy.folder, "trk-lol", "元と同じ棚に置く");
    assert.equal(copy.cat, "", "カタログの自動更新と切り離す");
    assert.deepEqual([...copy.songs], ["k1", "k2"]);
    assert.deepEqual([...copy.wish].map(w => w.t), ["w1"], "欲しい曲も引き継ぐ（形は plSanitize が整える）");
    assert.equal(copy.guide.url, "https://example.com");
    assert.deepEqual([...copy.tags], ["Game"]);
    assert.equal(copy.frozen, false);
    assert.equal(copy.locked, false);
    assert.equal(api.trkIsFixedList(copy), false, "編集できる（固定ではない）");
    assert.equal(api.trkListShown(copy), true, "曲画面の一覧に出る");
    assert.equal(settings.playlists.length, 2, "元のリストは残る");
    assert.equal(calls.saves, 1);
  });

  test("名前は24文字に収め、コピーだと分かる接尾辞を残す", () => {
    const settings = fresh();
    const long = trkPl("trk-ef-firstorder", { name: "初号指令 (上) ZD OST Vol.1" });
    settings.playlists.push(long);
    const { api } = sandbox(settings);
    const copy = api.trkCopyAsUser(long);
    assert.ok(copy.name.length <= 24, `24文字以内（${copy.name.length}）`);
    assert.ok(copy.name.endsWith("（コピー）"));
    assert.ok(copy.name.startsWith("初号指令"));
  });

  test("上限（200本）に達していたら作らない", () => {
    const settings = fresh();
    settings.playlists = Array.from({ length: 200 }, (_, i) => ({ id: "plmax" + i, songs: [] }));
    const { api, calls } = sandbox(settings);
    assert.equal(api.trkCopyAsUser(trkPl()), null);
    assert.equal(settings.playlists.length, 200);
    assert.equal(calls.saves, 0);
  });
});

describe("trk218 固定の案内（一度だけ）", () => {
  test("trk のリストがある人にだけ、1回だけ出す", () => {
    const empty = sandbox(fresh());
    assert.equal(empty.api.trkFixedNoticeOnce(), false, "リストが無ければ出さない");
    assert.equal(empty.settings.trkFixedNotice, 0);

    const settings = fresh();
    settings.playlists.push(trkPl());
    const { api, calls } = sandbox(settings);
    assert.equal(api.trkFixedNoticeOnce(), true);
    assert.equal(settings.trkFixedNotice, 1);
    assert.deepEqual([...calls.toasts], ["固定の案内"]);
    assert.equal(api.trkFixedNoticeOnce(), false, "2回目は出さない");
    assert.equal(calls.toasts.length, 1);
  });
});

describe("trk218 配線", () => {
  test("曲画面の「プレイリストに入れる」は trkListShown で絞り、隠した件数を案内する", () => {
    const start = library.indexOf("function songProfile(it) {");
    const block = library.slice(start, library.indexOf("\nfunction playedSave(", start));
    assert.ok(block.includes("const shownLists = core.settings.playlists.filter(trkListShown);"));
    assert.ok(block.includes("const shownLists = core.settings.playlists.filter(trkListShown);"));
    assert.ok(block.includes("for (const p of shownLists)"), "見えるものだけ並べる");
    assert.ok(block.includes('tr("plInListsHidden", { n: hiddenLists })'), "隠した件数と戻し方を案内する");
  });

  test("⚙ の一覧（画像1）に 👁／🗑 と 📋 があり、押すと切り替え・コピーになる", () => {
    const block = slice("function renderTrkSettings(", "/* 🐔 trk217：カタログから");
    assert.ok(block.includes('trkListSetShown(p, !listed)'), "👁／🗑 の切り替え");
    assert.ok(block.includes("trkCopyAsUser(p)"), "📋 のコピー");
    assert.ok(block.includes('tr("trkListHide")') && block.includes('tr("trkListShow")'));
    assert.ok(block.includes('tr("trkListNote")'), "🗑 は隠すだけ・📋 はコピーの説明");
    assert.ok(block.includes("aria-pressed"), "押下状態を読み上げに出す");
    assert.ok(block.includes("if (trkIsFixedList(p)) row.append(eye, copyBtn);"),
      "👁／📋 は trk のリストだけ（📋 のコピーは利用者のリストなので出さない）");
  });

  test("起動時に案内を1回だけ出す", () => {
    const startup = library.slice(library.indexOf("try{ setupGhostPanel(); syncGhostUI(); }"),
      library.indexOf("void initAgentOstTracks();"));
    assert.ok(startup.includes("trkFixedNoticeOnce()"), "起動時に呼ぶ");
  });

  test("設定の保存・読込・初期化に trkListed と trkFixedNotice がある", () => {
    assert.ok(coreSrc.includes("trkListed: cleanTrkRemoved(prefs.trkListed)"));
    assert.ok(coreSrc.includes("trkFixedNotice: prefs.trkFixedNotice === 1 ? 1 : 0"));
    assert.ok(coreSrc.includes('if (hasImported("trkListed") && Array.isArray(data.trkListed))'));
    assert.ok(coreSrc.includes("settings.trkListed = [];"));
    assert.ok(coreSrc.includes("settings.trkFixedNotice = 0;"));
  });

  test("削除したら 👁 の記録も消す", () => {
    const del = slice("function plDelete(", "function plCloseOpenTab(");
    assert.ok(del.includes("core.settings.trkListed.filter(id => id !== p.id)"));
  });

  test("文言は4言語そろっている", () => {
    const textBlocks = library.match(/^Object\.assign\(TEXT\.(?:ja|en|zh|ko), \{[\s\S]*?^\}\);$/gm).join("\n");
    for (const key of ["trkListShow", "trkListHide", "trkListShown", "trkListHidden", "trkListNote",
      "trkCopyBtn", "trkCopyDone", "trkCopyFail", "trkCopySuffix", "plInListsHidden", "trkFixedNotice"]) {
      assert.equal((textBlocks.match(new RegExp(`\\b${key}:`, "g")) || []).length, 4, `${key} は4言語`);
    }
  });

  test("Service Worker の cache を上げている", () => {
    const sw = fs.readFileSync(`${ROOT}/sw.js`, "utf8");
    /* 後の版で番号が進むので「trk218 以降」で見る（名前そのものは後の版が持つ） */
    const m = sw.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
    assert.ok(m, "版数つきの名前");
    assert.ok(Number(m[2]) >= 218, `trk218 以降の番号で割る（今は ${m[2]}）`);
  });
});
