// SPDX-License-Identifier: GPL-3.0-or-later
/* 📥 Shared playlist import: a size cap before reading the file (like settings import / chart JSON),
 * and the title fallback uses the app's own title keys (separators, extensions, track numbers)
 * but only takes a loose match when it is unique and, if the sharer gave a size, the size matches. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const titleMatch = fs.readFileSync(`${ROOT}/js/title-match.js`, "utf8");
const between = (start, end) => { const a = library.indexOf(start), b = library.indexOf(end, a); assert.ok(a >= 0 && b > a, start); return library.slice(a, b); };
const ctx = vm.createContext({ metaOf: () => null });
vm.runInContext(titleMatch + "\n" + between("const plMatchIndexCache", "function plOpenLink("), ctx);
const match = (s, all) => { ctx.s = s; ctx.all = all; return vm.runInContext("plMatchByTitle(s, all)", ctx); };
const song = (title, size) => ({ key: `${size}|${title}`, title, size });

test("exact titles still match first", () => {
  const a = song("Sometimes", 100), all = [a, song("sometimes", 200)];
  assert.equal(match({ title: "sometimes", size: 200 }, all).size, 200);
});

test("separator / extension differences match when the size agrees", () => {
  const local = song("08 sometimes", 1234);
  assert.equal(match({ title: "08_sometimes", size: 1234 }, [local]), local);
  assert.equal(match({ title: "08_sometimes.flac", size: 1234 }, [local]), local);
});

test("a loose match with a different size, or two candidates, is not taken", () => {
  assert.equal(match({ title: "08_sometimes", size: 999 }, [song("08 sometimes", 1234)]), null);
  assert.equal(match({ title: "01 intro" }, [song("03 intro", 1), song("05 intro", 2)]), null, "two albums' intros stay unmatched");
});

test("classical typography fallback still requires a unique candidate and matching size", () => {
  const title = "Symphony No.5 in Cm, Op.67 - I. Allegro con brio";
  const local = song(title + ".mp3", 1234);
  const shared = { title: "Symphony no. 5 in C minor, Op. 67 — I. Allegro con brio", size: 1234 };
  assert.equal(match(shared, [local]), local);
  assert.equal(match({ ...shared, size: 999 }, [local]), null);
  assert.equal(match({ title: shared.title }, [local, song(title + ".flac", 5678)]), null);
  assert.equal(match({ title: shared.title.replace("Op. 67", "Op. 68") }, [local]), null);
});

test("the import reads the file only after the size check", () => {
  const pick = between("function plImportPick()", "\n}\n");
  assert.ok(/PLAYLIST_IMPORT_MAX = 4 \* 1024 \* 1024/.test(library));
  assert.ok(pick.indexOf("f.size > PLAYLIST_IMPORT_MAX") >= 0 && pick.indexOf("f.size > PLAYLIST_IMPORT_MAX") < pick.indexOf("f.text()"));
  for (const lang of ["ja", "en", "zh", "ko"]) {
    const blocks = library.match(new RegExp(`Object\\.assign\\(TEXT\\.${lang}, \\{[\\s\\S]*?\\n\\}\\);`, "g")) || [];
    assert.ok(blocks.some(b => b.includes("plImportTooBig:")), `plImportTooBig in ${lang}`);
  }
});

test("catalog-only decoration fallback does not loosen shared playlist import", () => {
  const decorated = song("🎧Theme 22 - Daily Routine 247 by Nor.m4a", 1234);
  assert.equal(match({ title: "Daily Routine 247", size: 1234 }, [decorated]), null);
  const hq = song("【高音質】Constant Moderato.m4a", 5678);
  assert.equal(match({ title: "Constant Moderato", size: 5678 }, [hq]), null);
  assert.equal(match({ title: hq.title, size: 5678 }, [hq]), hq, "exact decorated titles still work");
});
