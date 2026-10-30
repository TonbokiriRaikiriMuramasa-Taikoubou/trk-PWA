import { toUint8Array } from "../binary/index.js";
import { parsePmd } from "../model/PmdModelParser.js";
import { parsePmx } from "../model/PmxModelParser.js";
import { parseVmd } from "../vmd/index.js";
import { parseVpd, vpdPoseToAnimation } from "../vpd/index.js";
import { detectModelFormat } from "../formatDetection.js";
import { createParsedModelFromBytes } from "./createParsedModel.js";
export class FallbackCore {
    version() {
        return "0.0.0+ts-fallback";
    }
    healthCheck() {
        return true;
    }
    loadModel(bytes, options = {}) {
        const input = toUint8Array(bytes);
        const format = options.format === "auto" || !options.format ? detectModelFormat(input) : options.format;
        const metadata = format === "pmx" ? parsePmx(input).metadata : parsePmd(input).metadata;
        return createParsedModelFromBytes(input, format, metadata);
    }
    loadVmd(bytes) {
        const input = toUint8Array(bytes);
        return { ...parseVmd(input), bytes: input.slice() };
    }
    loadVpd(bytes) {
        const input = toUint8Array(bytes);
        return { ...parseVpd(input), bytes: input.slice() };
    }
    loadVpdAnimation(bytes, name) {
        return vpdPoseToAnimation(this.loadVpd(bytes), name);
    }
}
