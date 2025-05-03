import { HttpClient } from "./HttpClient";
import { WebSocketClient } from "./WebSocketClient";

export function clientFromURL(url: string) {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const host = urlObj.host;
    const path = urlObj.pathname;

    if (protocol === 'http:') {
        return new HttpClient({ url: url });
    } else if (protocol === 'ws:' || protocol === 'wss:') {
        return new WebSocketClient(new WebSocket(url));
    }
}
