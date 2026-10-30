import { toUint8Array } from "../binary/index.js";
const signature = "Vocaloid Pose Data file";
const shiftJisDecoder = new TextDecoder("shift-jis");
export function parseVpdMetadata(input) {
    const inventory = parseVpdPoseInventory(input);
    if (inventory.boneCountMismatch !== null) {
        throw new Error(`VPD bone count mismatch: declared ${inventory.boneCountMismatch.declared}, parsed ${inventory.boneCountMismatch.parsed}`);
    }
    return {
        format: "vpd",
        signature,
        encoding: "shift-jis",
        modelFile: inventory.modelFile,
        boneCount: inventory.parsedBoneCount,
        trailingCharacters: inventory.trailingCharacters
    };
}
export function parseVpdPoseInventory(input) {
    const text = shiftJisDecoder.decode(toUint8Array(input));
    const header = readVpdHeader(text);
    const boneBlocks = readBoneBlockInventories(text, header.poseTextOffset);
    const parsedBoneCount = boneBlocks.length;
    const boneCountMismatch = header.declaredBoneCount === parsedBoneCount
        ? null
        : {
            declared: header.declaredBoneCount,
            parsed: parsedBoneCount
        };
    return {
        format: "vpd",
        signature,
        encoding: "shift-jis",
        modelFile: header.modelFile,
        declaredBoneCount: header.declaredBoneCount,
        parsedBoneCount,
        boneCountMismatch,
        boneBlocks,
        poseTextOffset: header.poseTextOffset,
        trailingCharacters: text.length - header.poseTextOffset
    };
}
export function parseVpdPose(input) {
    const text = shiftJisDecoder.decode(toUint8Array(input));
    const header = readVpdHeader(text);
    return {
        format: "vpd",
        signature,
        encoding: "shift-jis",
        modelFile: header.modelFile,
        bonePoses: readBonePoses(text, header.poseTextOffset)
    };
}
function readVpdHeader(text) {
    if (!text.startsWith(signature)) {
        throw new Error("Invalid VPD signature");
    }
    const modelStatement = readStatement(text, signature.length, "model file");
    const countStatement = readStatement(text, modelStatement.nextIndex, "bone count");
    const countText = countStatement.value.trim();
    if (!/^\d+$/.test(countText)) {
        throw new Error(`Invalid VPD bone count: ${countText}`);
    }
    const declaredBoneCount = Number(countText);
    if (!Number.isSafeInteger(declaredBoneCount)) {
        throw new Error(`Invalid VPD bone count: ${countText}`);
    }
    return {
        modelFile: modelStatement.value.trim(),
        declaredBoneCount,
        poseTextOffset: countStatement.nextIndex
    };
}
function readStatement(text, startIndex, label) {
    let index = consumeStatementPrefix(text, startIndex);
    let value = "";
    while (index < text.length) {
        if (text[index] === ";") {
            return { value, nextIndex: index + 1 };
        }
        value += text[index] ?? "";
        index += 1;
    }
    throw new Error(`Missing VPD ${label} statement terminator`);
}
function consumeStatementPrefix(text, startIndex) {
    let index = startIndex;
    while (index < text.length) {
        index = consumeWhitespace(text, index);
        if (text[index] !== "/" || text[index + 1] !== "/") {
            return index;
        }
        index = consumeLine(text, index);
    }
    return index;
}
function consumeWhitespace(text, startIndex) {
    let index = startIndex;
    while (index < text.length &&
        (text[index] === " " || text[index] === "\t" || text[index] === "\r" || text[index] === "\n")) {
        index += 1;
    }
    return index;
}
function consumeLine(text, startIndex) {
    let index = startIndex;
    while (index < text.length) {
        const char = text[index];
        index += 1;
        if (char === "\n") {
            break;
        }
    }
    return index;
}
function readBoneBlockInventories(text, startIndex) {
    const blockPattern = /Bone(\d+)\s*\{\s*([^\r\n]+)\s*\r?\n\s*(?:(?:\/\/)[^\r\n]*\r?\n\s*)?[^;]+;\s*(?:\/\/[^\r\n]*)?\r?\n\s*(?:(?:\/\/)[^\r\n]*\r?\n\s*)?[^;]+;\s*(?:\/\/[^\r\n]*)?\r?\n\s*\}/g;
    blockPattern.lastIndex = startIndex;
    const boneBlocks = [];
    for (const match of text.matchAll(blockPattern)) {
        if (match.index === undefined) {
            continue;
        }
        const blockIndexText = match[1] ?? "";
        const blockIndex = Number(blockIndexText);
        if (!Number.isSafeInteger(blockIndex)) {
            continue;
        }
        const offset = match.index;
        const textLength = match[0].length;
        boneBlocks.push({
            blockIndex,
            boneName: (match[2] ?? "").trim(),
            offset,
            textLength,
            range: {
                start: offset,
                end: offset + textLength
            }
        });
    }
    return boneBlocks;
}
function readBonePoses(text, startIndex) {
    const blockPattern = /Bone\d+\s*\{\s*([^\r\n]+)\s*\r?\n\s*(?:(?:\/\/)[^\r\n]*\r?\n\s*)?([^;]*);\s*(?:\/\/[^\r\n]*)?\r?\n\s*(?:(?:\/\/)[^\r\n]*\r?\n\s*)?([^;]*);\s*(?:\/\/[^\r\n]*)?\r?\n\s*\}/g;
    blockPattern.lastIndex = startIndex;
    const bonePoses = [];
    const blockRanges = [];
    for (const match of text.matchAll(blockPattern)) {
        const offset = match.index ?? 0;
        blockRanges.push({ start: offset, end: offset + match[0].length });
        bonePoses.push({
            boneName: (match[1] ?? "").trim(),
            translation: parseTuple(match[2] ?? "", 3),
            rotation: parseTuple(match[3] ?? "", 4)
        });
    }
    const blockStartPattern = /Bone\d+\s*\{/g;
    blockStartPattern.lastIndex = startIndex;
    for (const match of text.matchAll(blockStartPattern)) {
        const offset = match.index ?? 0;
        if (!blockRanges.some((range) => offset >= range.start && offset < range.end)) {
            throw new Error("Invalid VPD bone block");
        }
    }
    return bonePoses;
}
function parseTuple(value, length) {
    const fields = value.split(",").map((item) => item.trim());
    const values = fields.map((item) => Number(item));
    if (values.length !== length || values.some((item) => !Number.isFinite(item))) {
        throw new Error(`Invalid VPD numeric tuple: ${value.trim()}`);
    }
    if (fields.some((item) => item.length === 0)) {
        throw new Error(`Invalid VPD numeric tuple: ${value.trim()}`);
    }
    return values;
}
