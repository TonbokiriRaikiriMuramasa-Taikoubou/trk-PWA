#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Dependency-free smoke checks for the procedural MMD motion definitions.
 * Evaluates the pure VMD/SJIS/motion-data block from js/mmd.js and inspects
 * the bundled Lat-style PMD's bone/morph names. This is not device rendering.
 */
import fs from "node:fs";
import { restoreCoreAlias, sourceOf } from "./lib/js-source.mjs";
import path from "node:path";
import vm from "node:vm";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = restoreCoreAlias(fs.readFileSync(path.join(root, "js/mmd.js"), "utf8"));
const start = source.indexOf("const SJIS = {");
const end = source.indexOf("\n/* ============ 💠 同梱プリセットモデル", start);
if (start < 0 || end < 0) throw new Error("Could not locate the pure VMD/motion definitions in js/mmd.js");

const context = vm.createContext({ ArrayBuffer, DataView, Uint8Array, Math });
vm.runInContext(
  `${source.slice(start, end)}\nthis.__mmdCheck = { SJIS, BUILTIN, FACE_MORPHS, MOTION_GROUPS, MOTION_MENU_IDS, MOTION_MENU_SET, builtinBytes, sjisFix, FPS };`,
  context,
  { filename: "js/mmd.js#motion-data", timeout: 10000 }
);
const data = context.__mmdCheck;
const fail = message => { throw new Error(message); };
const decoder = new TextDecoder("shift_jis");
const ids = Object.keys(data.BUILTIN);
if (Object.getPrototypeOf(data.BUILTIN) !== null || ["constructor", "__proto__", "prototype", "toString"].some(id => data.BUILTIN[id] !== undefined)) {
  fail("MMD builtin motion lookup must not expose inherited object properties");
}
const expectedMotionCount = 65;
const required = ["walk112", "run152", "sit10", "dance128", "dreamy128", "melt170", "wedh174", "faceSmile", "faceWink", "faceSing", "songMic", "songLong", "songUp", "songHum", "songWhisper", "songCall", "mikuPrincess152", "mikuLeek120", "mikuPopipo150", "mikuNyan160"];
const retained = ["step", "swing", "turn", "jump", "idol", "stroll", "dune135", "kyukura165", "tyw150", "rolling194", "vanish240"];

if (ids.length !== expectedMotionCount) fail(`Expected ${expectedMotionCount} built-in motions, found ${ids.length}`);
if (data.MOTION_MENU_IDS.length !== expectedMotionCount || new Set(data.MOTION_MENU_IDS).size !== expectedMotionCount) {
  fail(`Expected ${expectedMotionCount} unique visible motions, found ${data.MOTION_MENU_IDS.length}`);
}
const groupedIds = data.MOTION_GROUPS.flatMap(group => group.ids);
if (JSON.stringify(groupedIds) !== JSON.stringify(data.MOTION_MENU_IDS)) fail("Grouped chooser order does not match the visible motion list");
if (new Set(groupedIds).size !== expectedMotionCount || ids.some(id => !data.MOTION_MENU_SET.has(id))) {
  fail("Every built-in motion must appear exactly once in the chooser groups");
}
for (const id of [...required, ...retained]) if (!data.BUILTIN[id]) fail(`Required/retained motion is missing: ${id}`);
for (const id of required) if (!data.MOTION_MENU_SET.has(id)) fail(`Required motion is not in the chooser: ${id}`);

function parsePmd(pmdPath) {
  const bytes = fs.readFileSync(pmdPath);
  if (bytes.subarray(0, 3).toString("ascii") !== "Pmd") fail("Bundled Lat-style model is not a PMD file");
  let at = 283;
  const need = n => { if (at + n > bytes.length) fail("Truncated bundled PMD while reading morph metadata"); };
  const readU16 = () => { need(2); const n = bytes.readUInt16LE(at); at += 2; return n; };
  const readU32 = () => { need(4); const n = bytes.readUInt32LE(at); at += 4; return n; };
  const readText = length => {
    need(length);
    const field = bytes.subarray(at, at + length); at += length;
    const zero = field.indexOf(0);
    return decoder.decode(zero < 0 ? field : field.subarray(0, zero));
  };
  const vertices = readU32(); at += vertices * 38; need(0);
  const indices = readU32(); at += indices * 2; need(0);
  const materials = readU32(); at += materials * 70; need(0);
  const boneCount = readU16(), bones = new Set();
  for (let i = 0; i < boneCount; i++) { bones.add(readText(20)); at += 19; need(0); }
  const ikCount = readU16();
  for (let i = 0; i < ikCount; i++) {
    need(11);
    const links = bytes.readUInt8(at + 4);
    at += 11 + links * 2;
    need(0);
  }
  const morphCount = readU16(), morphs = new Set();
  for (let i = 0; i < morphCount; i++) {
    const name = readText(20), count = readU32();
    need(1); at += 1;
    morphs.add(name);
    at += count * 16;
    need(0);
  }
  return { bones, morphs };
}

