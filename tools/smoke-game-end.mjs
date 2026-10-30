#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* 実ブラウザで「曲の最後まで → リザルト画面」を通す検査（trk97 の回帰用）。npm run check には入れない（ブラウザが要るため）。
 *
 *   SMOKE_CHROME=/path/to/chromium [SMOKE_CHROME_ARGS='["--no-sandbox", …]'] \
 *   SMOKE_PUPPETEER=puppeteer-core \
 *   node tools/smoke-game-end.mjs
 *
 * 20秒の合成音声を読み込み、MANUAL と AUTO の両方で最後まで流す。
 * 合格条件：endScreen が見えて結果の本文が入り、pageerror が 0 件。
 * 以前は endGame の ReferenceError で phase だけ ended になり、結果が空のままだった。 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spec = process.env.SMOKE_PUPPETEER || "puppeteer-core";
const puppeteer = (await import(path.isAbsolute(spec) ? pathToFileURL(spec).href : spec)).default;
const CHROME = process.env.SMOKE_CHROME;
if (!CHROME) { console.error("SMOKE_CHROME にブラウザの実行ファイルを指定してください"); process.exit(2); }
const ARGS = process.env.SMOKE_CHROME_ARGS ? JSON.parse(process.env.SMOKE_CHROME_ARGS) : ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"];

/* 20秒の合成WAV（モノラル22050Hz・16bit） */
function makeWav(seconds = 20) {
  const SR = 22050, n = SR * seconds, pcm = new Int16Array(n), beat = 0.5;
  let s = 99991; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < n; i++) {
    const t = i / SR, bt = t % beat, a = t < 2 ? 0.05 : 0.5;
    const kick = bt < 0.25 ? Math.sin(2 * Math.PI * (120 * Math.exp(-bt * 25)) * bt) * Math.exp(-bt * 18) : 0;
    const hat = (t % (beat / 2)) < 0.02 ? (rnd() * 2 - 1) * 0.25 : 0;
    pcm[i] = Math.max(-32767, Math.min(32767, Math.round(a * (kick * 0.9 + hat) * 32767)));
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length * 2, 4); hdr.write("WAVE", 8);
  hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(pcm.length * 2, 40);
  return Buffer.concat([hdr, Buffer.from(pcm.buffer)]);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const wavPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "trk-end-")), "song20.wav");
fs.writeFileSync(wavPath, makeWav());

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS, defaultViewport: { width: 1000, height: 800 } });
const failures = [];
try {
  for (const mode of ["manual", "auto"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror " + e.message));
    await page.goto(base, { waitUntil: "load" });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(m => {
      const p = JSON.parse(localStorage.getItem("shadow_taiko_preferences_v2") || "{}");
      p.autoPlay = m === "auto"; p.playMode = "manual"; p.countdown = false; p.playerMode = false; p.welcomeSeen = true;   /* 初回案内が #playBtn のクリックを受け止めないように */
      localStorage.setItem("shadow_taiko_preferences_v2", JSON.stringify(p));
    }, mode);
    await page.reload({ waitUntil: "load" });
    await new Promise(r => setTimeout(r, 1500));
    await (await page.$("#mediaFile")).uploadFile(wavPath);
    await page.waitForFunction(() => { const b = document.getElementById("playBtn"); return b && !b.disabled; }, { timeout: 60000 });
    await page.click("#playBtn");
    const reached = await page.waitForFunction(() => {
      const e = document.getElementById("endScreen");
      return e && !e.hidden && document.getElementById("result").innerHTML.length > 0;
    }, { timeout: 60000, polling: 250 }).then(() => true, () => false);
    if (!reached) failures.push(`${mode}: 結果画面が出ない（phase=${await page.evaluate(() => window.Trk.core.phase).catch(() => "?")}）`);
    if (errors.length) failures.push(`${mode}: ${errors.join(" / ")}`);
    console.log(`${mode}: ${reached ? "OK（結果画面が出た）" : "NG"}${errors.length ? "・エラー " + errors.length : "・エラー 0"}`);
    await page.close().catch(() => {});
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error("FAIL\n" + failures.join("\n")); process.exit(1); }
console.log("PASS: MANUAL・AUTO とも曲の最後で結果画面が出た");
