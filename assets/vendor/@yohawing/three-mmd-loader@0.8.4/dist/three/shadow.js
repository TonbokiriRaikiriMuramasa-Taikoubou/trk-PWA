import * as THREE from "three";
export const MMD_SELF_SHADOW_LAYER = 1;
const shadowFitBoxCorners = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
];
const shadowFitCenter = new THREE.Vector3();
const shadowFitLightPosition = new THREE.Vector3();
const shadowFitTargetPosition = new THREE.Vector3();
const shadowFitLightDirection = new THREE.Vector3();
const shadowFitLocalPosition = new THREE.Vector3();
export function configureMmdSelfShadowDirectionalLight(light, options = {}) {
    const shadowLayer = options.shadowLayer ?? MMD_SELF_SHADOW_LAYER;
    if (Number.isInteger(shadowLayer) && shadowLayer >= 0 && shadowLayer <= 31) {
        light.shadow.camera.layers.set(shadowLayer);
    }
    const mapWidth = options.mapWidth ?? options.mapSize;
    const mapHeight = options.mapHeight ?? options.mapSize;
    if (isPositiveFinite(mapWidth) || isPositiveFinite(mapHeight)) {
        light.shadow.mapSize.set(isPositiveFinite(mapWidth) ? mapWidth : light.shadow.mapSize.x, isPositiveFinite(mapHeight) ? mapHeight : light.shadow.mapSize.y);
    }
    const bias = options.bias;
    if (isFiniteNumber(bias)) {
        light.shadow.bias = bias;
    }
    const normalBias = options.normalBias;
    if (isFiniteNumber(normalBias)) {
        light.shadow.normalBias = normalBias;
    }
    if (options.shadowIntensity !== undefined) {
        light.shadow.intensity = clampSelfShadowIntensity(options.shadowIntensity);
    }
    const camera = light.shadow.camera;
    let cameraChanged = false;
    const cameraLeft = options.cameraLeft;
    if (isFiniteNumber(cameraLeft)) {
        camera.left = cameraLeft;
        cameraChanged = true;
    }
    const cameraRight = options.cameraRight;
    if (isFiniteNumber(cameraRight)) {
        camera.right = cameraRight;
        cameraChanged = true;
    }
    const cameraTop = options.cameraTop;
    if (isFiniteNumber(cameraTop)) {
        camera.top = cameraTop;
        cameraChanged = true;
    }
    const cameraBottom = options.cameraBottom;
    if (isFiniteNumber(cameraBottom)) {
        camera.bottom = cameraBottom;
        cameraChanged = true;
    }
    const cameraNear = options.cameraNear;
    if (isPositiveFinite(cameraNear)) {
        camera.near = cameraNear;
        cameraChanged = true;
    }
    const cameraFar = options.cameraFar;
    if (isPositiveFinite(cameraFar) && cameraFar > camera.near) {
        camera.far = cameraFar;
        cameraChanged = true;
    }
    if (cameraChanged) {
        camera.updateProjectionMatrix();
    }
    return light;
}
export function fitMmdSelfShadowDirectionalLightToBox(light, box, options = {}) {
    if (box.isEmpty()) {
        return light;
    }
    box.getCenter(shadowFitCenter);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    shadowFitLightPosition.setFromMatrixPosition(light.matrixWorld);
    shadowFitTargetPosition.setFromMatrixPosition(light.target.matrixWorld);
    shadowFitLightDirection.subVectors(shadowFitLightPosition, shadowFitTargetPosition);
    const boxSizeX = box.max.x - box.min.x;
    const boxSizeY = box.max.y - box.min.y;
    const boxSizeZ = box.max.z - box.min.z;
    const longestSide = Math.max(boxSizeX, boxSizeY, boxSizeZ, 0);
    const lightDistance = Math.max(shadowFitLightDirection.length(), longestSide, 1);
    if (shadowFitLightDirection.lengthSq() <= 0.000001) {
        shadowFitLightDirection.set(0, 0, 1);
    }
    shadowFitLightDirection.normalize();
    if (options.updateTarget !== false) {
        setWorldPosition(light.target, shadowFitCenter);
        shadowFitLightPosition.copy(shadowFitCenter).addScaledVector(shadowFitLightDirection, lightDistance);
        setWorldPosition(light, shadowFitLightPosition);
    }
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    const camera = light.shadow.camera;
    shadowFitLightPosition.setFromMatrixPosition(light.matrixWorld);
    shadowFitTargetPosition.setFromMatrixPosition(light.target.matrixWorld);
    camera.position.copy(shadowFitLightPosition);
    camera.lookAt(shadowFitTargetPosition);
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    setBoxCorners(box, shadowFitBoxCorners);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    for (const corner of shadowFitBoxCorners) {
        corner.applyMatrix4(camera.matrixWorldInverse);
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
        const depth = -corner.z;
        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
    }
    const margin = Math.max(options.margin ?? longestSide * (options.marginScale ?? 0.08), 0);
    const depthMargin = Math.max(options.depthMargin ?? margin, 0);
    const minNear = Math.max(options.minNear ?? 0.01, 0.0001);
    const minFarSpan = Math.max(options.minFarSpan ?? 1, 0.0001);
    camera.left = minX - margin;
    camera.right = maxX + margin;
    camera.bottom = minY - margin;
    camera.top = maxY + margin;
    camera.near = Math.max(minDepth - depthMargin, minNear);
    camera.far = Math.max(maxDepth + depthMargin, camera.near + minFarSpan);
    if (isPositiveFinite(options.maxFar)) {
        camera.far = Math.min(camera.far, Math.max(options.maxFar, camera.near + minFarSpan));
    }
    camera.updateProjectionMatrix();
    return light;
}
function setWorldPosition(object, worldPosition) {
    shadowFitLocalPosition.copy(worldPosition);
    if (object.parent) {
        object.parent.updateMatrixWorld();
        object.parent.worldToLocal(shadowFitLocalPosition);
    }
    object.position.copy(shadowFitLocalPosition);
    object.updateMatrixWorld();
}
export function applyMmdSelfShadowStateToThreeDirectionalLight(light, state, options) {
    if (!state) {
        return light;
    }
    light.castShadow = options?.enabledModes
        ? options.enabledModes.includes(state.mode)
        : state.mode === 1 || state.mode === 2;
    if (!light.castShadow) {
        return light;
    }
    const camera = light.shadow.camera;
    const distanceScale = options?.distanceScale ?? 100;
    const minFar = options?.minFar ?? 1;
    const maxFar = options?.maxFar ?? 100;
    const far = clampSelfShadowDistance(state.distance * distanceScale, minFar, maxFar);
    light.shadow.intensity = clampSelfShadowIntensity(options?.shadowIntensity ?? 1);
    if (Number.isFinite(far) && far > camera.near) {
        camera.far = far;
        camera.updateProjectionMatrix();
    }
    return light;
}
function clampSelfShadowDistance(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
function clampSelfShadowIntensity(value) {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.min(Math.max(value, 0), 1);
}
function isPositiveFinite(value) {
    return value !== undefined && Number.isFinite(value) && value > 0;
}
function isFiniteNumber(value) {
    return value !== undefined && Number.isFinite(value);
}
function setBoxCorners(box, target) {
    const min = box.min;
    const max = box.max;
    target[0].set(min.x, min.y, min.z);
    target[1].set(min.x, min.y, max.z);
    target[2].set(min.x, max.y, min.z);
    target[3].set(min.x, max.y, max.z);
    target[4].set(max.x, min.y, min.z);
    target[5].set(max.x, min.y, max.z);
    target[6].set(max.x, max.y, min.z);
    target[7].set(max.x, max.y, max.z);
}
