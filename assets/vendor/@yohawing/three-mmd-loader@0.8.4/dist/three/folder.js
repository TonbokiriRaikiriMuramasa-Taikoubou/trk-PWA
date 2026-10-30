export function createMmdTextureMapFromFiles(files, modelFile) {
    const textureMap = {};
    const modelDirectory = directoryName(normalizeMmdRelativePath(modelFile.webkitRelativePath || modelFile.name));
    for (const file of files) {
        if (!isMmdTextureFile(file)) {
            continue;
        }
        const relativePath = normalizeMmdRelativePath(file.webkitRelativePath || file.name);
        const relativeToModel = modelDirectory
            ? stripPrefix(relativePath, `${modelDirectory}/`)
            : relativePath;
        textureMap[relativePath] = file;
        textureMap[relativeToModel] = file;
        textureMap[file.name] = file;
    }
    return textureMap;
}
export function findMmdModelFiles(files) {
    return files.filter(isMmdModelFile).sort(compareFileKey);
}
export function findMmdMotionFiles(files) {
    return files.filter(isMmdMotionFile).sort(compareFileKey);
}
export function findMmdAccessoryFiles(files) {
    return files.filter(isMmdAccessoryFile).sort(compareFileKey);
}
export function findMmdAudioFiles(files) {
    return files.filter(isMmdAudioFile).sort(compareFileKey);
}
export function isMmdModelFile(file) {
    return /\.(?:pmx|pmd)$/i.test(file.name);
}
export function isMmdMotionFile(file) {
    return /\.vmd$/i.test(file.name);
}
export function isMmdTextureFile(file) {
    return /\.(bmp|dds|gif|jpe?g|png|tga|webp)$/i.test(file.name);
}
export function isMmdAccessoryFile(file) {
    return /\.(?:x|vac)$/i.test(file.name);
}
export function isMmdAudioFile(file) {
    return /\.wav$/i.test(file.name);
}
export function normalizeMmdRelativePath(path) {
    return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}
export function compareFileKey(a, b) {
    return fileKey(a).localeCompare(fileKey(b), undefined, { numeric: true });
}
function fileKey(file) {
    return normalizeMmdRelativePath(file.webkitRelativePath || file.name);
}
function directoryName(path) {
    const slashIndex = path.lastIndexOf("/");
    return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}
function stripPrefix(path, prefix) {
    return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
