import * as THREE from "three";
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function interpolateBezier(curve, x) {
    if (!curve) {
        return x;
    }
    const [x1, y1, x2, y2] = curve;
    if (Math.abs(x1 - y1) < 1e-6 && Math.abs(x2 - y2) < 1e-6) {
        return x;
    }
    let lower = 0;
    let upper = 1;
    let t = x;
    for (let i = 0; i < 16; i += 1) {
        const sampledX = cubicBezier(t, x1, x2);
        if (Math.abs(sampledX - x) < 1e-5) {
            break;
        }
        if (sampledX < x) {
            lower = t;
        }
        else {
            upper = t;
        }
        t = (lower + upper) / 2;
    }
    return cubicBezier(t, y1, y2);
}
function cubicBezier(t, p1, p2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}
function slerp(a, b, t) {
    let [bx, by, bz, bw] = b;
    let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (cos < 0) {
        cos = -cos;
        bx = -bx;
        by = -by;
        bz = -bz;
        bw = -bw;
    }
    if (cos > 0.9995) {
        return normalizeQuaternion([
            lerp(a[0], bx, t),
            lerp(a[1], by, t),
            lerp(a[2], bz, t),
            lerp(a[3], bw, t)
        ]);
    }
    const theta0 = Math.acos(cos);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - (cos * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return [a[0] * s0 + bx * s1, a[1] * s0 + by * s1, a[2] * s0 + bz * s1, a[3] * s0 + bw * s1];
}
function normalizeQuaternion(value) {
    const length = Math.hypot(value[0], value[1], value[2], value[3]);
    if (length < 1e-8) {
        return [0, 0, 0, 1];
    }
    return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}
function mmdQuaternionToThree(rotation) {
    return [-rotation[0], -rotation[1], rotation[2], rotation[3]];
}
function threeQuaternionToMmd(quaternion) {
    return [-quaternion.x, -quaternion.y, quaternion.z, quaternion.w];
}
const zeroVector3 = new THREE.Vector3();
function weightedThreeQuaternion(source, weight, target = new THREE.Quaternion()) {
    if (weight === 0) {
        return target.identity();
    }
    target.copy(source).normalize();
    let x = target.x;
    let y = target.y;
    let z = target.z;
    const w = target.w;
    if (weight < 0) {
        x = -x;
        y = -y;
        z = -z;
        return slerpIdentityQuaternionInto(x, y, z, w, -weight, target);
    }
    return slerpIdentityQuaternionInto(x, y, z, w, weight, target);
}
function slerpIdentityQuaternionInto(x, y, z, w, weight, target) {
    let bx = x;
    let by = y;
    let bz = z;
    let bw = w;
    let cos = bw;
    if (cos < 0) {
        cos = -cos;
        bx = -bx;
        by = -by;
        bz = -bz;
        bw = -bw;
    }
    if (cos > 0.9995) {
        return target.set(bx * weight, by * weight, bz * weight, 1 + (bw - 1) * weight).normalize();
    }
    const theta0 = Math.acos(cos);
    const theta = theta0 * weight;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - (cos * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return target.set(bx * s1, by * s1, bz * s1, s0 + bw * s1);
}
function prepareVector3ScratchArray(target, length) {
    for (let index = target.length; index < length; index += 1) {
        target.push(new THREE.Vector3());
    }
    target.length = length;
    for (const vector of target) {
        vector.set(0, 0, 0);
    }
    return target;
}
function prepareQuaternionScratchArray(target, length) {
    for (let index = target.length; index < length; index += 1) {
        target.push(new THREE.Quaternion());
    }
    target.length = length;
    for (const quaternion of target) {
        quaternion.identity();
    }
    return target;
}
function ensureFloat32ArrayLength(buffer, length) {
    return buffer.length === length ? buffer : new Float32Array(length);
}
function copyNumbersToFloat32Scratch(values, buffer) {
    const target = ensureFloat32ArrayLength(buffer, values.length);
    target.set(values);
    return target;
}
function normalizeFrameRate(frameRate) {
    if (!Number.isFinite(frameRate) || frameRate <= 0) {
        throw new RangeError("MMD runtime frameRate must be a finite positive number");
    }
    return frameRate;
}
function readMmdRestPosition(bone, mesh, index) {
    const restPosition = bone.userData.mmdRestPosition;
    if (isTuple3(restPosition)) {
        return [restPosition[0], restPosition[1], restPosition[2]];
    }
    bone.updateWorldMatrix(true, false);
    const worldPosition = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    const meshWorldPosition = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const relative = worldPosition.sub(meshWorldPosition);
    if (Number.isFinite(relative.x) && Number.isFinite(relative.y) && Number.isFinite(relative.z)) {
        return [relative.x, relative.y, -relative.z];
    }
    const local = mesh.skeleton.bones[index]?.position ?? new THREE.Vector3();
    return [local.x, local.y, -local.z];
}
function isTuple3(value) {
    return (Array.isArray(value) &&
        value.length === 3 &&
        value.every((component) => Number.isFinite(component)));
}
function clampOffsetVector(offsets, velocities, base, maxLength) {
    const length = Math.hypot(offsets[base], offsets[base + 1], offsets[base + 2]);
    if (length <= maxLength || length <= 1e-6) {
        return;
    }
    const scale = maxLength / length;
    for (let axis = 0; axis < 3; axis += 1) {
        offsets[base + axis] *= scale;
        velocities[base + axis] *= 0.25;
    }
}
function writeVector3ToBuffer(buffer, index, value) {
    const offset = index * 3;
    buffer[offset] = value[0];
    buffer[offset + 1] = value[1];
    buffer[offset + 2] = value[2];
}
function writeQuaternionToBuffer(buffer, index, value) {
    const offset = index * 4;
    buffer[offset] = value[0];
    buffer[offset + 1] = value[1];
    buffer[offset + 2] = value[2];
    buffer[offset + 3] = value[3];
}
export { clamp, clampOffsetVector, copyNumbersToFloat32Scratch, ensureFloat32ArrayLength, interpolateBezier, isTuple3, lerp, mmdQuaternionToThree, normalizeFrameRate, normalizeQuaternion, prepareQuaternionScratchArray, prepareVector3ScratchArray, readMmdRestPosition, slerp, slerpIdentityQuaternionInto, threeQuaternionToMmd, weightedThreeQuaternion, writeQuaternionToBuffer, writeVector3ToBuffer, zeroVector3 };
