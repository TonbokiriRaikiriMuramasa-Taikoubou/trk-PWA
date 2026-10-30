#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Vendor the CDN modules into assets/vendor/ (provenance: npm registry tarballs).
 *
 *   node tools/vendor-cdn.mjs --source=npm      (default) copy from the published npm tarballs
 *   node tools/vendor-cdn.mjs --source=cdn      copy from cdn.jsdelivr.net instead
 *
 * What it does:
 *   1. reads the import map in index.html and every dynamic import() in js/
 *   2. walks the module graph (relative imports, bare imports we already map, runtime assets)
 *   3. writes each file to assets/vendor/<pkg>@<version>/<path inside the package>
 *   4. rewrites the import map to ./assets/vendor/... and writes tools/vendor-lock.json
 *   5. copies each package LICENSE when the tarball has one
 *
 * After running, verify with:  node tools/check-vendor.mjs      (offline, part of npm run check)
 *                              node tools/check-vendor.mjs --source=npm   (compare with upstream)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
};
const source = value("--source", "npm");
if (!["cdn", "npm"].includes(source)) { console.error(`unknown --source=${source}`); process.exit(1); }

const CDN = "https://cdn.jsdelivr.net";
const NPM_CDN_PREFIX = `${CDN}/npm/`;
const REGISTRY = "https://registry.npmjs.org";
const VENDOR = path.join(root, "assets", "vendor");
const MAX_FILES = 400;
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

// The import map is local after the first run. Normalize its entries back to
// canonical jsDelivr URLs before walking the graph, so rerunning vendor:update
// is idempotent instead of handing relative paths to new URL().
function toCdnUrl(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith(NPM_CDN_PREFIX)) return value;
  if (value.startsWith("./assets/vendor/")) return `${NPM_CDN_PREFIX}${value.slice("./assets/vendor/".length)}`;
  if (value.startsWith("assets/vendor/")) return `${NPM_CDN_PREFIX}${value.slice("assets/vendor/".length)}`;
  return value;
}
function localOf(url) {
  if (!url.startsWith(NPM_CDN_PREFIX)) throw new Error(`cannot map non-npm URL into assets/vendor: ${url}`);
  return `assets/vendor/${url.slice(NPM_CDN_PREFIX.length)}`;
}

/* ---------- import map ---------- */
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!mapMatch) { console.error("no import map found in index.html"); process.exit(1); }
const rawImportMap = JSON.parse(mapMatch[1]).imports || {};
const importMap = Object.fromEntries(Object.entries(rawImportMap).map(([key, value]) => [key, toCdnUrl(value)]));

function resolveSpecifier(spec, baseUrl) {
  if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) return new URL(spec, baseUrl).href;
  if (importMap[spec]) return importMap[spec];
  const prefix = Object.keys(importMap).filter(k => k.endsWith("/") && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (prefix) return new URL(spec.slice(prefix.length), importMap[prefix]).href;
  return null;
}
const specifiers = new Set();
const appSource = [];
for (const file of fs.readdirSync(path.join(root, "js"))) {
  if (!file.endsWith(".js")) continue;
  const text = fs.readFileSync(path.join(root, "js", file), "utf8");
  appSource.push(text);
  for (const m of text.matchAll(/\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g)) specifiers.add(m[2]);
}
for (const key of Object.keys(importMap)) {
  if (key.endsWith("/")) continue;
  const quotedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const use = new RegExp(`(["'])${quotedKey}\\1`);
  if (appSource.some(text => use.test(text))) specifiers.add(key);
}

