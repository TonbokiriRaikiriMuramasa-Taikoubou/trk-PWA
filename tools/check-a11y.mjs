#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * trk! 読みやすさ・たどり着きやすさの静的な見張り番（♿）。
 *
 * `npm run check` の一部として走る。外部の診断サイト（W3C の Nu HTML Checker /
 * axe DevTools / Lighthouse）と同じ全部は見られないが、**依存パッケージ無し**で
 * 「一度直したのに戻ってきた」種類のものだけを、ここで毎回見る:
 *
 *   1. id の重複（同じ id が2つあると、JS の getElementById が取り違える）
 *   2. 入力欄（select / input / textarea）に読み上げ名（aria-label・label・title・data-i18n-aria）があるか
 *   3. 画像に alt があるか
 *   4. 押せるものに role="presentation" / "none" を付けていないか（読み上げから消える）
 *   5. role="tablist" の中身がタブだけか（＋ボタンなどを混ぜない）
 *   6. 見出し(h1〜h6)の順番が飛んでいないか（飛びは1件もあってはならず、出たらFAIL。許可リストは空）
 *
 * 実行: node tools/check-a11y.mjs
 * 外部ツールでの点検のしかたは docs/QUALITY-CHECKS.md を参照。
 */
import fs from "node:fs";
import { restoreCoreAlias, sourceOf } from "./lib/js-source.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => sourceOf(rel, fs.readFileSync(path.join(root, rel), "utf8"));
const htmlFiles = ["index.html", "credits.html", "privacy.html"].filter(f => fs.existsSync(path.join(root, f)));

const jsFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else if (e.name.endsWith(".js")) jsFiles.push(path.join(dir, e.name));
  }
})("js");
const js = Object.fromEntries(jsFiles.map(f => [f, read(f)]));

let pass = 0, failed = 0, warned = 0;
const rule = (ok, label, detail = "") => {
  if (ok) { pass++; console.log("OK    " + label + (detail ? " — " + detail : "")); }
  else { failed++; console.log("FAIL  " + label + (detail ? " — " + detail : "")); }
};
const warn = (label, detail = "") => { warned++; console.log("WARN  " + label + (detail ? " — " + detail : "")); };

/* ---------- 1. id の重複 ---------- */
const dupReport = [];
for (const f of htmlFiles) {
  const src = read(f);
  const ids = [...src.matchAll(/\sid=["']([^"']+)["']/g)].map(m => m[1]);
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  const dup = [...counts].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
  if (dup.length) dupReport.push(`${f}: ${dup.join(", ")}`);
  else if (f === "index.html") {
    /* 画面の切り替えで増える要素も、id を配る側で重複させていないか軽く見る */
    const generated = [...Object.values(js).join("\n").matchAll(/\.id\s*=\s*"([^"]+)"/g)].map(m => m[1]);
    const staticIds = new Set(ids);
    const clash = [...new Set(generated)].filter(id => staticIds.has(id));
    if (clash.length) dupReport.push(`${f}（JSが付け直す id と衝突）: ${clash.join(", ")}`);
  }
}
rule(dupReport.length === 0, "no duplicate id in the static HTML", dupReport.join(" / ") || "index/credits/privacy");

