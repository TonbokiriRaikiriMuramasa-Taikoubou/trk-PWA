import * as THREE from "three";
export function createThreeSkeleton(skeletonData) {
    if (skeletonData.bones.length === 0) {
        const root = new THREE.Bone();
        root.name = "__yw_mmd_root__";
        return new THREE.Skeleton([root]);
    }
    validateSkeletonData(skeletonData);
    const bones = skeletonData.bones.map((boneData) => {
        const bone = new THREE.Bone();
        bone.name = boneData.englishName || boneData.name;
        return bone;
    });
    skeletonData.bones.forEach((boneData, index) => {
        const bone = bones[index];
        const parent = boneData.parentIndex >= 0 ? bones[boneData.parentIndex] : undefined;
        const parentPosition = parent ? skeletonData.bones[boneData.parentIndex]?.position : undefined;
        const [parentX, parentY, parentZ] = parentPosition ?? [0, 0, 0];
        bone.position.set(boneData.position[0] - parentX, boneData.position[1] - parentY, -(boneData.position[2] - parentZ));
        parent?.add(bone);
    });
    return new THREE.Skeleton(bones);
}
function validateSkeletonData(skeletonData) {
    skeletonData.bones.forEach((boneData, index) => {
        if (!Number.isInteger(boneData.parentIndex) || boneData.parentIndex < -1) {
            throw new RangeError(`THREE_MMD_SKELETON_PARENT_INDEX_INVALID:${index}:${boneData.parentIndex}`);
        }
        if (boneData.parentIndex === index) {
            throw new RangeError(`THREE_MMD_SKELETON_PARENT_SELF:${index}`);
        }
        if (boneData.parentIndex >= skeletonData.bones.length) {
            throw new RangeError(`THREE_MMD_SKELETON_PARENT_OUT_OF_RANGE:${index}:${boneData.parentIndex}`);
        }
        if (!Array.isArray(boneData.position) || boneData.position.length !== 3) {
            throw new TypeError(`THREE_MMD_SKELETON_POSITION_INVALID:${index}`);
        }
        boneData.position.forEach((component, componentIndex) => {
            if (!Number.isFinite(component)) {
                throw new TypeError(`THREE_MMD_SKELETON_POSITION_NON_FINITE:${index}:${componentIndex}`);
            }
        });
    });
    skeletonData.bones.forEach((_boneData, index) => {
        validateParentChain(skeletonData, index);
    });
}
function validateParentChain(skeletonData, boneIndex) {
    const visited = new Set();
    let currentIndex = boneIndex;
    while (currentIndex >= 0) {
        if (visited.has(currentIndex)) {
            throw new RangeError(`THREE_MMD_SKELETON_PARENT_CYCLE:${boneIndex}:${currentIndex}`);
        }
        visited.add(currentIndex);
        currentIndex = skeletonData.bones[currentIndex]?.parentIndex ?? -1;
    }
}
