// SPDX-License-Identifier: GPL-3.0-or-later
/* trk217: trk's playlist は「起動時に一括で作る」のをやめ、設定のカタログから選んだリストだけを作る
 * （trk-apk の新基準）。このテストは js/library.js の trkPick* と、起動・チェックボックスの配線を
 * vm の砂場で確かめる。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const catalogSrc = fs.readFileSync(`${ROOT}/js/catalog.js`, "utf8");

function slice(start, end) {
  const a = library.indexOf(start);
  const b = library.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `slice ${start}`);
  return library.slice(a, b);
}

const catalogContext = vm.createContext({});
vm.runInContext(`${catalogSrc}\nglobalThis.__catalog = TRK_CATALOG;`, catalogContext);
const catalog = catalogContext.__catalog;

/* 実物の plSanitize／棚づくり／ピッカーを、外側の重い関数だけ差し替えて読み込む */
function sandbox({ settings, series = catalog, room = () => true, made = true } = {}) {
  const calls = { saves: 0, rooms: [], unmark: [], ost: 0, game: 0, classic: 0, agent: 0, toasts: [] };
  const context = vm.createContext({
    console, settings,
    core: { settings, saveUserPrefs: () => { calls.saves++; } },
    tr: (key, vars) => {
      let s = ({ trkPickOriginals: "trk オリジナル", trkPickAdded: "追加済み" })[key] ?? key;
      for (const [k, v] of Object.entries(vars || {})) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    PL_COLORS: { none: "none" },
    plGuideSanitize: g => g,
    plFolderRoom: n => { calls.rooms.push(n); return room(n); },
    trkCatalog: () => series,
    trkCatalogGuide: () => ({ key: "plGuideIntro" }),
    trkWishesFromCatalog: () => [{ t: "game" }],
    trkClassicWishesFromCatalog: () => [{ t: "classic" }],
    ensureTrkOstPlaylist: o => { calls.ost++; calls.toasts.push(o && o.toast); return made; },
    ensureTrkPlaylist: o => { calls.game++; calls.toasts.push(o && o.toast); return made; },
    ensureTrkClassicPlaylist: o => { calls.classic++; calls.toasts.push(o && o.toast); return made; },
    ensureAgentOstPlaylist: keys => { calls.agent++; return made; },
    trkUnmarkRemoved: id => {
      calls.unmark.push(id);
      if (Array.isArray(settings.trkRemoved)) settings.trkRemoved = settings.trkRemoved.filter(x => x !== id);
    },
    builtInSongs: [{ key: "builtin:trk-agent-ost:1" }, { key: "builtin:first-spark-tutorial-v1" }]
  });
  vm.runInContext([
    `const TRK_PLAYLIST_ID = "trk-playlist"; const TRK_FOLDER_ID = "trk";`,
    `const TRK_CLASSIC_ID = "trk-classic"; const TRK_OST_ID = "trk-ost-v1";`,
    `const TRK_LIST_MAX = 200; const TRK_TAB_ICON = "🐔"; const TRK_FOLDER_NAME = "trk's playlist";`,
    `const AGENT_OST_ID = "trk-agent-ost-v1"; const AGENT_OST_NAME = "trk Agent's OST Vol.1";`,
    `const AGENT_OST_KEY_PREFIX = "builtin:trk-agent-ost:";`,
    `const ENDFIELD_CHARACTER_FOLDER = "trk-endfield-character";`,
    `const ENDFIELD_CHARACTER_PL = new Set(["ef-blurring", "ef-ashen", "ef-floaty", "ef-makers"]);`,
    `var trkSelectedFoldersOnly = false;`,
    slice("function plSanitize(", "\nconst TRK_PLAYLIST_ID"),
    slice("function plFolderSanitize(", "\nfunction plFolderById"),
    slice("function ensureTrkSubfolder(", "\nfunction trkWishFromTrack("),
    slice("function ensureTrkFolder()", "\nfunction trkWishFromTrack("),
    slice("const TRK_SERIES_FOLDER", "\nfunction ensureTrkDistributionPlaylists"),
    slice("function trkWishFromTrack(", "\nfunction trkWishesFromCatalog"),
    slice("function trkPickEntries(", "\nfunction trkPickRender("),
    `globalThis.__api = { trkPickEntries, trkPickHas, trkPickAdd, trkShelfFor, TRK_LIST_MAX, get folders() { return settings.plFolders; } };`
  ].join("\n"), context);
  return { api: context.__api, calls, settings };
}
const fresh = () => ({ playlists: [], plFolders: [], trkRemoved: [], trkPlaylist: true, trkClassic: true });

describe("trk217 カタログから選んだリストだけを追加する", () => {
  test("候補は「trk オリジナル」4本＋カタログの全リスト。ID は24文字以内で重ならない", () => {
    const { api } = sandbox({ settings: fresh() });
    const entries = api.trkPickEntries();
    const specials = entries.filter(e => e.special);
    assert.deepEqual([...specials.map(e => e.id)], ["trk-ost-v1", "trk-playlist", "trk-classic", "trk-agent-ost-v1"]);
    const withSongs = catalog.reduce((n, s) => n + (s.playlists || []).filter(pl => (pl.songs || []).length).length, 0);
    assert.equal(entries.filter(e => e.playlist).length, withSongs);
    assert.ok(!entries.some(e => e.playlist && !(e.playlist.songs || []).length), "曲の無い項目は出さない");
    const ids = entries.map(e => e.id);
    assert.equal(new Set(ids).size, ids.length, "ID が重ならない");
    assert.ok(ids.every(id => id.length <= 24), "plSanitize の24文字に収まる");
    assert.ok(entries.every(e => e.group && e.name), "シリーズ名と表示名がある");
  });

  test("100曲を超えるリストは Vol.1／Vol.2 に分かれ、ID の接尾辞は削られない", () => {
    const series = [{ id: "demo", name: "Demo", icon: "🎵", playlists: [
      { id: "a-very-long-playlist-identifier-here", name: "Long", icon: "🎮", songs: Array.from({ length: 150 }, (_, i) => ({ t: `s${i}` })) }
    ] }];
    const { api } = sandbox({ settings: fresh(), series });
    const entries = api.trkPickEntries().filter(e => e.playlist);
    assert.equal(entries.length, 2);
    assert.deepEqual([...entries.map(e => e.volumes)], [2, 2]);
    assert.deepEqual([...entries.map(e => e.index)], [0, 1]);
    assert.ok(entries[0].id.endsWith("-v1") && entries[1].id.endsWith("-v2"));
    assert.ok(entries.every(e => e.id.length <= 24));
    assert.ok(/Vol\.1$/.test(entries[0].name) && /Vol\.2$/.test(entries[1].name));
  });

  test("追加済みの判定は ID でも cat（series:playlist／trk:series:playlist）でも一致する", () => {
    const settings = fresh();
    settings.playlists.push({ id: "trk-lol-svi", cat: "" });
    const { api } = sandbox({ settings });
    const entries = api.trkPickEntries();
    const lol = catalog.find(s => s.id === "lol");
    const one = entries.find(e => e.playlist && e.series.id === "lol" && e.playlist.id === "lol-svi");
    assert.ok(one && api.trkPickHas(one), "ID で一致");
    settings.playlists[0] = { id: "pl-user-import", cat: "lol:" + one.playlist.id };
    assert.ok(api.trkPickHas(one), "series:playlist の cat で一致");
    settings.playlists[0] = { id: "pl-user-import-2", cat: "trk:lol:" + one.playlist.id };
    assert.ok(api.trkPickHas(one), "trk:series:playlist の cat で一致");
    settings.playlists[0] = { id: "pl-user-import-3", cat: "lol:other" };
    assert.equal(api.trkPickHas(one), false);
  });

  test("カタログの1本を追加すると、そのリストと要る棚だけができる", () => {
    const settings = fresh();
    const { api, calls } = sandbox({ settings });
    const entry = api.trkPickEntries().find(e => e.playlist && e.series.id === "lol" && e.volumes === 1);
    settings.trkRemoved.push(entry.id);
    assert.equal(api.trkPickAdd(entry), true);
    assert.equal(settings.playlists.length, 1);
    const added = settings.playlists[0];
    assert.equal(added.id, entry.id);
    assert.equal(added.folder, "trk-lol", "シリーズの棚に入る");
    assert.equal(added.cat, `trk:lol:${entry.playlist.id}`);
    assert.equal(added.wish.length, entry.playlist.songs.length);
    assert.equal(added.songs.length, 0, "カタログは曲を同梱しない");
    assert.deepEqual([...calls.unmark], [entry.id], "消した印を外す");
    assert.ok(!settings.trkRemoved.includes(entry.id));
    const ids = settings.plFolders.map(f => f.id);
    assert.deepEqual([...ids].sort(), ["trk", "trk-lol"], "他のシリーズの棚はまとめて作らない");
    assert.equal(calls.saves > 0, true);
  });

  test("🎭 Endfield のキャラクターテーマは親の棚ごと作る", () => {
    const settings = fresh();
    const { api } = sandbox({ settings });
    const entry = api.trkPickEntries().find(e => e.playlist && e.playlist.id === "ef-ashen");
    assert.equal(api.trkPickAdd(entry), true);
    assert.deepEqual([...settings.plFolders.map(f => f.id)].sort(), ["trk", "trk-endfield", "trk-endfield-character"]);
    assert.equal(settings.playlists[0].folder, "trk-endfield-character");
  });

  test("上限（200本）や棚の数がいっぱいのときは作らない", () => {
    const settings = fresh();
    settings.playlists = Array.from({ length: 200 }, (_, i) => ({ id: `pl-max-${i}` }));
    const { api, calls } = sandbox({ settings });
    const entry = api.trkPickEntries().find(e => e.playlist);
    assert.equal(api.trkPickAdd(entry), false);
    assert.equal(settings.playlists.length, 200, "増えない");
    assert.deepEqual([...calls.unmark], [], "印も外さない");

    const settings2 = fresh();
    const noRoom = sandbox({ settings: settings2, room: () => false });
    const entry2 = noRoom.api.trkPickEntries().find(e => e.playlist && e.volumes === 1);
    assert.equal(noRoom.api.trkPickAdd(entry2), false);
    assert.equal(settings2.playlists.length, 0);
    assert.deepEqual([...settings2.plFolders], []);
  });

  test("trk オリジナル（Game Vol.1）は表示フラグを一時的に立て、失敗したら元に戻す", () => {
    const settings = fresh();
    settings.trkPlaylist = false;
    const { api, calls } = sandbox({ settings });
    const entry = api.trkPickEntries().find(e => e.special === "game");
    assert.equal(api.trkPickAdd(entry), true);
    assert.equal(calls.game, 1);
    assert.deepEqual([...calls.toasts], [false], "トーストは出さない");
    assert.equal(settings.trkPlaylist, true);

    const settings2 = fresh();
    settings2.trkPlaylist = false;
    const failed = sandbox({ settings: settings2, made: false });
    const entry2 = failed.api.trkPickEntries().find(e => e.special === "game");
    assert.equal(failed.api.trkPickAdd(entry2), false);
    assert.equal(settings2.trkPlaylist, false, "失敗したら元の表示設定へ");
    assert.equal(settings2.playlists.length, 0);
  });
});

describe("trk217 起動時は作らない（配線の確認）", () => {
  const startup = library.slice(library.indexOf("try{ setupGhostPanel(); syncGhostUI(); }"),
    library.indexOf("try { trkGuideBackfill(); }"));

  test("起動の一括作成は create:false。OST も「あるときだけ」更新する", () => {
    assert.ok(startup.includes("ensureTrkDistributionPlaylists({ create: false })"), "作成しない");
    assert.ok(!/ensureTrkDistributionPlaylists\(\)/.test(startup), "無条件の一括作成は残っていない");
    assert.ok(startup.includes("core.settings.playlists.some(p => p.id === TRK_OST_ID)"), "OST は既存のときだけ更新");
  });

  test("表示チェックは「表示だけ」。リストを作らない", () => {
    const chk = library.slice(library.indexOf('const trkChk = core.$("trkPlaylistChk");'),
      library.indexOf('const trkAbcChk = core.$("trkSortAbcChk");'));
    assert.ok(!chk.includes("ensureTrkPlaylist("), "🐔 のチェックで作らない");
    const klass = library.slice(library.indexOf('const trkClassicChk = core.$("trkClassicChk");'),
      library.indexOf('const trkClassicOpenBtn = core.$("trkClassicOpenBtn");'));
    assert.ok(!klass.includes("ensureTrkClassicPlaylist("), "🎻 のチェックで作らない");
  });

  test("♻ は出さない（戻すのはピッカーから）", () => {
    const sync = library.slice(library.indexOf('const restore = core.$("trkRestoreBtn");'),
      library.indexOf("try { renderTrkSettings(); }"));
    assert.ok(sync.includes("restore.hidden = true"));
  });

  test("ピッカーの HTML と4言語の文言がある", () => {
    const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
    for (const id of ["trkPickSelect", "trkPickAdd", "trkPickHint", "trkPickStatus"]) {
      assert.ok(html.includes(`id="${id}"`), id);
    }
    const textBlocks = library.match(/^Object\.assign\(TEXT\.(?:ja|en|zh|ko), \{[\s\S]*?^\}\);$/gm).join("\n");
    for (const key of ["trkPickHint", "trkPickLabel", "trkPickAdd", "trkPickAdded", "trkPickOk", "trkPickFail", "trkPickOriginals"]) {
      assert.equal((textBlocks.match(new RegExp(`${key}:`, "g")) || []).length, 4, `${key} は4言語`);
    }
    assert.equal((textBlocks.match(/チュートリアルを終えると自動で追加されます/g) || []).length, 0, "「自動で追加」の説明は残さない");
  });
});
