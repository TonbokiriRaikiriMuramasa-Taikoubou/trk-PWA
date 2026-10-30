#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Verify the vendored third-party modules (assets/vendor/).
 *
 *   node tools/check-vendor.mjs                offline: hashes, import-map coverage, missing files  (npm run check)
 *   node tools/check-vendor.mjs --source=npm   also compare against the published npm tarballs     (npm run check:vendor:npm)
 *   node tools/check-vendor.mjs --source=cdn   compare against cdn.jsdelivr.net (needs that host to be reachable)
 *   node tools/check-vendor.mjs --list         print the vendored graph
 *
 * Checks (all offline unless a --source is given):
 *   1. every file in tools/vendor-lock.json exists and its SHA-384 matches
 *   2. no extra files in assets/vendor (except README.md) that the lock does not know
 *   3. every relative import and file-relative runtime asset resolves to a vendored file
 *   4. every bare import resolves through the import map in index.html
 *   5. index.html has no third-party CDN origin left in the import map
 * With --source it also re-downloads the same graph and compares the digests (provenance).
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
const source = value("--source", "");
const list = args.includes("--list");
const CDN = "https://cdn.jsdelivr.net";
const REGISTRY = "https://registry.npmjs.org";
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

let failed = 0, passed = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { passed++; console.log(`OK    ${label}${detail ? " — " + detail : ""}`); }
  else { failed++; console.log(`FAIL  ${label}${detail ? " — " + detail : ""}`); }
};

/* ---------- lock + files ---------- */
const lockPath = path.join(root, "tools", "vendor-lock.json");
let lock;
try { lock = JSON.parse(fs.readFileSync(lockPath, "utf8")); }
catch (error) { console.error(`cannot read tools/vendor-lock.json: ${error.message}`); process.exit(1); }
const entries = Object.entries(lock.entries || {});
ok(entries.length >= 20, "tools/vendor-lock.json lists the vendored modules", `${entries.length} module(s)`);

const sha384 = buf => crypto.createHash("sha384").update(buf).digest("base64");
let bytesTotal = 0;
const known = new Set();
for (const [url, entry] of entries) {
  known.add(entry.local);
  const file = path.join(root, entry.local);
  if (!fs.existsSync(file)) { failed++; console.log(`FAIL  missing file: ${entry.local}`); continue; }
  const buf = fs.readFileSync(file);
  bytesTotal += buf.length;
  if (sha384(buf) !== entry.sha384) { failed++; console.log(`FAIL  hash mismatch: ${entry.local}`); }
}
ok(true, "every vendored file exists with a matching SHA-384", `${(bytesTotal / 1048576).toFixed(2)} MB`);

/* extra files the lock does not know (except the generated README) */
const extras = [];
for (const dir of ["assets/vendor"]) {
  const walk = rel => {
    for (const name of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const next = `${rel}/${name.name}`;
      if (name.isDirectory()) walk(next);
      else if (next !== "assets/vendor/README.md" && !known.has(next)) extras.push(next);
    }
  };
  walk(dir);
}
ok(extras.length === 0, "no unexplained files under assets/vendor", extras.slice(0, 3).join(" · "));

