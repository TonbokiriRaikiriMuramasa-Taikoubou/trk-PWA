import * as THREE from "three";
import { applyMorphOverrides, validateMorphOverrides } from "./morphOverrides.js";
import { writeBonePhysicsToggleBuffer } from "../physics/legacyPhysicsBridge.js";
import { sampleMmdCameraTrackInto, sampleMmdLightTrackInto } from "./animation.js";
import { DefaultMmdRuntime } from "./core.js";
import { copyNumbersToFloat32Scratch, ensureFloat32ArrayLength, normalizeFrameRate, threeQuaternionToMmd, writeQuaternionToBuffer, writeVector3ToBuffer } from "./math.js";
import { syncMorphSplitTargetInfluences } from "./morphSplitSync.js";
import { HostRigPhysics } from "./hostRigPhysics.js";
import { applyPhysicsOutputToSkeleton, captureRuntimeDebugStageInto, createPhysicsResetContext, createPrePhysicsInputBuffersIfNeeded, extractMmdWorldMatricesInto, mergePhysicsOutputDeltas, readRuntimeExternalPhysics } from "./physics.js";
const defaultMmdAnimIkTolerance = 1.0e-2;
export function parseMmdAnimWasmFormatJson(wasm, data, fileName) {
    const parser = wasm.parseMmdFormatJson;
    if (!parser) {
        throw new TypeError("mmd-anim wasm module does not expose parseMmdFormatJson");
    }
    return JSON.parse(parser(data, fileName ?? null));
}
export function exportMmdAnimWasmFormatBytes(wasm, data, fileName) {
    const exporter = wasm.exportMmdFormatBytes;
    if (!exporter) {
        throw new TypeError("mmd-anim wasm module does not expose exportMmdFormatBytes");
    }
    return exporter(data, fileName ?? null);
}
export function exportMmdAnimWasmVmdAnimationJsonBytes(wasm, json) {
    const exporter = wasm.exportVmdAnimationJsonBytes;
    if (!exporter) {
        throw new TypeError("mmd-anim wasm module does not expose exportVmdAnimationJsonBytes");
    }
    return exporter(json);
}
export function exportMmdAnimWasmVpdPoseJsonBytes(wasm, json) {
    const exporter = wasm.exportVpdPoseJsonBytes;
    if (!exporter) {
        throw new TypeError("mmd-anim wasm module does not expose exportVpdPoseJsonBytes");
    }
    return exporter(json);
}
export function createMmdAnimWasmCameraTrack(wasm, bytes) {
    return wasm.WasmVmdCameraTrack?.fromVmdBytes?.(bytes);
}
export function createMmdAnimWasmLightTrack(wasm, bytes) {
    return wasm.WasmVmdLightTrack?.fromVmdBytes?.(bytes);
}
export function sampleMmdAnimWasmCameraTrackInto(track, frame, scratch, target) {
    if (scratch.length < 9 || !track.sample(frame, scratch)) {
        throw new RangeError("MmdAnimRuntime camera sample buffer is too short");
    }
    target.distance = scratch[0] ?? 0;
    target.position[0] = scratch[1] ?? 0;
    target.position[1] = scratch[2] ?? 0;
    target.position[2] = scratch[3] ?? 0;
    target.rotation[0] = scratch[4] ?? 0;
    target.rotation[1] = scratch[5] ?? 0;
    target.rotation[2] = scratch[6] ?? 0;
    target.fov = scratch[7] ?? 1;
    target.perspective = (scratch[8] ?? 1) >= 0.5;
    return target;
}
export function sampleMmdAnimWasmLightTrackInto(track, frame, scratch, target) {
    if (scratch.length < 6 || !track.sample(frame, scratch)) {
        throw new RangeError("MmdAnimRuntime light sample buffer is too short");
    }
    target.color[0] = scratch[0] ?? 0;
    target.color[1] = scratch[1] ?? 0;
    target.color[2] = scratch[2] ?? 0;
    target.direction[0] = scratch[3] ?? 0;
    target.direction[1] = scratch[4] ?? 0;
    target.direction[2] = scratch[5] ?? 0;
    return target;
}
/**
 * Experimental runtime adapter for the mmd-anim WASM evaluator.
 *
 * The adapter intentionally accepts structural wasm types instead of importing
 * a package name, so local harness builds and future published artifacts can be
 * tested without changing this package's dependency graph.
 */
