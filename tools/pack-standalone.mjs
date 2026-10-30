#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* 📦 trk! の「手渡し用」ZIPを作る（2026-10-31・レビュー③の再発防止）

   なぜ要るか：
   2026-10-31 の手渡し用ZIPは、作業ディレクトリを .gitignore のつもりで除外しながら集めたため、
   `assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/` が丸ごと抜けた（`dist/` を除外する規則に
   引っかかった）。main と Pages には入っていたので、ZIPだけMMDが読めない状態だった。

   この道具は **git が追跡しているファイルだけ** を集める（`git ls-files`）。
   .gitignore の規則は関係しないので、`dist/` のような名前でも、追跡されていれば必ず入る。
   さらに、tools/vendor-lock.json の全ファイルと、index.html が参照するファイルが
   そろっているかを検査してからZIPにする。

   使い方：
     node tools/pack-standalone.mjs [--out=dist] [--date=2026-10-31T21:00:00Z] [--name=trk-standalone-2026-10-31]
     node tools/pack-standalone.mjs --check-only     （集める一覧と検査だけ。ZIPは作らない）

   ・形は配布ZIPと同じ「index.html＋README.txt＋trk-files/」（tools/prepare-release.mjs の
     LAUNCHER_HTML をそのまま使う）。
   ・開発用（tests/・tools/・.github/・package*.json・capacitor.config.ts・CONTRIBUTING.md）と、
     開発者向けの引き継ぎ文書（HANDOFF*・MIGRATIONS・REVIEW-REQUEST*・IPHONE-PWA-BRAINSTORM*）は入れない。
   ・音源は入れない（リポジトリにも入れていない）。 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LAUNCHER_HTML, writeZip } from "./prepare-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* 入れないもの（リポジトリには在るが、使う人には要らない）。前後の / は付けない。
   ⚠ ここは **リポジトリの根からの名前** で見ること。`dist` を「どこかの階層の名前」で除外すると、
   assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/ のような **必要な dist まで落ちる**
   （2026-10-31 レビュー③がまさにこれだった）。 */
export const EXCLUDE_ROOTS = [".github", "tests", "tools", "node_modules", "dist", "release", "_site", "mobile-web"];
export const EXCLUDE_ANY_DIR = ["node_modules"];
export const EXCLUDE_FILES = ["package.json", "package-lock.json", "capacitor.config.ts", "CONTRIBUTING.md"];
export const EXCLUDE_DOCS = [
  "docs/HANDOFF.md", "docs/HANDOFF-ARCHIVE.md", "docs/HANDOFF-TRK.md", "docs/HANDOFF-TRK-STANDALONE.md",
  "docs/MIGRATIONS.md", "docs/REVIEW-REQUEST-2026-10-31.md", "docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md"
];

/** そのファイルを配布物に入れるか（純粋な判断。テストで確かめる） */
export function includeRel(rel) {
  const clean = String(rel || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean || clean.endsWith("/")) return false;
  if (EXCLUDE_FILES.includes(clean)) return false;
  if (EXCLUDE_DOCS.includes(clean)) return false;
  const parts = clean.split("/");
  if (EXCLUDE_ROOTS.includes(parts[0])) return false;
  if (parts.slice(0, -1).some(part => EXCLUDE_ANY_DIR.includes(part))) return false;
  return true;
}

/** git が追跡しているファイルの一覧（.gitignore に左右されない） */
export function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\0").filter(Boolean);
}

/** 集めた一覧から、配布物に入れるものを選ぶ */
export function pickFiles(files = trackedFiles()) {
  return files.filter(includeRel).sort();
}

/** index.html が参照しているファイル（相対のみ）を返す */
export function indexRefs(rel = "index.html") {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const refs = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"'#?]+)["']/gi)) refs.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref=["']([^"'#?]+)["']/gi)) refs.add(m[1]);
  return [...refs].filter(ref => !/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith("//"));
}

/** vendor-lock.json の全ファイルが一覧に入っているか（レビュー③の再発防止） */
export function vendorProblems(files) {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/vendor-lock.json"), "utf8"));
  const set = new Set(files);
  const problems = [];
  for (const entry of Object.values(lock.entries || {})) {
    if (entry && entry.local && !set.has(entry.local)) problems.push(`vendor が見つかりません: ${entry.local}`);
  }
  return problems;
}

/** index.html の参照先が一覧に入っているか */
export function refProblems(files) {
  const set = new Set(files);
  const problems = [];
  for (const ref of indexRefs()) {
    /* 自作キャラのMODの記入例（js/characters/○○.js）は、実在しないのが正しい */
    if (ref.includes("○○")) continue;
    if (!set.has(ref.replace(/^\.\//, ""))) problems.push(`index.html の参照が見つかりません: ${ref}`);
  }
  return problems;
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

async function main() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) continue;
    args[m[1]] = m[2] === undefined ? true : m[2];
  }
  const out = path.resolve(args.out || path.join(ROOT, "dist"));
  const name = String(args.name || `trk-standalone-${new Date().toISOString().slice(0, 10)}`).replace(/[^\w.@-]+/g, "-");
  const date = String(args.date || new Date().toISOString());

  const files = pickFiles();
  const problems = [...vendorProblems(files), ...refProblems(files)];
  if (problems.length) {
    for (const p of problems) console.error(`  - ${p}`);
    fail(`配布物に要るファイルが欠けています（${problems.length}件）。ZIPは作りません。`);
    return;
  }
  const vendorCount = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "tools/vendor-lock.json"), "utf8")).entries || {}).length;
  console.log(`✅ 集めるファイル: ${files.length}（vendor ${vendorCount} 件をすべて含む・index.html の参照も欠けなし）`);
  if (args["check-only"]) return;

  const stage = path.join(out, name);
  fs.rmSync(stage, { recursive: true, force: true });
  const appDir = path.join(stage, "trk-files");
  for (const rel of files) {
    const to = path.join(appDir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), to);
  }
  fs.writeFileSync(path.join(stage, "index.html"), LAUNCHER_HTML);
  const readme = args.readme ? path.resolve(args.readme) : path.join(ROOT, "release", "README-standalone.txt");
  if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(stage, "README.txt"));
  else console.warn(`⚠ README が見つからないので入れませんでした: ${readme}`);

  /* 時刻をそろえる（同じ入力なら同じZIPになる） */
  const stamp = new Date(date);
  if (!Number.isFinite(stamp.getTime())) { fail(`--date を読めません: ${date}`); return; }
  const touch = p => { try { fs.utimesSync(p, stamp, stamp); } catch (_) {} };
  const walk = (dir, prefix = "") => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
  });
  const all = walk(stage);
  for (const rel of all) touch(path.join(stage, rel));
  for (const rel of all) {
    const parts = rel.split("/"); parts.pop();
    while (parts.length) { touch(path.join(stage, ...parts)); parts.pop(); }
  }

  const entries = all.map(rel => ({ name: `${name}/${rel}`, abs: path.join(stage, rel) }));
  const bytes = await writeZip(entries, date);
  fs.mkdirSync(out, { recursive: true });
  const zipPath = path.join(out, `${name}.zip`);
  fs.writeFileSync(zipPath, bytes);
  console.log(`📦 ${path.relative(ROOT, zipPath)}（${entries.length} ファイル・${(bytes.length / 1024 / 1024).toFixed(1)} MB）`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => { console.error(error); process.exitCode = 1; });
