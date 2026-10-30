export const MODEL_SOURCE_STRING_UNRESOLVED = "MODEL_SOURCE_STRING_UNRESOLVED";
export function isModelSource(source) {
    return (typeof source === "string" ||
        source instanceof ArrayBuffer ||
        source instanceof Uint8Array ||
        (typeof File !== "undefined" && source instanceof File));
}
export async function readModelSource(source, options = {}) {
    if (source instanceof Uint8Array) {
        return {
            bytes: source,
            diagnostic: { kind: "bytes", byteLength: source.byteLength }
        };
    }
    if (source instanceof ArrayBuffer) {
        const bytes = new Uint8Array(source);
        return {
            bytes,
            diagnostic: { kind: "bytes", byteLength: bytes.byteLength }
        };
    }
    if (typeof File !== "undefined" && source instanceof File) {
        const bytes = new Uint8Array(await source.arrayBuffer());
        return {
            bytes,
            diagnostic: {
                kind: "file",
                byteLength: bytes.byteLength,
                name: source.name || undefined
            }
        };
    }
    if (typeof source === "string") {
        const fetchSource = options.fetch ?? globalThis.fetch;
        if (typeof fetchSource !== "function") {
            throw new TypeError(`${MODEL_SOURCE_STRING_UNRESOLVED}: string ModelSource requires fetch to be available`);
        }
        const response = options.signal
            ? await fetchSource(source, { signal: options.signal })
            : await fetchSource(source);
        const contentType = response.headers.get("content-type") ?? undefined;
        const contentLengthHeader = response.headers.get("content-length");
        const contentLength = contentLengthHeader !== null && contentLengthHeader.trim() !== ""
            ? Number(contentLengthHeader)
            : undefined;
        if (!response.ok) {
            throw new Error(`Failed to fetch MMD source ${source}: ${response.status}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return {
            bytes,
            diagnostic: {
                kind: "url",
                url: source,
                status: response.status,
                ok: response.ok,
                byteLength: bytes.byteLength,
                contentType,
                contentLength: Number.isFinite(contentLength) ? contentLength : undefined
            }
        };
    }
    throw new TypeError("Unsupported MMD model source");
}
export async function readModelSourceBytes(source, options = {}) {
    return (await readModelSource(source, options)).bytes;
}
