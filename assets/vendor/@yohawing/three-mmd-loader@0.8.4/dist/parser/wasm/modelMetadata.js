export function mergeWasmMetadata(parsed, wasm) {
    return {
        ...parsed,
        version: wasm.version,
        encoding: wasm.encoding,
        counts: { ...wasm.counts, softBodies: parsed.counts.softBodies },
        indexSizes: wasm.indexSizes,
        additionalUvCount: wasm.additionalUvCount,
        diagnostics: parsed.diagnostics
    };
}
