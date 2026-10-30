// SPDX-License-Identifier: GPL-3.0-or-later
/* ↕ trkMovePlaylist moves a playlist next to its neighbour in the list the user is looking at.
 * The 🐔 menu shows one group per folder, but playlistOrder is one global array: swapping with the
 * global neighbour (another folder's playlist, or a deleted id) changed nothing on screen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const fn = name => { const a = library.indexOf(`function ${name}(`); const b = library.indexOf("\n}\n", a); assert.ok(a >= 0 && b > a, name); return library.slice(a, b + 3); };
const mk = (id, folder, createdAt) => ({ id, folder, name: id, createdAt });

function setup(order = []) {
  const settings = { trkSortABC: false, playlistOrder: order,
    playlists: [mk("A1", "trk", 1), mk("B1", "trk-classic", 2), mk("A2", "trk", 3), mk("B2", "trk-classic", 4)] };
  const ctx = vm.createContext({ core: { settings, saveUserPrefs() {} }, renderLib() {}, trkFolderIdSet: () => new Set(["trk", "trk-classic"]) });
  vm.runInContext(fn("trkOrderedPlaylists") + fn("trkMovePlaylist"), ctx);
  const group = folder => vm.runInContext(`trkOrderedPlaylists(core.settings.playlists.filter(p => p.folder === ${JSON.stringify(folder)})).map(p => p.id)`, ctx);
  const move = (id, dir, peers) => { ctx.args = [id, dir, peers]; vm.runInContext("trkMovePlaylist(...args)", ctx); };
  return { settings, group, move };
}

test("moving inside a folder group works even when another folder's playlist sits between them", () => {
  const { group, move } = setup();
  move("A1", 1, group("trk"));
  assert.deepEqual(Array.from(group("trk")), ["A2", "A1"]);
  assert.deepEqual(Array.from(group("trk-classic")), ["B1", "B2"], "the other folder keeps its order");
  move("B2", -1, group("trk-classic"));
  assert.deepEqual(Array.from(group("trk-classic")), ["B2", "B1"]);
});

test("the end of a group does not swap with another folder's playlist", () => {
  const { settings, group, move } = setup();
  move("A2", 1, group("trk"));
  assert.deepEqual(Array.from(group("trk")), ["A1", "A2"]);
  assert.deepEqual(Array.from(settings.playlistOrder), [], "nothing is saved for a move that cannot happen");
});

test("deleted ids in playlistOrder are dropped and never swallow a move", () => {
  const { settings, group, move } = setup(["A1", "GHOST", "A2", "B1", "B2"]);
  move("A1", 1, group("trk"));
  assert.deepEqual(Array.from(group("trk")), ["A2", "A1"], "one press moves it");
  assert.ok(!settings.playlistOrder.includes("GHOST"));
});

test("the flat lists (settings, folder menu) still move by the visible neighbour", () => {
  const { settings, move } = setup();
  move("A2", 1);   /* no peers = every trk playlist in display order: A1, B1, A2, B2 */
  assert.deepEqual(Array.from(settings.playlistOrder), ["A1", "B1", "B2", "A2"]);
});

test("every ↕ button passes its visible neighbours and is disabled at the ends", () => {
  assert.equal((library.match(/trkMovePlaylist\(p\.id, -?1, peers\)/g) || []).length, 6, "three lists × up/down");
  assert.equal((library.match(/trkMoveButtonsState\(up, down, i, (?:ordered|list)\.length\)/g) || []).length, 3);
});
