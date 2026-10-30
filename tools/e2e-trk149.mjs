#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* 実ブラウザでの確認（trk149）。npm run check には入れない（ブラウザが要るため）。
 *
 *   SMOKE_CHROME=/path/to/chromium SMOKE_CHROME_ARGS='["--no-sandbox"]' \
 *   SMOKE_PUPPETEER=puppeteer-core node tools/e2e-trk149.mjs
 *
 * 見ること：
 *   1. ようこそ：初回に出る → 閉じる → 緊急復旧の「ようこそをもう一度」で再び出る
 *   2. trk Agent's OST Vol.1：ビルド側の AGENT_OST_MANIFEST_INCLUDED が true で、manifestもある場合だけ、
 *      10曲が専用プレイリストに出て、02番の音源読み込み・解析まで進む（既定ビルドでは飛ばす）
 *   3. 書斎：CBZ（3ページ）と ZIP（2ページ）を取り込むと、2冊・5ページになる
 *   4. CATCH の設定：「次の荷物まで」のチェックがある
 *   5. どの確認でも、ページの例外・console.error が無い
 * 終了コード：失敗があれば 1。 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUP = process.env.SMOKE_PUPPETEER || "puppeteer-core";
const { default: puppeteer } = await import(PUP).catch(() => {
  console.error(`「${PUP}」が見つかりません。SMOKE_PUPPETEER で指定してください。`); process.exit(2);
});
const CHROME = process.env.SMOKE_CHROME;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".svg": "image/svg+xml" };

/* 静的サーバー（リポジトリの中身をそのまま返す） */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

/* テスト用の CBZ／ZIP（画像は小さな PNG。ZIP は無圧縮で書く） */
function png(w, h, rgb) {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array(w).fill(rgb).flat())])));
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function storedZip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name), crc = zlib.crc32(data) >>> 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, data); centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const central = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trk149-"));
const cbz = path.join(tmp, "test-comic.cbz"), zip = path.join(tmp, "test-stored.zip");
fs.writeFileSync(cbz, storedZip([["001.png", png(40, 60, [255, 0, 0])], ["002.png", png(40, 60, [0, 255, 0])], ["003.png", png(40, 60, [0, 0, 255])]]));
fs.writeFileSync(zip, storedZip([["page1.png", png(30, 30, [255, 255, 0])], ["page2.png", png(30, 30, [0, 255, 255])]]));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: JSON.parse(process.env.SMOKE_CHROME_ARGS || "[]") });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("dialog", d => d.accept());
await page.setViewport({ width: 1280, height: 800 });
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = {};
const check = (name, ok, detail) => { results[name] = { ok: !!ok, ...(detail !== undefined ? { detail } : {}) }; };

try {
  await page.goto(base, { waitUntil: "load" });
  await wait(3000);

  // 1. ようこそ
  const firstShown = await page.$eval("#welcomeBox", el => !el.hidden);
  await page.click("#welcomeCloseBtn");
  const closed = await page.$eval("#welcomeBox", el => el.hidden);
  await page.evaluate(() => { document.getElementById("emergencyPanel").open = true; document.getElementById("emergencyWelcomeBtn").click(); });
  const replayed = await page.$eval("#welcomeBox", el => !el.hidden);
  await page.evaluate(() => document.getElementById("welcomeCloseBtn").click());
  check("welcome", firstShown && closed && replayed, { firstShown, closed, replayed });

  // 2. trk Agent's OST Vol.1（音源があるときだけ）
  const manifestPath = path.join(ROOT, "assets/trk-ost/manifest.json");
  const agentOstEnabled = /const AGENT_OST_MANIFEST_INCLUDED\s*=\s*true/.test(fs.readFileSync(path.join(ROOT, "js/library.js"), "utf8"));
  if (agentOstEnabled && fs.existsSync(manifestPath)) {
    const playlists = await page.evaluate(() => (window.Trk.core.settings.playlists || []).map(p => ({ id: p.id, name: p.name, songs: p.songs.length })));
    const pl = playlists.find(p => p.id === "trk-agent-ost-v1");
    const songs = await page.evaluate(() => window.Trk.library.allSongs().filter(s => s.key.startsWith("builtin:trk-agent-ost:")).length);
    const sel = await page.evaluate(async () => {
      const s = window.Trk.library.allSongs().find(x => x.key === "builtin:trk-agent-ost:02");
      try { await window.Trk.library.selectSong(s); return null; } catch (e) { return String(e && e.message || e); }
    });
    await wait(4000);
    const status = await page.evaluate(() => (document.getElementById("loadStatus") || {}).textContent || "");
    check("agentOst", !!pl && pl.songs === 10 && songs === 10 && !sel && /analy|解析|Ready/i.test(status), { playlist: pl, songs, selectError: sel, status });
  } else {
    const ok = !agentOstEnabled;
    results.agentOst = { ok, skipped: ok ? "既定ビルドは AGENT_OST_MANIFEST_INCLUDED=false（任意資産を要求しない）" : "AGENT_OST_MANIFEST_INCLUDED=true ですが assets/trk-ost/manifest.json がありません" };
  }

  // 3. 書斎：CBZ と ZIP の取り込み
  const input = await page.$("#studyArchiveInput");
  await input.uploadFile(cbz, zip);
  await wait(5000);
  const db = await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open("trk_study_room_v1");
    req.onerror = () => reject(String(req.error));
    req.onsuccess = () => {
      const d = req.result, tx = d.transaction(["books", "pages"], "readonly");
      const books = tx.objectStore("books").getAll(), pages = tx.objectStore("pages").count();
      tx.oncomplete = () => { d.close(); resolve({ books: books.result.length, pages: pages.result }); };
      tx.onerror = () => reject(String(tx.error));
    };
  }));
  check("studyArchives", db.books === 2 && db.pages === 5, db);

  // 4. CATCH の設定
  const catchOpt = await page.evaluate(() => !!document.getElementById("catchBlastNext"));
  check("catchOption", catchOpt);

  // 5. エラー
  check("noErrors", errors.length === 0, errors.slice(0, 10));
} catch (error) {
  results.crash = { ok: false, detail: String(error && error.message || error) };
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
const failed = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k);
console.log(JSON.stringify(results, null, 1));
console.log(failed.length ? `NG：${failed.join(", ")}` : "OK：trk149 の確認はすべて通りました");
process.exit(failed.length ? 1 : 0);
