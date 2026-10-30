// SPDX-License-Identifier: GPL-3.0-or-later
/* trk114: deleting an automatic trk playlist leaves a marker so the next start does not recreate it,
 * moving trk's OST Vol.1 is respected after the one-time trk112 migration, and catalog guides carry a
 * dictionary key so the note follows the UI language. The library.js pieces run in a vm sandbox. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const catalogSrc = fs.readFileSync(`${ROOT}/js/catalog.js`, "utf8");
const between = (src, start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `slice ${start}`);
  return src.slice(a, b);
};
const textBlocks = library.match(/^Object\.assign\(TEXT\.(?:ja|en|zh|ko), \{[\s\S]*?^\}\);$/gm).join("\n");
const catalogContext = vm.createContext({});
vm.runInContext(catalogSrc + "\nglobalThis.__catalog = TRK_CATALOG;", catalogContext);
const catalog = catalogContext.__catalog;
const lol = catalog.find(series => series.id === "lol");
const valorant = catalog.find(series => series.id === "valorant");
const riotGames = catalog.find(series => series.id === "riot-games");

function sandbox(settings, { lang = "ja", series = [lol] } = {}) {
  const calls = { saves: 0, ensureGame: 0, ensureClassic: 0 };
  const context = vm.createContext({
    TEXT: { ja: {}, en: {}, zh: {}, ko: {} }, lang, console, calls, window: {},
    core: { settings, saveUserPrefs: () => { calls.saves++; } },
    tr: (key, vars) => {
      let s = context.TEXT[context.lang][key] ?? context.TEXT.en[key] ?? context.TEXT.ja[key] ?? key;
      for (const [k, v] of Object.entries(vars || {})) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    plToast: () => {}, renderLib: () => {}, ensureTrkFolder: () => {}, plSanitize: raw => raw,
    trkCatalog: () => series, trkWishesForSeries: () => [],
    ensureTrkPlaylist: () => { calls.ensureGame++; return false; },
    ensureTrkClassicPlaylist: () => { calls.ensureClassic++; return false; },
    TRK_PLAYLIST_ID: "trk-playlist", TRK_CLASSIC_ID: "trk-classic", TRK_OST_ID: "trk-ost-v1", TRK_FOLDER_ID: "trk",
    FIRST_SPARK_KEY: "builtin:first-spark-tutorial-v1",
    plById: id => settings.playlists.find(p => p.id === id) || null
  });
  vm.runInContext([
    textBlocks,
    between(library, "function trkWishFromTrack(", "\nfunction trkWishesFromCatalog"),
    between(library, "function trkCatalogGuide(", "\n(function plTighten()"),
    between(library, "const TRK_OST_CAT", "/* 🌐 trk114 より前に作った"),
    between(library, "function trkGuideBackfill()", "function trkOrderedPlaylists("),
    between(library, "const TRK_AUTO_ID", "\n/* 📂 フォルダ内プレイリストのタブを閉じる"),
    between(library, "function plGuideText(", "/* プレイリスト1つの設定"),
    "globalThis.__api = { ensureTrkDistributionPlaylists, ensureTrkOstPlaylist, plDelete, trkRestoreRemoved, trkIsRemoved, trkUnmarkRemoved, trkCatalogGuide, plGuideSanitize, plGuideText, trkGuideBackfill };"
  ].join("\n"), context);
  return { api: context.__api, calls, context };
}
const fresh = () => ({ playlists: [], plFolders: [], libOpenTabs: [], libTab: "all", trkRemoved: [] });

describe("deleted automatic trk playlists stay deleted", () => {
  test("deleting a catalog playlist leaves a marker and the next start skips only that list", () => {
    const settings = fresh();
    const { api } = sandbox(settings);
    api.ensureTrkDistributionPlaylists();
    const total = settings.playlists.length;
    const season3 = settings.playlists.find(p => p.id === "trk-lol-season-3");
    assert.ok(season3 && total === lol.playlists.length);
    api.plDelete(season3);
    assert.deepEqual(settings.trkRemoved, ["trk-lol-season-3"]);
    api.ensureTrkDistributionPlaylists();
    assert.equal(settings.playlists.length, total - 1, "the deleted list is not recreated");
    assert.ok(!settings.playlists.some(p => p.id === "trk-lol-season-3"));
    const own = { id: "pl123abc", name: "mine", songs: [] };
    settings.playlists.push(own);
    api.plDelete(own);
    assert.deepEqual(settings.trkRemoved, ["trk-lol-season-3"], "the user's own playlists never get a marker");
  });

  test("restore clears every marker and recreates the lists", () => {
    const settings = fresh();
    const { api, calls } = sandbox(settings);
    api.ensureTrkDistributionPlaylists();
    api.plDelete(settings.playlists.find(p => p.id === "trk-lol-warsongs"));
    api.plDelete(settings.playlists.find(p => p.id === "trk-lol-season-9"));
    assert.equal(settings.trkRemoved.length, 2);
    const restored = api.trkRestoreRemoved();
    assert.equal(restored, 2);
    assert.equal(settings.trkRemoved.length, 0);
    assert.ok(settings.playlists.some(p => p.id === "trk-lol-warsongs") && settings.playlists.some(p => p.id === "trk-lol-season-9"));
    assert.ok(calls.ensureGame === 1 && calls.ensureClassic === 1, "Game Vol.1 and Classic Vol.1 are offered again too");
  });
});

describe("trk's OST Vol.1", () => {
  test("is created once in the trk folder and then left where the user moves it", () => {
    const settings = fresh();
    const { api } = sandbox(settings);
    assert.equal(api.ensureTrkOstPlaylist({ toast: false }), true);
    const ost = settings.playlists.find(p => p.id === "trk-ost-v1");
    assert.equal(ost.folder, "trk");
    assert.equal(ost.cat, "trk:ost");
    ost.folder = "my-folder";
    assert.equal(api.ensureTrkOstPlaylist({ toast: false }), false);
    assert.equal(ost.folder, "my-folder", "a moved OST is not pulled back");
    ost.folder = "";
    api.ensureTrkOstPlaylist({ toast: false });
    assert.equal(ost.folder, "", "not even when it was moved to the top level");
  });

  test("migrates the trk112 top-level copy once, and a deleted OST is not recreated", () => {
    const settings = fresh();
    settings.playlists.push({ id: "trk-ost-v1", name: "trk's OST Vol.1", folder: "", cat: "", songs: [] });
    const { api } = sandbox(settings);
    api.ensureTrkOstPlaylist({ toast: false });
    assert.equal(settings.playlists[0].folder, "trk");
    assert.equal(settings.playlists[0].cat, "trk:ost");
    api.plDelete(settings.playlists[0]);
    assert.deepEqual(settings.trkRemoved, ["trk-ost-v1"]);
    assert.equal(api.ensureTrkOstPlaylist({ toast: false }), false);
    assert.equal(settings.playlists.length, 0);
    api.trkRestoreRemoved();
    assert.ok(settings.playlists.some(p => p.id === "trk-ost-v1"));
  });
});

describe("catalog guides follow the UI language", () => {
  test("guides store a whitelisted key plus the Japanese note, and display in the current language", () => {
    const settings = fresh();
    const { api, context } = sandbox(settings, { lang: "en" });
    const season9 = lol.playlists.find(pl => pl.id === "lol-season-9");
    const guide = api.trkCatalogGuide(lol, season9, true);
    assert.equal(guide.key, "plGuideLolCsVerified");
    assert.equal(guide.note, context.TEXT.ja.plGuideLolCsVerified);
    assert.match(api.plGuideText(guide), /^Official SoundCloud album/);
    context.lang = "ko";
    assert.match(api.plGuideText(guide), /공식 SoundCloud/);
    assert.equal(api.plGuideText({ note: "保存した控え", url: "", key: "plGuideNoSuchKey" }), "保存した控え");
    assert.equal(api.plGuideSanitize({ note: "x", url: "javascript:alert(1)", key: "__proto__" }).key, undefined);
    assert.equal(api.plGuideSanitize({ note: "x", url: "javascript:alert(1)" }).url, "");
    assert.equal(api.plGuideSanitize({ note: "y".repeat(500), url: "" }).note.length, 160);
  });

  test("LoL wording matches each playlist's Creator-Safe status", () => {
    const { api, context } = sandbox(fresh());
    const keyOf = id => api.trkCatalogGuide(lol, lol.playlists.find(pl => pl.id === id), true).key;
    assert.equal(keyOf("lol-season-9"), "plGuideLolCsVerified");
    assert.equal(keyOf("lol-season-8"), "plGuideLolCsVerified");
    /* trk115：101曲目以降（songdata.io の一覧）で Season 1〜7 を全曲照合。Warsongs は11曲中10曲 */
    for (let n = 1; n <= 7; n++) assert.equal(keyOf("lol-season-" + n), "plGuideLolCsVerified", "Season " + n);
    assert.equal(keyOf("lol-warsongs"), "plGuideLolCsPartial");
    /* trk116：残りのリストも全件照合。Sessions は Vi・Taliyah が全曲、Diana が43曲中42曲。
       公式リンク集は Champion Theme 39/41・Worlds 1/13 が一部、MSI・K/DA は見当たらない */
    assert.equal(keyOf("lol-svi"), "plGuideLolCsVerified");
    assert.equal(keyOf("lol-staliyah"), "plGuideLolCsVerified");
    assert.equal(keyOf("lol-sdiana"), "plGuideLolCsPartial");
    assert.equal(keyOf("lol-champion-themes"), "plGuideRiotLinksPartial");
    assert.equal(keyOf("lol-worlds-anthems"), "plGuideRiotLinksPartial");
    assert.equal(keyOf("lol-msi-anthems"), "plGuideRiotLinksAbsent");
    assert.equal(keyOf("lol-kda-songs"), "plGuideRiotLinksAbsent");
    assert.equal(keyOf("lol-popular-tracks"), "plGuideLolPopular");
    assert.equal(api.trkCatalogGuide(lol, { id: "lol-mod-list", creatorSafe: "verified-by-mod?" }, true).key, "plGuideRiotLinks",
      "an unknown status never reads as Creator-Safe");
    assert.match(context.TEXT.ja.plGuideLolCsPartial, /一部の曲はCreator-Safe対象.*見当たらない・要確認/);
    assert.match(context.TEXT.ja.plGuideRiotLinksPartial, /^公式リンク集.*一部の曲はCreator-Safe対象.*見当たらない/);
    assert.match(context.TEXT.ja.plGuideRiotLinksAbsent, /^公式リンク集.*見当たらない.*Creator-Safe対象外・要確認/);
    for (const key of ["plGuideLolCsPartial", "plGuideRiotLinksPartial", "plGuideRiotLinksAbsent", "plGuideLolPopular"]) {
      assert.doesNotMatch(context.TEXT.ja[key], /可能性が高い/, key + " never claims the songs it did not find");
      for (const lang of ["en", "zh", "ko"]) assert.ok(context.TEXT[lang][key] && context.TEXT[lang][key] !== context.TEXT.ja[key], key + " " + lang);
    }
    for (const lang of ["ja", "en", "zh", "ko"]) {
      assert.equal(context.TEXT[lang].plGuideLolCsLikely, undefined, lang);
      assert.equal(context.TEXT[lang].plGuideLolSessions, undefined, lang);
    }
    for (const retired of ["likely", "sessions"])
      assert.equal(api.trkCatalogGuide(lol, { id: "lol-old", creatorSafe: retired }, true).key, "plGuideRiotLinks",
        "the retired '" + retired + "' status falls back to the links-only wording");
    assert.match(context.TEXT.ja.plGuideLolPopular, /一部だけCreator-Safe対象.*共同制作曲などは対象外・要確認/);
    /* trk117：VALORANT も同じ状態と文言。公式Creator-Safe Playlist（全40曲）に収録の9曲は見当たらない */
    for (const pl of valorant.playlists.filter(list => list.id !== "val-cs")) {
      assert.equal(pl.creatorSafe, "links-absent", pl.id);
      const guide = api.trkCatalogGuide(valorant, pl);
      assert.equal(guide.key, "plGuideRiotLinksAbsent", pl.id);
      assert.equal(guide.url, "https://www.riotgames.com/en/riot-music-creator-safe-guidelines", pl.id);
    }
    assert.equal(api.trkCatalogGuide(valorant, { id: "val-mod", creatorSafe: "verified-by-mod?" }).key, "plGuideRiotLinks",
      "an unknown VALORANT status never reads as Creator-Safe");
    assert.equal(api.trkCatalogGuide(valorant).key, "plGuideRiotLinks", "the series itself keeps the links-only wording");
    assert.doesNotMatch(context.TEXT.ja.plGuideRiotLinksAbsent, /LoL|League/, "the shared wording names no single game");
    /* trk118：Creator-Safe プレイリストの曲から作ったリストは「全曲が対象」の文言。LoL の4リストは自動作成、
       VALORANT Creator-Safe と LoL関連ゲーム（riot-games）は🛒公式カタログから取り込む */
    for (const id of ["lol-cs-pentakill", "lol-cs-themes", "lol-cs-esports", "lol-cs-ost-2025"]) {
      assert.equal(keyOf(id), "plGuideRiotLinksVerified", id);
      assert.equal(api.trkCatalogGuide(lol, lol.playlists.find(pl => pl.id === id), true).url, "https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N", id);
    }
    const valCs = valorant.playlists.find(pl => pl.id === "val-cs");
    assert.equal(api.trkCatalogGuide(valorant, valCs).key, "plGuideRiotLinksVerified");
    assert.equal(valCs.songs.length, 39);
    assert.ok(riotGames && riotGames.playlists.length === 7, "the Riot Games series holds seven lists");
    for (const pl of riotGames.playlists) {
      const guide = api.trkCatalogGuide(riotGames, pl);
      assert.equal(guide.key, "plGuideRiotLinksVerified", pl.id);
      assert.equal(guide.url, "https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N", pl.id);
      assert.ok(pl.songs.length <= 100 && pl.songs.every(track => /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}$/.test(track.u)), pl.id);
    }
    assert.match(context.TEXT.ja.plGuideRiotLinksVerified, /^公式リンク集.*全曲がCreator-Safe対象.*照合済み/);
    for (const lang of ["en", "zh", "ko"]) assert.ok(context.TEXT[lang].plGuideRiotLinksVerified !== context.TEXT.ja.plGuideRiotLinksVerified, lang);
    assert.ok(context.TEXT.ja.plGuideLolPopular.length <= 80, "the popular-tracks note stays short");
  });

  test("Game Vol.1 / Classic Vol.1 created before trk114 get a key without losing their URL", () => {
    const settings = fresh();
    settings.playlists.push({ id: "trk-playlist", guide: { note: "非営利の紹介プレイリスト。", url: "https://example.com/kept" } },
      { id: "trk-classic", guide: { note: "版権切れ", url: "https://musopen.org/" } },
      { id: "pl-user", guide: { note: "mine", url: "" } });
    const { api } = sandbox(settings);
    api.trkGuideBackfill();
    assert.equal(settings.playlists[0].guide.key, "plGuideGameVol1");
    assert.equal(settings.playlists[0].guide.url, "https://example.com/kept");
    assert.equal(settings.playlists[1].guide.key, "plGuideClassic");
    assert.equal(settings.playlists[2].guide.key, undefined);
  });
});