/* ---------- import map ---------- */
const html = read("index.html");
const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
ok(!!mapMatch, "index.html still has an import map");
const importMap = mapMatch ? (JSON.parse(mapMatch[1]).imports || {}) : {};
const remote = Object.entries(importMap).filter(([, v]) => /^https?:\/\//i.test(v));
ok(remote.length === 0, "the import map is fully local (no CDN origin left)", remote.map(([k]) => k).join(" · "));
const localMap = Object.entries(importMap).filter(([, v]) => v.startsWith("./"));
ok(localMap.length === Object.keys(importMap).length && localMap.length > 0, "every import map entry points into ./", `${localMap.length} entry(ies)`);
for (const [key, value] of localMap) {
  const target = value.endsWith("/") ? value.slice(0, -1) : value;
  if (!fs.existsSync(path.join(root, target))) { failed++; console.log(`FAIL  import map target missing: ${key} -> ${value}`); }
}

/* ---------- imports and runtime assets inside the vendored code ---------- */
const IMPORT_RE = /(?:^|[^\w$])(?:import|export)\s*(?:[\s\S]{0,4000}?\bfrom\s*)?(["'])([^"'\n]+)\1|import\s*\(\s*(["'])([^"'\n]+)\3\s*\)/g;
const ASSET_RE = /new\s+URL\s*\(\s*(["'])([^"'\n]+)\1\s*,\s*import\.meta\.url\s*\)/g;
function resolve(spec, fromFile) {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const resolved = path.normalize(path.join(path.dirname(fromFile), spec));
    return { kind: "relative", resolved };
  }
  if (spec.startsWith("/")) return { kind: "relative", resolved: spec.slice(1) };
  if (importMap[spec]) return { kind: "bare", resolved: path.normalize(importMap[spec].replace(/^\.\//, "")) };
  const prefix = Object.keys(importMap).filter(k => k.endsWith("/") && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (prefix) return { kind: "bare", resolved: path.normalize(path.join(importMap[prefix].replace(/^\.\//, ""), spec.slice(prefix.length))) };
  return { kind: "unmapped", resolved: spec };
}
function resolveAsset(spec, fromFile) {
  // URL strings passed to new URL(..., import.meta.url) are file-relative
  // asset paths, not module specifiers (and must not use the import map).
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(spec)) return { kind: "external", resolved: spec };
  const filePath = spec.split(/[?#]/, 1)[0];
  if (filePath.startsWith("/")) return { kind: "relative", resolved: filePath.slice(1) };
  return { kind: "relative", resolved: path.normalize(path.join(path.dirname(fromFile), filePath)) };
}
const missing = new Set(), unmapped = new Set();
const checkReference = (spec, rel, resolver) => {
  if (!spec || spec.startsWith("node:") || spec.startsWith("data:") || /^https?:/i.test(spec)) return;
  const r = resolver(spec, rel);
  if (r.kind === "unmapped") unmapped.add(`${rel} -> ${spec}`);
  else if (r.kind !== "external" && !fs.existsSync(path.join(root, r.resolved))) missing.add(`${rel} -> ${spec} (${r.resolved})`);
};
for (const rel of [...known].filter(p => p.endsWith(".js")).sort()) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  for (const m of text.matchAll(IMPORT_RE)) checkReference(m[2] || m[4], rel, resolve);
  for (const m of text.matchAll(ASSET_RE)) checkReference(m[2], rel, resolveAsset);
}
ok(missing.size === 0, "every relative import and file-relative runtime asset resolves", [...missing].slice(0, 3).join(" · "));
ok(unmapped.size === 0, "every bare import is covered by the import map", [...unmapped].slice(0, 3).join(" · "));

/* ---------- optional: compare with upstream ---------- */
if (source) {
  if (!["npm", "cdn"].includes(source)) { console.error(`unknown --source=${source}`); process.exit(1); }
  const packageOf = url => {
    const m = url.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^/@]+)@([^/]+)\/(.+)$/);
    if (!m) return null;
    const base = m[1].includes("/") ? m[1].split("/")[1] : m[1];
    return { name: m[1], version: m[2], file: m[3], tarball: `${REGISTRY}/${m[1]}/-/${base}-${m[2]}.tgz` };
  };
  const tarballs = new Map();
  const unpack = buf => {
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
  };
  let compared = 0, changed = 0, unreachable = 0;
  for (const [url, entry] of entries) {
    let buf = null;
    try {
      if (source === "npm") {
        const info = packageOf(url);
        if (!info) continue;
        if (!tarballs.has(info.tarball)) {
          const res = await fetch(info.tarball, { redirect: "follow" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          tarballs.set(info.tarball, unpack(zlib.gunzipSync(Buffer.from(await res.arrayBuffer()))));
        }
        buf = tarballs.get(info.tarball).get(`package/${info.file}`) || null;
      } else {
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
      }
    } catch (error) { unreachable++; continue; }
    if (!buf) continue;
    compared++;
    if (sha384(buf) !== entry.sha384) { changed++; console.log(`CHANGED upstream: ${url}`); }
  }
  if (compared === 0) { console.error(`could not reach the ${source === "npm" ? "npm registry" : "CDN"} -- nothing compared`); process.exit(3); }
  ok(changed === 0, `upstream (${source}) matches the vendored digests`, `${compared} file(s) compared${unreachable ? `, ${unreachable} unreachable` : ""}`);
}

if (list) {
  for (const [url, entry] of entries) console.log(`${String(entry.bytes).padStart(9)}  ${entry.local}   <- ${url.slice(`${CDN}/npm/`.length)}`);
}

console.log("");
console.log(`Vendor check: ${failed ? failed + " failure(s) · " : ""}${passed} check(s) passed · ${entries.length} module(s) · ${(bytesTotal / 1048576).toFixed(2)} MB`);
process.exit(failed ? 1 : 0);
