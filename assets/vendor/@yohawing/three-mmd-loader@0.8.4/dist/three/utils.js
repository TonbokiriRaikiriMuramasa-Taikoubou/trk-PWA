export function clampColor(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(Math.max(value, 0), 1);
}
