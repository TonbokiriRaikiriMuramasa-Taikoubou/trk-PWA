import * as THREE from "three";
import { readMmdMeshRuntimeData } from "./userData.js";
function readIkChains(mesh) {
    const chains = readMmdMeshRuntimeData(mesh).mmdIkChains;
    return Array.isArray(chains) ? chains.filter(isRuntimeIkChain) : [];
}
function createCcdIkStaticBones(mesh) {
    return mesh.skeleton.bones.map((bone) => ({
        parentIndex: bone.parent instanceof THREE.Bone ? mesh.skeleton.bones.indexOf(bone.parent) : -1,
        translation: [0, 0, 0]
    }));
}
function collectIkSourceBoneIndices(chains) {
    const indices = new Set();
    collectIkSourceBoneIndicesInto(chains, indices);
    return indices;
}
function collectIkSourceBoneIndicesInto(chains, indices) {
    indices.clear();
    for (const chain of chains) {
        indices.add(chain.goalBoneIndex);
        indices.add(chain.effectorBoneIndex);
        for (const link of chain.links) {
            indices.add(link.boneIndex);
        }
    }
    return indices;
}
function isRuntimeIkChain(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const chain = value;
    return (Number.isInteger(chain.goalBoneIndex) &&
        Number.isInteger(chain.effectorBoneIndex) &&
        Number.isFinite(chain.iterationCount) &&
        Array.isArray(chain.links));
}
export function solvePreparedIk(mesh, solver, chains, scratch) {
    if (!mesh || chains.length === 0) {
        scratch.sourceBoneIndices.clear();
        return scratch.sourceBoneIndices;
    }
    mesh.updateWorldMatrix(false, true);
    const skeletonBones = mesh.skeleton.bones;
    ensureIkScratchLength(scratch, skeletonBones.length);
    for (let index = 0; index < skeletonBones.length; index += 1) {
        const bone = skeletonBones[index];
        const scratchBone = scratch.bones[index];
        scratchBone.parentIndex =
            bone.parent instanceof THREE.Bone ? skeletonBones.indexOf(bone.parent) : -1;
        scratchBone.translation[0] = bone.position.x;
        scratchBone.translation[1] = bone.position.y;
        scratchBone.translation[2] = -bone.position.z;
        const rotation = scratch.rotations[index];
        rotation[0] = -bone.quaternion.x;
        rotation[1] = -bone.quaternion.y;
        rotation[2] = bone.quaternion.z;
        rotation[3] = bone.quaternion.w;
    }
    solver.applyPrepared({
        bones: scratch.bones,
        pose: { rotations: scratch.rotations },
        chains
    });
    for (let index = 0; index < skeletonBones.length; index += 1) {
        const rotation = scratch.rotations[index];
        skeletonBones[index]?.quaternion.set(-rotation[0], -rotation[1], rotation[2], rotation[3]);
    }
    return collectIkSourceBoneIndicesInto(chains, scratch.sourceBoneIndices);
}
function ensureIkScratchLength(scratch, length) {
    for (let index = scratch.bones.length; index < length; index += 1) {
        scratch.bones.push({
            parentIndex: -1,
            translation: [0, 0, 0]
        });
    }
    for (let index = scratch.rotations.length; index < length; index += 1) {
        scratch.rotations.push([0, 0, 0, 1]);
    }
    scratch.bones.length = length;
    scratch.rotations.length = length;
}
export { collectIkSourceBoneIndices, createCcdIkStaticBones, readIkChains };