const preset = JSON.parse(fs.readFileSync(path.join(root, "assets/mmd/lat-miku/preset.json"), "utf8"));
const latPmd = parsePmd(path.join(root, "assets/mmd/lat-miku", preset.files.find(name => name.toLowerCase().endsWith(".pmd"))));
if (!latPmd.bones.size || !latPmd.morphs.size) fail("Could not read Lat-style PMD bone/morph metadata");
for (const name of data.FACE_MORPHS) {
  if (!latPmd.morphs.has(name)) fail(`Facial morph is not present in the bundled Lat-style PMD: ${name}`);
  if ([...name].some(ch => ch.charCodeAt(0) >= 0x80 && !data.SJIS[ch])) fail(`Unmapped CP932 character in morph name: ${name}`);
}

const faceMorphSet = new Set(data.FACE_MORPHS);
for (const id of ids) {
  const motion = data.BUILTIN[id];
  if (typeof motion.pose !== "function" || typeof motion.morphs !== "function" || !(motion.seconds > 0) || !Number.isFinite(motion.seconds)) {
    fail(`Invalid motion metadata or missing face-morph track: ${id}`);
  }
  const sampleTimes = [0, motion.seconds * 0.25, motion.seconds * 0.5, motion.seconds * 0.75, motion.seconds];
  for (const t of sampleTimes) {
    const pose = motion.pose(t);
    if (!pose || typeof pose !== "object" || !Object.keys(pose).length) fail(`Empty pose: ${id} at ${t}`);
    for (const [bone, value] of Object.entries(pose)) {
      if (!latPmd.bones.has(bone)) fail(`Bone is not present in the bundled Lat-style PMD (${id}): ${bone}`);
      if ([...bone].some(ch => ch.charCodeAt(0) >= 0x80 && !data.SJIS[ch])) fail(`Unmapped CP932 bone name in ${id}: ${bone}`);
      if (data.sjisFix(bone, 15).length !== 15) fail(`Invalid bone-name byte length in ${id}: ${bone}`);
      for (const [field, vector] of [["rot", value.rot], ["pos", value.pos || [0, 0, 0]]]) {
        if (!Array.isArray(vector) || vector.length !== 3 || vector.some(n => !Number.isFinite(n))) {
          fail(`Invalid ${field} vector in ${id}/${bone} at ${t}`);
        }
      }
    }
    const morphs = motion.morphs(t);
    if (JSON.stringify(Object.keys(morphs)) !== JSON.stringify(data.FACE_MORPHS)) fail(`Morph channels changed between frames: ${id}`);
    for (const [name, weight] of Object.entries(morphs)) {
      if (!faceMorphSet.has(name) || !Number.isFinite(weight) || weight < 0 || weight > 1) fail(`Invalid morph weight: ${id}/${name}=${weight}`);
    }
  }

  const bytes = Buffer.from(data.builtinBytes(id));
  if (bytes.length > 1024 * 1024) fail(`Generated VMD is unexpectedly large: ${id} (${bytes.length} bytes)`);
  const header = bytes.subarray(0, 30).toString("ascii").replace(/\0.*$/s, "");
  if (header !== "Vocaloid Motion Data 0002") fail(`Bad VMD header for ${id}`);
  const boneFrameCount = bytes.readUInt32LE(50);
  const morphCountOffset = 54 + boneFrameCount * 111;
  if (morphCountOffset + 4 > bytes.length) fail(`Truncated bone-frame section for ${id}`);
  const morphFrameCount = bytes.readUInt32LE(morphCountOffset);
  const expectedLast = Math.ceil(motion.seconds * data.FPS);
  const sampledTimes = Math.ceil(expectedLast / 3) + 1;
  if (morphFrameCount !== sampledTimes * data.FACE_MORPHS.length) fail(`Incomplete morph tracks for ${id}`);
  if (bytes.length !== morphCountOffset + 4 + morphFrameCount * 23 + 16) fail(`Bad VMD byte length for ${id}`);
  if (!boneFrameCount) fail(`VMD has no bone frames: ${id}`);
  let lastBoneFrame = -1;
  for (let i = 0; i < boneFrameCount; i++) {
    const at = 54 + i * 111;
    const frame = bytes.readUInt32LE(at + 15);
    if (frame < lastBoneFrame) fail(`VMD bone frames are out of order: ${id}`);
    lastBoneFrame = frame;
    const bone = decoder.decode(bytes.subarray(at, at + 15)).replace(/\0.*$/s, "");
    if (!latPmd.bones.has(bone)) fail(`VMD contains an unknown Lat-style bone name (${id}): ${bone}`);
    for (const offset of [19, 23, 27, 31, 35, 39, 43]) {
      if (!Number.isFinite(bytes.readFloatLE(at + offset))) fail(`Non-finite VMD value: ${id}, frame ${i}`);
    }
  }
  if (lastBoneFrame !== expectedLast) fail(`VMD loop boundary sample missing: ${id}`);

  const morphSeen = new Map();
  let previousName = "", previousFrame = -1;
  for (let i = 0; i < morphFrameCount; i++) {
    const at = morphCountOffset + 4 + i * 23;
    const name = decoder.decode(bytes.subarray(at, at + 15)).replace(/\0.*$/s, "");
    const frame = bytes.readUInt32LE(at + 15), weight = bytes.readFloatLE(at + 19);
    if (!faceMorphSet.has(name) || !latPmd.morphs.has(name)) fail(`VMD contains an unknown Lat-style morph name (${id}): ${name}`);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) fail(`Invalid VMD morph weight: ${id}/${name}=${weight}`);
    if (name < previousName || (name === previousName && frame < previousFrame)) fail(`VMD morph frames are not grouped/sorted: ${id}`);
    if (frame > expectedLast) fail(`VMD morph frame exceeds loop boundary: ${id}/${name}`);
    morphSeen.set(name, (morphSeen.get(name) || 0) + 1);
    previousName = name; previousFrame = frame;
  }
  for (const name of data.FACE_MORPHS) {
    if (morphSeen.get(name) !== sampledTimes) fail(`Morph frame count mismatch: ${id}/${name}`);
  }
  for (let at = bytes.length - 16; at < bytes.length; at += 4) {
    if (bytes.readUInt32LE(at) !== 0) fail(`Non-zero camera/light/shadow/property count for ${id}`);
  }
}