export class MmdAnimRuntime {
    hostRig;
    hostRigPhysics;
    hostPose;
    hostIkDisabled = new Uint8Array(0);
    frameRate;
    wasm;
    wasmModel;
    wasmRuntime;
    ownsWasmResources;
    physicsMode;
    physicsBackend;
    ikTolerance;
    ikMaxIterationsCap;
    state;
    evaluateReturnState = {
        seconds: 0,
        frame: 0,
        frameRate: 30
    };
    worldMatrices;
    morphWeights;
    hostMorphWeights;
    debugStages = createEmptyDebugStages();
    scratchWorldMatrices = [];
    scratchThreeWorldMatrix = new THREE.Matrix4();
    scratchLocalMatrix = new THREE.Matrix4();
    scratchParentInverseMatrix = new THREE.Matrix4();
    scratchParentBoneIndices = [];
    scratchCameraState = {
        distance: 0,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        fov: 1,
        perspective: true
    };
    scratchCameraSample = new Float32Array(9);
    scratchCameraFrameHint = { index: 0 };
    scratchLightState = {
        color: [0, 0, 0],
        direction: [0, 0, 0]
    };
    scratchLightSample = new Float32Array(6);
    scratchExternalPhysicsInput = {
        translations: new Float32Array(0),
        rotations: new Float32Array(0),
        worldMatricesColumnMajor: new Float32Array(0),
        outputTranslations: new Float32Array(0),
        outputRotations: new Float32Array(0),
        outputWorldMatricesColumnMajor: new Float32Array(0),
        updatedBoneIndices: [],
        bonePhysicsToggleBuffer: new Uint8Array(0),
        worldMatricesColumnMajorNumbers: []
    };
    scratchPrePhysics = {
        preTranslations: new Float32Array(0),
        preRotations: new Float32Array(0),
        preWorldMatricesColumnMajor: new Float32Array(0),
        composeWorldPositions: [],
        composeWorldRotations: [],
        composeMatrix: new THREE.Matrix4(),
        composeUnitScale: new THREE.Vector3(1, 1, 1),
        mergeTargetRotation: new THREE.Quaternion(),
        mergePreRotation: new THREE.Quaternion(),
        mergePhysicsRotation: new THREE.Quaternion(),
        localPosition: new THREE.Vector3(),
        localRotation: new THREE.Quaternion()
    };
    wasmClip;
    wasmCameraTrack;
    wasmLightTrack;
    ownsWasmClip = false;
    mesh;
    mmdAnimation;
    parsedTrackRuntime;
    externalPhysicsData;
    previousEvaluateSeconds;
    physicsDisabled = false;
    _restPoseDirty = true;
    constructor(options) {
        this.frameRate = normalizeFrameRate(options.frameRate ?? 30);
        this.wasm = options.wasm;
        this.wasmModel = options.model ?? createWasmModelFromPmxBytes(options.wasm, options.pmxBytes);
        this.wasmRuntime = createWasmRuntime(options.wasm, this.wasmModel);
        this.ownsWasmResources = options.ownsWasmResources ?? true;
        this.physicsMode = options.physics ?? "none";
        this.physicsBackend = options.physicsBackend;
        this.ikTolerance = readNonNegativeOptionalNumber(options.ikTolerance, "MmdAnimRuntime ikTolerance");
        this.ikMaxIterationsCap = readNonNegativeIntegerOptionalNumber(options.ikMaxIterationsCap, "MmdAnimRuntime ikMaxIterationsCap");
        this.wasmClip = options.clip;
        this.worldMatrices = new Float32Array(this.wasmRuntime.worldMatrixF32Len());
        this.morphWeights = new Float32Array(this.wasmRuntime.morphWeightLen?.() ?? this.wasmModel.morphCount?.() ?? 0);
        this.hostMorphWeights = new Float32Array(this.morphWeights.length);
        this.state = createFrameState(options.initialSeconds ?? 0, this.frameRate);
    }
    static fromPmxBytes(wasm, pmxBytes, options = {}) {
        return new MmdAnimRuntime({ ...options, wasm, pmxBytes });
    }
    evaluate(seconds, options) {
        const overrides = options?.morphOverrides;
        validateMorphOverrides(overrides, this.hostMorphWeights.length);
        if (!this.hostRig && !this.parsedTrackRuntime && overrides?.indices.length) {
            const supported = this.wasmClip
                ? this.wasmRuntime.evaluateClipFrameWithMorphOverrides
                : this.wasmRuntime.evaluateRestPoseWithMorphOverrides;
            if (!supported)
                throw new Error("mmd-anim WASM must be rebuilt to support morph overrides");
        }
        if (this.hostRig) {
            return this.evaluateHostPose(seconds, options);
        }
        const previousSeconds = this.state.seconds;
        writeFrameState(this.state, seconds, this.frameRate);
        if (this.parsedTrackRuntime) {
            const state = this.parsedTrackRuntime.evaluate(seconds, options);
            return copyFrameStateInto(this.evaluateReturnState, state);
        }
        let poseEvaluated = false;
        if (overrides?.indices.length) {
            // Match ordinary clip/rest evaluation, including its default IK policy.
            const configuredIk = this.wasmClip && (this.ikTolerance !== undefined || this.ikMaxIterationsCap !== undefined);
            const tolerance = configuredIk ? this.ikTolerance ?? defaultMmdAnimIkTolerance : undefined;
            const cap = configuredIk ? this.ikMaxIterationsCap ?? 0 : 0;
            if (this.wasmClip) {
                this.wasmRuntime.evaluateClipFrameWithMorphOverrides?.(this.wasmClip, this.state.frame, overrides.indices, overrides.weights, tolerance, cap, options?.ik !== false);
            }
            else {
                this.wasmRuntime.evaluateRestPoseWithMorphOverrides?.(overrides.indices, overrides.weights, tolerance, cap, options?.ik !== false);
            }
            this._restPoseDirty = true;
            poseEvaluated = true;
        }
        else if (this.wasmClip) {
            this.evaluateWasmClipFrame(this.wasmClip, this.state.frame);
            poseEvaluated = true;
        }
        else if (this._restPoseDirty) {
            this.wasmRuntime.evaluateRestPose();
            this._restPoseDirty = false;
            poseEvaluated = true;
        }
        if (poseEvaluated) {
            this.copyWasmOutput();
            this.syncBoundMesh();
            this.captureDebugStage("vmdInterpolation");
            this.captureDebugStage("appendTransform");
            this.captureDebugStage("ik");
        }
        if (options?.physics === false) {
            if (!this.physicsDisabled) {
                this.resetPhysicsState();
            }
            this.physicsDisabled = true;
        }
        else {
            this.stepExternalPhysics(previousSeconds);
            this.physicsDisabled = false;
        }
        this.capturePhysicsDebugStage();
        this.previousEvaluateSeconds = options?.physics === false ? undefined : this.state.seconds;
        return copyFrameStateInto(this.evaluateReturnState, this.state);
    }
    /** Configure host evaluation and bind its display skeleton without a VMD clip. */
    setHostRig(definition, mesh) {
        if (this.physicsMode === "external" && !this.physicsBackend) {
            throw new TypeError("MmdAnimRuntime host rigs require a physicsBackend for external physics");
        }
        if (!isSkinnedMesh(mesh) || mesh.skeleton.bones.length !== this.wasmModel.boneCount()) {
            throw new TypeError("MmdAnimRuntime host rig mesh must match the model bone count and order");
        }
        const Rig = this.wasm?.WasmMmdHostRig;
        if (!Rig) {
            throw new TypeError("mmd-anim wasm module does not expose WasmMmdHostRig");
        }
        const rig = new Rig(this.wasmModel, definition.drivenBoneIndices, definition.goalBoneIndices);
        if (this.physicsMode === "external" && !rig.evaluateWithExternalPhysics) {
            rig.free();
            throw new TypeError("mmd-anim wasm host rig does not expose evaluateWithExternalPhysics");
        }
        this.clearHostRig();
        this.clearAnimation();
        this.hostRig = rig;
        // Keep the ordinary path bound to the same mesh when the rig is cleared.
        this.externalPhysicsData = this.physicsMode === "external" && this.physicsBackend
            ? readRuntimeExternalPhysics(mesh)
            : undefined;
        if (this.externalPhysicsData && this.physicsBackend) {
            this.hostRigPhysics = new HostRigPhysics(this.physicsBackend, this.externalPhysicsData, definition.drivenBoneIndices);
            this.hostRigPhysics.reset();
        }
        this.hostIkDisabled = new Uint8Array(this.wasmModel.ikCount?.() ?? 0);
        this.mesh = mesh;
        writeParentBoneIndices(mesh.skeleton.bones, this.scratchParentBoneIndices);
        ensureScratchMatrixArrayLength(this.scratchWorldMatrices, mesh.skeleton.bones.length);
    }
    /** Retains caller-owned buffers; populate them before every evaluate/tick call. */
    setHostPose(pose) {
        if (!this.hostRig) {
            throw new TypeError("MmdAnimRuntime setHostRig must precede setHostPose");
        }
        this.hostPose = pose;
    }
    /** Release the configured rig and return to ordinary rest/VMD evaluation. */
    clearHostRig() {
        if (this.hostRig) {
            this.previousEvaluateSeconds = undefined;
            this.physicsDisabled = false;
        }
        this.hostRigPhysics?.reset();
        this.hostRigPhysics = undefined;
        this.hostRig?.free();
        this.hostRig = undefined;
        this.hostPose = undefined;
        this._restPoseDirty = true;
    }
    evaluateHostPose(seconds, options) {
        if (!Number.isFinite(seconds)) {
            throw new RangeError("MmdAnimRuntime seconds must be finite");
        }
        const rig = this.hostRig;
        const pose = this.hostPose;
        if (!rig || !pose) {
            throw new TypeError("MmdAnimRuntime host rig requires a fresh base pose");
        }
        let morphWeights = pose.morphWeights;
        if (options?.morphOverrides?.indices.length) {
            if (morphWeights.length !== this.hostMorphWeights.length) {
                throw new RangeError("Host pose morph count must match the model");
            }
            this.hostMorphWeights.set(morphWeights);
            applyMorphOverrides(this.hostMorphWeights, options.morphOverrides);
            morphWeights = this.hostMorphWeights;
        }
        const physics = options?.physics === false ? undefined : this.hostRigPhysics;
        if (physics && rig.evaluateWithExternalPhysics) {
            physics.prepare(seconds, this.frameRate);
            try {
                rig.evaluateWithExternalPhysics(this.wasmRuntime, pose.positions, pose.rotations, pose.scales, morphWeights, options?.ik === false ? this.hostIkDisabled : pose.ikEnabled, this.ikTolerance ?? defaultMmdAnimIkTolerance, this.ikMaxIterationsCap ?? 0, physics.step);
                physics.commit();
            }
            catch (error) {
                // A failed callback may have advanced the solver. Recover by reseeding
                // on the next frame; the display remains at its last successful pose.
                physics.reset();
                throw error;
            }
        }
        else {
            this.hostRigPhysics?.reset();
            rig.evaluate(this.wasmRuntime, pose.positions, pose.rotations, pose.scales, morphWeights, options?.ik === false ? this.hostIkDisabled : pose.ikEnabled, this.ikTolerance ?? defaultMmdAnimIkTolerance, this.ikMaxIterationsCap ?? 0);
        }
        writeFrameState(this.state, seconds, this.frameRate);
        this.copyWasmOutput();
        this.syncBoundMesh();
        this.captureDebugStage("vmdInterpolation");
        this.captureDebugStage("appendTransform");
        this.captureDebugStage("ik");
        this.capturePhysicsDebugStage();
        return copyFrameStateInto(this.evaluateReturnState, this.state);
    }
    tick(seconds, meshOrOptions, options) {
        let renderObject;
        let evaluateOptions;
        if (isObject3D(meshOrOptions)) {
            renderObject = meshOrOptions;
            evaluateOptions = options;
        }
        else if (meshOrOptions == null) {
            renderObject = undefined;
            evaluateOptions = options;
        }
        else {
            renderObject = meshOrOptions.mesh;
            evaluateOptions = meshOrOptions;
        }
        const state = this.evaluate(seconds, evaluateOptions);
        syncRuntimeObjectForRender(renderObject ?? this.mesh);
        return state;
    }
    seek(seconds) {
        this.hostRigPhysics?.reset();
        writeFrameState(this.state, seconds, this.frameRate);
        this.parsedTrackRuntime?.seek(seconds);
        return copyFrameStateInto(this.evaluateReturnState, this.state);
    }
    resetPose() {
        this.hostRigPhysics?.reset();
        this.hostPose = undefined;
        if (this.parsedTrackRuntime) {
            this.parsedTrackRuntime.resetPose();
            return;
        }
        this._restPoseDirty = true;
        this.wasmRuntime.evaluateRestPose();
        this._restPoseDirty = false;
        this.copyWasmOutput();
        this.syncBoundMesh();
    }
    clearAnimation() {
        this.releaseOwnedClip();
        this.releaseCameraTrack();
        this.releaseLightTrack();
        this.wasmClip = undefined;
        this.mmdAnimation = undefined;
        this.parsedTrackRuntime = undefined;
        this.scratchCameraFrameHint.index = 0;
        this._restPoseDirty = true;
    }
    cameraState() {
        if (this.parsedTrackRuntime) {
            return this.parsedTrackRuntime.cameraState();
        }
        if (this.wasmCameraTrack) {
            return sampleMmdAnimWasmCameraTrackInto(this.wasmCameraTrack, this.state.frame, this.scratchCameraSample, this.scratchCameraState);
        }
        const frames = this.mmdAnimation?.cameraFrames;
        if (!frames || frames.length === 0) {
            this.scratchCameraFrameHint.index = 0;
            return undefined;
        }
        return sampleMmdCameraTrackInto(frames, this.state.frame, this.scratchCameraState, this.scratchCameraFrameHint);
    }
    lightState() {
        if (this.parsedTrackRuntime) {
            return this.parsedTrackRuntime.lightState();
        }
        if (this.wasmLightTrack) {
            return sampleMmdAnimWasmLightTrackInto(this.wasmLightTrack, this.state.frame, this.scratchLightSample, this.scratchLightState);
        }
        const frames = this.mmdAnimation?.lightFrames;
        if (!frames || frames.length === 0) {
            return undefined;
        }
        return sampleMmdLightTrackInto(frames, this.state.frame, this.scratchLightState);
    }
    reset(seconds = 0) {
        this.seek(seconds);
        this.resetPose();
        this.clearAnimation();
        return copyFrameStateInto(this.evaluateReturnState, this.state);
    }
    setAnimation(animation, mesh) {
        if (!isSkinnedMesh(mesh)) {
            throw new TypeError("MmdAnimRuntime mesh must be a THREE.SkinnedMesh");
        }
        if (animation.kind !== "vmd") {
            throw new TypeError("MmdAnimRuntime animation must be an MmdAnimation");
        }
        this.clearHostRig();
        this._restPoseDirty = true;
        this.mesh = mesh;
        this.mmdAnimation = animation;
        this.parsedTrackRuntime = undefined;
        this.scratchCameraFrameHint.index = 0;
        this.releaseCameraTrack();
        this.releaseLightTrack();
        writeParentBoneIndices(mesh.skeleton.bones, this.scratchParentBoneIndices);
        this.externalPhysicsData =
            this.physicsMode === "external" && this.physicsBackend
                ? readRuntimeExternalPhysics(mesh)
                : undefined;
        this.resetPhysicsState();
        this.previousEvaluateSeconds = undefined;
        this.physicsDisabled = false;
        if (hasParsedModelTracks(animation) && !isLikelyVmdBytes(animation.bytes)) {
            this.releaseOwnedClip();
            this.wasmClip = undefined;
            this.externalPhysicsData = undefined;
            this.parsedTrackRuntime = new DefaultMmdRuntime({
                frameRate: this.frameRate,
                initialSeconds: this.state.seconds,
                physics: this.physicsMode === "external" ? "external" : "none",
                physicsBackend: this.physicsBackend
            });
            this.parsedTrackRuntime.setAnimation(animation, mesh);
            return;
        }
        if (!(animation.bytes instanceof Uint8Array) || animation.bytes.byteLength === 0) {
            this.releaseOwnedClip();
            this.wasmClip = undefined;
            return;
        }
        const clipFactory = this.wasm?.WasmMmdClip?.fromVmdBytesForModel;
        if (clipFactory) {
            this.releaseOwnedClip();
            this.wasmClip = clipFactory(this.wasmModel, animation.bytes);
            this.ownsWasmClip = true;
        }
        if (animation.metadata.counts.cameras > 0 || animation.cameraFrames.length > 0) {
            try {
                this.wasmCameraTrack = createMmdAnimWasmCameraTrack(this.wasm ?? {}, animation.bytes);
            }
            catch {
                this.wasmCameraTrack = undefined;
            }
        }
        if (animation.metadata.counts.lights > 0 || animation.lightFrames.length > 0) {
            try {
                this.wasmLightTrack = createMmdAnimWasmLightTrack(this.wasm ?? {}, animation.bytes);
            }
            catch {
                this.wasmLightTrack = undefined;
            }
        }
    }
    frameState() {
        return { ...this.state };
    }
    debugState() {
        if (this.parsedTrackRuntime) {
            return this.parsedTrackRuntime.debugState();
        }
        return {
            stages: {
                vmdInterpolation: cloneDebugStage(this.debugStages.vmdInterpolation),
                appendTransform: cloneDebugStage(this.debugStages.appendTransform),
                ik: cloneDebugStage(this.debugStages.ik),
                physics: cloneDebugStage(this.debugStages.physics)
            }
        };
    }
    debugRigidBodyWorldTransformsColumnMajor() {
        if (this.parsedTrackRuntime) {
            return this.parsedTrackRuntime.debugRigidBodyWorldTransformsColumnMajor();
        }
        return this.physicsBackend?.debugRigidBodyWorldTransformsColumnMajor?.() ?? [];
    }
    dispose() {
        this.clearHostRig();
        this.releaseOwnedClip();
        this.releaseCameraTrack();
        this.releaseLightTrack();
        if (!this.ownsWasmResources) {
            return;
        }
        this.wasmRuntime.free?.();
        this.wasmModel.free?.();
    }
    copyWasmOutput() {
        const worldMatricesView = this.wasmRuntime.worldMatricesView?.();
        if (worldMatricesView) {
            if (worldMatricesView.length < this.wasmRuntime.worldMatrixF32Len()) {
                throw new RangeError("MmdAnimRuntime world matrix view is too short");
            }
            this.worldMatrices = worldMatricesView;
        }
        else if (!this.wasmRuntime.copyWorldMatrices(this.worldMatrices)) {
            throw new RangeError("MmdAnimRuntime world matrix buffer is too short");
        }
        const morphWeightsView = this.wasmRuntime.morphWeightsView?.();
        if (morphWeightsView) {
            this.morphWeights = morphWeightsView;
        }
        else {
            this.wasmRuntime.copyMorphWeights?.(this.morphWeights);
        }
    }
    evaluateWasmClipFrame(clip, frame) {
        if (this.ikTolerance === undefined && this.ikMaxIterationsCap === undefined) {
            this.wasmRuntime.evaluateClipFrame(clip, frame);
            return;
        }
        const evaluateWithIkOptions = this.wasmRuntime.evaluateClipFrameWithIkOptions;
        if (!evaluateWithIkOptions) {
            throw new TypeError("mmd-anim wasm runtime does not expose evaluateClipFrameWithIkOptions");
        }
        evaluateWithIkOptions.call(this.wasmRuntime, clip, frame, this.ikTolerance ?? defaultMmdAnimIkTolerance, this.ikMaxIterationsCap ?? 0);
    }
    syncBoundMesh() {
        const mesh = this.mesh;
        if (!mesh) {
            return;
        }
        syncWorldMatricesToSkeleton(mesh, this.worldMatrices, this.scratchWorldMatrices, this.scratchParentBoneIndices, this.scratchThreeWorldMatrix, this.scratchLocalMatrix, this.scratchParentInverseMatrix);
        syncMorphWeights(mesh, this.morphWeights);
        syncMorphSplitTargetInfluences(mesh);
    }
    captureDebugStage(stage) {
        const target = this.debugStages[stage];
        copyArrayLikeToNumberArray(this.worldMatrices, target.worldMatricesColumnMajor);
        copyArrayLikeToNumberArray(this.morphWeights, target.morphWeights);
    }
    capturePhysicsDebugStage() {
        const mesh = this.mesh;
        if (!mesh) {
            this.captureDebugStage("physics");
            return;
        }
        captureRuntimeDebugStageInto(mesh, this.debugStages.physics);
    }
    stepExternalPhysics(previousSeconds) {
        const mesh = this.mesh;
        const data = this.externalPhysicsData;
        const backend = this.physicsBackend;
        if (this.physicsMode !== "external" || !mesh || !data || !backend || backend.disabled || backend.disposed) {
            return;
        }
        mesh.updateWorldMatrix(false, true);
        const boneCount = mesh.skeleton.bones.length;
        const inputTranslations = ensureFloat32ArrayLength(this.scratchExternalPhysicsInput.translations, boneCount * 3);
        this.scratchExternalPhysicsInput.translations = inputTranslations;
        inputTranslations.fill(0, 0, boneCount * 3);
        const inputRotations = ensureFloat32ArrayLength(this.scratchExternalPhysicsInput.rotations, boneCount * 4);
        this.scratchExternalPhysicsInput.rotations = inputRotations;
        inputRotations.fill(0, 0, boneCount * 4);
        for (let index = 0; index < boneCount; index += 1) {
            const bone = mesh.skeleton.bones[index];
            if (!bone) {
                continue;
            }
            writeVector3ToBuffer(inputTranslations, index, [
                bone.position.x,
                bone.position.y,
                -bone.position.z
            ]);
            writeQuaternionToBuffer(inputRotations, index, threeQuaternionToMmd(bone.quaternion));
        }
        const inputWorldMatricesColumnMajor = copyNumbersToFloat32Scratch(extractMmdWorldMatricesInto(mesh, this.scratchExternalPhysicsInput.worldMatricesColumnMajorNumbers), this.scratchExternalPhysicsInput.worldMatricesColumnMajor);
        this.scratchExternalPhysicsInput.worldMatricesColumnMajor = inputWorldMatricesColumnMajor;
        const prePhysics = createPrePhysicsInputBuffersIfNeeded(data.skeleton, inputTranslations, inputRotations, inputWorldMatricesColumnMajor, this.scratchPrePhysics);
        const physicsInputTranslations = prePhysics?.translations ?? inputTranslations;
        const physicsInputRotations = prePhysics?.rotations ?? inputRotations;
        const physicsInputWorldMatricesColumnMajor = prePhysics?.worldMatricesColumnMajor ?? inputWorldMatricesColumnMajor;
        const outputTranslations = copyFloat32ArrayToScratch(physicsInputTranslations, this.scratchExternalPhysicsInput.outputTranslations);
        this.scratchExternalPhysicsInput.outputTranslations = outputTranslations;
        const outputRotations = copyFloat32ArrayToScratch(physicsInputRotations, this.scratchExternalPhysicsInput.outputRotations);
        this.scratchExternalPhysicsInput.outputRotations = outputRotations;
        const outputWorldMatricesColumnMajor = copyFloat32ArrayToScratch(physicsInputWorldMatricesColumnMajor, this.scratchExternalPhysicsInput.outputWorldMatricesColumnMajor);
        this.scratchExternalPhysicsInput.outputWorldMatricesColumnMajor =
            outputWorldMatricesColumnMajor;
        if (this.scratchExternalPhysicsInput.bonePhysicsToggleBuffer.length < data.bones.length) {
            this.scratchExternalPhysicsInput.bonePhysicsToggleBuffer = new Uint8Array(data.bones.length);
        }
        const context = {
            seconds: this.state.seconds,
            deltaSeconds: Math.max(0, this.state.seconds - previousSeconds),
            frame: this.state.frame,
            frameRate: this.state.frameRate,
            seeking: this.previousEvaluateSeconds === undefined ||
                this.state.seconds < this.previousEvaluateSeconds,
            skeleton: data.skeleton,
            rigidBodies: data.rigidBodies,
            joints: data.joints,
            inputTranslations: physicsInputTranslations,
            inputRotations: physicsInputRotations,
            inputWorldMatricesColumnMajor: physicsInputWorldMatricesColumnMajor,
            output: {
                translations: outputTranslations,
                rotations: outputRotations,
                worldMatricesColumnMajor: outputWorldMatricesColumnMajor,
                updatedBoneIndices: resetNumberArray(this.scratchExternalPhysicsInput.updatedBoneIndices)
            },
            bonePhysicsToggles: writeBonePhysicsToggleBuffer(data.bones, {}, this.scratchExternalPhysicsInput.bonePhysicsToggleBuffer),
            morphImpulses: data.morphImpulses
        };
        const result = backend.step(context);
        const updatedBoneCount = result.updatedBoneCount ?? context.output?.updatedBoneIndices?.length ?? 0;
        if (!result.simulated && updatedBoneCount === 0) {
            return;
        }
        if (prePhysics) {
            mergePhysicsOutputDeltas(context, inputTranslations, inputRotations, prePhysics, this.scratchPrePhysics);
        }
        applyPhysicsOutputToSkeleton(mesh, context, updatedBoneCount);
        mesh.skeleton.update();
    }
    resetPhysicsState() {
        this.physicsBackend?.reset?.(createPhysicsResetContext(this.state));
    }
    releaseOwnedClip() {
        if (this.ownsWasmClip) {
            this.wasmClip?.free?.();
        }
        this.ownsWasmClip = false;
    }
    releaseCameraTrack() {
        this.wasmCameraTrack?.free?.();
        this.wasmCameraTrack = undefined;
    }
    releaseLightTrack() {
        this.wasmLightTrack?.free?.();
        this.wasmLightTrack = undefined;
    }
}
function copyFloat32ArrayToScratch(source, scratch) {
    const target = ensureFloat32ArrayLength(scratch, source.length);
    target.set(source);
    return target;
}
function resetNumberArray(target) {
    target.length = 0;
    return target;
}
function copyArrayLikeToNumberArray(values, target) {
    target.length = values.length;
    for (let index = 0; index < values.length; index += 1) {
        target[index] = values[index];
    }
    return target;
}
function createWasmModelFromPmxBytes(wasm, bytes) {
    const factory = wasm?.WasmMmdModel?.fromPmxBytes;
    if (!factory || !bytes) {
        throw new TypeError("MmdAnimRuntime requires either a wasm model or wasm.WasmMmdModel.fromPmxBytes with pmxBytes");
    }
    return factory(bytes);
}
function createWasmRuntime(wasm, model) {
    const runtimeFactory = wasm?.WasmMmdRuntimeInstance;
    if (!runtimeFactory) {
        throw new TypeError("MmdAnimRuntime requires wasm.WasmMmdRuntimeInstance");
    }
    return runtimeFactory.forModel?.(model) ?? new runtimeFactory(model, model.morphCount?.() ?? 0);
}
function hasParsedModelTracks(animation) {
    return Object.keys(animation.boneTracks).length > 0 || Object.keys(animation.morphTracks).length > 0;
}
function isLikelyVmdBytes(bytes) {
    const header = "Vocaloid Motion Data";
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < header.length) {
        return false;
    }
    for (let index = 0; index < header.length; index += 1) {
        if (bytes[index] !== header.charCodeAt(index)) {
            return false;
        }
    }
    return true;
}
function syncWorldMatricesToSkeleton(mesh, matrices, worldMatrices, parentBoneIndices, threeWorldMatrix, localMatrix, parentInverseMatrix) {
    const bones = mesh.skeleton.bones;
    ensureScratchMatrixArrayLength(worldMatrices, bones.length);
    for (let index = 0; index < bones.length; index += 1) {
        writeMmdWorldMatrixToThree(matrices, index, threeWorldMatrix);
        worldMatrices[index].copy(threeWorldMatrix);
    }
    for (let index = 0; index < bones.length; index += 1) {
        const bone = bones[index];
        const parentBoneIndex = parentBoneIndices[index] ?? -1;
        if (parentBoneIndex >= 0) {
            localMatrix.copy(parentInverseMatrix.copy(worldMatrices[parentBoneIndex]).invert()).multiply(worldMatrices[index]);
        }
        else {
            localMatrix.copy(worldMatrices[index]);
        }
        localMatrix.decompose(bone.position, bone.quaternion, bone.scale);
        bone.updateMatrix();
    }
    mesh.updateMatrixWorld(true);
    mesh.skeleton.update();
    if (mesh.skeleton.boneTexture) {
        mesh.skeleton.boneTexture.needsUpdate = true;
    }
}
function writeMmdWorldMatrixToThree(matrices, index, target) {
    const offset = index * 16;
    return target.set(matrices[offset], matrices[offset + 4], -matrices[offset + 8], matrices[offset + 12], matrices[offset + 1], matrices[offset + 5], -matrices[offset + 9], matrices[offset + 13], -matrices[offset + 2], -matrices[offset + 6], matrices[offset + 10], -matrices[offset + 14], 0, 0, 0, 1);
}
function writeParentBoneIndices(bones, target) {
    target.length = bones.length;
    for (let index = 0; index < bones.length; index += 1) {
        const parent = bones[index]?.parent;
        let parentIndex = -1;
        if (parent) {
            for (let candidate = 0; candidate < bones.length; candidate += 1) {
                if (bones[candidate] === parent) {
                    parentIndex = candidate;
                    break;
                }
            }
        }
        target[index] = parentIndex;
    }
}
function syncMorphWeights(mesh, weights) {
    const influences = mesh.morphTargetInfluences;
    if (!influences) {
        return;
    }
    for (let index = 0; index < influences.length; index += 1) {
        influences[index] = weights[index] ?? 0;
    }
}
function syncRuntimeObjectForRender(object) {
    if (!object) {
        return;
    }
    object.updateMatrixWorld(true);
    updateSkinnedMeshSkeletons(object);
}
function updateSkinnedMeshSkeletons(object) {
    if (isSkinnedMesh(object)) {
        object.skeleton.update();
    }
    const children = object.children;
    for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        if (child) {
            updateSkinnedMeshSkeletons(child);
        }
    }
}
function ensureScratchMatrixArrayLength(matrices, length) {
    for (let index = matrices.length; index < length; index += 1) {
        matrices.push(new THREE.Matrix4());
    }
    matrices.length = length;
    return matrices;
}
function isObject3D(value) {
    return value instanceof THREE.Object3D || hasBooleanFlag(value, "isObject3D");
}
function isSkinnedMesh(value) {
    return value instanceof THREE.SkinnedMesh || hasBooleanFlag(value, "isSkinnedMesh");
}
function hasBooleanFlag(value, key) {
    return (typeof value === "object" &&
        value !== null &&
        value[key] === true);
}
function createEmptyDebugStages() {
    return {
        vmdInterpolation: createEmptyDebugStage(),
        appendTransform: createEmptyDebugStage(),
        ik: createEmptyDebugStage(),
        physics: createEmptyDebugStage()
    };
}
function createEmptyDebugStage() {
    return {
        worldMatricesColumnMajor: [],
        morphWeights: []
    };
}
function cloneDebugStage(stage) {
    return {
        worldMatricesColumnMajor: Array.from(stage.worldMatricesColumnMajor),
        morphWeights: Array.from(stage.morphWeights)
    };
}
function createFrameState(seconds, frameRate) {
    return writeFrameState({
        seconds: 0,
        frame: 0,
        frameRate: 30
    }, seconds, frameRate);
}
function writeFrameState(target, seconds, frameRate) {
    if (!Number.isFinite(seconds)) {
        throw new RangeError("MmdAnimRuntime seconds must be finite");
    }
    target.seconds = seconds;
    target.frame = seconds * frameRate;
    target.frameRate = frameRate;
    return target;
}
function readNonNegativeOptionalNumber(value, label) {
    if (value === undefined) {
        return undefined;
    }
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${label} must be a non-negative finite number`);
    }
    return value;
}
function readNonNegativeIntegerOptionalNumber(value, label) {
    const parsed = readNonNegativeOptionalNumber(value, label);
    if (parsed === undefined) {
        return undefined;
    }
    if (!Number.isInteger(parsed)) {
        throw new RangeError(`${label} must be an integer`);
    }
    return parsed;
}
function copyFrameStateInto(target, source) {
    target.seconds = source.seconds;
    target.frame = source.frame;
    target.frameRate = source.frameRate;
    return target;
}
