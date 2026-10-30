// SPDX-License-Identifier: GPL-3.0-or-later
/* Validate the pinned TouhouThemeDB title index, release coverage, and non-canon split. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const themeDataSrc = fs.readFileSync(path.join(ROOT, "js/touhou-theme-data.js"), "utf8");
const catalogSrc = fs.readFileSync(path.join(ROOT, "js/catalog.js"), "utf8");
const librarySrc = fs.readFileSync(path.join(ROOT, "js/library.js"), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(themeDataSrc, context, { filename: "js/touhou-theme-data.js" });
vm.runInContext(catalogSrc, context, { filename: "js/catalog.js" });
const data = context.window.Trk.touhouThemeData;
const catalog = vm.runInContext("TRK_CATALOG", context);
const main = catalog.find(series => series.id === "touhou");
const adjacent = catalog.find(series => series.id === "zun-other");
const tracks = series => (series?.playlists || []).flatMap(playlist => playlist.songs || []);
const idsOf = series => new Set(tracks(series).flatMap(track => track.matchAliases || []));
const releaseOf = id => id.slice(0, id.lastIndexOf("_"));

describe("TouhouThemeDB snapshot and complete release-ID coverage", () => {
  test("records upstream source, commit, and Unlicense instead of mislabeling the data as GPL", () => {
    assert.match(themeDataSrc, /^\/\/ SPDX-License-Identifier: Unlicense/m);
    assert.match(themeDataSrc, /TouhouThemeDB/);
    assert.equal(data.sourceCommit, "e70e6451cf2e44d75564c09aa7c5a9cc09982692");
    assert.ok(Object.isFrozen(data) && Object.isFrozen(data.titles) && Object.isFrozen(data.redirects));
  });

  test("all pinned title and redirect IDs resolve; sentinel IDs are excluded", () => {
    const ids = new Set([...Object.keys(data.titles), ...Object.keys(data.redirects)]);
    ids.delete("none");
    ids.delete("th_main");
    assert.equal(ids.size, 904);
    for (const id of ids) {
      let key = id;
      const seen = new Set();
      while (!data.titles[key] && data.redirects[key] && !seen.has(key)) {
        seen.add(key);
        key = data.redirects[key];
      }
      assert.ok(data.titles[key], `unresolved title ID: ${id}`);
    }
  });

  test("catalog covers every unique main and adjacent ID exactly once in its release playlist", () => {
    assert.ok(main && adjacent);
    const sourceIds = new Set([...Object.keys(data.titles), ...Object.keys(data.redirects)]);
    sourceIds.delete("none");
    sourceIds.delete("th_main");
    assert.deepEqual([...idsOf(main)].sort(), [...sourceIds].filter(id => !/^(?:sh01|sh02|tmgc|alcostg|touki|thmj)_/.test(id)).sort());
    assert.deepEqual([...idsOf(adjacent)].sort(), [...sourceIds].filter(id => /^(?:sh01|sh02|tmgc|alcostg|touki|thmj)_/.test(id)).sort());
    assert.equal(idsOf(main).size, 862);
    assert.equal(idsOf(adjacent).size, 42);
    assert.equal(new Set([...idsOf(main), ...idsOf(adjacent)]).size, 904);

    const gameReleaseLists = main.playlists.filter(playlist => !["th-pc98", "th-pc98-v2", "th-zun-cds", "th-zun-cds-v2"].includes(playlist.id));
    assert.equal(gameReleaseLists.length, 66);
    assert.equal(adjacent.playlists.length, 6);
    for (const playlist of [...gameReleaseLists, ...adjacent.playlists]) {
      assert.ok(playlist.songs.length > 0, `empty playlist: ${playlist.id}`);
      for (const track of playlist.songs) {
        assert.ok(track.t && track.matchAliases?.length === 1, `${playlist.id} has a missing title or stable ID alias`);
        assert.match(track.u, /^https:\/\//);
      }
    }
  });

  test("preserves existing playlist IDs and maps th06_01.mid to its Japanese catalog title", () => {
    const oldIds = [
      "th-koumakyou", "th-youyoumu", "th-eiyasyou", "th-fuujinroku", "th-chireiden",
      "th-seirensen", "th-shinreibyou", "th-kishinjou", "th-kanjuden", "th-tenkuushou",
      "th-kikeijuu", "th-kouryudou", "th-juuouen", "th-pc98", "th-zun-cds"
    ];
    for (const id of oldIds) assert.ok([...main.playlists, ...adjacent.playlists].some(playlist => playlist.id === id), `legacy ID changed: ${id}`);
    const koumakyou = main.playlists.find(playlist => playlist.id === "th-koumakyou");
    const song = koumakyou.songs.find(track => track.matchAliases.includes("th06_01"));
    assert.equal(song.t, "赤より紅い夢");
    assert.equal(song.al, "東方紅魔郷");
    assert.equal(song.ar, "ZUN");
    for (const id of ["th06_03", "th06_04", "th06_05", "th06_06", "th06_15"]) {
      const wish = main.playlists.flatMap(playlist => playlist.songs).find(track => track.matchAliases?.includes(id));
      assert.ok(wish, `playlist wish missing stable ID ${id}`);
      assert.equal(wish.t, data.titles[id], `playlist title does not match the pinned title data for ${id}`);
    }

    const ids = new Set([...main.playlists, ...adjacent.playlists].map(playlist => playlist.id));
    assert.equal(ids.size, main.playlists.length + adjacent.playlists.length, "playlist IDs stay unique");
  });

  test("shows Japanese catalogue titles for ID-named files such as th06_05.mid and th06_15.mid", () => {
    const start = librarySrc.indexOf("function touhouCatalogTitle(it) {");
    const end = librarySrc.indexOf("\n\n/* 保存されていたプレイリスト1つの検証", start);
    assert.ok(start >= 0 && end > start, "the filename-title helper can be isolated");
    const displayContext = vm.createContext({
      window: context.window,
      metaOf:key => key === "custom" ? { title:"My own title" } : null,
      songTagField: () => ""   /* 🏷 タグ無し相当（trk167 で表示名の鎖に入った。タグ優先順は tests/trk167-audio-tags.test.mjs が見る） */
    });
    vm.runInContext(librarySrc.slice(start, end) + "\nglobalThis.__songDisplayTitle = songDisplayTitle;", displayContext);
    const displayTitle = displayContext.__songDisplayTitle;
    for (const [id, title] of [
      ["th06_03", "妖魔夜行"], ["th06_04", "ルーネイトエルフ"], ["th06_05", "おてんば恋娘"],
      ["th06_15", "U.N.オーエンは彼女なのか？"]
    ]) {
      assert.equal(displayTitle({ base:id, title:id, key:id }), title);
    }
    assert.equal(displayTitle({ file:{ name:"th06_06.MID" }, key:"th06_06" }), data.titles.th06_06);
    assert.equal(displayTitle({ base:"th06_15", title:"th06_15", key:"custom" }), "My own title", "manual profile titles remain authoritative");
    assert.equal(displayTitle({ base:"unrelated_track", title:"unrelated_track", key:"other" }), "unrelated_track");
    assert.match(librarySrc, /libName", libRowNameText/);   /* trk167: 行の曲名は libRowNameText 経由（中身は songDisplayTitle） */
    assert.match(librarySrc, /function libRowNameText\(it, info\) \{[\s\S]{0,140}songDisplayTitle\(it\)/);
    assert.match(librarySrc, /songTitleBig.*songDisplayTitle\(s, m\)/);
  });

  test("PC-98 and music-CD aggregates remain under the 100-wish limit and preserve album labels", () => {
    const pc98 = main.playlists.filter(playlist => playlist.id === "th-pc98" || playlist.id === "th-pc98-v2");
    const cds = main.playlists.filter(playlist => playlist.id === "th-zun-cds" || playlist.id === "th-zun-cds-v2");
    assert.deepEqual(Array.from(pc98, playlist => playlist.songs.length), [100, 12]);
    assert.deepEqual(Array.from(cds, playlist => playlist.songs.length), [100, 84]);
    assert.ok([...pc98, ...cds].every(playlist => playlist.songs.length <= 100));
    const firstCd = cds[0].songs.find(track => track.matchAliases.includes("mcd_01_01"));
    assert.equal(firstCd.al, "蓬莱人形");
  });

  test("keeps Seihou and other associated games out of the Touhou Project series", () => {
    const outside = new Set(["sh01", "sh02", "tmgc", "alcostg", "touki", "thmj"]);
    for (const playlist of adjacent.playlists) {
      const release = releaseOf(playlist.songs[0].matchAliases[0]);
      assert.ok(outside.has(release));
      assert.ok(playlist.tags.includes("Not Touhou Project"));
    }
    assert.ok(main.playlists.every(playlist => !playlist.songs.some(track => outside.has(releaseOf(track.matchAliases[0])))));
    assert.match(main.note, /公式一覧ではありません/);
    assert.match(adjacent.note, /東方Project外/);
  });
});