if (data.sjisFix("笑い", 15).slice(0, 4).join(",") !== [0x8f, 0xce, 0x82, 0xa2].join(",")) {
  fail("Lat-style Japanese morph names do not encode as CP932");
}
const skirtFront = Array.from(data.sjisFix("右ｽｶｰﾄ前", 15)).slice(0, 8);
const skirtBack = Array.from(data.sjisFix("右ｽｶｰﾄ後", 15)).slice(0, 8);
const expectedFront = [0x89, 0x45, 0xbd, 0xb6, 0xb0, 0xc4, 0x91, 0x4f];
const expectedBack = [0x89, 0x45, 0xbd, 0xb6, 0xb0, 0xc4, 0x8c, 0xe3];
if (skirtFront.some((n, i) => n !== expectedFront[i]) || skirtBack.some((n, i) => n !== expectedBack[i])) {
  fail("Lat-style skirt bone names do not encode as CP932");
}

/* 🚶 歩行／🏃 走行：腕の前後振りが脚と逆相で出ているか、肘を前に折っているか、足ＩＫで足を持ち上げているか。
   2026-10 の「腕が横にしか動かない」の再発防止（前後は rot[0]、足はＩＫの position.y、肘は左＝+Y／右＝-Y） */
for (const { id, arm, lift, elbowAxis, elbowMin, elbowMirrored } of [
  { id: "walk112", arm: 25, lift: 0.5, elbowAxis: 0, elbowMin: 20, elbowMirrored: false },
  { id: "run152", arm: 40, lift: 0.8, elbowAxis: 0, elbowMin: 45, elbowMirrored: false }
]) {
  const motion = data.BUILTIN[id];
  if (!motion) fail(`Swing check needs the ${id} motion`);
  const samples = 24, armShots = [], armLegShots = [];
  let armMin = Infinity, armMax = -Infinity, diffMin = Infinity, diffMax = -Infinity, elbowMax = 0, liftL = 0, liftR = 0, bothUp = 0;
  for (let i = 0; i < samples; i++) {
    const pose = motion.pose(motion.seconds * i / samples);
    const left = pose["左腕"], right = pose["右腕"], leg = pose["左足"], elbowL = pose["左ひじ"], elbowR = pose["右ひじ"],
          ikL = pose["左足ＩＫ"], ikR = pose["右足ＩＫ"];
    if (!left || !right || !leg || !elbowL || !elbowR || !ikL || !ikR) fail(`${id}: the swing check needs 腕・ひじ・足・足ＩＫ in every frame`);
    const l = left.rot[0], r = right.rot[0];
    armMin = Math.min(armMin, l); armMax = Math.max(armMax, l);
    diffMin = Math.min(diffMin, l - r); diffMax = Math.max(diffMax, l - r);
    armShots.push(l); armLegShots.push(l * leg.rot[0]);
    elbowMax = Math.max(elbowMax, elbowL.rot[elbowAxis], elbowMirrored ? -elbowR.rot[elbowAxis] : elbowR.rot[elbowAxis]);
    liftL = Math.max(liftL, ikL.pos[1]); liftR = Math.max(liftR, ikR.pos[1]);
    if (ikL.pos[1] > lift * 0.3 && ikR.pos[1] > lift * 0.3) bothUp++;
  }
  if (armMax - armMin < arm * 2) fail(`${id}: the arms must swing fore/aft by ±${arm}° (found ${((armMax - armMin) / 2).toFixed(1)}°)`);
  if (diffMax - diffMin < arm * 2) fail(`${id}: the two arms must swing in opposite directions (found ${((diffMax - diffMin) / 2).toFixed(1)}°)`);
  if (armLegShots.some(v => v > 0.5)) fail(`${id}: the arm must swing opposite to the leg on the same side`);
  if (elbowMax < elbowMin) fail(`${id}: the elbow must fold forward by at least ${elbowMin}° (found ${elbowMax.toFixed(1)}°)`);
  if (liftL < lift || liftR < lift) fail(`${id}: each foot must lift by at least ${lift} (found ${liftL.toFixed(2)} / ${liftR.toFixed(2)})`);
  if (bothUp > 1) fail(`${id}: the feet must lift alternately, not together`);
}

