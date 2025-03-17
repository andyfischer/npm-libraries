
import { Transport, TransportEvent, TransportEventType } from '../TransportTypes'
import { Stream, captureError } from '@andyfischer/streams'

const VerboseLogMessages = false;

interface SetupOptions {
    // Whether this socket connection is already successfully open. This 
    // is used by WebSocketServer when setting up an incoming connection.
    alreadyConnected?: boolean
}

// Small interface to describe the standard WebSocket client interface.
interface WebSocket {
    addEventListener(name: string, callback: any): void
    removeEventListener(name: string, callback: any): void
    send(msg: string): void
    close(): void
    readyState: number
}

export class WebSocketClient<RequestType,ResponseType> implements Transport<RequestType, ResponseType> {
    socket: WebSocket
    incomingEvents: Stream<TransportEvent<RequestType>> = new Stream();
    name = "WebSocketClient"

    constructor(socket: WebSocket, { alreadyConnected }: SetupOptions = {}) {
        this.socket = socket;

        if (alreadyConnected) {
            this.incomingEvents.item({ t: TransportEventType.connection_ready })
        } else {
            socket.addEventListener('open', evt => {
                if (VerboseLogMessages)
                    console.log(`${this.name} got open event`, evt);

                if (this.incomingEvents.isClosed()) {
                    // console.log('WebSocketClient got message but incomingEvents is closed', evt);
                    return;
                }
                this.incomingEvents.item({ t: TransportEventType.connection_ready })
            });
        }

        socket.addEventListener('close', evt => {
            if (VerboseLogMessages)
                console.log(`${this.name} got close event`, evt);

            if (this.incomingEvents.isClosed()) {
                // console.log('WebSocketClient got message but incomingEvents is closed', evt);
                return;
            }
            this.incomingEvents.item({t: TransportEventType.connection_lost})
        });

        socket.addEventListener('error', evt => {
            if (VerboseLogMessages)
                console.log(`${this.name} got error event`, evt);

            if (this.incomingEvents.isClosed())
                return;

            const error = captureError(evt.error);
            this.incomingEvents.item({
                t: TransportEventType.connection_lost,
                cause: error,
            })
        });

        socket.addEventListener('message', evt => {
            if (this.incomingEvents.isClosed()) {
                // console.log('WebSocketClient got message but incomingEvents is closed', evt);
                return;
            }

            const message = JSON.parse(evt.data);

            if (VerboseLogMessages)
                console.log(`${this.name} got message`, message);

            switch (message.t) {
            case TransportEventType.request:
            case TransportEventType.response_event:
                this.incomingEvents.item(message);
                break;

            default:
                console.error('WebSocketClientTransport: unhandled transport message', message);
            }
        });
    }

    send(message: TransportEvent<RequestType>) {

        if (VerboseLogMessages)
            console.log(`${this.name} sending`, message);

        const json = JSON.stringify(message);
        this.socket.send(json);
    }

    close() {
        this.socket.close();
        this.socket = null;
    }
}
