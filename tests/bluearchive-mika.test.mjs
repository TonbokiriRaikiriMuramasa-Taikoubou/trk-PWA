// SPDX-License-Identifier: GPL-3.0-or-later
/* ミカ曲：公式ページの固定記録、5項目の媒体・言語の分離、保存時の条件維持。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const fixture = JSON.parse(fs.readFileSync(`${ROOT}/tools/bluearchive-mika-tracklist.json`, "utf8"));
const lib = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const between = (a, b) => {
  const start = lib.indexOf(a), end = lib.indexOf(b, start);
  assert.ok(start >= 0 && end > start, a);
  return lib.slice(start, end);
};
const ctx = vm.createContext({ metaOf: () => null, PL_COLORS: { none: "", pink: "pink" } });
vm.runInContext([
  fs.readFileSync(`${ROOT}/js/catalog.js`, "utf8"),
  fs.readFileSync(`${ROOT}/js/title-match.js`, "utf8"),
  between("function plWishMatch(", "function plSyncWishes("),
  between("function plSanitize(", "const TRK_PLAYLIST_ID"),
  between("function plGuideSanitize(", "function plGuideJa("),
  between("function trkWishFromTrack(", "function trkWishesFromCatalog("),
  `globalThis.api = { plWishMatch, plSongMatchKeys, plWishMediaMatches, plSanitize, trkWishFromTrack };
   globalThis.ba = TRK_CATALOG.find(s => s.id === "bluearchive");`
].join("\n"), ctx);
const { api, ba } = ctx;
const playlist = ba.playlists.find(p => p.id === fixture.playlistId);
const memLobbySongs = playlist.songs.slice(0, 2);
const kissSongs = playlist.songs.slice(2, 7);
const ariaSongs = playlist.songs.slice(7, 10);
const jpSongs = playlist.songs.slice(10, 14);
const clean = x => JSON.parse(JSON.stringify(x));
const index = items => {
  const map = new Map();
  for (const it of items) for (const key of api.plSongMatchKeys(it.title, it.hint)) {
    const hits = map.get(key) || [];
    if (!hits.includes(it)) hits.push(it);
    map.set(key, hits);
  }
  return map;
};
const local = (title, kind) => ({ key: `${kind}|${title}`, title,
  file: { name: title + (kind === "video" ? ".mp4" : ".m4a"), type: kind + "/mp4" } });

test("unified 🪽聖園ミカ playlist orders Memorial Lobby (Daily Routine 24/7, You’re My Princess) -> kiss angel -> Aria to the Star -> solo/ensemble songs while keeping 225 OST tracks separate", () => {
  assert.equal(ba.playlists.length, 9);
  assert.equal(ba.playlists.filter(p => /^ba-v[1-8]$/.test(p.id)).flatMap(p => p.songs).length, 225);
  assert.equal(playlist.id, "ba-mika");
  assert.equal(playlist.name, "聖園ミカ");
  assert.equal(playlist.icon, "🪽");
  assert.equal(playlist.color, "pink");
  assert.ok(playlist.name.length <= 24);
  assert.equal(playlist.sourceUrl, fixture.guideUrl);
  assert.equal(playlist.songs.length, 14);
  assert.deepEqual(clean(memLobbySongs), [
    {
      t: "Daily Routine 24/7",
      al: "Blue Archive Original Soundtrack Vol.1 ~Longing for the memorable days~",
      ar: "Nor",
      u: "https://mora.jp/package/43000033/PA00094941-1-1/",
      matchAliases: ["Daily Routine 247"],
      matchMedia: "audio"
    },
    {
      t: "You’re My Princess",
      al: "",
      ar: "EmoCosine",
      u: "https://x.com/EmoCosine/status/1950427696582054373",
      matchAliases: ["You're My Princess"],
      matchMedia: "audio"
    }
  ]);
  for (const title of [
    "Daily Routine 24/7",
    "Daily Routine 247",
    "🎧Theme 22 - Daily Routine 24/7 by Nor",
    "🎧Theme 22 - Daily Routine 247 by Nor",
    "【高音質】Daily Routine 24/7"
  ]) {
    const right = local(title, "audio");
    assert.deepEqual(playlist.songs.filter(w => api.plWishMatch(w, index([right]))).map(w => w.t).join(), "Daily Routine 24/7");
  }
  for (const title of ["You’re My Princess", "You're My Princess", "🎧Theme 298 - You're My Princess by EmoCosine", "【高音質】You’re My Princess"]) {
    const right = local(title, "audio");
    assert.deepEqual(playlist.songs.filter(w => api.plWishMatch(w, index([right]))).map(w => w.t).join(), "You’re My Princess");
    assert.equal(api.plWishMatch(memLobbySongs[1], index([local(title, "video")])), null);
  }
  assert.deepEqual(clean(kissSongs), fixture.tracks.map(({ durationSeconds, ...track }) => track));
  assert.deepEqual(kissSongs.map(t => t.matchMedia).join(","), "video,video,audio,audio,audio");
  assert.ok(kissSongs.every(t => !/short|by angel/i.test(t.t + " " + t.matchAliases.join(" "))));
});

for (let i = 0; i < fixture.tracks.length; i++) test(`only the right language/medium matches: ${fixture.tracks[i].t}`, () => {
  const track = kissSongs[i];
  for (const title of [track.t, ...track.matchAliases]) {
    for (const prefix of ["", "【高音質】"]) {
      const file = local(prefix + title, track.matchMedia);
      const hits = playlist.songs.filter(w => api.plWishMatch(w, index([file])));
      assert.deepEqual(hits.map(w => w.t).join(), track.t);
      const wrong = local(prefix + title, track.matchMedia === "audio" ? "video" : "audio");
      assert.equal(api.plWishMatch(track, index([wrong])), null);
    }
  }
});

test("unmarked titles, old typo and Short versions do not fill any of the 12 rows", () => {
  for (const title of ["Do you wanna kiss angel", "Do you wanna kiss by angel", "Do you wanna kiss angel (JP Ver. (Short))",
    "Do you wanna kiss angel - CN Ver. (Short)", "Do you wanna kiss angel (JP MV) (Short)"]) {
    for (const kind of ["audio", "video"]) {
      const file = local(title, kind);
      assert.ok(playlist.songs.every(w => api.plWishMatch(w, index([file])) === null));
    }
  }
});

test("media filtering happens before selecting a hit, including decorated fallback", () => {
  const wish = kissSongs[0];
  for (const prefix of ["", "【高音質】"]) {
    const audio = local(prefix + wish.t, "audio"), video = local(prefix + wish.t, "video");
    assert.equal(api.plWishMatch(wish, index([audio, video])), video);
    assert.equal(api.plWishMatch(wish, index([video, audio])), video);
  }
  const memo = { ...local("unrelated", "audio"), hint: wish.t };
  assert.equal(api.plWishMatch(wish, index([memo])), null, "a manual match note cannot turn an audio file into a PV");
});

test("catalog projection and saved playlist sanitization retain media conditions", () => {
  const wish = playlist.songs.map(api.trkWishFromTrack);
  const p = api.plSanitize({ id: "trk-ba-mika", name: playlist.name, icon: playlist.icon, color: playlist.color, wish, songs: [] });
  assert.deepEqual(clean(p.wish), clean(playlist.songs));
  const restored = api.plSanitize(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(clean(restored.wish), clean(p.wish));
  for (const invalid of ["image", true, 1, {}, ["video"]]) {
    assert.equal(api.trkWishFromTrack({ t: "x", matchMedia: invalid }).matchMedia, undefined);
    assert.equal(api.plSanitize({ id: "x", wish: [{ t: "x", matchMedia: invalid }] }).wish[0].matchMedia, undefined);
  }
});

test("file MIME/name or confirmed video flag determine medium; display title does not", () => {
  const audio = { matchMedia: "audio" }, video = { matchMedia: "video" };
  for (const item of [{ file: { name: "x.mp4" } }, { file: { type: "video/webm" } }, { video: true }]) {
    assert.equal(api.plWishMediaMatches(video, item), true);
    assert.equal(api.plWishMediaMatches(audio, item), false);
  }
  for (const item of [{ file: { name: "x.m4a" } }, { file: { type: "audio/mp4", name: "x.mp4" } }]) {
    assert.equal(api.plWishMediaMatches(audio, item), true);
    assert.equal(api.plWishMediaMatches(video, item), false);
  }
  for (const item of [{ title: "x.mp4" }, { file: { name: "unknown" } }]) {
    assert.equal(api.plWishMediaMatches(audio, item), false);
    assert.equal(api.plWishMediaMatches(video, item), false);
    assert.equal(api.plWishMediaMatches({ t: "ordinary" }, item), true, "old catalog behavior is unchanged");
  }
});

const ariaFixture = JSON.parse(fs.readFileSync(`${ROOT}/tools/bluearchive-mika-aria-tracklist.json`, "utf8"));
test("Aria section (rows 8–10) has two vocal tracks plus the full Global official musical", () => {
  assert.equal(playlist.name, ariaFixture.playlistName);
  assert.deepEqual(clean(ariaSongs), ariaFixture.tracks.map(({ durationSeconds, ...t }) => t));
  assert.equal(ariaSongs.length, 3);
  assert.equal(ba.playlists.flatMap(p => p.songs).length, 239);
});

for (const wish of ariaSongs) test(`Aria media and version isolation: ${wish.t}`, () => {
  for (const title of [wish.t, ...(wish.matchAliases || [])]) {
    for (const prefix of ["", "【高音質】"]) {
      const right = local(prefix + title, wish.matchMedia);
      const wrong = local(prefix + title, wish.matchMedia === "audio" ? "video" : "audio");
      assert.equal(api.plWishMatch(wish, index([wrong])), null);
      assert.equal(api.plWishMatch(wish, index([wrong, right])), right);
      assert.deepEqual(playlist.songs.filter(w => api.plWishMatch(w, index([right]))).map(w => w.t).join(), wish.t);
    }
    for (const version of [" (Instrumental)", " (Short)", " (English Ver.)", " (Teaser)", " (Album Ver.) MV"]) {
      assert.equal(api.plWishMatch(wish, index([local(title + version, wish.matchMedia)])), null);
    }
  }
});

test("Japanese solo/ensemble section (rows 9–12) keeps full vocals separate from short, instrumental and MV", () => {
  assert.deepEqual([...jpSongs.map(t => t.t)], ["幸せになるよ", "ワンダー・ファニー・ハーモニー", "Let's Go With...", "【ブルアカ】5周年記念楽曲「Let's Go With…」MV"]);
  assert.deepEqual([...jpSongs.map(t => t.matchMedia)], ["audio", "audio", "audio", "video"]);
  assert.deepEqual([...jpSongs.map(t => t.u.split("/").pop())], ["1867673117", "1697260292", "1861397911", "watch?v=PdnDedDp-5A"]);
  assert.equal(jpSongs[1].ar.split("、").length, 12);
  assert.equal(jpSongs[2].ar.split("、").length, 6);
  for (const w of jpSongs) {
    assert.ok(w.ar.includes("ミカ"));
    assert.ok(w.ar.length <= 80);
    const right = local(w.t, w.matchMedia);
    assert.equal(api.plWishMatch(w, index([right])), right);
    assert.deepEqual(playlist.songs.filter(x => api.plWishMatch(x, index([right]))).map(x => x.t).join(), w.t);
    assert.equal(api.plWishMatch(w, index([local(w.t, w.matchMedia === "audio" ? "video" : "audio")])), null);
    for (const suffix of ["(Short Ver.)", "(Instrumental Ver.)", " (Cover)"]) {
      assert.equal(api.plWishMatch(w, index([local(w.t + suffix, w.matchMedia)])), null);
    }
  }
  assert.deepEqual(clean(api.plSanitize({ id: "jp", wish: jpSongs.map(api.trkWishFromTrack) }).wish), clean(jpSongs));
});