describe("settings: the deletion marker is validated", () => {
  const clean = new Function(`${between(coreSrc, "function cleanTrkRemoved(", "\nfunction guessLang")}\nreturn cleanTrkRemoved;`)();
  test("keeps only unique trk- IDs, newest 200", () => {
    assert.deepEqual(clean(["trk-lol-season-3", "pl-user", 42, "trk-lol-season-3", "trk-th-mcd_02", "__proto__"]), ["trk-lol-season-3", "trk-th-mcd_02"]);
    assert.deepEqual(clean("trk-ost-v1"), []);
    assert.equal(clean(Array.from({ length: 300 }, (_, i) => "trk-x" + i)).length, 200);
  });
  test("defaults, factory reset and settings import all go through the validator", () => {
    assert.match(coreSrc, /trkRemoved: cleanTrkRemoved\(prefs\.trkRemoved\)/);
    assert.match(coreSrc, /settings\.trkRemoved = \[\];/);
    assert.match(coreSrc, /settings\.trkRemoved = cleanTrkRemoved\(data\.trkRemoved\)/);
  });
});

describe("Classicの配布名を既存の棚にも補う", () => {
  const classical = catalog.find(s => s.id === "classical");
  const track = classical.playlists.find(p => p.id === "classic-beethoven").songs[0];
  const oldWish = () => ({ t: track.t, al: track.al, ar: track.ar, u: track.u });

  test("保存済みClassic Vol.1の別名だけを更新し、順序・所持曲・利用者設定を守る", () => {
    const settings = fresh();
    const editedWish = { ...oldWish(), t: "自分で変えた曲名" };
    const p = { id: "trk-classic", cat: "trk:classic", name: "お気に入り", icon: "🎵", tags: ["mine"],
      frozen: true, folder: "my-folder", songs: ["my-audio"], wish: [editedWish, oldWish()] };
    settings.playlists.push(p);
    const before = JSON.stringify(p);
    const { api, calls } = sandbox(settings, { series: [classical] });
    api.ensureTrkDistributionPlaylists();
    assert.deepEqual([...p.wish[1].matchAliases], [...track.matchAliases]);
    const updated = JSON.parse(JSON.stringify(p));
    delete updated.wish[1].matchAliases;
    assert.equal(JSON.stringify(updated), before);
    const saves = calls.saves;
    api.ensureTrkDistributionPlaylists();
    assert.equal(calls.saves, saves, "2回目は保存し直さない");
  });

  test("新規Classicのwishにも別名が入る", () => {
    const { context } = sandbox(fresh(), { series: [classical] });
    vm.runInContext(between(library, "function trkClassicWishesFromCatalog(", "/* チュートリアル完了時"), context);
    const wishes = vm.runInContext("trkClassicWishesFromCatalog()", context);
    assert.deepEqual([...wishes[0].matchAliases], [...track.matchAliases]);
  });

  test("保存済みwishの更新から照合・所持曲への追加までつながる", () => {
    const settings = fresh();
    const p = { id: "trk-classic", cat: "trk:classic", songs: ["already-owned"], wish: [oldWish()] };
    settings.playlists.push(p);
    const { api, context } = sandbox(settings, { series: [classical] });
    vm.runInContext(fs.readFileSync(`${ROOT}/js/title-match.js`, "utf8") + "\n" +
      between(library, "function plWishMatch(", "/* 🛒 「集める棚」"), context);
    context.metaOf = () => null;
    context.local = { key: "musopen-local", title: "Symphony no. 5 in Cm, Op. 67 - I. Allegro con brio.mp3" };
    context.p = p;
    vm.runInContext("globalThis.byTitle = new Map(plSongMatchKeys(local.title, '').map(k => [k, [local]]));", context);
    assert.equal(vm.runInContext("plSyncWishes(p, byTitle)", context), false, "更新前は一致しない");
    api.ensureTrkDistributionPlaylists();
    assert.equal(vm.runInContext("plSyncWishes(p, byTitle)", context), true);
    assert.deepEqual(p.songs, ["already-owned", "musopen-local"]);
    assert.equal(vm.runInContext("plSyncWishes(p, byTitle)", context), false, "再描画しても重複追加しない");
  });

  test("個別に取り込んだBeethovenリストにも届き、自分のリストは触らない", () => {
    const settings = fresh();
    const imported = { id: "my-import", cat: "classical:classic-beethoven", name: "my name", songs: ["own"], wish: [oldWish()] };
    const own = { id: "own", cat: "", wish: [oldWish()] };
    settings.playlists.push(imported, own);
    const { api } = sandbox(settings, { series: [classical] });
    api.ensureTrkDistributionPlaylists();
    assert.deepEqual([...imported.wish[0].matchAliases], [...track.matchAliases]);
    assert.equal(imported.name, "my name");
    assert.deepEqual(imported.songs, ["own"]);
    assert.ok(!own.wish[0].matchAliases);
  });
});

