#!/usr/bin/env node
/* 🎵 OST の WAV → MP3 変換（lamejs）。依存はわざとリポジトリの外に置く。
   準備: npm install --prefix /tmp/mp3enc lamejs
   使いかた: node tools/encode-ost-mp3.mjs <in.wav> <out.mp3> [kbps] [--lamejs path/to/lame.min.js]
   入力は make-trk-song.mjs の出す 22050Hz・モノラル・16bit の WAV。
   lamejs の package main は新しい Node で動かないことがある（MPEGMode 未定義）ため、
   ビルド済みの lame.min.js を直接読む。 */
import fs from "node:fs";
import path from "node:path";

const fail = (msg) => { console.error(`encode-ost-mp3: ${msg}`); process.exit(1); };

const args = process.argv.slice(2).filter((a) => a !== "--force");
const force = process.argv.includes("--force");
const lameIdx = args.indexOf("--lamejs");
let lamePath = process.env.LAMEJS_MIN || "/tmp/mp3enc/node_modules/lamejs/lame.min.js";
if (lameIdx >= 0) { lamePath = args[lameIdx + 1]; args.splice(lameIdx, 2); }
const [inWav, outMp3, kbpsRaw] = args;
if (!inWav || !outMp3) fail("usage: node tools/encode-ost-mp3.mjs <in.wav> <out.mp3> [kbps]");
const kbps = Number(kbpsRaw || 128);
if (![64, 96, 128, 160, 192].includes(kbps)) fail(`kbps must be one of 64/96/128/160/192 (got ${kbpsRaw})`);
if (fs.existsSync(outMp3) && !force) fail(`exists (refusing to overwrite; pass --force): ${outMp3}`);
if (!fs.existsSync(lamePath)) fail(`lamejs not found at ${lamePath} (run: npm install --prefix /tmp/mp3enc lamejs)`);

const wav = fs.readFileSync(inWav);
if (wav.subarray(0, 4).toString() !== "RIFF" || wav.subarray(8, 12).toString() !== "WAVE") fail("not a WAV file");
if (wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 || wav.readUInt32LE(24) !== 22050 || wav.readUInt16LE(34) !== 16) {
  fail("want 22050 Hz mono 16-bit PCM (what make-trk-song.mjs writes)");
}
const n = wav.readUInt32LE(40) / 2;
const pcm = new Int16Array(n);
for (let i = 0; i < n; i++) pcm[i] = wav.readInt16LE(44 + i * 2);

const lameSrc = fs.readFileSync(lamePath, "utf8");
const lame = new Function(`${lameSrc};return lamejs;`)();   /* min.js は輸出しないので関数名で掴む */
if (!lame || typeof lame.Mp3Encoder !== "function") fail(`could not load Mp3Encoder from ${lamePath}`);
const enc = new lame.Mp3Encoder(1, 22050, kbps);
const parts = [];
for (let i = 0; i < n; i += 1152) {
  const chunk = enc.encodeBuffer(pcm.subarray(i, i + 1152));
  if (chunk.length) parts.push(Buffer.from(chunk));
}
const tail = enc.flush();
if (tail.length) parts.push(Buffer.from(tail));
const mp3 = Buffer.concat(parts);
if (mp3.length < 1024 || mp3[0] !== 0xff || (mp3[1] & 0xe0) !== 0xe0) fail("encoder produced no MP3 frames");
fs.mkdirSync(path.dirname(outMp3), { recursive: true });
fs.writeFileSync(outMp3, mp3);
console.log(JSON.stringify({ mp3: outMp3, bytes: mp3.length, kbps, seconds: Math.round((n / 22050) * 10) / 10 }));
