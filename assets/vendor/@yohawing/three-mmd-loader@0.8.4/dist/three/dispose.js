import * as THREE from "three";
export function disposeMmdModel(model, options = {}) {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    const disposedTextures = new Set();
    const disposedSkeletons = new Set();
    const textureOwnership = options.textures ?? "all";
    const root = model.root ?? model.object;
    root?.parent?.remove(root);
    disposeRuntimeResources(model.runtime);
    const bodyMeshes = Array.isArray(model.mesh.userData.mmdMorphSplitBodyMeshes)
        ? model.mesh.userData.mmdMorphSplitBodyMeshes.filter(isSkinnedMesh)
        : [];
    const meshes = [
        model.mesh,
        ...bodyMeshes,
        ...(model.outlineMeshes ?? []),
        ...(model.renderOrderMeshes ?? [])
    ];
    for (const mesh of meshes) {
        mesh.parent?.remove(mesh);
        disposeSkeletonResources(mesh.skeleton, disposedSkeletons);
        if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
            mesh.geometry.dispose();
            disposedGeometries.add(mesh.geometry);
        }
        for (const material of normalizeMaterials(mesh.material)) {
            disposeMaterialResources(material, disposedMaterials, disposedTextures, textureOwnership);
        }
        disposeMaterialResources(mesh.customDepthMaterial, disposedMaterials, disposedTextures, textureOwnership);
        disposeMaterialResources(mesh.customDistanceMaterial, disposedMaterials, disposedTextures, textureOwnership);
    }
}
function isSkinnedMesh(value) {
    return (value instanceof THREE.SkinnedMesh ||
        (typeof value === "object" &&
            value !== null &&
            value.isSkinnedMesh === true));
}
function disposeMaterialResources(material, disposedMaterials, disposedTextures, textureOwnership) {
    if (!material) {
        return;
    }
    for (const texture of collectMaterialTextures(material)) {
        disposeTexture(texture, disposedTextures, textureOwnership);
    }
    if (!disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
    }
}
function collectMaterialTextures(material) {
    const textures = [];
    for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
            textures.push(value);
        }
    }
    for (const value of Object.values(material.userData ?? {})) {
        if (value instanceof THREE.Texture) {
            textures.push(value);
        }
    }
    for (const value of Object.values(material.userData ?? {})) {
        const uniforms = value?.uniforms;
        if (uniforms && typeof uniforms === "object") {
            for (const uniform of Object.values(uniforms)) {
                const texture = uniform?.value;
                if (texture instanceof THREE.Texture) {
                    textures.push(texture);
                }
            }
        }
    }
    return textures;
}
function disposeTexture(texture, disposedTextures, textureOwnership) {
    if (!texture ||
        disposedTextures.has(texture) ||
        textureOwnership === "none" ||
        texture.userData.mmdFallbackToonGradient === true ||
        (textureOwnership === "owned" && texture.userData.mmdTextureOwnership !== "loader")) {
        return;
    }
    texture.dispose();
    disposedTextures.add(texture);
}
function disposeSkeletonResources(skeleton, disposedSkeletons) {
    if (!skeleton || disposedSkeletons.has(skeleton)) {
        return;
    }
    skeleton.dispose();
    disposedSkeletons.add(skeleton);
}
function disposeRuntimeResources(runtime) {
    if (!runtime) {
        return;
    }
    const disposable = runtime;
    if (typeof disposable.dispose === "function") {
        disposable.dispose();
    }
}
function normalizeMaterials(material) {
    return Array.isArray(material) ? material : [material];
}
