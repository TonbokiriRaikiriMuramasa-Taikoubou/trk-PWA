// SPDX-License-Identifier: GPL-3.0-or-later
/* trk160: 公開ビルドに無い Agent OST manifest は要求せず、任意資産を含むビルドだけ読み込む。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const start = library.indexOf("const AGENT_OST_ID =");
const end = library.indexOf("async function materializeAgentOst(", start);
assert.ok(start >= 0 && end > start, "the optional Agent OST initializer can be isolated");
const source = library.slice(start, end);

function setup({ enabled = false, manifest = null, playlists = [] } = {}) {
  const calls = { fetch:[], renders:0, saves:0, folders:0 };
  const settings = { playlists, trkRemoved:[] };
  const ctx = vm.createContext({
    window:{ Trk:{} }, core:{ settings, saveUserPrefs() { calls.saves++; } },
    calls, console, Map, String, Number, Object, Array, Date, Math, Promise, TRK_FOLDER_ID:"trk",
    ensureTrkFolder() { calls.folders++; },
    plSanitize(value) { return value; },
    trkIsRemoved(id) { return settings.trkRemoved.includes(id); },
    renderLib() { calls.renders++; },
    fetch:async url => { calls.fetch.push(url); return { ok:true, json:async () => manifest }; },
  });
  const code = source.replace("const AGENT_OST_MANIFEST_INCLUDED = false;", `const AGENT_OST_MANIFEST_INCLUDED = ${enabled};`);
  vm.runInContext(`let builtInSongs = [];\n${code}\nglobalThis.__api = {
    initAgentOstTracks,
    songs:() => builtInSongs,
    urls:() => [...agentOstUrls.entries()],
    flag:AGENT_OST_MANIFEST_INCLUDED
  };`, ctx);
  return { ctx, api:ctx.__api, calls, settings };
}

test("the default build renames old Agent OST playlists without requesting a missing manifest", async () => {
  const legacy = { id:"trk-agent-ost-v1", name:"trk Agent's Orig. Vol.1", songs:[] };
  const { api, calls } = setup({ playlists:[legacy] });
  await api.initAgentOstTracks();
  assert.equal(api.flag, false);
  assert.equal(legacy.name, "trk Agent's OST Vol.1", "the existing rename migration still runs");
  assert.equal(calls.fetch.length, 0, "the optional Git-ignored manifest is not fetched");
  assert.equal(calls.renders, 0);
});

test("a build that includes the optional manifest registers tracks but defers audio loading", async () => {
  const manifest = { version:1, enabled:true, tracks:[
    { key:"01", file:"01.wav", title:"Sketch 1" },
    { key:"02", file:"02.wav", title:"Sketch 2" },
  ] };
  const { api, calls, settings } = setup({ enabled:true, manifest });
  await api.initAgentOstTracks();
  assert.deepEqual(calls.fetch, ["./assets/trk-ost/manifest.json"]);
  assert.equal(api.songs().length, 2);
  assert.deepEqual(Array.from(api.songs(), song => song.key), ["builtin:trk-agent-ost:01", "builtin:trk-agent-ost:02"]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.urls())), [
    ["builtin:trk-agent-ost:01", "./assets/trk-ost/01.wav"],
    ["builtin:trk-agent-ost:02", "./assets/trk-ost/02.wav"],
  ]);
  assert.deepEqual(Array.from(settings.playlists[0].songs), ["builtin:trk-agent-ost:01", "builtin:trk-agent-ost:02"]);
  assert.equal(settings.playlists[0].id, "trk-agent-ost-v1");
  assert.equal(calls.renders, 1);
});
