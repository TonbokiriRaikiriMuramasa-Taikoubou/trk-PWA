import { createMmdAnimBulletPhysicsBackend } from "./mmdAnimBullet.js";
export const customBulletMmdScriptPath = "./mmd/mmd_bullet.js";
export function resolveCustomBulletMmdScriptUrl(baseUrl = import.meta.url) {
    return new URL(customBulletMmdScriptPath, baseUrl).href;
}
export async function loadCustomBulletMmdModule(options = {}) {
    const scriptUrl = options.scriptUrl ?? resolveCustomBulletMmdScriptUrl(options.baseUrl);
    if (typeof document === "undefined" || typeof window === "undefined") {
        throw new Error("loadCustomBulletMmdModule requires a browser document and window.");
    }
    await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const timeout = window.setTimeout(() => reject(new Error(`Timed out loading ${scriptUrl}`)), options.timeoutMs ?? 10000);
        script.async = true;
        script.src = scriptUrl;
        script.onload = () => {
            window.clearTimeout(timeout);
            resolve();
        };
        script.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error(`Failed to load ${scriptUrl}`));
        };
        document.head.appendChild(script);
    });
    const factory = globalThis.MmdBullet;
    if (typeof factory !== "function") {
        throw new Error("MmdBullet is not available on globalThis.");
    }
    return factory();
}
export function createCustomBulletMmdPhysicsBackend(module, options = {}) {
    return new CustomBulletMmdCompatibilityBackend(module, options);
}
class CustomBulletMmdCompatibilityBackend {
    name = "custom-bullet-mmd";
    disabled = false;
    backend;
    stepBuffers;
    stepBufferBoneCount = -1;
    constructor(module, options) {
        this.backend = createMmdAnimBulletPhysicsBackend(module, options);
    }
    get disposed() {
        return this.backend.disposed;
    }
    acquireStepBuffers(layout) {
        if (!this.stepBuffers || this.stepBufferBoneCount !== layout.boneCount) {
            this.stepBuffers = {
                inputTranslations: new Float32Array(layout.translationValueCount),
                inputRotations: new Float32Array(layout.rotationValueCount),
                inputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
                outputTranslations: new Float32Array(layout.translationValueCount),
                outputRotations: new Float32Array(layout.rotationValueCount),
                outputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
                bonePhysicsToggles: new Uint8Array(layout.boneCount),
                updatedBoneIndices: new Uint32Array(layout.boneCount)
            };
            this.stepBufferBoneCount = layout.boneCount;
        }
        return this.stepBuffers;
    }
    step(context) {
        return this.backend.step(context);
    }
    reset(context) {
        this.backend.reset?.(context);
    }
    dispose() {
        this.backend.dispose?.();
        this.stepBuffers = undefined;
        this.stepBufferBoneCount = -1;
    }
    diagnostics() {
        return this.backend.diagnostics?.() ?? [];
    }
    debugContactCount() {
        return this.backend.debugContactCount();
    }
    debugPhysicsContacts() {
        return this.backend.debugPhysicsContacts();
    }
}
