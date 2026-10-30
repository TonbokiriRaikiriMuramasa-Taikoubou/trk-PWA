const geometryMorphSources = new WeakMap();
export function setMmdGeometryMorphSource(geometry, morphs) {
    if (morphs.length > 0) {
        geometryMorphSources.set(geometry, morphs);
    }
}
export function getMmdGeometryMorphSource(geometry) {
    return geometryMorphSources.get(geometry);
}
