import * as textureAlpha from "../textures.js";
import { mmdMaterialMorphCanAffectAlpha, mmdMaterialTransparencyMode } from "./material-metadata.js";
const geometryAlphaCache = new WeakMap();
export async function loadMmdDefaultMaterialTextureSet(material, materialIndex, modelUrl, textureResolver, textureDiagnostics, textureLoader, textureCache, ddsLoader) {
    const shouldLoadSphereTexture = material.sphereMode !== "none";
    const [texture, gradientMap, sphereTexture] = await Promise.all([
        textureAlpha.loadMaterialTextureWithDiagnostics(material.texturePath, material.textureInfo, "diffuse", materialIndex, modelUrl, textureResolver, textureDiagnostics, textureLoader, textureCache, ddsLoader),
        textureAlpha.loadToonTexture(material, materialIndex, modelUrl, textureResolver, textureDiagnostics, textureLoader, textureCache, ddsLoader),
        shouldLoadSphereTexture
            ? textureAlpha.loadMaterialTextureWithDiagnostics(material.sphereTexturePath, material.sphereTextureInfo, "sphere", materialIndex, modelUrl, textureResolver, textureDiagnostics, textureLoader, textureCache, ddsLoader)
            : undefined
    ]);
    return { texture, gradientMap, sphereTexture };
}
export function evaluateMmdDefaultMaterialTransparency(material, morphs, geometry, materialIndex, texture, options = {}) {
    const morphAlphaTransparent = mmdMaterialMorphCanAffectAlpha(morphs, materialIndex);
    const textureMetadataTransparencyMode = texture?.userData.mmdTextureAlphaMode;
    const textureAlphaSource = texture?.userData.mmdTextureAlphaSource;
    const pmxTransparencyMode = mmdMaterialTransparencyMode(material, !!texture);
    const pmxOpaque = pmxTransparencyMode === "opaque";
    // Real MMD 9.32 blends a regular TGA hair material's texture alpha (golden:
    // mmd-tga-regular-hair-alpha-opaque shows the white background through the soft band).
    // The geometry-aware scan inspects the actually-used UVs, so it can be trusted to
    // classify TGA materials too -- it returns "opaque" when the used region is solid and
    // only promotes when a real alpha gradient/cutout is present. We therefore allow the
    // geometry-aware scan for TGA materials; the coarse whole-texture metadata fast path
    // stays guarded (TGA metadata over-reports alpha across unused atlas regions).
    const canUseTextureAlphaForOpaqueMaterial = options.geometryAwareAlpha ||
        textureAlphaSource !== "tga" ||
        isLikelyMmdAlphaOverlayMaterial(material);
    const shouldUseTextureMetadata = textureMetadataTransparencyMode !== undefined &&
        (!pmxOpaque || textureAlphaSource !== "tga");
    const needsTextureTransparencyScan = !shouldUseTextureMetadata &&
        (options.geometryAwareAlpha
            ? pmxOpaque && canUseTextureAlphaForOpaqueMaterial
            : pmxTransparencyMode !== "opaque");
    const rawTextureTransparencyMode = (shouldUseTextureMetadata ? textureMetadataTransparencyMode : undefined) ??
        (texture && needsTextureTransparencyScan
            ? (options.geometryAwareAlpha
                ? evaluateCachedMmdTextureAlphaGeometry(texture, geometry, materialIndex)
                : textureAlpha.evaluateMmdTextureAlphaTexture(texture))
            : undefined);
    const textureTransparencyMode = rawTextureTransparencyMode === "alphaTest" && isLikelyMmdSoftAlphaOverlayMaterial(material)
        ? "alphaBlend"
        : rawTextureTransparencyMode;
    const textureTransparencyReason = shouldUseTextureMetadata && textureTransparencyMode !== undefined
        ? "texture-metadata"
        : texture && needsTextureTransparencyScan && textureTransparencyMode !== undefined
            ? options.geometryAwareAlpha
                ? "geometry-alpha-scan"
                : "texture-alpha-scan"
            : undefined;
    const baseTransparencyMode = mmdMaterialTransparencyMode(material, !!texture, textureTransparencyMode);
    const transparencyMode = baseTransparencyMode !== "opaque"
        ? baseTransparencyMode
        : textureTransparencyMode &&
            textureTransparencyMode !== "opaque" &&
            (options.geometryAwareAlpha || textureMetadataTransparencyMode !== undefined)
            ? textureTransparencyMode
            : "opaque";
    const reason = getTransparencyReason({
        pmxTransparencyMode,
        textureTransparencyMode,
        transparencyMode,
        textureTransparencyReason,
        morphAlphaTransparent,
        promotedByNameHeuristic: rawTextureTransparencyMode === "alphaTest" && textureTransparencyMode === "alphaBlend"
    });
    return {
        transparencyMode,
        textureTransparencyMode,
        morphAlphaTransparent,
        diagnostic: {
            materialIndex,
            materialName: material.englishName || material.name || `material_${materialIndex}`,
            pmxTransparencyMode,
            textureTransparencyMode,
            finalTransparencyMode: transparencyMode,
            morphAlphaTransparent,
            reason
        }
    };
}
function getTransparencyReason(options) {
    if (options.transparencyMode !== "opaque" && options.pmxTransparencyMode !== "opaque") {
        return "pmx";
    }
    if (options.promotedByNameHeuristic) {
        return "name-heuristic";
    }
    if (options.textureTransparencyMode !== undefined &&
        options.textureTransparencyMode !== "opaque" &&
        options.textureTransparencyReason) {
        return options.textureTransparencyReason;
    }
    if (options.morphAlphaTransparent) {
        return "morph-alpha";
    }
    return "pmx";
}
function isLikelyMmdAlphaOverlayMaterial(material) {
    const materialName = `${material.name} ${material.englishName}`.toLowerCase();
    if (/(hair\s*shadow|hairshadow|shadow|shade|髪影|髪の影|影)/u.test(materialName)) {
        return true;
    }
    return (!material.flags.groundShadow &&
        !material.flags.selfShadowMap &&
        !material.flags.selfShadow &&
        !material.flags.edge);
}
function isLikelyMmdSoftAlphaOverlayMaterial(material) {
    const materialName = `${material.name} ${material.englishName}`.toLowerCase();
    return /(hair\s*shadow|hairshadow|shadow|shade|cheek|blush|髪影|髪の影|影|頬|ほほ|チーク)/u.test(materialName);
}
function evaluateCachedMmdTextureAlphaGeometry(texture, geometry, materialIndex) {
    let geometryCache = geometryAlphaCache.get(texture);
    if (!geometryCache) {
        geometryCache = new WeakMap();
        geometryAlphaCache.set(texture, geometryCache);
    }
    let materialCache = geometryCache.get(geometry);
    if (!materialCache) {
        materialCache = new Map();
        geometryCache.set(geometry, materialCache);
    }
    if (materialCache.has(materialIndex)) {
        return materialCache.get(materialIndex);
    }
    const alphaMode = textureAlpha.evaluateMmdTextureAlphaGeometry(texture, geometry, materialIndex);
    materialCache.set(materialIndex, alphaMode);
    return alphaMode;
}
