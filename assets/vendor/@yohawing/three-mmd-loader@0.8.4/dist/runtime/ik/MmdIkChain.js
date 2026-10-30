export function createCcdIkSolveInputFromMmdIk(input) {
    return {
        bones: input.bones.map((bone) => ({
            parentIndex: bone.parentIndex,
            translation: [...bone.translation]
        })),
        pose: input.pose,
        chains: input.chains.map(mmdIkChainToCcdIkChain)
    };
}
export function mmdIkChainToCcdIkChain(chain) {
    return {
        goalBoneIndex: chain.boneIndex,
        effectorBoneIndex: chain.targetBoneIndex,
        links: chain.links.map(mmdIkLinkToCcdIkLink),
        iterationCount: chain.iterationCount,
        maxAnglePerIteration: chain.maxAnglePerIteration,
        tolerance: chain.tolerance
    };
}
function mmdIkLinkToCcdIkLink(link) {
    return {
        boneIndex: link.boneIndex,
        enabled: link.enabled,
        angleLimit: link.angleLimit,
        limitsKind: link.limitsKind
    };
}
