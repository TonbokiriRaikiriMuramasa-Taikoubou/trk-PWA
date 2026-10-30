// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// trk140: チュートリアルのスタンプ読み込みを、実際の js/core.js の関数で確かめる（文字列の有無ではなく入出力）。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreSource = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
const start = coreSource.indexOf("function tutorialStampsFrom(raw)");
const end = coreSource.indexOf("const settings = {", start);
assert.notEqual(start, -1, "tutorialStampsFrom is defined in js/core.js");
assert.notEqual(end, -1, "end marker found");
const context = vm.createContext({});
vm.runInContext(coreSource.slice(start, end) + "\nglobalThis.stamps = tutorialStampsFrom;", context);
const read = raw => JSON.parse(JSON.stringify(context.stamps(raw)));

test("a missing or non-array value gives an empty list", () => {
  assert.deepEqual(read(undefined), []);
  assert.deepEqual(read("play"), []);
  assert.deepEqual(read({ 0: "play" }), []);
});

test("the old song id becomes play, and duplicates are removed", () => {
  assert.deepEqual(read(["song", "look", "play", "song"]), ["play", "look"]);
});

test("unknown ids are dropped and the order of the rest is kept", () => {
  assert.deepEqual(read(["seed", "bogus", "look", 3, null, "studyBack"]), ["seed", "look", "studyBack"]);
});

test("all eight known ids are kept", () => {
  const all = ["play", "look", "safe", "back", "amp", "study", "studyBack", "seed"];
  assert.deepEqual(read(all), all);
});
