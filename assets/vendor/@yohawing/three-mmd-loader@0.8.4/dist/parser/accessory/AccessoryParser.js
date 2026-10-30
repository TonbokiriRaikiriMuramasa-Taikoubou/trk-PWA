export function parseAccessory(bytes, core, fileName) {
    const typed = core;
    if (typeof typed.parseAccessory !== "function") {
        throw new Error("Accessory parsing requires WASM core (use initCore())");
    }
    return typed.parseAccessory(bytes, fileName);
}
