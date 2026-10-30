import { parseMmdAnimWasmFormatJson } from "./mmdAnimRuntime.js";
export function loadMmdAnimWasmVmd(wasm, bytes, fileName) {
    return mmdAnimWasmVmdDtoToAnimation(expectVmdDto(parseMmdAnimWasmFormatJson(wasm, bytes, fileName)), bytes.slice());
}
export function loadMmdAnimWasmVpd(wasm, bytes, fileName) {
    return mmdAnimWasmVpdDtoToPose(expectVpdDto(parseMmdAnimWasmFormatJson(wasm, bytes, fileName)), bytes.slice());
}
export function mmdAnimWasmVmdDtoToAnimation(dto, bytes = new Uint8Array()) {
    return {
        kind: "vmd",
        bytes,
        metadata: {
            modelName: dto.metadata.modelName,
            counts: dto.metadata.counts,
            maxFrame: dto.metadata.maxFrame
        },
        boneTracks: createBoneTracks(dto.boneFrames),
        morphTracks: createMorphTracks(dto.morphFrames),
        cameraFrames: dto.cameraFrames.map((frame) => ({
            frame: frame.frame,
            distance: frame.distance,
            position: toTuple3(frame.position),
            rotation: toTuple3(frame.rotation),
            fov: frame.fov,
            perspective: frame.perspective,
            interpolation: readCameraInterpolation(frame.interpolation)
        })),
        lightFrames: dto.lightFrames.map((frame) => ({
            frame: frame.frame,
            color: toTuple3(frame.color),
            direction: toTuple3(frame.direction)
        })),
        selfShadowFrames: dto.selfShadowFrames.map((frame) => ({
            frame: frame.frame,
            mode: frame.mode,
            distance: frame.distance
        })),
        propertyFrames: dto.propertyFrames.map((frame) => ({
            frame: frame.frame,
            visible: frame.visible,
            physicsSimulation: frame.physicsSimulation ?? true,
            ikStates: frame.ikStates.map((state) => ({
                boneName: state.boneName,
                enabled: state.enabled
            }))
        }))
    };
}
export function mmdAnimWasmVpdDtoToPose(dto, bytes = new Uint8Array()) {
    const bones = {};
    for (const bone of dto.bones) {
        bones[bone.name] = {
            name: bone.name,
            translation: toTuple3(bone.translation),
            rotation: toTuple4(bone.rotation)
        };
    }
    return {
        kind: "vpd",
        bytes,
        metadata: {
            modelFile: dto.modelFile,
            boneCount: dto.boneCount,
            morphCount: 0
        },
        bones,
        morphs: {}
    };
}
function createBoneTracks(frames) {
    const grouped = groupBy(frames, (frame) => frame.boneName);
    const tracks = {};
    for (const [name, sourceFrames] of grouped) {
        const sorted = [...sourceFrames].sort(compareFrame);
        const track = createBoneTrack(sorted.length);
        sorted.forEach((frame, index) => {
            track.frames[index] = frame.frame;
            track.translations.set(frame.translation, index * 3);
            track.rotations.set(frame.rotation, index * 4);
            writePackedBoneInterpolation(track.interpolations, index, readBoneInterpolation(frame.interpolation));
            track.physicsToggles[index] = readBonePhysicsToggle(frame.interpolation) ?? -1;
        });
        tracks[name] = track;
    }
    return tracks;
}
function createMorphTracks(frames) {
    const grouped = groupBy(frames, (frame) => frame.morphName);
    const tracks = {};
    for (const [name, sourceFrames] of grouped) {
        const sorted = [...sourceFrames].sort(compareFrame);
        const track = createMorphTrack(sorted.length);
        sorted.forEach((frame, index) => {
            track.frames[index] = frame.frame;
            track.weights[index] = frame.weight;
        });
        tracks[name] = track;
    }
    return tracks;
}
function createBoneTrack(count) {
    const physicsToggles = new Int8Array(count);
    physicsToggles.fill(-1);
    return {
        packed: "bone",
        frames: new Uint32Array(count),
        translations: new Float32Array(count * 3),
        rotations: new Float32Array(count * 4),
        interpolations: new Float32Array(count * 16),
        physicsToggles
    };
}
function createMorphTrack(count) {
    return {
        packed: "morph",
        frames: new Uint32Array(count),
        weights: new Float32Array(count)
    };
}
function groupBy(values, keyOf) {
    const result = new Map();
    for (const value of values) {
        const key = keyOf(value);
        const group = result.get(key);
        if (group) {
            group.push(value);
        }
        else {
            result.set(key, [value]);
        }
    }
    return result;
}
function compareFrame(left, right) {
    return left.frame - right.frame;
}
function writePackedBoneInterpolation(target, frameIndex, interpolation) {
    const offset = frameIndex * 16;
    const curves = [
        interpolation?.translationX,
        interpolation?.translationY,
        interpolation?.translationZ,
        interpolation?.rotation
    ];
    curves.forEach((curve, curveIndex) => {
        const curveOffset = offset + curveIndex * 4;
        target[curveOffset] = curve?.[0] ?? 0;
        target[curveOffset + 1] = curve?.[1] ?? 0;
        target[curveOffset + 2] = curve?.[2] ?? 0;
        target[curveOffset + 3] = curve?.[3] ?? 0;
    });
}
function readBoneInterpolation(bytes) {
    if (!bytes) {
        return undefined;
    }
    return {
        translationX: normalizeInterpolationCurve([bytes[0] ?? 0, bytes[4] ?? 0, bytes[8] ?? 0, bytes[12] ?? 0]),
        translationY: normalizeInterpolationCurve([bytes[1] ?? 0, bytes[5] ?? 0, bytes[9] ?? 0, bytes[13] ?? 0]),
        translationZ: normalizeInterpolationCurve([bytes[2] ?? 0, bytes[6] ?? 0, bytes[10] ?? 0, bytes[14] ?? 0]),
        rotation: normalizeInterpolationCurve([bytes[3] ?? 0, bytes[7] ?? 0, bytes[11] ?? 0, bytes[15] ?? 0])
    };
}
function readBonePhysicsToggle(bytes) {
    const physicsInfo = (((bytes?.[2] ?? 0) << 8) | (bytes?.[3] ?? 0)) >>> 0;
    if (physicsInfo === 0x0000) {
        return 1;
    }
    if (physicsInfo === 0x630f) {
        return 0;
    }
    return undefined;
}
function readCameraInterpolation(bytes) {
    if (!bytes) {
        return undefined;
    }
    return {
        positionX: readCameraInterpolationCurve(bytes, 0),
        positionY: readCameraInterpolationCurve(bytes, 1),
        positionZ: readCameraInterpolationCurve(bytes, 2),
        rotation: readCameraInterpolationCurve(bytes, 3),
        distance: readCameraInterpolationCurve(bytes, 4),
        fov: readCameraInterpolationCurve(bytes, 5)
    };
}
function readCameraInterpolationCurve(bytes, channel) {
    const offset = channel * 4;
    return normalizeInterpolationCurve([
        bytes[offset] ?? 0,
        bytes[offset + 1] ?? 0,
        bytes[offset + 2] ?? 0,
        bytes[offset + 3] ?? 0
    ]);
}
function normalizeInterpolationCurve(values) {
    return values.map((value) => Math.min(Math.max(value / 127, 0), 1));
}
function toTuple3(value) {
    return [value[0], value[1], value[2]];
}
function toTuple4(value) {
    return [value[0], value[1], value[2], value[3]];
}
function expectVmdDto(value) {
    if (!isObject(value) || value.kind !== "vmd") {
        throw new TypeError("mmd-anim wasm parser did not return a VMD DTO");
    }
    return value;
}
function expectVpdDto(value) {
    if (!isObject(value) || (value.kind !== "vpd" && value.format !== "vpd")) {
        throw new TypeError("mmd-anim wasm parser did not return a VPD DTO");
    }
    return value;
}
function isObject(value) {
    return typeof value === "object" && value !== null;
}
