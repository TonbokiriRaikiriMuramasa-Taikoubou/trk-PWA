import { BinaryReader, toUint8Array } from "../binary/index.js";
const asciiDecoder = new TextDecoder("ascii");
const shiftJisDecoder = new TextDecoder("shift-jis");
const pmdVertexBytes = 38;
const pmdMaterialBytes = 70;
const pmdBoneBytes = 39;
const pmdMorphVertexBytes = 16;
const pmdRigidBodyBytes = 83;
const pmdJointBytes = 124;
export function parsePmdMetadata(input) {
    return parsePmd(input).metadata;
}
export function parsePmdSectionInventory(input) {
    return parsePmd(input).inventory;
}
function parsePmd(input) {
    const reader = new BinaryReader(toUint8Array(input));
    const sections = [];
    const signature = asciiDecoder.decode(reader.bytes(3));
    if (signature !== "Pmd") {
        throw new Error(`Invalid PMD signature: ${JSON.stringify(signature)}`);
    }
    const version = reader.f32();
    const name = readFixedText(reader, 20);
    let englishName = "";
    const comment = readFixedText(reader, 256);
    let englishComment = "";
    const vertices = reader.u32();
    skipSection(reader, sections, "vertices", vertices, pmdVertexBytes, "vertex");
    const vertexIndices = reader.u32();
    const faces = readFaceCount(vertexIndices, "PMD vertex index");
    skipSection(reader, sections, "vertexIndices", vertexIndices, 2, "vertex index");
    const materials = reader.u32();
    skipSection(reader, sections, "materials", materials, pmdMaterialBytes, "material");
    const bones = reader.u16();
    skipSection(reader, sections, "bones", bones, pmdBoneBytes, "bone");
    const iks = reader.u16();
    const iksOffset = reader.offset;
    for (let i = 0; i < iks; i++) {
        reader.skip(4);
        const linkCount = reader.u8();
        reader.skip(6);
        reader.skip(checkedSectionBytes(linkCount, 2, "IK link"));
    }
    pushSectionRange(sections, "iks", iks, iksOffset, reader.offset - iksOffset);
    const morphs = reader.u16();
    const morphsOffset = reader.offset;
    for (let i = 0; i < morphs; i++) {
        reader.skip(20);
        const morphVertexCount = reader.u32();
        reader.skip(1);
        reader.skip(checkedSectionBytes(morphVertexCount, pmdMorphVertexBytes, "morph vertex"));
    }
    pushSectionRange(sections, "morphs", morphs, morphsOffset, reader.offset - morphsOffset);
    const displayFrameInfo = readOptionalDisplayFrames(reader, sections);
    const english = readOptionalEnglishBlock(reader, sections, bones, morphs, displayFrameInfo.boneDisplayNames);
    englishName = english.name;
    englishComment = english.comment;
    readOptionalToonTextures(reader, sections);
    const rigidBodies = readOptionalFixedSizeSectionCount(reader, sections, "rigidBodies", pmdRigidBodyBytes, "rigid body");
    const joints = readOptionalFixedSizeSectionCount(reader, sections, "joints", pmdJointBytes, "joint");
    const counts = {
        vertices,
        faces,
        materials,
        bones,
        iks,
        morphs,
        displayFrames: displayFrameInfo.totalDisplayFrames,
        rigidBodies,
        joints,
        softBodies: 0
    };
    const trailingBytes = reader.remaining;
    const header = {
        signature: "Pmd",
        version
    };
    return {
        metadata: {
            format: "pmd",
            header,
            encoding: "shift-jis",
            name,
            englishName,
            comment,
            englishComment,
            counts,
            trailingBytes
        },
        inventory: {
            format: "pmd",
            header,
            counts,
            sections,
            trailingBytes
        }
    };
}
function readOptionalDisplayFrames(reader, sections) {
    if (reader.remaining === 0) {
        return { totalDisplayFrames: 0, boneDisplayNames: 0 };
    }
    const morphDisplayFrames = reader.u8();
    skipSection(reader, sections, "morphDisplayFrames", morphDisplayFrames, 2, "morph display frame");
    if (reader.remaining === 0) {
        return { totalDisplayFrames: morphDisplayFrames, boneDisplayNames: 0 };
    }
    const boneDisplayNames = reader.u8();
    skipSection(reader, sections, "boneDisplayNames", boneDisplayNames, 50, "bone display name");
    if (reader.remaining === 0) {
        return {
            totalDisplayFrames: morphDisplayFrames + boneDisplayNames,
            boneDisplayNames
        };
    }
    const boneDisplayEntries = reader.u32();
    skipSection(reader, sections, "boneDisplayFrames", boneDisplayEntries, 3, "bone display frame");
    return {
        totalDisplayFrames: morphDisplayFrames + boneDisplayNames,
        boneDisplayNames
    };
}
function readOptionalEnglishBlock(reader, sections, boneCount, morphCount, boneDisplayNameCount) {
    if (reader.remaining === 0) {
        return { name: "", comment: "" };
    }
    const hasEnglish = reader.u8();
    if (hasEnglish === 0) {
        return { name: "", comment: "" };
    }
    if (hasEnglish !== 1) {
        throw new Error(`Invalid PMD English block flag: ${hasEnglish}`);
    }
    const metadataOffset = reader.offset;
    const name = readFixedText(reader, 20);
    const comment = readFixedText(reader, 256);
    sections.push({
        name: "englishMetadata",
        count: 1,
        offset: metadataOffset,
        byteLength: reader.offset - metadataOffset
    });
    skipSection(reader, sections, "englishBoneNames", boneCount, 20, "English bone name");
    skipSection(reader, sections, "englishMorphNames", Math.max(0, morphCount - 1), 20, "English morph name");
    skipSection(reader, sections, "englishBoneDisplayNames", boneDisplayNameCount, 50, "English bone display name");
    return { name, comment };
}
function readOptionalToonTextures(reader, sections) {
    if (reader.remaining === 0 || isPlausiblePmdPhysicsTail(reader)) {
        return;
    }
    if (reader.remaining < 1000) {
        throw new Error("Unexpected end of buffer in PMD toon texture block");
    }
    skipRawSection(reader, sections, "toonTextures", 10, 1000);
}
function readOptionalFixedSizeSectionCount(reader, sections, sectionName, entrySize, label) {
    if (reader.remaining === 0) {
        return 0;
    }
    const count = reader.u32();
    skipSection(reader, sections, sectionName, count, entrySize, label);
    return count;
}
function readFixedText(reader, byteLength) {
    const bytes = reader.bytes(byteLength);
    const end = bytes.indexOf(0);
    const slice = end >= 0 ? bytes.subarray(0, end) : bytes;
    return shiftJisDecoder.decode(slice).trim();
}
function checkedSectionBytes(count, entrySize, label) {
    const byteLength = count * entrySize;
    if (!Number.isSafeInteger(byteLength)) {
        throw new Error(`Invalid PMD ${label} byte length`);
    }
    return byteLength;
}
function readFaceCount(vertexIndexCount, label) {
    if (vertexIndexCount % 3 !== 0) {
        throw new Error(`${label} count must be divisible by 3: ${vertexIndexCount}`);
    }
    return vertexIndexCount / 3;
}
function skipSection(reader, sections, sectionName, count, entrySize, label) {
    skipRawSection(reader, sections, sectionName, count, checkedSectionBytes(count, entrySize, label));
}
function skipRawSection(reader, sections, sectionName, count, byteLength) {
    const offset = reader.offset;
    reader.skip(byteLength);
    pushSectionRange(sections, sectionName, count, offset, byteLength);
}
function pushSectionRange(sections, sectionName, count, offset, byteLength) {
    sections.push({
        name: sectionName,
        count,
        offset,
        byteLength
    });
}
function isPlausiblePmdPhysicsTail(reader) {
    const start = reader.offset;
    const rigidBodyCount = peekU32(reader, start);
    if (rigidBodyCount === undefined) {
        return false;
    }
    const rigidBodyBytes = checkedSectionBytes(rigidBodyCount, pmdRigidBodyBytes, "rigid body");
    const jointCountOffset = start + 4 + rigidBodyBytes;
    if (jointCountOffset === reader.view.byteLength) {
        return true;
    }
    const jointCount = peekU32(reader, jointCountOffset);
    if (jointCount === undefined) {
        return false;
    }
    const jointBytes = checkedSectionBytes(jointCount, pmdJointBytes, "joint");
    return jointCountOffset + 4 + jointBytes === reader.view.byteLength;
}
function peekU32(reader, offset) {
    if (offset < 0 || offset + 4 > reader.view.byteLength) {
        return undefined;
    }
    return reader.view.getUint32(offset, true);
}
