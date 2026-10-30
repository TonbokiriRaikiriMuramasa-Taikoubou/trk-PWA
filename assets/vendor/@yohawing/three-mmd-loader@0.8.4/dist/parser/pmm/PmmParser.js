export function parsePmmDocument(bytes, core) {
    const typed = core;
    if (typeof typed.parsePmmDocument !== "function") {
        throw new Error("PMM document parsing requires WASM core (use initCore())");
    }
    return typed.parsePmmDocument(bytes);
}
const asciiDecoder = new TextDecoder("ascii");
const shiftJisDecoder = new TextDecoder("shift-jis");
const pmmHeaderPrefix = "Polygon Movie maker ";
const defaultUserFileRoot = "UserFile";
const assetPathPattern = /([A-Za-z]:[\\/][^\0\r\n]*?\.(?:pmd|pmx|vmd|vac|x|wav|bmp|tga)|(?:UserFile|Model|Accessory|Motion|Wave|BackGround)[\\/][^\0\r\n]*?\.(?:pmd|pmx|vmd|vac|x|wav|bmp|tga))/gi;
export function parsePmmManifest(bytes) {
    const header = asciiDecoder.decode(bytes.subarray(0, Math.min(bytes.byteLength, 32)));
    if (!header.startsWith(pmmHeaderPrefix)) {
        throw new Error("PMM_HEADER_NOT_FOUND");
    }
    const version = header.slice(pmmHeaderPrefix.length).split("\0")[0]?.trim() ?? "";
    const references = extractPmmAssetReferences(bytes);
    return {
        signature: "Polygon Movie maker",
        version,
        byteLength: bytes.byteLength,
        assetReferences: references,
        modelPaths: pathsByKind(references, "model"),
        accessoryPaths: pathsByKind(references, "accessory"),
        motionPaths: pathsByKind(references, "motion"),
        audioPaths: pathsByKind(references, "audio"),
        imagePaths: pathsByKind(references, "image")
    };
}
export function createPmmScenePlan(manifest, options = {}) {
    const resolutions = manifest.assetReferences.map((reference) => resolvePmmAssetReference(reference, options));
    return {
        modelAssets: resolutions.filter((resolution) => resolution.reference.kind === "model"),
        accessoryAssets: resolutions.filter((resolution) => resolution.reference.kind === "accessory"),
        motionAssets: resolutions.filter((resolution) => resolution.reference.kind === "motion"),
        audioAssets: resolutions.filter((resolution) => resolution.reference.kind === "audio"),
        imageAssets: resolutions.filter((resolution) => resolution.reference.kind === "image"),
        missingAssets: resolutions.filter((resolution) => resolution.exists === false)
    };
}
export function createPmmStaticPreviewPlan(scenePlan) {
    const availableModels = scenePlan.modelAssets.filter(assetExists);
    const availableAccessories = scenePlan.accessoryAssets.filter(assetExists);
    const primaryModel = availableModels.find((asset) => !isLikelyDummyModel(asset.reference.fileName)) ??
        availableModels[0];
    const previewAssets = new Set([...availableModels, ...availableAccessories]);
    const allAssets = [
        ...scenePlan.modelAssets,
        ...scenePlan.accessoryAssets,
        ...scenePlan.motionAssets,
        ...scenePlan.audioAssets,
        ...scenePlan.imageAssets
    ];
    return {
        primaryModel,
        modelAssets: availableModels,
        accessoryAssets: availableAccessories,
        skippedAssets: allAssets.filter((asset) => !previewAssets.has(asset)),
        missingAssets: scenePlan.missingAssets
    };
}
export function resolvePmmAssetReference(reference, options = {}) {
    const userFileRoot = normalizeResolutionPath(options.userFileRoot ?? defaultUserFileRoot);
    const existingPaths = options.existingPaths
        ? new Set([...options.existingPaths].map((path) => normalizeResolutionPath(path).toLowerCase()))
        : undefined;
    const resolvedPath = resolvePmmAssetPath(reference.normalizedPath, userFileRoot);
    return {
        reference,
        resolvedPath,
        exists: existingPaths ? existingPaths.has(resolvedPath.toLowerCase()) : undefined
    };
}
export function resolvePmmAssetPath(path, userFileRoot = defaultUserFileRoot) {
    const normalizedPath = normalizeResolutionPath(path);
    const normalizedRoot = normalizeResolutionPath(userFileRoot).replace(/\/$/, "");
    const userFilePrefix = "userfile/";
    if (normalizedPath.toLowerCase().startsWith(userFilePrefix)) {
        return `${normalizedRoot}/${normalizedPath.slice(userFilePrefix.length)}`;
    }
    return normalizedPath;
}
function extractPmmAssetReferences(bytes) {
    const references = new Map();
    let chunkStart = 0;
    for (let index = 0; index <= bytes.byteLength; index++) {
        if (index < bytes.byteLength && bytes[index] !== 0) {
            continue;
        }
        if (index > chunkStart) {
            const text = shiftJisDecoder.decode(bytes.subarray(chunkStart, index));
            for (const match of text.matchAll(assetPathPattern)) {
                if (match.index === undefined) {
                    continue;
                }
                const rawPath = stripLeadingBinaryJunk(match[1] ?? "");
                if (!rawPath.includes("\\") && !rawPath.includes("/")) {
                    continue;
                }
                const normalizedPath = normalizePmmAssetPath(rawPath);
                const key = normalizedPath.toLowerCase();
                if (!references.has(key)) {
                    references.set(key, createAssetReference(rawPath, normalizedPath, chunkStart + match.index));
                }
            }
        }
        chunkStart = index + 1;
    }
    return [...references.values()].sort((left, right) => left.offset - right.offset);
}
function stripLeadingBinaryJunk(value) {
    return value.replace(/^[^A-Za-z0-9_ぁ-んァ-ヶ一-龠（）()]+/, "");
}
function normalizePmmAssetPath(value) {
    const normalized = value.replaceAll("\\", "/").replace(/\/+/g, "/");
    const userFileIndex = normalized.toLowerCase().lastIndexOf("userfile/");
    return userFileIndex >= 0 ? normalized.slice(userFileIndex) : normalized;
}
function normalizeResolutionPath(value) {
    return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}
function createAssetReference(path, normalizedPath, offset) {
    const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
    const extensionSeparatorIndex = fileName.lastIndexOf(".");
    const extension = extensionSeparatorIndex >= 0 ? fileName.slice(extensionSeparatorIndex + 1).toLowerCase() : "";
    return {
        path,
        normalizedPath,
        fileName,
        extension,
        kind: classifyAssetKind(extension),
        offset
    };
}
function classifyAssetKind(extension) {
    switch (extension) {
        case "pmd":
        case "pmx":
            return "model";
        case "x":
        case "vac":
            return "accessory";
        case "vmd":
            return "motion";
        case "wav":
            return "audio";
        case "bmp":
        case "tga":
            return "image";
        default:
            return "unknown";
    }
}
function pathsByKind(references, kind) {
    return references
        .filter((reference) => reference.kind === kind)
        .map((reference) => reference.normalizedPath);
}
function assetExists(asset) {
    return asset.exists !== false;
}
function isLikelyDummyModel(fileName) {
    return fileName.toLowerCase() === "dummy.pmd" || fileName === "ダミーボーン.pmd";
}