/* ---------- fetch from npm tarballs or the CDN ---------- */
function packageOf(url) {
  const m = url.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^/@]+)@([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, name, version, file] = m;
  const base = name.includes("/") ? name.split("/")[1] : name;
  return { name, version, file, tarball: `${REGISTRY}/${name}/-/${base}-${version}.tgz` };
}
function unpackTar(buf) {
  const files = new Map();
  for (let o = 0; o + 512 <= buf.length;) {
    const name = buf.toString("utf8", o, o + 100).replace(/\0.*$/, "");
    if (!name) break;
    const prefix = buf.toString("utf8", o + 345, o + 500).replace(/\0.*$/, "");
    const size = parseInt(buf.toString("utf8", o + 124, o + 136).replace(/\0.*$/, "").trim() || "0", 8) || 0;
    const type = buf.toString("utf8", o + 156, o + 157);
    const full = prefix ? `${prefix}/${name}` : name;
    if (type === "0" || type === "\0" || type === "") files.set(full, Buffer.from(buf.subarray(o + 512, o + 512 + size)));
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
const tarballs = new Map();
async function npmFile(url) {
  const info = packageOf(url);
  if (!info) throw Object.assign(new Error(`not an npm CDN url: ${url}`), { unreachable: true });
  if (!tarballs.has(info.tarball)) {
    const res = await fetch(info.tarball, { redirect: "follow" });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${info.tarball}`), { unreachable: true });
    tarballs.set(info.tarball, unpackTar(zlib.gunzipSync(Buffer.from(await res.arrayBuffer()))));
  }
  const file = tarballs.get(info.tarball).get(`package/${info.file}`);
  if (!file) throw Object.assign(new Error(`${info.file} is not inside ${info.tarball}`), { unreachable: true });
  return file;
}
async function fetchBytes(url) {
  if (source === "npm") return npmFile(url);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { unreachable: true });
  return Buffer.from(await res.arrayBuffer());
}

/* ---------- walk the graph ---------- */
const IMPORT_RE = /(?:^|[^\w$])(?:import|export)\s*(?:[\s\S]{0,4000}?\bfrom\s*)?(["'])([^"'\n]+)\1|import\s*\(\s*(["'])([^"'\n]+)\3\s*\)/g;
const ASSET_RE = /new\s+URL\s*\(\s*(["'])([^"'\n]+)\1\s*,\s*import\.meta\.url\s*\)/g;
const graph = new Map();   // cdn url -> { bytes, sha384 }
const licenses = new Set();
const queue = [...specifiers].map(s => resolveSpecifier(s, `${CDN}/`));
while (queue.length) {
  const url = queue.shift();
  if (!url || graph.has(url)) continue;
  if (!url.startsWith(`${CDN}/npm/`)) { console.error(`skipping unexpected origin: ${url}`); continue; }
  if (graph.size >= MAX_FILES) { console.error(`module graph is larger than ${MAX_FILES} files -- stopping`); break; }
  const bytes = await fetchBytes(url);
  graph.set(url, { bytes, sha384: crypto.createHash("sha384").update(bytes).digest("base64") });
  const text = bytes.toString("utf8");
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[2] || m[4];
    if (!spec || spec.startsWith("node:")) continue;
    const next = resolveSpecifier(spec, url);
    if (next) queue.push(next);
  }
  // new URL(..., import.meta.url) constructs a runtime asset URL, not a module
  // import; resolve it against this file's URL while walking the vendored graph.
  for (const m of text.matchAll(ASSET_RE)) queue.push(new URL(m[2], url).href);
}
/* each package LICENSE (we are redistributing these files, so keep their notices) */
for (const url of [...graph.keys()]) {
  const info = packageOf(url);
  if (!info || licenses.has(info.name)) continue;
  licenses.add(info.name);
  try { graph.set(`${CDN}/npm/${info.name}@${info.version}/LICENSE`, { bytes: await fetchBytes(`${CDN}/npm/${info.name}@${info.version}/LICENSE`), license: true }); }
  catch (_) { /* package may name it differently; the summary file still lists the license */ }
}
for (const [url, entry] of graph) entry.sha384 ||= crypto.createHash("sha384").update(entry.bytes).digest("base64");

/* ---------- write assets/vendor ---------- */
const urls = [...graph.keys()].sort();
let written = 0, total = 0;
for (const url of urls) {
  const target = path.join(root, localOf(url));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, graph.get(url).bytes);
  written++; total += graph.get(url).bytes.length;
}

/* ---------- rewrite the import map ---------- */
const nextMap = {};
for (const [key, url] of Object.entries(importMap)) nextMap[key] = "./" + localOf(url);
const before = mapMatch[0];
const after = `<script type="importmap">\n${JSON.stringify({ imports: nextMap }, null, 2)}\n</script>`;
fs.writeFileSync(htmlPath, html.replace(before, after));

/* ---------- vendor lock (provenance + hashes) ---------- */
const lock = {
  note: "Vendored third-party modules. Verified offline by tools/check-vendor.mjs (part of npm run check).",
  source,
  entries: {}
};
for (const url of urls) lock.entries[url] = { local: localOf(url), sha384: graph.get(url).sha384, bytes: graph.get(url).bytes.length };
fs.writeFileSync(path.join(root, "tools", "vendor-lock.json"), JSON.stringify(lock, null, 2) + "\n");

/* ---------- a human-readable summary next to the files ---------- */
const byPackage = new Map();
for (const url of urls) {
  const info = packageOf(url);
  if (!info) continue;
  const key = `${info.name}@${info.version}`;
  const entry = byPackage.get(key) || { files: 0, bytes: 0 };
  entry.files++; entry.bytes += graph.get(url).bytes.length;
  byPackage.set(key, entry);
}
const summary = [
  "# Vendored third-party modules",
  "",
  "These files are copies of published npm packages, kept here so trk! does not depend on a CDN.",
  "Do not edit them by hand. Regenerate with `node tools/vendor-cdn.mjs` and verify with `npm run check:vendor`.",
  "",
  `Source: ${source === "npm" ? "npm registry tarballs" : "cdn.jsdelivr.net"}`,
  "",
  "| package | files | size | license |",
  "| --- | --- | --- | --- |",
  ...[...byPackage.entries()].map(([key, v]) => `| ${key} | ${v.files} | ${(v.bytes / 1048576).toFixed(2)} MB | MIT (three.js / three-vrm / three-mmd-loader) |`),
  "",
  "Licenses: three.js (MIT, (c) three.js authors), @pixiv/three-vrm (MIT, (c) pixiv Inc.),",
  "@yohawing/three-mmd-loader (MIT, (c) yohawing). Their LICENSE files are next to the code.",
  "The exact bytes are recorded in tools/vendor-lock.json.",
  ""
].join("\n");
fs.writeFileSync(path.join(VENDOR, "README.md"), summary);

console.log(`vendored ${written} file(s), ${(total / 1048576).toFixed(2)} MB from ${source}`);
for (const [key, v] of byPackage) console.log(`  ${key}: ${v.files} file(s), ${(v.bytes / 1048576).toFixed(2)} MB`);
console.log("import map now points at:");
for (const [key, value] of Object.entries(nextMap)) console.log(`  ${key} -> ${value}`);