const translatedKeys = [
  "mmdMotionWalk", "mmdMotionRun", "mmdMotionSit", "mmdMotionDance", "mmdMotionLegacy",
  "mmdGroupDaily", "mmdGroupDance", "mmdGroupSongs", "mmdGroupMiku", "mmdGroupFaces", "mmdGroupVoice",
  "mmdMotionFaceSmile", "mmdMotionFaceWink", "mmdMotionFaceShy", "mmdMotionFaceAngry", "mmdMotionFaceConfused",
  "mmdMotionFaceSurprise", "mmdMotionFaceSleepy", "mmdMotionFacePout", "mmdMotionFaceLaugh", "mmdMotionFaceSing",
  "mmdMotionPrincess", "mmdMotionLeekShake", "mmdMotionPopipo", "mmdMotionTriple", "mmdMotionNyan", "mmdMotionSalute",
  "mmdMotionDoubleHeart", "mmdMotionPoint", "mmdMotionEncore", "mmdMotionDramatic", "mmdMotionVictory", "mmdMotionPenlight",
  "mmdMotionChibi", "mmdMotionSpin", "mmdMotionGroove", "mmdMotionStepTouch", "mmdMotionShoulderPop", "mmdMotionArmWave",
  "mmdMotionCrossStep", "mmdMotionSoftBow", "mmdMotionMarionette",
  "mmdMotionSongMic", "mmdMotionSongLong", "mmdMotionSongUp", "mmdMotionSongHum", "mmdMotionSongWhisper", "mmdMotionSongCall"
];
for (const key of translatedKeys) {
  const count = (source.match(new RegExp(`\\b${key}:`, "g")) || []).length;
  if (count !== 4) fail(`${key} must have four translations (found ${count})`);
}
const core = restoreCoreAlias(fs.readFileSync(path.join(root, "js/core.js"), "utf8"));
if (preset.motion !== "faceSing" || preset.bpm !== 0) fail("Bundled Lat-style Miku preset must start with the BPM-free faceSing mouth loop");
if (!core.includes('prefs.mmdMotionKind : "faceSing"') || !core.includes('settings.mmdMotionKind = "faceSing"')) {
  fail("Missing-preference and reset defaults must use faceSing");
}
if (!source.includes('settings.mmdMotionKind === "none"') || !source.includes("visibleMotions: () => MOTION_MENU_IDS.slice()")) {
  fail("Saved no-motion choice or chooser API is not preserved/exposed");
}
if (!source.includes('walk112: { label:"mmdMotionWalk", bpm:112, auto:false') ||
    !source.includes('run152: { label:"mmdMotionRun", bpm:152, auto:false') ||
    !source.includes("m.auto === false")) {
  fail("Auto BPM selection should not choose generic walk/run motions");
}
if (!source.includes("for (const group of MOTION_GROUPS)") || !source.includes("g.label = tr(group.label)")) {
  fail("Grouped select/quick motion lists are not wired");
}

console.log(`MMD motion smoke check passed · ${ids.length} built-ins/choices · prototype-safe lookup · ${data.FACE_MORPHS.length} Lat morph tracks · VMD/CP932/poses + walk/run swing valid`);
