const loaderPerformanceFlag = "__THREE_MMD_LOADER_PERF__";
let loaderProfileId = 0;
export function createLoaderPerformanceProfile(label, options = {}) {
    if (!isLoaderPerformanceEnabled(options)) {
        return undefined;
    }
    const profileId = ++loaderProfileId;
    const prefix = `three-mmd-loader:${profileId}:${sanitizePerformanceLabel(label)}`;
    const marks = new Set();
    const measures = [];
    return {
        measures,
        mark(name) {
            const markName = `${prefix}:${name}`;
            performance.mark(markName);
            marks.add(markName);
        },
        measure(name, start, end) {
            const measureName = `${prefix}:${name}`;
            const startMark = `${prefix}:${start}`;
            const endMark = `${prefix}:${end}`;
            if (!marks.has(startMark) || !marks.has(endMark)) {
                return;
            }
            const performanceMeasure = performance.measure(measureName, startMark, endMark);
            const measure = {
                label,
                name,
                durationMs: performanceMeasure.duration
            };
            measures.push(measure);
            options.onMeasure?.(measure);
        },
        clear() {
            for (const mark of marks) {
                performance.clearMarks(mark);
            }
        }
    };
}
function isLoaderPerformanceEnabled(options) {
    return (typeof performance !== "undefined" &&
        typeof performance.mark === "function" &&
        typeof performance.measure === "function" &&
        (options.enabled === true ||
            typeof options.onMeasure === "function" ||
            globalThis[loaderPerformanceFlag] === true));
}
function sanitizePerformanceLabel(label) {
    return label.replace(/\s+/g, " ").slice(0, 80);
}
