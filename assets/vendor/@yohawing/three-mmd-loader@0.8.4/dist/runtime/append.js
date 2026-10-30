import { weightedThreeQuaternion, zeroVector3 } from "./math.js";
export function appendTransformOrder(bones) {
    return bones
        .map((bone, index) => ({
        index,
        layer: readBoneLayer(bone)
    }))
        .sort((left, right) => left.layer - right.layer || left.index - right.index)
        .map((entry) => entry.index);
}
function readBoneLayer(bone) {
    const layer = bone.userData.mmdLayer;
    return Number.isFinite(layer) ? Number(layer) : 0;
}
export function applyAppendTransforms(mesh, appendOrder, scratchAppendTranslations, scratchAppendRotations, scratchVector3A, scratchQuaternionA) {
    if (!mesh) {
        return;
    }
    const bones = mesh.skeleton.bones;
    const appendTranslations = scratchAppendTranslations;
    const appendRotations = scratchAppendRotations;
    resetVectorScratchArray(appendTranslations, bones.length);
    resetQuaternionScratchArray(appendRotations, bones.length);
    for (let orderIndex = 0; orderIndex < appendOrder.length; orderIndex += 1) {
        const index = appendOrder[orderIndex];
        const bone = bones[index];
        if (!bone) {
            continue;
        }
        const appendTransform = bone.userData.mmdAppendTransform;
        const flags = bone.userData.mmdFlags;
        if (!appendTransform || (!flags?.appendRotate && !flags?.appendTranslate)) {
            continue;
        }
        const sourceBone = bones[appendTransform.parentIndex];
        if (!sourceBone) {
            continue;
        }
        const weight = appendTransform.weight;
        const parentHasAppend = sourceBone.userData.mmdAppendTransform !== undefined;
        if (flags.appendRotate) {
            const sourceRotation = sourceBone.quaternion;
            const slerpQ = weightedThreeQuaternion(sourceRotation, weight, scratchQuaternionA);
            appendRotations[index].copy(slerpQ);
            bone.quaternion.multiply(slerpQ);
        }
        if (flags.appendTranslate) {
            const weightedTranslation = scratchVector3A.copy(!flags.appendLocal && parentHasAppend
                ? appendTranslations[appendTransform.parentIndex]
                : sourceBone.position);
            weightedTranslation.multiplyScalar(weight);
            appendTranslations[index].copy(weightedTranslation);
            bone.position.add(weightedTranslation);
        }
    }
}
export function reapplyAppendTransformsForSources(mesh, sourceBoneIndices, appendOrder, preAppendTransforms, scratchChangedBoneIndices, scratchReappliedBoneIndices, scratchReapplyAppendTranslations, scratchReapplyAppendRotations, scratchVector3A, scratchQuaternionA) {
    if (!mesh || sourceBoneIndices.size === 0 || preAppendTransforms.length === 0) {
        return;
    }
    const bones = mesh.skeleton.bones;
    const appendTranslations = scratchReapplyAppendTranslations;
    const appendRotations = scratchReapplyAppendRotations;
    resetVectorScratchArray(appendTranslations, bones.length);
    resetQuaternionScratchArray(appendRotations, bones.length);
    const changedBoneIndices = scratchChangedBoneIndices;
    const reappliedBoneIndices = scratchReappliedBoneIndices;
    changedBoneIndices.clear();
    reappliedBoneIndices.clear();
    for (const index of sourceBoneIndices) {
        changedBoneIndices.add(index);
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (let orderIndex = 0; orderIndex < appendOrder.length; orderIndex += 1) {
            const index = appendOrder[orderIndex];
            if (reappliedBoneIndices.has(index)) {
                continue;
            }
            const bone = bones[index];
            const appendTransform = bone?.userData.mmdAppendTransform;
            const flags = bone?.userData.mmdFlags;
            if (!bone ||
                !appendTransform ||
                !changedBoneIndices.has(appendTransform.parentIndex) ||
                (!flags?.appendRotate && !flags?.appendTranslate)) {
                continue;
            }
            const base = preAppendTransforms[index];
            const sourceBone = bones[appendTransform.parentIndex];
            if (!base || !sourceBone) {
                continue;
            }
            bone.position.copy(base.position);
            bone.quaternion.copy(base.quaternion);
            const parentHasAppend = sourceBone.userData.mmdAppendTransform !== undefined;
            if (flags.appendRotate) {
                const sourceRotation = !flags.appendLocal && parentHasAppend
                    ? appendRotations[appendTransform.parentIndex]
                    : sourceBone.quaternion;
                const weightedRotation = weightedThreeQuaternion(sourceRotation, appendTransform.weight, scratchQuaternionA);
                appendRotations[index].copy(weightedRotation);
                bone.quaternion.multiply(weightedRotation);
            }
            if (flags.appendTranslate) {
                const sourceTranslation = scratchVector3A.copy(!flags.appendLocal && parentHasAppend
                    ? appendTranslations[appendTransform.parentIndex]
                    : sourceBone.position);
                if (flags.appendLocal || !parentHasAppend) {
                    sourceTranslation.sub(preAppendTransforms[appendTransform.parentIndex]?.position ?? zeroVector3);
                }
                const weightedTranslation = sourceTranslation.multiplyScalar(appendTransform.weight);
                appendTranslations[index].copy(weightedTranslation);
                bone.position.add(weightedTranslation);
            }
            reappliedBoneIndices.add(index);
            changedBoneIndices.add(index);
            changed = true;
        }
    }
}
function resetVectorScratchArray(values, length) {
    for (let index = 0; index < length; index += 1) {
        values[index]?.set(0, 0, 0);
    }
}
function resetQuaternionScratchArray(values, length) {
    for (let index = 0; index < length; index += 1) {
        values[index]?.identity();
    }
}
