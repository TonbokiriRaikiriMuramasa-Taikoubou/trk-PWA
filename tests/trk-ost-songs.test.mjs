// SPDX-License-Identifier: GPL-3.0-or-later
/* trk179: trk's OST Vol.1 の任意同梱曲。manifest があれば曲を登録し、音源は選ぶまで読まない。
   プレイリストへは「未見のキーだけ」足す。利用者が外した曲を勝手に戻さない。消したリストは作り直さない。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const start = library.indexOf("const TRK_OST_MANIFEST_INCLUDED =");
const end = library.indexOf("async function materializeTrkOstSong(", start);
assert.ok(start >= 0 && end > start, "the optional OST song initializer can be isolated");
const source = library.slice(start, end);

function setup({ manifest = null, ok = true, playlists = [], seen = [], included = true, packSongs = [] } = {}) {
  const calls = { fetch: [], renders: 0, saves: 0 };
  const settings = { playlists, trkRemoved: [], trkOstSeenKeys: seen };
  const ctx = vm.createContext({
    window: { Trk: {} }, core: { settings, saveUserPrefs() { calls.saves++; },
      hashString(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; } },
    calls, console, Map, String, Number, Object, Array, Date, Math, Promise,
    TRK_FOLDER_ID: "trk", TRK_OST_ID: "trk-ost-v1",
    trkIsRemoved(id) { return settings.trkRemoved.includes(id); },
    renderLib() { calls.renders++; },
    fetch: async (url) => { calls.fetch.push(url); return { ok, json: async () => manifest }; },
  });
  const src = included ? source.replace("const TRK_OST_MANIFEST_INCLUDED = false;", "const TRK_OST_MANIFEST_INCLUDED = true;") : source;
  vm.runInContext(`let builtInSongs = []; let packSongs = ${JSON.stringify(packSongs)};\n${src}\nglobalThis.__api = {
    initTrkOstSongs,
    trkOstLegacyCleanOnce,
    appendTrkOstSongs,
    syncTrkOstPackSongs,
    trkOstPackId,
    songs: () => builtInSongs,
    urls: () => [...trkOstSongUrls.entries()],
  };`, ctx);
  return { ctx, api: ctx.__api, calls, settings };
}

const demoManifest = () => ({
  version: 1, enabled: true, tracks: [
    { key: "ost-01-sunrise-dash", file: "ost-01-sunrise-dash.mp3", title: "SUNRISE DASH", artist: "trk!", bpm: 150, offset: 0 },
    { key: "ost-02-dummy", file: "ost-02-dummy.mp3", title: "Dummy", bpm: "not-a-number", offset: "x" },
  ],
});

test("the default build does not fetch the OST manifest at all (trk185: separate distribution)", async () => {
  const { api, calls } = setup({ ok: false, included: false });
  await api.initTrkOstSongs();
  assert.deepEqual(calls.fetch, [], "no 404 request for the removed bundled OST");
  assert.equal(api.songs().length, 0);
  assert.equal(calls.renders, 0);
});

test("an included build with a missing manifest means a lightweight build: no songs, no crash", async () => {
  const { api, calls } = setup({ ok: false });
  await api.initTrkOstSongs();
  assert.deepEqual(calls.fetch, ["./assets/optional-ost-audio/manifest.json"]);
  assert.equal(api.songs().length, 0);
  assert.equal(calls.renders, 0);
});

test("a valid manifest registers tracks, parses metadata, and defers audio loading", async () => {
  const ost = { id: "trk-ost-v1", name: "trk's OST Vol.1", songs: ["builtin:first-spark-tutorial-v1"] };
  const { api, calls, settings } = setup({ manifest: demoManifest(), playlists: [ost] });
  await api.initTrkOstSongs();
  assert.deepEqual(calls.fetch, ["./assets/optional-ost-audio/manifest.json"], "only the small manifest is fetched; MP3s wait for selection");
  assert.deepEqual(Array.from(api.songs(), (song) => song.key),
    ["builtin:trk-ost-song:ost-01-sunrise-dash", "builtin:trk-ost-song:ost-02-dummy"]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.urls())), [
    ["builtin:trk-ost-song:ost-01-sunrise-dash", "./assets/optional-ost-audio/ost-01-sunrise-dash.mp3"],
    ["builtin:trk-ost-song:ost-02-dummy", "./assets/optional-ost-audio/ost-02-dummy.mp3"],
  ]);
  const [first, second] = api.songs();
  assert.equal(first.title, "SUNRISE DASH");
  assert.equal(first.bpm, 150);
  assert.equal(first.offset, 0);
  assert.equal(first.file, null);
  assert.equal(second.bpm, 0, "unparsable bpm falls back to 0 (analyzed later)");
  assert.equal(second.offset, 0);
  assert.deepEqual(Array.from(ost.songs), ["builtin:first-spark-tutorial-v1",
    "builtin:trk-ost-song:ost-01-sunrise-dash", "builtin:trk-ost-song:ost-02-dummy"]);
  assert.deepEqual(Array.from(settings.trkOstSeenKeys),
    ["builtin:trk-ost-song:ost-01-sunrise-dash", "builtin:trk-ost-song:ost-02-dummy"]);
  assert.equal(calls.renders, 1);
});

test("unsafe track entries are filtered out before they can touch the filesystem or DOM", async () => {
  const { api } = setup({
    manifest: {
      version: 1, enabled: true, tracks: [
        { key: "../evil", file: "evil.mp3", title: "Traversal key" },
        { key: "ok-key", file: "../evil.mp3", title: "Traversal file" },
        { key: "ok-key", file: "song.wav", title: "Wrong extension" },
        { key: "x".repeat(33), file: "long.mp3", title: "Overlong key" },
        { key: "fine", file: "fine.mp3", title: "Fine" },
      ],
    },
  });
  await api.initTrkOstSongs();
  assert.deepEqual(Array.from(api.songs(), (song) => song.key), ["builtin:trk-ost-song:fine"]);
});

test("songs the user removed from the playlist are not resurrected", async () => {
  const ost = { id: "trk-ost-v1", name: "trk's OST Vol.1", songs: ["builtin:first-spark-tutorial-v1"] };
  const seen = ["builtin:trk-ost-song:ost-01-sunrise-dash"];
  const { api, settings } = setup({ manifest: demoManifest(), playlists: [ost], seen });
  await api.initTrkOstSongs();
  assert.deepEqual(Array.from(ost.songs), ["builtin:first-spark-tutorial-v1", "builtin:trk-ost-song:ost-02-dummy"],
    "only the never-seen key is appended; the removed one stays out");
  assert.ok(settings.trkOstSeenKeys.includes("builtin:trk-ost-song:ost-02-dummy"));
});

test("a deleted playlist is respected: songs stay in the library, no list is rebuilt", async () => {
  const { api, settings } = setup({ manifest: demoManifest(), playlists: [] });
  await api.initTrkOstSongs();
  assert.equal(api.songs().length, 2, "library registration does not depend on the playlist");
  assert.equal(settings.playlists.length, 0, "the initializer never recreates a removed list");
  assert.equal(settings.trkOstSeenKeys.length, 0, "unseen keys stay unseen until a list exists to hold them");
});

test("the official OST pack fills the playlist with unseen pack keys only (trk185)", async () => {
  const ost = { id: "trk-ost-v1", name: "trk's OST Vol.1", songs: ["builtin:first-spark-tutorial-v1"] };
  const probe = setup({ playlists: [ost] });
  const pid = probe.api.trkOstPackId();
  assert.ok(pid.startsWith("p"), "pack id follows packIdentityFromManifest (name|author hash)");
  const packSongs = ["s01", "s02", "s03", "s04", "s05"].map(id => ({ key: `pack:${pid}/${id}` }));
  packSongs.push({ key: "pack:pother/s01" });
  const { api, settings } = setup({ playlists: [ost], packSongs, seen: [`pack:${pid}/s02`] });
  assert.equal(api.syncTrkOstPackSongs(), true);
  assert.deepEqual(Array.from(ost.songs), ["builtin:first-spark-tutorial-v1",
    `pack:${pid}/s01`, `pack:${pid}/s03`, `pack:${pid}/s04`, `pack:${pid}/s05`],
    "only the official pack's unseen songs are appended, in pack order");
  assert.equal(api.syncTrkOstPackSongs(), false, "a second sync changes nothing");
});

test("no official pack installed: the playlist keeps only what it had", async () => {
  const ost = { id: "trk-ost-v1", name: "trk's OST Vol.1", songs: ["builtin:first-spark-tutorial-v1"] };
  const { api } = setup({ playlists: [ost], packSongs: [{ key: "pack:pxyz/s01" }] });
  assert.equal(api.syncTrkOstPackSongs(), false);
  assert.deepEqual(Array.from(ost.songs), ["builtin:first-spark-tutorial-v1"]);
});


test("legacy cleanup removes only bundled OST references once, preserving user data and pack removal history", () => {
  const legacy = "builtin:trk-ost-song:ost-01-sunrise-dash";
  const songs = ["builtin:first-spark-tutorial-v1", legacy, "pack:pabc/s01", "local:mine"];
  const ost = { id: "trk-ost-v1", songs: [...songs], name: "My OST", folder: "mine" };
  const other = { id: "mine", songs: [...songs] };
  const { api, settings, calls } = setup({ included: false, playlists: [ost, other], seen: [legacy, "pack:pabc/s02"] });
  assert.equal(api.trkOstLegacyCleanOnce(), true);
  assert.deepEqual(Array.from(ost.songs), songs.filter(k => k !== legacy));
  assert.deepEqual(other.songs, songs, "other user playlists are not modified");
  assert.equal(ost.name, "My OST"); assert.equal(ost.folder, "mine");
  assert.deepEqual(Array.from(settings.trkOstSeenKeys), ["pack:pabc/s02"]);
  assert.equal(settings.trkOstLegacyClean1, 1); assert.equal(calls.saves, 1);
  ost.songs.push(legacy);
  assert.equal(api.trkOstLegacyCleanOnce(), false);
  assert.ok(ost.songs.includes(legacy), "later user edits are not swept again");
  assert.equal(calls.saves, 1);
});

test("cleanup respects included builds, safe mode and deleted playlists", () => {
  const included = setup();
  assert.equal(included.api.trkOstLegacyCleanOnce(), false);
  assert.equal(included.settings.trkOstLegacyClean1, undefined);
  const safe = setup({ included: false }); safe.ctx.window.TrkSafeMode = () => true;
  assert.equal(safe.api.trkOstLegacyCleanOnce(), false); assert.equal(safe.calls.saves, 0);
  const removed = setup({ included: false }); removed.settings.trkRemoved = ["trk-ost-v1"];
  assert.equal(removed.api.trkOstLegacyCleanOnce(), true);
  assert.equal(removed.settings.playlists.length, 0);
  assert.deepEqual(removed.settings.trkRemoved, ["trk-ost-v1"]);
});

test("OST migration mark and seen keys survive JSON save and core settings reload", () => {
  const core = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
  const fields = core.slice(core.indexOf("  trkOstLegacyClean1:"), core.indexOf("  trkSortABC:"));
  const prefs = { trkOstLegacyClean1: 1, trkOstSeenKeys: ["pack:pabc/s02", "pack:pabc/s02", null, {}, "bad"] };
  const ctx = vm.createContext({ prefs: JSON.parse(JSON.stringify(prefs)) });
  const restored = vm.runInContext(`({${fields}})`, ctx);
  assert.equal(restored.trkOstLegacyClean1, 1);
  assert.deepEqual(Array.from(restored.trkOstSeenKeys), ["pack:pabc/s02"]);
  const ost = { id: "trk-ost-v1", songs: [] };
  const app = setup({ included: false, playlists: [ost], seen: Array.from(restored.trkOstSeenKeys) });
  app.settings.trkOstLegacyClean1 = restored.trkOstLegacyClean1;
  assert.equal(app.api.trkOstLegacyCleanOnce(), false);
  app.api.appendTrkOstSongs(["pack:pabc/s02"]);
  assert.deepEqual(ost.songs, [], "a previously removed pack song stays removed after reload");
});