/* ---------- 2. 入力欄の読み上げ名 ---------- */
const labelFor = src => new Set([...src.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/g)].map(m => m[1]));
const labelSpans = src => {
  const spans = [];
  for (const m of src.matchAll(/<label\b[^>]*>/g)) {
    const end = src.indexOf("</label>", m.index);
    if (end > 0) spans.push([m.index, end]);
  }
  return spans;
};
const named = (tag, at, id, spans, forSet) => {
  if (/\baria-label=|\baria-labelledby=|\btitle=|data-i18n-aria=/.test(tag)) return true;
  if (id && forSet.has(id)) return true;
  return spans.some(([a, b]) => at >= a && at <= b);   // label で包んでいる
};
const unnamedReport = [];
for (const f of htmlFiles) {
  const src = read(f);
  const spans = labelSpans(src), forSet = labelFor(src);
  for (const m of src.matchAll(/<(select|input|textarea)\b[^>]*>/g)) {
    const tag = m[0];
    if (/\btype=["'](hidden|file)["']/.test(tag) && spans.some(([a, b]) => m.index >= a && m.index <= b)) continue;
    if (/\btype=["']hidden["']/.test(tag) || /\bhidden\b/.test(tag)) continue;
    const id = (tag.match(/\bid=["']([^"']+)["']/) || [])[1];
    if (!named(tag, m.index, id, spans, forSet)) unnamedReport.push(`${f}: ${tag.slice(0, 70)}`);
  }
}
rule(unnamedReport.length === 0, "every select / input / textarea has an accessible name",
  unnamedReport.length ? unnamedReport.join(" / ") : "aria-label・label・title・data-i18n-aria のいずれか");

/* ---------- 3. 画像の alt ---------- */
const altReport = [];
for (const f of htmlFiles) {
  for (const m of read(f).matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) altReport.push(`${f}: ${m[0].slice(0, 60)}`);
}
rule(altReport.length === 0, "every <img> has an alt attribute", altReport.join(" / ") || "装飾でも alt=\"\" を書く");

/* ---------- 4. 押せるものを読み上げから消していないか ---------- */
const hiddenReport = [];
for (const f of htmlFiles) {
  for (const m of read(f).matchAll(/<(button|a|input|select|textarea)\b[^>]*\brole=["'](presentation|none)["'][^>]*>/g)) hiddenReport.push(`${f}: ${m[0].slice(0, 60)}`);
}
for (const [f, src] of Object.entries(js)) {
  for (const m of src.matchAll(/setAttribute\(\s*["']role["']\s*,\s*["'](presentation|none)["']\s*\)/g)) {
    /* 装飾用の div / span なら良い。押せるもの（同じ行に button / a / input がある）は駄目 */
    const line = src.slice(src.lastIndexOf("\n", m.index) + 1, src.indexOf("\n", m.index));
    if (/\bbutton\b|\b<button|\binput\b|\.type\s*=/.test(line)) hiddenReport.push(`${f}: ${line.trim().slice(0, 80)}`);
  }
}
rule(hiddenReport.length === 0, "no interactive element is hidden from screen readers (role=presentation / none)", hiddenReport.join(" / ") || "押せるものは role を消さず、装飾だけ aria-hidden にする");

/* ---------- 5. tablist の中身はタブだけ ---------- */
const tabProblems = [];
for (const f of htmlFiles) {
  const src = read(f);
  for (const m of src.matchAll(/<([a-z]+)\b[^>]*\brole=["']tablist["'][^>]*>/g)) {
    const end = src.indexOf(`</${m[1]}>`, m.index);
    const inner = src.slice(m.index, end < 0 ? src.length : end);
    const nonTab = [...inner.matchAll(/<(?!\/)([a-z]+)\b[^>]*>/g)].filter(x => !/\brole=["']tab["']/.test(x[0])).map(x => x[1]);
    if (nonTab.length) tabProblems.push(`${f}: <${m[1]}> に ${nonTab.join(", ")}`);
  }
}
{
  const lib = js["js/library.js"] || "";
  if (/setAttribute\(\s*["']role["']\s*,\s*["']tablist["']\s*\)/.test(lib)) {
    if (!/libTabsList/.test(lib)) tabProblems.push("js/library.js: タブの入れ物（libTabsList）が無い");
    if (!/tabList\.append\(b\)/.test(lib)) tabProblems.push("js/library.js: タブを tablist の入れ物へ入れていない");
    if (/\bbox\.append\(b\)/.test(lib)) tabProblems.push("js/library.js: ＋ボタンと同じ親にタブを直接入れている");
  }
}
rule(tabProblems.length === 0, "role=tablist holds tabs only (the ＋ button stays outside)", tabProblems.join(" / ") || "js/library.js の libTabsList");

/* ---------- 6. 見出し順: 許容済みWARN以外はFAIL ---------- */
{
  const src = read("index.html");
  const levels = [...src.matchAll(/<h([1-6])\b[^>]*>/g)].map(m => Number(m[1]));
  let prev = 0; const jumps = [];
  for (const l of levels) { if (prev && l > prev + 1) jumps.push(`h${prev}→h${l}`); prev = l; }
  const allowed = new Map(); // 許可リストは空（既知の h1→h3 は 2026-10-08 に h2 へ直して解消。docs/QUALITY-CHECKS.md）
  const observed = new Map();
  for (const jump of jumps) observed.set(jump, (observed.get(jump) || 0) + 1);
  const unreviewed = [...observed].filter(([jump, count]) => count > (allowed.get(jump) || 0))
    .map(([jump, count]) => `${jump}×${count}（許容 ${allowed.get(jump) || 0}）`);
  rule(unreviewed.length === 0, "heading-order warnings match the reviewed allowlist",
    unreviewed.length ? `unreviewed: ${unreviewed.join(", ")}` : jumps.length ? "known h1→h3 warning only" : "no heading-order warnings");
  if (jumps.length) warn("見出しの順番が飛んでいます（許容済みの既知WARN。docs/QUALITY-CHECKS.md を参照）",
    `${jumps.join(", ")}（左の列の見出しが h3 のため。h2 へ変えると見た目が変わるので保留中）`);
  else rule(true, "heading levels never skip a level in index.html");
}

/* ---------- 7. 手順書が残っているか（外部ツールでの素振りの記録） ---------- */
{
  const doc = fs.existsSync(path.join(root, "docs/QUALITY-CHECKS.md")) && read("docs/QUALITY-CHECKS.md");
  const linked = /QUALITY-CHECKS\.md/.test(read("docs/HANDOFF.md")) && /QUALITY-CHECKS\.md/.test(read("README.md"));
  rule(Boolean(doc) && linked && /axe-core/.test(doc) && /html-validate/.test(doc),
    "docs/QUALITY-CHECKS.md が残っている（README と HANDOFF から参照）",
    doc ? "外部ツールでの点検手順つき" : "見つかりません");
}

console.log("");
if (failed) {
  console.log(`a11y check: ${failed} failure(s) · ${pass} check(s) passed`);
  process.exit(1);
}
console.log(`a11y check: passed · ${pass} check(s) · ${warned} warning(s)`);
