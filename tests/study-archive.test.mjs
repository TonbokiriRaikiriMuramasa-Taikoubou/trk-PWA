// SPDX-License-Identifier: GPL-3.0-or-later
/* 📚 CBZ／ZIP の取り込み（trk138）の純粋な部分：どの項目をページにするか、並び順、MIME。
   js/study-room-utils.js を vm で読み、study-room.js の配線は npm run check の静的検査で見る。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const window = {};
vm.runInNewContext(fs.readFileSync(`${ROOT}/js/study-room-utils.js`, "utf8"), { window, Intl, String, Array, Map, Set, Math, Number });
const U = window.TrkStudyUtils;
const names = list => U.archivePages(list.map(name => ({ name }))).map(entry => entry.name);

test("only image entries become pages, in natural order", () => {
  assert.deepEqual(names(["10.jpg", "2.jpg", "1.PNG", "notes.txt", "a/3.webp", "a/10.webp"]),
    ["1.PNG", "2.jpg", "10.jpg", "a/3.webp", "a/10.webp"]);
});

test("Mac metadata and dot files are skipped", () => {
  assert.deepEqual(names(["__MACOSX/vol/._1.jpg", "vol/.DS_Store", "vol/.hidden.jpg", "vol/1.jpg", "__MACOSX.jpg"]),
    ["__MACOSX.jpg", "vol/1.jpg"]);
});

test("unsupported image types are not pages", () => {
  assert.deepEqual(names(["1.svg", "2.tiff", "3.heic", "4.jpeg"]), ["4.jpeg"]);
});

test("MIME follows the extension and falls back to octet-stream", () => {
  assert.equal(U.mimeOf("x/A.JPG"), "image/jpeg");
  assert.equal(U.mimeOf("p.png"), "image/png");
  assert.equal(U.mimeOf("p.bin"), "application/octet-stream");
});

// vm の別の実行環境で作られた値は厳密比較で型が違うので、JSON にしてから比べる
const problem = (...args) => JSON.parse(JSON.stringify(U.albumProblem(...args)));
const LIM = { count: 3000, bytes: 600 * 1048576, file: 100 * 1048576 };
test("album limits: at the limit is fine, over it is refused", () => {
  assert.equal(problem([{ name: "a", size: 1 }], LIM), null);
  assert.equal(problem(Array.from({ length: 3000 }, (_, i) => ({ name: "p" + i, size: 1 })), LIM), null);
  assert.deepEqual(problem(Array.from({ length: 3001 }, (_, i) => ({ name: "p" + i, size: 1 })), LIM), { kind: "album" });
  // 7 × 90MB = 630MB：1枚は100MB以内でも、合計が600MBを超える
  assert.deepEqual(problem(Array.from({ length: 7 }, (_, i) => ({ name: "v" + i, size: 90 * 1048576 })), LIM), { kind: "album" });
});
test("one page over 100 MB is refused and named", () => {
  assert.deepEqual(problem([{ name: "ok", size: 5 }, { name: "big.png", size: 100 * 1048576 + 1 }], LIM),
    { kind: "file", name: "big.png", max: 100 * 1048576 });
});
test("with the limit ignored (Infinity) nothing is refused", () => {
  const off = { count: Infinity, bytes: Infinity, file: Infinity };
  assert.equal(problem(Array.from({ length: 3500 }, (_, i) => ({ name: "p" + i, size: 500 * 1048576 })), off), null);
});
