
/**
 * Very simple helper class that helps generate unique incrementing IDs.
 */
export class IDSource {
    next: number = 1;

    copyFrom(source: IDSource) {
        this.next = source.next;
    }

    take() {
        const out = this.next;
        this.next++;
        return out;
    }
}