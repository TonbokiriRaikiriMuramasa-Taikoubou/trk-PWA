import { Matrix4, Quaternion, Vector3 } from "three";
/** Adapts model-space WASM callbacks without applying an intermediate display pose. */
export class HostRigPhysics {
    backend;
    data;
    context;
    indices = [];
    translations;
    rotations;
    local = new Matrix4();
    parentInverse = new Matrix4();
    position = new Vector3();
    rotation = new Quaternion();
    scale = new Vector3();
    previousSeconds;
    seconds = 0;
    driven;
    rotationOnly;
    order;
    effectiveWorld;
    constructor(backend, data, drivenIndices) {
        this.backend = backend;
        this.data = data;
        const count = data.bones.length;
        this.driven = new Uint8Array(count);
        for (const index of drivenIndices)
            this.driven[index] = 1;
        this.rotationOnly = new Uint8Array(count);
        const seen = new Uint8Array(count);
        for (const body of data.rigidBodies) {
            const index = body.boneIndex;
            if (index === undefined || index < 0 || index >= count || seen[index] || body.motionType === "static")
                continue;
            seen[index] = 1;
            this.rotationOnly[index] = body.motionType === "dynamicWithBone" ? 1 : 0;
        }
        this.effectiveWorld = Array.from({ length: count }, () => new Matrix4());
        this.order = Array.from({ length: count }, (_, index) => index);
        const depth = (index) => {
            let result = 0;
            for (let parent = data.skeleton.bones[index].parentIndex ?? -1; parent >= 0; parent = data.skeleton.bones[parent].parentIndex ?? -1) {
                if (++result > count)
                    throw new TypeError("Host rig skeleton has a parent cycle");
            }
            return result;
        };
        this.order.sort((a, b) => depth(a) - depth(b));
        this.translations = new Float32Array(count * 3);
        this.rotations = new Float32Array(count * 4);
        this.context = {
            seconds: 0, deltaSeconds: 0, frame: 0, frameRate: 30, seeking: true,
            skeleton: data.skeleton, rigidBodies: data.rigidBodies, joints: data.joints,
            inputTranslations: this.translations, inputRotations: this.rotations,
            output: { updatedBoneIndices: this.indices }
        };
    }
    prepare(seconds, frameRate) {
        this.seconds = seconds;
        this.context.seconds = seconds;
        this.context.frame = seconds * frameRate;
        this.context.frameRate = frameRate;
        this.context.deltaSeconds = this.previousSeconds === undefined ? 0 : Math.max(0, seconds - this.previousSeconds);
        this.context.seeking = this.previousSeconds === undefined || seconds < this.previousSeconds;
    }
    commit() { this.previousSeconds = this.seconds; }
    reset() {
        this.previousSeconds = undefined;
        this.backend.reset?.();
    }
    step = (before, output, mask) => {
        if (this.backend.disabled || this.backend.disposed) {
            throw new Error("Host rig physics backend is unavailable");
        }
        for (let index = 0; index < this.data.bones.length; index++) {
            this.local.fromArray(before, index * 16);
            const parent = this.data.skeleton.bones[index].parentIndex ?? -1;
            if (parent >= 0) {
                this.parentInverse.fromArray(before, parent * 16).invert();
                this.local.premultiply(this.parentInverse);
            }
            this.local.decompose(this.position, this.rotation, this.scale);
            this.position.toArray(this.translations, index * 3);
            this.rotation.toArray(this.rotations, index * 4);
        }
        this.indices.length = 0;
        output.fill(NaN);
        mask.fill(0);
        this.context.inputWorldMatricesColumnMajor = before;
        // HostRig writeback is world-space. A backend must write this output and
        // report selected indices, including seed-only frames (simulated=false).
        this.output.worldMatricesColumnMajor = output;
        this.context.output = this.output;
        const result = this.backend.step(this.context);
        for (const diagnostic of result.diagnostics ?? emptyDiagnostics) {
            if (diagnostic.level === "error")
                throw new Error(diagnostic.message);
        }
        const count = result.updatedBoneCount ?? this.indices.length;
        if (!Number.isInteger(count) || count < 0 || count > this.indices.length) {
            throw new RangeError("Host rig physics returned an invalid updatedBoneCount");
        }
        for (let offset = 0; offset < count; offset++) {
            const index = this.indices[offset];
            if (!Number.isInteger(index) || index < 0 || index >= mask.length) {
                throw new RangeError("Host rig physics returned an invalid bone index");
            }
            mask[index] = 1;
        }
        // Bullet's raw world output includes body translation for mode 2. Keep
        // its animated local position, resolving protected parents from base FK.
        for (const index of this.order) {
            const world = this.effectiveWorld[index];
            const parent = this.data.skeleton.bones[index].parentIndex ?? -1;
            if (this.driven[index]) {
                world.fromArray(before, index * 16);
            }
            else if (mask[index]) {
                world.fromArray(output, index * 16);
                if (this.rotationOnly[index]) {
                    this.position.fromArray(this.translations, index * 3);
                    if (parent >= 0)
                        this.position.applyMatrix4(this.effectiveWorld[parent]);
                    world.setPosition(this.position);
                    world.toArray(output, index * 16);
                }
            }
            else {
                this.local.fromArray(before, index * 16);
                if (parent >= 0)
                    this.local.premultiply(this.parentInverse.fromArray(before, parent * 16).invert());
                world.copy(this.local);
                if (parent >= 0)
                    world.premultiply(this.effectiveWorld[parent]);
            }
        }
        return true;
    };
    output = {
        updatedBoneIndices: this.indices
    };
}
const emptyDiagnostics = [];
