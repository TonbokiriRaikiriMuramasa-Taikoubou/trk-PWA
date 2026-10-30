export function legacyMmdRigidBodyModeToPhysicsMotionType(mode) {
    switch (mode) {
        case "static":
            return "static";
        case "dynamicBone":
            return "dynamicWithBone";
        case "dynamic":
        case "unknown":
            return "dynamic";
    }
}
export function legacyMmdRigidBodyShapeToPhysicsShapeType(shape) {
    switch (shape) {
        case "box":
            return "box";
        case "capsule":
            return "capsule";
        case "sphere":
        case "unknown":
            return "sphere";
    }
}
export function legacyMmdEulerToQuaternion(euler) {
    const halfX = euler[0] * 0.5;
    const halfY = euler[1] * 0.5;
    const halfZ = euler[2] * 0.5;
    const sx = Math.sin(halfX);
    const cx = Math.cos(halfX);
    const sy = Math.sin(halfY);
    const cy = Math.cos(halfY);
    const sz = Math.sin(halfZ);
    const cz = Math.cos(halfZ);
    return [
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz
    ];
}
export function mapLegacyMmdRigidBodyToPhysicsRigidBody(rigidBody, index) {
    return {
        index,
        name: rigidBody.name,
        boneIndex: rigidBody.boneIndex,
        motionType: legacyMmdRigidBodyModeToPhysicsMotionType(rigidBody.mode),
        shape: {
            type: legacyMmdRigidBodyShapeToPhysicsShapeType(rigidBody.shape),
            size: rigidBody.size
        },
        localTranslation: rigidBody.position,
        localRotation: legacyMmdEulerToQuaternion(rigidBody.rotation),
        mass: rigidBody.mass,
        linearDamping: rigidBody.linearDamping,
        angularDamping: rigidBody.angularDamping,
        restitution: rigidBody.restitution,
        friction: rigidBody.friction,
        collisionGroup: rigidBody.group,
        collisionMask: rigidBody.mask
    };
}
export function mapLegacyMmdJointToPhysicsJoint(joint, index) {
    return {
        index,
        name: joint.name,
        rigidBodyIndexA: joint.rigidBodyIndexA,
        rigidBodyIndexB: joint.rigidBodyIndexB,
        translation: joint.position,
        rotation: legacyMmdEulerToQuaternion(joint.rotation),
        linearLimit: {
            lower: joint.translationLowerLimit,
            upper: joint.translationUpperLimit
        },
        angularLimit: {
            lower: joint.rotationLowerLimit,
            upper: joint.rotationUpperLimit
        },
        spring: {
            linear: joint.springTranslationFactor,
            angular: joint.springRotationFactor
        }
    };
}
export function writeTuple3ArrayToBuffer(tuples, buffer) {
    for (let i = 0; i < tuples.length; i += 1) {
        const tuple = tuples[i];
        const offset = i * 3;
        buffer[offset] = tuple[0];
        buffer[offset + 1] = tuple[1];
        buffer[offset + 2] = tuple[2];
    }
}
export function writeQuaternionArrayToBuffer(tuples, buffer) {
    for (let i = 0; i < tuples.length; i += 1) {
        const tuple = tuples[i];
        const offset = i * 4;
        buffer[offset] = tuple[0];
        buffer[offset + 1] = tuple[1];
        buffer[offset + 2] = tuple[2];
        buffer[offset + 3] = tuple[3];
    }
}
export function createBonePhysicsToggleBuffer(bones, toggles) {
    const buffer = new Uint8Array(bones.length);
    return writeBonePhysicsToggleBuffer(bones, toggles, buffer);
}
export function writeBonePhysicsToggleBuffer(bones, toggles, buffer) {
    if (buffer.length < bones.length) {
        throw new RangeError(`Bone physics toggle buffer must have at least ${bones.length} values; got ${buffer.length}.`);
    }
    for (let i = 0; i < bones.length; i += 1) {
        const bone = bones[i];
        const value = (bone.name === undefined ? undefined : toggles[bone.name]) ??
            (bone.englishName === undefined ? undefined : toggles[bone.englishName]) ??
            true;
        buffer[i] = value ? 1 : 0;
    }
    return buffer;
}