test("unified 🪽聖園ミカ playlist is created under Blue Archive with pink color, 14 ordered wishes, 4-language guide, and deletion respect", () => {
  const ba = catalog.find(s => s.id === "bluearchive"), settings = fresh();
  const { api, context } = sandbox(settings, { series: [ba] });
  api.ensureTrkDistributionPlaylists();
  const p = settings.playlists.find(p => p.id === "trk-ba-mika");
  assert.equal(p.name, "聖園ミカ");
  assert.equal(p.icon, "🪽");
  assert.equal(p.color, "pink");
  assert.equal(p.folder, "trk-ba");
  assert.equal(p.wish.length, 14);
  assert.deepEqual([...p.wish.map(w => w.matchMedia)], ["audio", "audio", "video", "video", "audio", "audio", "audio", "audio", "audio", "video", "audio", "audio", "audio", "video"]);
  assert.equal(p.guide.key, "plGuideBlueArchiveMika");
  assert.equal(p.guide.url, "https://bluearchive.jp/");
  assert.ok(p.guide.note.length <= 160);
  for (const lang of ["ja", "en", "zh", "ko"]) {
    context.lang = lang;
    assert.equal(api.plGuideText(p.guide), context.TEXT[lang].plGuideBlueArchiveMika);
    assert.match(api.plGuideText(p.guide), /Short/);
    assert.match(api.plGuideText(p.guide), /Princess/);
  }
  p.name = "my Mika"; p.songs.push("owned"); p.frozen = true;
  delete p.wish[2].matchMedia;
  api.ensureTrkDistributionPlaylists();
  assert.equal(p.wish[2].matchMedia, "video");
  assert.equal(p.name, "my Mika");
  assert.equal(p.frozen, true);
  assert.deepEqual([...p.songs], ["owned"]);
  api.plDelete(p);
  api.ensureTrkDistributionPlaylists();
  assert.ok(!settings.playlists.some(p => p.id === "trk-ba-mika"));
});

