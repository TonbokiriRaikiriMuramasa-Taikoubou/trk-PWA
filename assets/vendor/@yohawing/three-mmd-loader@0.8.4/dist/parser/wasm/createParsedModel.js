import { parsePmd } from "../model/PmdModelParser.js";
import { parsePmx } from "../model/PmxModelParser.js";
import { mergeWasmMetadata } from "./modelMetadata.js";
import { ParsedModel } from "./ParsedModel.js";
export function createParsedModelFromBytes(bytes, format, wasmMetadata) {
    const parsed = format === "pmx" ? parsePmx(bytes) : parsePmd(bytes);
    parsed.metadata = mergeWasmMetadata(parsed.metadata, wasmMetadata);
    return new ParsedModel(parsed);
}
