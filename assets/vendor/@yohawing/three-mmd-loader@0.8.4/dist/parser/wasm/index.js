import { FallbackCore } from "./FallbackCore.js";
import { MmdAnimBackedCore } from "./MmdAnimBackedCore.js";
export { FallbackCore } from "./FallbackCore.js";
export async function initCore(options = {}) {
    let mmdAnimWasm;
    try {
        mmdAnimWasm = await import("./generated/mmd_anim_wasm.js");
    }
    catch (error) {
        throw new Error("mmd-anim wasm module is missing. Run npm run build:mmd-anim && npm run build before initCore().", { cause: error });
    }
    await initMmdAnimWasm(mmdAnimWasm, options);
    return new MmdAnimBackedCore({
        parsePmxModelNonGeometryJson: mmdAnimWasm.parsePmxModelNonGeometryJson,
        parseMmdFormatJson: mmdAnimWasm.parseMmdFormatJson,
        parseVmdAnimationJson: mmdAnimWasm.parseVmdAnimationJson,
        WasmPmxParsedModel: mmdAnimWasm.WasmPmxParsedModel,
        WasmPmxGeometry: mmdAnimWasm.WasmPmxGeometry,
        wasm_wrapper_version: mmdAnimWasm.wasm_wrapper_version
    });
}
async function initMmdAnimWasm(mmdAnimWasm, options) {
    if (options.wasmUrl != null) {
        await mmdAnimWasm.default(options.wasmUrl);
        return;
    }
    if (isNodeLikeRuntime()) {
        const [{ readFile }, { fileURLToPath }] = await Promise.all([
            import("node:fs/promises"),
            import("node:url")
        ]);
        const wasmPath = fileURLToPath(new URL("./generated/mmd_anim_wasm_bg.wasm", import.meta.url));
        const bytes = await readFile(wasmPath);
        await mmdAnimWasm.default({ module_or_path: bytes });
        return;
    }
    await mmdAnimWasm.default();
}
function isNodeLikeRuntime() {
    return typeof process !== "undefined" && process.versions?.node !== undefined;
}
export async function initCoreWithFallback(options = {}) {
    try {
        return await initCore(options);
    }
    catch {
        return new FallbackCore();
    }
}
