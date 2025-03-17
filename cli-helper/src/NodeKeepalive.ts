
// Helper class that prevents Node from quitting even if there's nothing in the event queue.
export class NodeKeepalive {
    interval: any

    constructor() {
        this.interval = setInterval(() => {
        }, 5000);
    }

    stop() {
        clearInterval(this.interval);
    }
}
