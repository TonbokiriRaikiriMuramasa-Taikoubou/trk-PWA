import * as THREE from "three";
const bundledSharedToonTextureUrls = {
    "toon01.bmp": new URL("./assets/mmd/toon01.bmp", import.meta.url),
    "toon02.bmp": new URL("./assets/mmd/toon02.bmp", import.meta.url),
    "toon03.bmp": new URL("./assets/mmd/toon03.bmp", import.meta.url),
    "toon04.bmp": new URL("./assets/mmd/toon04.bmp", import.meta.url),
    "toon05.bmp": new URL("./assets/mmd/toon05.bmp", import.meta.url),
    "toon06.bmp": new URL("./assets/mmd/toon06.bmp", import.meta.url),
    "toon07.bmp": new URL("./assets/mmd/toon07.bmp", import.meta.url),
    "toon08.bmp": new URL("./assets/mmd/toon08.bmp", import.meta.url),
    "toon09.bmp": new URL("./assets/mmd/toon09.bmp", import.meta.url),
    "toon10.bmp": new URL("./assets/mmd/toon10.bmp", import.meta.url)
};
let defaultToonGradientMap;
const blobTextureCacheKeys = new WeakMap();
const blobTgaTextureCache = new WeakMap();
let nextBlobTextureCacheKey = 1;
function createAlphaStats() {
    return {
        minAlpha: 255,
        maxAlpha: 0,
        middleAlphaTotal: 0,
        middleAlphaCount: 0,
        solidAlphaCount: 0,
        sampleCount: 0
    };
}
function recordAlphaSample(stats, alpha) {
    if (!Number.isFinite(alpha)) {
        return;
    }
    const value = alpha;
    stats.sampleCount += 1;
    stats.minAlpha = Math.min(stats.minAlpha, value);
    stats.maxAlpha = Math.max(stats.maxAlpha, value);
    if (value > 0 && value < 255) {
        stats.middleAlphaTotal += value;
        stats.middleAlphaCount += 1;
    }
    if (value >= SOLID_ALPHA_MIN) {
        stats.solidAlphaCount += 1;
    }
}
// T070-20 soft-alpha-dominance thresholds.
// SOLID_ALPHA_MIN: alpha value at/above which a sample is considered "solid"
// (fully or near-fully opaque) rather than a soft/AA edge value.
const SOLID_ALPHA_MIN = 250;
// SOFT_DOMINANCE_RATIO: among visible pixels (middle + solid, excluding alpha=0),
// the fraction that must be "middle" for the texture to be treated as a soft
// overlay rather than a hard cutout with AA edges.
const SOFT_DOMINANCE_RATIO = 0.75;
// SOFT_OCCUPANCY_MIN: the middle-alpha population must also cover at least this
// fraction of ALL samples (including alpha=0) so that a handful of stray
// mid-range texels near a huge alpha=0 field can't trigger promotion.
const SOFT_OCCUPANCY_MIN = 0.005;
function evaluateAlphaStats(stats, options) {
    const alphaThreshold = options.alphaThreshold ?? 195;
    const alphaBlendThreshold = options.alphaBlendThreshold ?? 100;
    const averageMiddleAlpha = stats.middleAlphaCount > 0 ? stats.middleAlphaTotal / stats.middleAlphaCount : 0;
    if (stats.sampleCount === 0 || stats.minAlpha >= alphaThreshold) {
        return "opaque";
    }
    if (stats.middleAlphaCount / stats.sampleCount >= 0.25) {
        return "alphaBlend";
    }
    // Soft-alpha-dominance promotion (T070-20): cutouts have solid-dominated
    // visible pixels with only anti-aliased edges falling in the middle range;
    // soft overlays (e.g. cheek blush) have middle-dominated visible pixels with
    // near-zero solid population. Alpha=0 samples are excluded from the
    // dominance ratio's denominator so transparent atlas padding cannot inflate
    // it into a false promotion (preserves the existing atlas-padding contract).
    if (stats.middleAlphaCount > 0 &&
        stats.middleAlphaCount / (stats.middleAlphaCount + stats.solidAlphaCount) >=
            SOFT_DOMINANCE_RATIO &&
        stats.middleAlphaCount / stats.sampleCount >= SOFT_OCCUPANCY_MIN) {
        return "alphaBlend";
    }
    return averageMiddleAlpha + alphaBlendThreshold < stats.maxAlpha ? "alphaTest" : "alphaBlend";
}
export function evaluateMmdTextureAlphaSamples(alphaSamples, options = {}) {
    const stats = createAlphaStats();
    for (let index = 0; index < alphaSamples.length; index += 1) {
        recordAlphaSample(stats, alphaSamples[index]);
    }
    return evaluateAlphaStats(stats, options);
}
export function evaluateMmdTextureTransparencySamples(alphaSamples, options = {}) {
    const stats = createAlphaStats();
    for (let index = 0; index < alphaSamples.length; index += 1) {
        const alpha = alphaSamples[index];
        if (!Number.isFinite(alpha)) {
            continue;
        }
        recordAlphaSample(stats, 255 - alpha);
    }
    return evaluateAlphaStats(stats, options);
}
export function evaluateMmdTextureAlphaRgba(rgbaPixels, options = {}) {
    const stats = createAlphaStats();
    for (let index = 3; index < rgbaPixels.length; index += 4) {
        recordAlphaSample(stats, rgbaPixels[index]);
    }
    return evaluateAlphaStats(stats, options);
}
export function evaluateMmdBmpTextureAlpha(bytes, options = {}) {
    const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    if (data.length < 54 || data[0] !== 0x42 || data[1] !== 0x4d) {
        return undefined;
    }
    const view = bytes instanceof ArrayBuffer ? new DataView(bytes) : new DataView(Uint8Array.from(data).buffer);
    const pixelOffset = view.getUint32(10, true);
    const dibHeaderSize = view.getUint32(14, true);
    const width = view.getInt32(18, true);
    const height = view.getInt32(22, true);
    const planes = view.getUint16(26, true);
    const bitsPerPixel = view.getUint16(28, true);
    const compression = view.getUint32(30, true);
    const imageSize = view.getUint32(34, true);
    const absoluteHeight = Math.abs(height);
    if (dibHeaderSize < 40 ||
        width <= 0 ||
        absoluteHeight <= 0 ||
        planes !== 1 ||
        (compression !== 0 &&
            compression !== 1 &&
            compression !== 2 &&
            compression !== 3 &&
            compression !== 6)) {
        return undefined;
    }
    if ((compression === 1 && bitsPerPixel === 8) || (compression === 2 && bitsPerPixel === 4)) {
        if (pixelOffset >= data.length || (imageSize > 0 && pixelOffset + imageSize > data.length)) {
            return undefined;
        }
        return "opaque";
    }
    if (bitsPerPixel === 1 ||
        bitsPerPixel === 4 ||
        bitsPerPixel === 8 ||
        bitsPerPixel === 16 ||
        bitsPerPixel === 24) {
        if (compression !== 0) {
            if (bitsPerPixel === 16 && (compression === 3 || compression === 6)) {
                return evaluateBmp16BitfieldAlpha(view, data.length, pixelOffset, width, absoluteHeight, options);
            }
            return undefined;
        }
        const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
        return pixelOffset + rowSize * absoluteHeight <= data.length ? "opaque" : undefined;
    }
    if (bitsPerPixel !== 32 || pixelOffset >= data.length) {
        return undefined;
    }
    const pixelCount = width * absoluteHeight;
    if (pixelOffset + pixelCount * 4 > data.length) {
        return undefined;
    }
    const stats = createAlphaStats();
    if (compression === 3 || compression === 6) {
        const alphaMask = readBmpBitfieldAlphaMask(view, dibHeaderSize, pixelOffset);
        if (alphaMask === undefined) {
            return undefined;
        }
        if (alphaMask === 0) {
            return "opaque";
        }
        const alphaShift = trailingZeroBits(alphaMask);
        const alphaMax = alphaMask >>> alphaShift;
        for (let index = 0; index < pixelCount; index += 1) {
            const value = view.getUint32(pixelOffset + index * 4, true);
            recordAlphaSample(stats, Math.round((((value & alphaMask) >>> alphaShift) / alphaMax) * 255));
        }
    }
    else {
        for (let index = 0; index < pixelCount; index += 1) {
            recordAlphaSample(stats, data[pixelOffset + index * 4 + 3] ?? 255);
        }
    }
    return evaluateAlphaStats(stats, options);
}
export function injectMmdBmp32BitAlphaHeader(bytes) {
    const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : Uint8Array.from(bytes);
    if (data.length < 54 || data[0] !== 0x42 || data[1] !== 0x4d) {
        return undefined;
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const dibHeaderSize = view.getUint32(14, true);
    const pixelOffset = view.getUint32(10, true);
    const bitsPerPixel = view.getUint16(28, true);
    const compression = view.getUint32(30, true);
    if (dibHeaderSize !== 40 ||
        bitsPerPixel !== 32 ||
        compression !== 0 ||
        pixelOffset < 54 ||
        pixelOffset >= data.length) {
        return undefined;
    }
    const injected = new Uint8Array(data.length + bmpV4HeaderExtension.length);
    injected.set(data.subarray(0, 54), 0);
    injected.set(bmpV4HeaderExtension, 54);
    injected.set(data.subarray(54), 54 + bmpV4HeaderExtension.length);
    const injectedView = new DataView(injected.buffer);
    injectedView.setUint32(2, injected.length, true);
    injectedView.setUint32(10, pixelOffset + bmpV4HeaderExtension.length, true);
    injectedView.setUint32(14, 40 + bmpV4HeaderExtension.length, true);
    injectedView.setUint32(30, 3, true);
    return injected;
}
export function evaluateMmdTextureAlphaTexture(texture, options = {}) {
    const metadataAlphaMode = texture.userData.mmdTextureAlphaMode;
    if (metadataAlphaMode) {
        return metadataAlphaMode;
    }
    const image = texture.image;
    const data = image?.data;
    if (!data || data.length === 0) {
        return evaluateMmdTextureAlphaCanvasImage(image, options);
    }
    const pixelCount = Number.isFinite(image?.width) && Number.isFinite(image?.height)
        ? Math.max(0, Number(image?.width) * Number(image?.height))
        : Math.floor(data.length / 4);
    if (pixelCount <= 0 || data.length < pixelCount * 4) {
        return evaluateMmdTextureAlphaCanvasImage(image, options);
    }
    return evaluateMmdTextureAlphaRgba(data, options);
}
export function evaluateMmdTextureAlphaGeometry(texture, geometry, materialIndex, options = {}) {
    const metadataAlphaMode = texture.userData.mmdTextureAlphaMode;
    if (metadataAlphaMode) {
        return metadataAlphaMode;
    }
    const image = texture.image;
    const rgba = readableRgbaTextureData(image);
    if (!rgba || !hasAnyReadableAlpha(rgba.data, rgba.width, rgba.height)) {
        return undefined;
    }
    const uvAttribute = geometry.getAttribute("uv");
    if (!uvAttribute) {
        return undefined;
    }
    const groups = geometry.groups.filter((group) => group.materialIndex === materialIndex);
    if (groups.length === 0) {
        return undefined;
    }
    const indexArray = geometry.index?.array;
    const stats = createAlphaStats();
    const resolution = 512;
    for (const group of groups) {
        for (let offset = group.start; offset < group.start + group.count; offset += 3) {
            const a = Number(indexArray?.[offset] ?? offset);
            const b = Number(indexArray?.[offset + 1] ?? offset + 1);
            const c = Number(indexArray?.[offset + 2] ?? offset + 2);
            recordRasterizedUvTriangleAlpha(stats, rgba.data, rgba.width, rgba.height, uvAttribute.getX(a), uvAttribute.getY(a), uvAttribute.getX(b), uvAttribute.getY(b), uvAttribute.getX(c), uvAttribute.getY(c), resolution);
        }
    }
    return stats.sampleCount > 0 ? evaluateAlphaStats(stats, options) : undefined;
}
export async function loadToonTexture(material, materialIndex, modelUrl, textureResolver, textureDiagnostics, textureLoader, textureCache, ddsLoader) {
    if (!material.toonTexturePath && material.sharedToonIndex === undefined) {
        return getDefaultToonGradientMap();
    }
    const toonTexture = resolveMmdToonTextureReference(material);
    if (!toonTexture.path) {
        return undefined;
    }
    const bundledSharedToonTexture = toonTexture.shared
        ? resolveBundledSharedToonTexture(toonTexture.path)
        : undefined;
    let unsupportedFormat = false;
    let texture;
    if (bundledSharedToonTexture) {
        texture = await loadResolvedTexture(bundledSharedToonTexture, toonTexture.path, undefined, textureLoader, textureCache, "toon", modelUrl);
    }
    else {
        const result = await loadMaterialTexture(toonTexture.path, toonTexture.textureInfo, modelUrl, textureResolver, textureLoader, textureCache, "toon", ddsLoader);
        texture = result.texture;
        unsupportedFormat = result.unsupportedFormat === true;
    }
    if (unsupportedFormat && material.toonTexturePath) {
        textureDiagnostics.push({
            level: "warning",
            code: "TEXTURE_FORMAT_UNSUPPORTED",
            materialIndex,
            textureKind: "toon",
            path: material.toonTexturePath
        });
    }
    if (!texture && material.toonTexturePath) {
        if (!unsupportedFormat) {
            textureDiagnostics.push({
                level: "warning",
                code: "TEXTURE_RESOLVE_FAILED",
                materialIndex,
                textureKind: "toon",
                path: material.toonTexturePath
            });
        }
    }
    if (!texture &&
        !material.toonTexturePath &&
        material.sharedToonIndex !== undefined &&
        toonTexture.shared &&
        !textureResolver &&
        !modelUrl) {
        textureDiagnostics.push({
            level: "warning",
            code: "TEXTURE_RESOLVE_FAILED",
            materialIndex,
            textureKind: "toon",
            path: toonTexture.path
        });
    }
    if (!texture && !textureResolver && !modelUrl && !material.toonTexturePath) {
        return undefined;
    }
    if (!texture) {
        return toonGradient();
    }
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    texture.userData.mmdToonTexturePath = toonTexture.path;
    texture.userData.mmdToonTextureShared = toonTexture.shared;
    return texture;
}
export function rotateMmdToonTexture(texture) {
    const image = texture.image;
    const width = Number(image?.width);
    const height = Number(image?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return texture;
    }
    if (texture instanceof THREE.DataTexture && image && "data" in image) {
        const sourceData = image.data;
        if (sourceData && sourceData.length >= width * height * 4) {
            const rotated = new Uint8Array(width * height * 4);
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    const source = (y * width + x) * 4;
                    const targetX = height - 1 - y;
                    const targetY = x;
                    const target = (targetY * height + targetX) * 4;
                    rotated[target] = sourceData[source] ?? 0;
                    rotated[target + 1] = sourceData[source + 1] ?? 0;
                    rotated[target + 2] = sourceData[source + 2] ?? 0;
                    rotated[target + 3] = sourceData[source + 3] ?? 255;
                }
            }
            texture.image = { data: rotated, width: height, height: width };
            texture.userData.mmdToonTextureRotated = true;
            texture.needsUpdate = true;
        }
        return texture;
    }
    if (typeof document === "undefined") {
        return texture;
    }
    const canvas = document.createElement("canvas");
    canvas.width = height;
    canvas.height = width;
    const context = canvas.getContext("2d");
    if (!context) {
        return texture;
    }
    context.clearRect(0, 0, height, width);
    context.translate(height / 2, width / 2);
    context.rotate(Math.PI / 2);
    context.translate(-width / 2, -height / 2);
    context.drawImage(texture.image, 0, 0);
    texture.image = context.getImageData(0, 0, height, width);
    texture.userData.mmdToonTextureRotated = true;
    texture.needsUpdate = true;
    return texture;
}
export async function loadMaterialTextureWithDiagnostics(texturePath, textureInfo, textureKind, materialIndex, modelUrl, textureResolver, textureDiagnostics, textureLoader, textureCache, ddsLoader) {
    const result = await loadMaterialTexture(texturePath, textureInfo, modelUrl, textureResolver, textureLoader, textureCache, textureKind, ddsLoader);
    const texture = result.texture;
    if (result.unsupportedFormat && texturePath) {
        textureDiagnostics.push({
            level: "warning",
            code: "TEXTURE_FORMAT_UNSUPPORTED",
            materialIndex,
            textureKind,
            path: texturePath
        });
        return undefined;
    }
    if (!texture && texturePath) {
        textureDiagnostics.push({
            level: "warning",
            code: "TEXTURE_RESOLVE_FAILED",
            materialIndex,
            textureKind,
            path: texturePath
        });
    }
    return texture;
}
export function configureMmdTexture(texture, textureInfo) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.flipY = textureInfo?.invertY ?? false;
    if (textureInfo?.noMipmap) {
        texture.generateMipmaps = false;
    }
    if (textureInfo) {
        texture.userData.mmdTextureInfo = { ...textureInfo };
    }
    texture.needsUpdate = true;
    return texture;
}
export function decodeMmdTgaTexture(bytes) {
    const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : Uint8Array.from(bytes);
    if (data.length < 18) {
        return undefined;
    }
    const idLength = data[0] ?? 0;
    const colorMapType = data[1] ?? 0;
    const imageType = data[2] ?? 0;
    const width = (data[12] ?? 0) | ((data[13] ?? 0) << 8);
    const height = (data[14] ?? 0) | ((data[15] ?? 0) << 8);
    const bitsPerPixel = data[16] ?? 0;
    const descriptor = data[17] ?? 0;
    if (colorMapType !== 0 ||
        (imageType !== 2 && imageType !== 10) ||
        width <= 0 ||
        height <= 0 ||
        (bitsPerPixel !== 24 && bitsPerPixel !== 32)) {
        return undefined;
    }
    const bytesPerPixel = bitsPerPixel / 8;
    const pixelOffset = 18 + idLength;
    if (data.length < pixelOffset) {
        return undefined;
    }
    const output = new Uint8Array(width * height * 4);
    const topOrigin = (descriptor & 0x20) !== 0;
    let hasAlpha = false;
    const writePixel = (sourcePixelIndex, source) => {
        if (source + bytesPerPixel > data.length) {
            return false;
        }
        const sourceY = Math.floor(sourcePixelIndex / width);
        const x = sourcePixelIndex % width;
        const targetY = topOrigin ? sourceY : height - 1 - sourceY;
        const target = (targetY * width + x) * 4;
        output[target] = data[source + 2] ?? 0;
        output[target + 1] = data[source + 1] ?? 0;
        output[target + 2] = data[source] ?? 0;
        const alpha = bitsPerPixel === 32 ? (data[source + 3] ?? 255) : 255;
        output[target + 3] = alpha;
        hasAlpha ||= alpha < 255;
        return true;
    };
    const pixelCount = width * height;
    if (imageType === 2) {
        const pixelByteLength = pixelCount * bytesPerPixel;
        if (data.length < pixelOffset + pixelByteLength) {
            return undefined;
        }
        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
            if (!writePixel(pixelIndex, pixelOffset + pixelIndex * bytesPerPixel)) {
                return undefined;
            }
        }
    }
    else {
        let source = pixelOffset;
        let pixelIndex = 0;
        while (pixelIndex < pixelCount) {
            if (source >= data.length) {
                return undefined;
            }
            const packet = data[source++] ?? 0;
            const count = (packet & 0x7f) + 1;
            if ((packet & 0x80) !== 0) {
                if (source + bytesPerPixel > data.length) {
                    return undefined;
                }
                for (let i = 0; i < count && pixelIndex < pixelCount; i += 1, pixelIndex += 1) {
                    if (!writePixel(pixelIndex, source)) {
                        return undefined;
                    }
                }
                source += bytesPerPixel;
            }
            else {
                for (let i = 0; i < count && pixelIndex < pixelCount; i += 1, pixelIndex += 1) {
                    if (!writePixel(pixelIndex, source)) {
                        return undefined;
                    }
                    source += bytesPerPixel;
                }
            }
        }
    }
    return { data: output, width, height, hasAlpha };
}
export function isMmdBmpLikeTexturePath(texturePath) {
    return /\.(?:bmp|spa|sph)$/i.test(texturePath);
}
export function isMmdTgaLikeTexturePath(texturePath) {
    return /\.tga$/i.test(texturePath);
}
export function isMmdDdsTexturePath(texturePath) {
    return /\.dds(?:[?#].*)?$/i.test(texturePath);
}
export function createTextureResolver(textureResolver, textureMap) {
    if (!textureResolver && !textureMap) {
        return undefined;
    }
    return {
        async resolve(path, modelUrl) {
            const mapped = resolveMappedTexture(path, textureMap);
            if (mapped) {
                return mapped;
            }
            return ((await textureResolver?.resolve(path, modelUrl)) ?? resolveAdjacentTexture(path, modelUrl));
        }
    };
}
export function createMmdBuiltInToonTextureMap(baseUrl) {
    const map = {};
    const base = typeof baseUrl === "string" ? baseUrl : baseUrl.toString();
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    for (let index = 1; index <= 10; index += 1) {
        const texturePath = `toon${String(index).padStart(2, "0")}.bmp`;
        map[texturePath] = isAbsoluteUrl(normalizedBase)
            ? new URL(texturePath, normalizedBase).toString()
            : `${normalizedBase}${texturePath}`;
    }
    return map;
}
export function resolveMappedTexture(texturePath, textureMap) {
    if (!textureMap) {
        return undefined;
    }
    const normalized = normalizeMmdTexturePath(texturePath);
    const mapped = textureMap[texturePath] ?? textureMap[normalized] ?? textureMap[`./${normalized}`];
    if (mapped) {
        return mapped;
    }
    const normalizedLower = normalized.toLowerCase();
    for (const [key, value] of Object.entries(textureMap)) {
        if (normalizeMmdTexturePath(key).toLowerCase() === normalizedLower) {
            return value;
        }
    }
    return undefined;
}
export function defaultSharedToonTexturePath(sharedToonIndex) {
    return sharedToonIndex === undefined
        ? ""
        : `toon${String(sharedToonIndex + 1).padStart(2, "0")}.bmp`;
}
export function resolveMmdToonTextureReference(material) {
    if (material.toonTexturePath) {
        return {
            path: material.toonTexturePath,
            textureInfo: material.toonTextureInfo,
            shared: false
        };
    }
    const sharedPath = defaultSharedToonTexturePath(material.sharedToonIndex);
    return {
        path: sharedPath,
        textureInfo: undefined,
        shared: sharedPath.length > 0
    };
}
export function normalizeMmdTexturePath(texturePath) {
    return texturePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}
export function createFallbackMmdMaterial() {
    const material = new THREE.MeshToonMaterial({
        color: new THREE.Color(0.8, 0.8, 0.8),
        gradientMap: toonGradient(),
        side: THREE.DoubleSide
    });
    material.name = "mmd_fallback_material";
    material.userData.mmdMaterial = {
        materialIndex: 0,
        name: "fallback",
        englishName: "fallback"
    };
    return material;
}
export function getDefaultToonGradientMap() {
    if (defaultToonGradientMap) {
        return defaultToonGradientMap;
    }
    const data = new Uint8Array([255, 255, 255, 255]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.name = "mmd-default-toon";
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.userData.mmdFallbackToonGradient = true;
    defaultToonGradientMap = texture;
    return defaultToonGradientMap;
}
async function loadMaterialTexture(texturePath, textureInfo, modelUrl, textureResolver, textureLoader, textureCache, cacheNamespace = "material", ddsLoader) {
    if (!texturePath) {
        return {};
    }
    const resolved = textureResolver
        ? await textureResolver.resolve(texturePath, modelUrl)
        : resolveAdjacentTexture(texturePath, modelUrl);
    if (!resolved) {
        return {};
    }
    const resolvedIsDds = isResolvedMmdDdsTexture(texturePath, resolved);
    if (resolvedIsDds && !ddsLoader) {
        return { unsupportedFormat: true };
    }
    if (isMmdTgaLikeTexturePath(texturePath)) {
        const tgaTexture = await loadMmdTgaTexture(resolved, textureInfo);
        if (tgaTexture) {
            return { texture: tgaTexture };
        }
    }
    const texture = await loadResolvedTexture(resolved, texturePath, textureInfo, resolvedIsDds ? ddsLoader : textureLoader, textureCache, cacheNamespace, modelUrl);
    return { texture };
}
function isResolvedMmdDdsTexture(texturePath, resolved) {
    if (typeof resolved === "string") {
        return isResolvedPathDds(texturePath, resolved);
    }
    if (typeof Blob !== "undefined" && resolved instanceof Blob) {
        const fileName = typeof File !== "undefined" && resolved instanceof File ? resolved.name : undefined;
        if (fileName) {
            return isMmdDdsTexturePath(fileName);
        }
        if (resolved.type) {
            return /dds/i.test(resolved.type);
        }
        return isMmdDdsTexturePath(texturePath);
    }
    if (resolved instanceof URL) {
        return isResolvedPathDds(texturePath, resolved.pathname);
    }
    return false;
}
function isResolvedPathDds(texturePath, resolvedPath) {
    if (isMmdDdsTexturePath(resolvedPath)) {
        return true;
    }
    if (/\.(?:bmp|gif|jpe?g|png|tga|webp)(?:[?#].*)?$/i.test(resolvedPath)) {
        return false;
    }
    return isMmdDdsTexturePath(texturePath);
}
async function loadResolvedTexture(resolved, texturePath, textureInfo, textureLoader, textureCache, cacheNamespace = "material", modelUrl) {
    const cacheKey = createTextureCacheKey(cacheNamespace, texturePath, textureInfo, resolved, modelUrl);
    const cached = textureCache?.get(cacheKey);
    if (cached) {
        return cached;
    }
    const promise = loadResolvedTextureUncached(resolved, texturePath, textureInfo, textureLoader).then((texture) => {
        if (!texture && textureCache?.get(cacheKey) === promise) {
            textureCache.delete(cacheKey);
        }
        return texture;
    }, (error) => {
        if (textureCache?.get(cacheKey) === promise) {
            textureCache.delete(cacheKey);
        }
        throw error;
    });
    textureCache?.set(cacheKey, promise);
    return promise;
}
async function loadResolvedTextureUncached(resolved, texturePath, textureInfo, textureLoader) {
    const request = await createTextureLoadRequest(resolved, texturePath);
    const loader = textureLoader ?? new THREE.TextureLoader();
    return new Promise((resolve) => {
        const finish = (texture) => {
            if (request.revokeUrl) {
                URL.revokeObjectURL(request.url);
            }
            resolve(texture);
        };
        try {
            loader.load(request.url, (texture) => {
                configureMmdTexture(texture, textureInfo);
                if (!textureLoader) {
                    texture.userData.mmdTextureOwnership = "loader";
                }
                if (request.alphaMode) {
                    texture.userData.mmdTextureAlphaMode = request.alphaMode;
                }
                finish(texture);
            }, undefined, () => finish(undefined));
        }
        catch {
            finish(undefined);
        }
    });
}
async function loadMmdTgaTexture(resolved, textureInfo) {
    const source = typeof Blob !== "undefined" && resolved instanceof Blob
        ? await loadCachedBlobMmdTgaTexture(resolved)
        : await loadMmdTgaTextureSource(resolved);
    if (!source) {
        return undefined;
    }
    return cloneMmdTgaTexture(source, textureInfo);
}
async function loadCachedBlobMmdTgaTexture(resolved) {
    const cached = blobTgaTextureCache.get(resolved);
    if (cached) {
        return cached;
    }
    const promise = loadMmdTgaTextureSource(resolved).then((texture) => {
        if (!texture && blobTgaTextureCache.get(resolved) === promise) {
            blobTgaTextureCache.delete(resolved);
        }
        return texture;
    }, (error) => {
        if (blobTgaTextureCache.get(resolved) === promise) {
            blobTgaTextureCache.delete(resolved);
        }
        throw error;
    });
    blobTgaTextureCache.set(resolved, promise);
    return promise;
}
async function loadMmdTgaTextureSource(resolved) {
    try {
        const buffer = typeof Blob !== "undefined" && resolved instanceof Blob
            ? await resolved.arrayBuffer()
            : await fetch(String(resolved)).then((response) => response.ok ? response.arrayBuffer() : undefined);
        if (!buffer) {
            return undefined;
        }
        const image = decodeMmdTgaTexture(buffer);
        if (!image) {
            return undefined;
        }
        const texture = new THREE.DataTexture(image.data, image.width, image.height, THREE.RGBAFormat);
        texture.type = THREE.UnsignedByteType;
        texture.userData.mmdTextureAlphaSource = "tga";
        texture.userData.mmdTextureOwnership = "loader";
        texture.userData.mmdTextureAlphaMode = image.hasAlpha
            ? evaluateMmdTextureAlphaRgba(image.data)
            : "opaque";
        return texture;
    }
    catch {
        return undefined;
    }
}
function cloneMmdTgaTexture(source, textureInfo) {
    const texture = source.clone();
    texture.needsUpdate = true;
    return configureMmdTexture(texture, textureInfo);
}
function resolveBundledSharedToonTexture(texturePath) {
    return resolveMappedTexture(texturePath, bundledSharedToonTextureUrls);
}
async function createTextureLoadRequest(resolved, texturePath) {
    if (typeof Blob !== "undefined" && resolved instanceof Blob) {
        if (!isMmdBmpLikeTexturePath(texturePath)) {
            return { url: URL.createObjectURL(resolved), revokeUrl: true };
        }
        const buffer = await resolved.arrayBuffer();
        const injected = injectMmdBmp32BitAlphaHeader(buffer);
        return {
            url: URL.createObjectURL(injected
                ? new Blob([injected.buffer], {
                    type: "image/bmp"
                })
                : resolved),
            alphaMode: evaluateMmdBmpTextureAlpha(buffer),
            revokeUrl: true
        };
    }
    const url = String(resolved);
    if (!isMmdBmpLikeTexturePath(texturePath)) {
        return { url };
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return { url };
        }
        const buffer = await response.arrayBuffer();
        const injected = injectMmdBmp32BitAlphaHeader(buffer);
        const alphaMode = evaluateMmdBmpTextureAlpha(buffer);
        if (!injected) {
            return { url, alphaMode };
        }
        return {
            url: URL.createObjectURL(new Blob([injected.buffer], { type: "image/bmp" })),
            alphaMode,
            revokeUrl: true
        };
    }
    catch {
        return { url };
    }
}
function createTextureCacheKey(namespace, texturePath, textureInfo, resolved, modelUrl) {
    const normalizedPath = normalizeMmdTexturePath(texturePath).toLowerCase();
    const resolvedKey = typeof Blob !== "undefined" && resolved instanceof Blob
        ? `blob:${getBlobTextureCacheKey(resolved)}`
        : String(resolved);
    return [
        namespace,
        modelUrl ?? "",
        normalizedPath,
        resolvedKey,
        textureInfo?.invertY ? "invertY" : "",
        textureInfo?.noMipmap ? "noMipmap" : ""
    ].join("\0");
}
function getBlobTextureCacheKey(blob) {
    let key = blobTextureCacheKeys.get(blob);
    if (key === undefined) {
        key = nextBlobTextureCacheKey;
        nextBlobTextureCacheKey += 1;
        blobTextureCacheKeys.set(blob, key);
    }
    return key;
}
function evaluateBmp16BitfieldAlpha(view, dataLength, pixelOffset, width, absoluteHeight, options) {
    const rowSize = Math.floor((16 * width + 31) / 32) * 4;
    if (pixelOffset + rowSize * absoluteHeight > dataLength) {
        return undefined;
    }
    const alphaMask = readBmpBitfieldAlphaMask(view, view.getUint32(14, true), pixelOffset);
    if (alphaMask === undefined || alphaMask === 0) {
        return "opaque";
    }
    const alphaShift = trailingZeroBits(alphaMask);
    const alphaMax = alphaMask >>> alphaShift;
    const stats = createAlphaStats();
    for (let y = 0; y < absoluteHeight; y += 1) {
        const rowOffset = pixelOffset + y * rowSize;
        for (let x = 0; x < width; x += 1) {
            const value = view.getUint16(rowOffset + x * 2, true);
            recordAlphaSample(stats, Math.round((((value & alphaMask) >>> alphaShift) / alphaMax) * 255));
        }
    }
    return evaluateAlphaStats(stats, options);
}
const bmpV4HeaderExtension = new Uint8Array([
    0x00, 0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
]);
function readBmpBitfieldAlphaMask(view, dibHeaderSize, pixelOffset) {
    const maskOffset = 14 + 40;
    const alphaMaskOffset = maskOffset + 12;
    if (dibHeaderSize >= 56 && 14 + dibHeaderSize >= alphaMaskOffset + 4) {
        return view.getUint32(alphaMaskOffset, true);
    }
    if (pixelOffset >= alphaMaskOffset + 4) {
        return view.getUint32(alphaMaskOffset, true);
    }
    return undefined;
}
function trailingZeroBits(value) {
    let shift = 0;
    while (shift < 32 && ((value >>> shift) & 1) === 0) {
        shift += 1;
    }
    return shift;
}
let cachedToonGradient;
function toonGradient() {
    if (cachedToonGradient) {
        return cachedToonGradient;
    }
    const data = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
    const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.NoColorSpace;
    texture.userData.mmdFallbackToonGradient = true;
    texture.needsUpdate = true;
    cachedToonGradient = texture;
    return texture;
}
function readableRgbaTextureData(image) {
    const width = Number(image?.width);
    const height = Number(image?.height);
    const data = image?.data;
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        if (data && data.length >= width * height * 4) {
            return { data, width, height };
        }
        return readableRgbaCanvasImage(image, width, height);
    }
    return undefined;
}
function readableRgbaCanvasImage(image, width, height) {
    try {
        if (typeof document === "undefined") {
            return undefined;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return undefined;
        }
        context.drawImage(image, 0, 0, width, height);
        return { data: context.getImageData(0, 0, width, height).data, width, height };
    }
    catch {
        return undefined;
    }
}
function hasAnyReadableAlpha(rgba, width, height) {
    const pixelCount = width * height;
    for (let index = 0; index < pixelCount; index += 1) {
        if ((rgba[index * 4 + 3] ?? 255) < 255) {
            return true;
        }
    }
    return false;
}
function sampleRgbaAlphaByUv(rgba, width, height, uvX, uvY) {
    const wrap = (value, size) => {
        let wrapped = Math.round(value * size) % size;
        if (wrapped < 0) {
            wrapped += size;
        }
        return wrapped;
    };
    const x = wrap(uvX, width);
    const y = wrap(uvY, height);
    return rgba[(y * width + x) * 4 + 3] ?? 255;
}
function recordRasterizedUvTriangleAlpha(stats, rgba, width, height, uvAX, uvAY, uvBX, uvBY, uvCX, uvCY, resolution) {
    const minU = Math.min(uvAX, uvBX, uvCX);
    const maxU = Math.max(uvAX, uvBX, uvCX);
    const minV = Math.min(uvAY, uvBY, uvCY);
    const maxV = Math.max(uvAY, uvBY, uvCY);
    const shiftMinU = Math.ceil(-maxU);
    const shiftMaxU = Math.floor(1 - minU);
    const shiftMinV = Math.ceil(-maxV);
    const shiftMaxV = Math.floor(1 - minV);
    for (let shiftU = shiftMinU; shiftU <= shiftMaxU; shiftU += 1) {
        for (let shiftV = shiftMinV; shiftV <= shiftMaxV; shiftV += 1) {
            recordRasterizedUvTriangleAlphaTile(stats, rgba, width, height, uvAX + shiftU, uvAY + shiftV, uvBX + shiftU, uvBY + shiftV, uvCX + shiftU, uvCY + shiftV, resolution);
        }
    }
}
function recordRasterizedUvTriangleAlphaTile(stats, rgba, width, height, uvAX, uvAY, uvBX, uvBY, uvCX, uvCY, resolution) {
    const ax = uvAX * resolution;
    const ay = uvAY * resolution;
    const bx = uvBX * resolution;
    const by = uvBY * resolution;
    const cx = uvCX * resolution;
    const cy = uvCY * resolution;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(resolution - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(resolution - 1, Math.ceil(Math.max(ay, by, cy)));
    if (minX > maxX || minY > maxY) {
        return;
    }
    const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denominator) < 1e-9) {
        return;
    }
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const px = x + 0.5;
            const py = y + 0.5;
            const wA = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denominator;
            const wB = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denominator;
            const wC = 1 - wA - wB;
            if (wA >= 0 && wB >= 0 && wC >= 0) {
                recordAlphaSample(stats, sampleRgbaAlphaByUv(rgba, width, height, px / resolution, py / resolution));
            }
        }
    }
}
function evaluateMmdTextureAlphaCanvasImage(image, options) {
    if (typeof document === "undefined" ||
        !image ||
        typeof image !== "object" ||
        !("width" in image) ||
        !("height" in image)) {
        return undefined;
    }
    const width = Number(image.width);
    const height = Number(image.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return undefined;
    }
    try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return undefined;
        }
        context.drawImage(image, 0, 0, width, height);
        return evaluateMmdTextureAlphaRgba(context.getImageData(0, 0, width, height).data, options);
    }
    catch {
        return undefined;
    }
}
function resolveAdjacentTexture(texturePath, modelUrl) {
    if (!modelUrl) {
        return undefined;
    }
    if (typeof location === "undefined" && !isAbsoluteUrl(modelUrl)) {
        const normalizedModelUrl = normalizeMmdTexturePath(modelUrl);
        const basePath = normalizedModelUrl.includes("/")
            ? normalizedModelUrl.slice(0, normalizedModelUrl.lastIndexOf("/") + 1)
            : "";
        return `${basePath}${normalizeMmdTexturePath(texturePath)}`;
    }
    if (typeof location === "undefined" && isAbsoluteUrl(modelUrl)) {
        return new URL(normalizeMmdTexturePath(texturePath), new URL(".", modelUrl)).toString();
    }
    return new URL(normalizeMmdTexturePath(texturePath), new URL(".", new URL(modelUrl, browserBaseHref()))).toString();
}
function isAbsoluteUrl(url) {
    return /^[a-z][a-z\d+.-]*:/i.test(url);
}
function browserBaseHref() {
    return typeof location === "undefined" ? "http://localhost/" : location.href;
}
