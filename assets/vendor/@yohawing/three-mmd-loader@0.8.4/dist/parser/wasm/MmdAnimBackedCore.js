import { toUint8Array } from "../binary/index.js";
import { detectModelFormat } from "../formatDetection.js";
import { denseMorphProviderSymbol } from "../model/denseMorphProvider.js";
import { parsePmd } from "../model/PmdModelParser.js";
import { parseVmd } from "../vmd/index.js";
import { parseVpd, vpdPoseToAnimation } from "../vpd/index.js";
import { mmdAnimWasmVmdDtoToAnimation } from "../../runtime/mmdAnimWasmParser.js";
import { ParsedModel } from "./ParsedModel.js";
class MmdAnimPmxModel {
    j;
    _metadata;
    _geometry;
    _skeleton;
    _materials;
    constructor(j, geometry) {
        this.j = j;
        const rawMeta = asRecord(j["metadata"]);
        const topDiagnostics = asDiagnostics(j["diagnostics"]);
        const metaDiagnostics = asDiagnostics(rawMeta["diagnostics"]);
        const adapterDiagnostics = buildAdapterDiagnostics(j);
        this._metadata = {
            ...rawMeta,
            diagnostics: [...metaDiagnostics, ...topDiagnostics, ...adapterDiagnostics]
        };
        this._geometry = geometry;
        this._skeleton = normalizeSkeleton(j["skeleton"]);
        this._materials = normalizeMaterials(j["materials"]);
    }
    metadata() { return this._metadata; }
    geometry() { return this._geometry; }
    materials() { return this._materials; }
    skeleton() { return this._skeleton; }
    morphs() { return asArray(this.j["morphs"]); }
    displayFrames() { return asArray(this.j["displayFrames"]); }
    rigidBodies() { return asArray(this.j["rigidBodies"]); }
    joints() { return asArray(this.j["joints"]); }
    softBodies() { return asArray(this.j["softBodies"]); }
    embeddedTextures() { return []; }
}
function buildGeometryFromWasm(g) {
    const vertexCount = g.vertexCount();
    const rawIndices = g.indices();
    const indices = vertexCount <= 65535 ? Uint16Array.from(rawIndices) : rawIndices;
    return {
        positions: g.positions(),
        normals: g.normals(),
        uvs: g.uvs(),
        additionalUvs: buildAdditionalUvsFromWasm(g.additionalUvs(), g.additionalUvCount(), vertexCount),
        indices,
        edgeScale: g.edgeScale(),
        materialGroups: buildMaterialGroupsFromWasm(g.materialGroups()),
        skinIndices: toSkinIndices16(g.skinIndices()),
        skinWeights: g.skinWeights(),
        sdef: buildSdefFromWasm(g),
        qdef: buildQdefFromWasm(g)
    };
}
class WasmVertexMorphProvider {
    sparsePositionOffsets;
    constructor(vertexIndices, positions, start, count) {
        this.sparsePositionOffsets = { vertexIndices, positions, start, count };
    }
    createPositionOffsets(vertexCount) {
        const { vertexIndices, positions, start, count } = this.sparsePositionOffsets;
        if (count === 0) {
            return undefined;
        }
        const dense = new Float32Array(vertexCount * 3);
        for (let offsetIndex = 0; offsetIndex < count; offsetIndex += 1) {
            const sourceIndex = start + offsetIndex;
            const vertexIndex = vertexIndices[sourceIndex] ?? 0;
            if (vertexIndex >= vertexCount) {
                throw new RangeError(`PMX_VERTEX_MORPH_VERTEX_INDEX_INVALID:${offsetIndex}:${vertexIndex}:${vertexCount}`);
            }
            const sourcePosition = sourceIndex * 3;
            const targetPosition = vertexIndex * 3;
            dense[targetPosition] = positions[sourcePosition] ?? 0;
            dense[targetPosition + 1] = positions[sourcePosition + 1] ?? 0;
            dense[targetPosition + 2] = -(positions[sourcePosition + 2] ?? 0);
        }
        return dense;
    }
    createUvOffsets() {
        return undefined;
    }
    createAdditionalUvOffsets() {
        return undefined;
    }
}
function attachVertexMorphOffsetsFromWasm(json, dto) {
    const morphs = asArray(json["morphs"]);
    const spans = dto.morphSpans();
    const vertexIndices = dto.vertexIndices();
    const positions = dto.positions();
    if (spans.length !== morphs.length * 2) {
        throw new RangeError(`PMX_VERTEX_MORPH_SPAN_LENGTH_INVALID:${spans.length}:${morphs.length * 2}`);
    }
    if (positions.length !== vertexIndices.length * 3) {
        throw new RangeError(`PMX_VERTEX_MORPH_POSITION_LENGTH_INVALID:${positions.length}:${vertexIndices.length * 3}`);
    }
    for (let morphIndex = 0; morphIndex < morphs.length; morphIndex += 1) {
        const start = spans[morphIndex * 2] ?? 0;
        const count = spans[morphIndex * 2 + 1] ?? 0;
        const end = start + count;
        if (end > vertexIndices.length) {
            throw new RangeError(`PMX_VERTEX_MORPH_SPAN_INVALID:${morphIndex}:${start}:${count}:${vertexIndices.length}`);
        }
        const morph = morphs[morphIndex];
        if (morph) {
            const provider = new WasmVertexMorphProvider(vertexIndices, positions, start, count);
            Object.defineProperty(morph, denseMorphProviderSymbol, { value: provider });
            Object.defineProperty(morph, "vertexOffsets", {
                configurable: true,
                enumerable: true,
                get: () => {
                    const materialized = materializeVertexMorphOffsets(provider);
                    Object.defineProperty(morph, "vertexOffsets", {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value: materialized
                    });
                    return materialized;
                },
                set: (value) => {
                    Object.defineProperty(morph, "vertexOffsets", {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value
                    });
                }
            });
        }
    }
}
function materializeVertexMorphOffsets(provider) {
    const { vertexIndices, positions, start, count } = provider.sparsePositionOffsets;
    const offsets = new Array(count);
    for (let offsetIndex = 0; offsetIndex < count; offsetIndex += 1) {
        const sourceIndex = start + offsetIndex;
        const positionIndex = sourceIndex * 3;
        offsets[offsetIndex] = {
            vertexIndex: vertexIndices[sourceIndex] ?? 0,
            position: [
                positions[positionIndex] ?? 0,
                positions[positionIndex + 1] ?? 0,
                positions[positionIndex + 2] ?? 0
            ]
        };
    }
    return offsets;
}
function buildAdditionalUvsFromWasm(raw, additionalUvCount, vertexCount) {
    const stride = vertexCount * 4;
    const additionalUvs = [];
    for (let index = 0; index < additionalUvCount; index += 1) {
        additionalUvs.push(raw.slice(index * stride, (index + 1) * stride));
    }
    return additionalUvs;
}
function buildMaterialGroupsFromWasm(raw) {
    const materialGroups = [];
    for (let index = 0; index < raw.length; index += 3) {
        materialGroups.push({
            start: raw[index] ?? 0,
            count: raw[index + 1] ?? 0,
            materialIndex: raw[index + 2] ?? 0
        });
    }
    return materialGroups;
}
function toSkinIndices16(values) {
    const converted = new Uint16Array(values.length);
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index] ?? 0;
        if (value < 0 || value > 0xffff) {
            throw new Error(`PMX bone index ${value} exceeds the current three-mmd-loader skin index range.`);
        }
        converted[index] = value;
    }
    return converted;
}
function normalizeSkeleton(skeleton) {
    const skeletonRecord = asRecord(skeleton);
    const bones = asArray(skeletonRecord["bones"]);
    return {
        bones: bones.map((bone) => ({
            ...bone,
            tailPosition: bone.tailPosition ?? undefined,
            appendTransform: bone.appendTransform ?? undefined,
            fixedAxis: bone.fixedAxis ?? undefined,
            localAxis: bone.localAxis ?? undefined,
            externalParentKey: bone.externalParentKey ?? undefined,
            ikStateName: bone.ikStateName ?? undefined,
            ik: bone.ik == null
                ? undefined
                : {
                    ...bone.ik,
                    links: asArray(bone.ik.links).map((link) => ({
                        ...link,
                        limits: link.limits ?? undefined
                    }))
                }
        }))
    };
}
function normalizeMaterials(materials) {
    return asArray(materials).map((material) => ({
        ...material,
        sharedToonIndex: material.sharedToonIndex ?? undefined,
        toonTexturePath: material.toonTexturePath || ""
    }));
}
function buildSdefFromWasm(g) {
    const enabled = enabledU8ToF32(g.sdefEnabled());
    if (!hasEnabledDeformVertex(enabled)) {
        return undefined;
    }
    return {
        enabled,
        c: g.sdefC(),
        r0: g.sdefR0(),
        r1: g.sdefR1(),
        rw0: g.sdefRw0(),
        rw1: g.sdefRw1()
    };
}
function buildQdefFromWasm(g) {
    const enabled = enabledU8ToF32(g.qdefEnabled());
    if (!hasEnabledDeformVertex(enabled)) {
        return undefined;
    }
    return { enabled };
}
function enabledU8ToF32(enabled) {
    const converted = new Float32Array(enabled.length);
    for (let index = 0; index < enabled.length; index += 1) {
        converted[index] = enabled[index] === 0 ? 0 : 1;
    }
    return converted;
}
function hasEnabledDeformVertex(enabled) {
    for (let index = 0; index < enabled.length; index += 1) {
        if (enabled[index] > 0.5) {
            return true;
        }
    }
    return false;
}
function buildAdapterDiagnostics(j) {
    const skeleton = asRecord(j["skeleton"]);
    const bones = asArray(skeleton["bones"]);
    const diagnostics = [];
    if (bones.some((bone) => {
        const ik = asRecord(bone["ik"]);
        return asArray(ik["links"]).some((link) => link["limits"] != null);
    })) {
        diagnostics.push({
            level: "warning",
            code: "IK_PMX_LINK_LIMITS_APPROXIMATE",
            category: "skeleton",
            message: "PMX IK link limits are parsed but are approximated by the runtime solver."
        });
    }
    if (bones.some((bone) => asRecord(bone["flags"])["fixedAxis"] === true)) {
        diagnostics.push({
            level: "warning",
            code: "BONE_FIXED_AXIS_CONSTRAINTS_UNSUPPORTED",
            category: "skeleton",
            message: "Fixed-axis metadata is applied to IK links, but non-IK fixed-axis bone behavior is not yet enforced by the runtime."
        });
    }
    if (bones.some((bone) => asRecord(bone["flags"])["localAxis"] === true)) {
        diagnostics.push({
            level: "warning",
            code: "BONE_LOCAL_AXIS_CONSTRAINTS_UNSUPPORTED",
            category: "skeleton",
            message: "Local-axis metadata is applied to IK link limits, but non-IK local-axis bone behavior is not yet enforced by the runtime."
        });
    }
    return diagnostics;
}
function asRecord(value) {
    return isRecord(value) ? value : {};
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function asDiagnostics(value) {
    return asArray(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseWasmJsonResponse(raw, fileName) {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
        throw new TypeError(`${fileName} WASM JSON response must be an object`);
    }
    return parsed;
}
function missingSplitPmxAbi() {
    throw new Error("mmd-anim PMX split ABI is required: provide WasmPmxParsedModel or parsePmxModelNonGeometryJson plus WasmPmxGeometry.");
}
export class MmdAnimBackedCore {
    wasm;
    versionString;
    constructor(wasm) {
        this.wasm = wasm;
        this.versionString = `0.0.${wasm.wasm_wrapper_version()}+mmd-anim`;
    }
    version() {
        return this.versionString;
    }
    healthCheck() {
        return true;
    }
    loadModel(bytes, options = {}) {
        const input = toUint8Array(bytes);
        const format = options.format === "auto" || !options.format ? detectModelFormat(input) : options.format;
        if (format === "pmx") {
            if (this.wasm.WasmPmxParsedModel != null) {
                const parsedHandle = this.wasm.WasmPmxParsedModel.parse(input);
                try {
                    const hasVertexMorphSplit = parsedHandle.nonGeometryJsonWithoutVertexOffsets != null &&
                        parsedHandle.vertexMorphOffsets != null;
                    const json = parseWasmJsonResponse(hasVertexMorphSplit
                        ? parsedHandle.nonGeometryJsonWithoutVertexOffsets()
                        : parsedHandle.nonGeometryJson(), "PMX model");
                    if (hasVertexMorphSplit) {
                        const vertexMorphOffsets = parsedHandle.vertexMorphOffsets();
                        try {
                            attachVertexMorphOffsetsFromWasm(json, vertexMorphOffsets);
                        }
                        finally {
                            vertexMorphOffsets.free?.();
                        }
                    }
                    const geometryHandle = parsedHandle.geometry();
                    try {
                        return new MmdAnimPmxModel(json, buildGeometryFromWasm(geometryHandle));
                    }
                    finally {
                        geometryHandle.free?.();
                    }
                }
                finally {
                    parsedHandle.free?.();
                }
            }
            if (this.wasm.parsePmxModelNonGeometryJson != null && this.wasm.WasmPmxGeometry != null) {
                const json = parseWasmJsonResponse(this.wasm.parsePmxModelNonGeometryJson(input), "PMX model");
                const geometryHandle = this.wasm.WasmPmxGeometry.fromPmxBytes(input);
                try {
                    return new MmdAnimPmxModel(json, buildGeometryFromWasm(geometryHandle));
                }
                finally {
                    geometryHandle.free?.();
                }
            }
            return missingSplitPmxAbi();
        }
        return new ParsedModel(parsePmd(input));
    }
    loadVmd(bytes) {
        const input = toUint8Array(bytes);
        if (this.wasm.parseVmdAnimationJson != null) {
            return mmdAnimWasmVmdDtoToAnimation(parseWasmJsonResponse(this.wasm.parseVmdAnimationJson(input), "motion.vmd"), input.slice());
        }
        if (this.wasm.parseMmdFormatJson != null) {
            return mmdAnimWasmVmdDtoToAnimation(parseWasmJsonResponse(this.wasm.parseMmdFormatJson(input, "motion.vmd"), "motion.vmd"), input.slice());
        }
        return { ...parseVmd(input), bytes: input.slice() };
    }
    loadVpd(bytes) {
        const input = toUint8Array(bytes);
        return { ...parseVpd(input), bytes: input.slice() };
    }
    loadVpdAnimation(bytes, name) {
        return vpdPoseToAnimation(this.loadVpd(bytes), name);
    }
    parsePmmDocument(bytes) {
        return this.parseWasmJson(bytes, "project.pmm");
    }
    parseAccessory(bytes, fileName) {
        return this.parseWasmJson(bytes, fileName ?? "accessory.x");
    }
    parseWasmJson(bytes, fileName) {
        const input = toUint8Array(bytes);
        if (this.wasm.parseMmdFormatJson == null) {
            throw new Error(`${fileName} parsing requires parseMmdFormatJson WASM export`);
        }
        return parseWasmJsonResponse(this.wasm.parseMmdFormatJson(input, fileName), fileName);
    }
}
