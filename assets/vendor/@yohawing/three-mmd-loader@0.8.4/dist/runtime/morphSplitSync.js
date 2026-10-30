import * as THREE from "three";
export function syncMorphSplitTargetInfluences(source) {
    const sourceInfluences = source.morphTargetInfluences;
    if (!sourceInfluences) {
        return;
    }
    const bodyMeshes = source.userData.mmdMorphSplitBodyMeshes;
    if (!Array.isArray(bodyMeshes)) {
        return;
    }
    for (let bodyIndex = 0; bodyIndex < bodyMeshes.length; bodyIndex += 1) {
        const body = bodyMeshes[bodyIndex];
        if (!isSkinnedMesh(body)) {
            continue;
        }
        const split = body.userData.mmdMorphSplitBody;
        const morphTargetIndices = split?.morphTargetIndices;
        const targetInfluences = body.morphTargetInfluences;
        if (!morphTargetIndices || !targetInfluences) {
            continue;
        }
        for (let index = 0; index < morphTargetIndices.length; index += 1) {
            targetInfluences[index] = sourceInfluences[morphTargetIndices[index] ?? -1] ?? 0;
        }
    }
}
function isSkinnedMesh(value) {
    return value instanceof THREE.SkinnedMesh || (typeof value === "object" &&
        value !== null &&
        value.isSkinnedMesh === true);
}
