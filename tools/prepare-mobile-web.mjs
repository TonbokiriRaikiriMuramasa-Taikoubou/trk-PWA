#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Stage the same static web app used by GitHub Pages for Capacitor.
 * The output is ignored because it is a generated copy consumed by `cap sync`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "mobile-web");
const files = [
  "index.html",
  "privacy.html",
  "credits.html",
  "manifest.webmanifest",
  "sw.js",
  "verified.json",
  "NOTICE.md",
  "LICENSE"
];
const directories = ["assets", "css", "docs", "icons", "js"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const rel of files) {
  const source = path.join(root, rel);
  if (!fs.existsSync(source)) throw new Error(`Missing web file: ${rel}`);
  const destination = path.join(out, rel);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
for (const rel of directories) {
  const source = path.join(root, rel);
  if (!fs.existsSync(source)) throw new Error(`Missing web directory: ${rel}`);
  fs.cpSync(source, path.join(out, rel), { recursive: true });
}

console.log(`Prepared ${files.length} files and ${directories.length} directories in ${path.relative(root, out)}/`);
