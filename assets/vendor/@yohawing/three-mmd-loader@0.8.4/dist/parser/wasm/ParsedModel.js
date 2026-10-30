export class ParsedModel {
    parsed;
    constructor(parsed) {
        this.parsed = parsed;
    }
    metadata() {
        return this.parsed.metadata;
    }
    geometry() {
        return this.parsed.geometry;
    }
    materials() {
        return this.parsed.materials;
    }
    skeleton() {
        return this.parsed.skeleton;
    }
    morphs() {
        return this.parsed.morphs;
    }
    displayFrames() {
        return this.parsed.displayFrames;
    }
    rigidBodies() {
        return this.parsed.rigidBodies;
    }
    joints() {
        return this.parsed.joints;
    }
    softBodies() {
        return this.parsed.softBodies;
    }
    embeddedTextures() {
        return [];
    }
}
export class DisposableParsedModel extends ParsedModel {
    release;
    disposed = false;
    constructor(parsed, release) {
        super(parsed);
        this.release = release;
    }
    isDisposed() {
        return this.disposed;
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.release();
    }
}