test("legacy three Mika playlists (trk157–158) consolidate into a single trk-ba-mika while preserving owned songs, open tab, and user edits", () => {
  const ba = catalog.find(s => s.id === "bluearchive"), settings = fresh();
  settings.playlists.push(
    { id: "trk-ba-mika-kiss", name: "ミカ — kiss angel", icon: "🪽", color: "pink", folder: "trk-ba",
      tags: ["Blue Archive", "Mika", "CN", "PV", "Vocal"], wish: [], songs: ["kiss-cn", "shared"], cat: "trk:bluearchive:ba-mika-kiss" },
    { id: "trk-ba-mika-aria", name: "ミカ — Aria to the Star", icon: "🪽", color: "pink", folder: "trk-ba",
      tags: ["Blue Archive", "Mika", "KR", "Musical", "PV"], wish: [], songs: ["aria-1", "shared"], frozen: true, cat: "trk:bluearchive:ba-mika-aria" },
    { id: "trk-ba-mika-vocals", name: "ミカ — ソロ＆参加曲", icon: "🪽", color: "pink", folder: "trk-ba",
      tags: ["Blue Archive", "Mika", "JP", "Vocal", "PV"], wish: [], songs: ["jp-1"], cat: "trk:bluearchive:ba-mika-vocals" }
  );
  settings.libTab = "pl:trk-ba-mika-aria";
  settings.libOpenTabs = ["trk-ba-mika-kiss", "trk-ba-mika-aria"];
  settings.playlistOrder = ["trk-ba-v1", "trk-ba-mika-kiss", "trk-ba-mika-aria", "trk-ba-mika-vocals"];
  const { api } = sandbox(settings, { series: [ba] });
  api.ensureTrkDistributionPlaylists();
  const mikaLists = settings.playlists.filter(p => p.id.startsWith("trk-ba-mika"));
  assert.equal(mikaLists.length, 1);
  const p = mikaLists[0];
  assert.equal(p.id, "trk-ba-mika");
  assert.equal(p.name, "聖園ミカ");
  assert.equal(p.icon, "🪽");
  assert.equal(p.color, "pink");
  assert.equal(p.frozen, true);
  assert.equal(p.wish.length, 14);
  assert.deepEqual([...p.songs], ["kiss-cn", "shared", "aria-1", "jp-1"]);
  assert.equal(settings.libTab, "pl:trk-ba-mika");
  assert.deepEqual([...settings.libOpenTabs], ["trk-ba-mika"]);
  assert.deepEqual([...settings.playlistOrder], ["trk-ba-v1", "trk-ba-mika"]);
});
