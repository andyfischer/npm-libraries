
import { EventReceiver, Stream } from './Stream'
import { StreamEvent,
        c_done, c_fail, c_item, c_log_error, c_log_info, c_log_warn,
        c_restart, } from './EventType'
import { ErrorDetails, recordUnhandledError } from './Errors'
import { BackpressureStop, exceptionIsBackpressureStop } from './BackpressureStop'

/*
  StreamListeners

  Stores a list of streams that all listen to the same events.
*/
export class StreamDispatcher<ItemType = any, MetadataType = any>
    implements EventReceiver<ItemType>
{
    listeners: Array<[ Stream<ItemType>, MetadataType ]> = []
    recordUnhandledExceptions = true
    closed = false

    newListener({metadata}: {metadata?: MetadataType} = {}) {
        const stream = new Stream<ItemType>();
        this.listeners.push([stream,metadata]);
        return stream;
    }
    
    addListener(stream: Stream, metadata?: MetadataType) {
        this.listeners.push([stream,metadata]);
        return stream;
    }

    onItem(callback: (item: ItemType) => void) {
        const stream = this.newListener();
        stream.onItem(callback);
        return stream;
    }

    item(item: ItemType) {
        this.event({t: c_item, item});
    }

    info(message: string, details?: Record<string, any>) {
        this.event({ t: c_log_info, message, details });
    }

    warn(message: string, details?: Record<string, any>) {
        this.event({ t: c_log_warn, message, details });
    }

    logError(error: ErrorDetails) {
        this.event({ t: c_log_error, error });
    }

    restart() {
        this.event({t: c_restart});
    }

    close() {
        if (this.closed)
            return;

        this.event({t: c_done});
    }

    event(evt: StreamEvent<ItemType>) {
        if (this.closed)
            throw new BackpressureStop();

        let anyClosed = false;

        for (let index = 0; index < this.listeners.length; index++) {
            const stream = this.listeners[index][0];

            // Check if the stream is closed (maybe closed by downstream)
            if (stream.isClosed()) {
                this.listeners[index] = null;
                anyClosed = true;
                continue;
            }

            try {
                stream.event(evt);
            } catch (e) {
                if (exceptionIsBackpressureStop(e)) {
                    anyClosed = true;
                    this.listeners[index] = null;
                    continue;
                }

                if (this.recordUnhandledExceptions)
                    recordUnhandledError(e);
            }
        }

        // Check to delete closed streams from the listener list.
        switch (evt.t) {
        case c_done:
        case c_fail:
            this.listeners = [];
            this.closed = true;
            break;
        default:
            if (anyClosed)
                this.listeners = this.listeners.filter(item => item != null);
        }
    }

    /*
        Call the callback for each stream in the list. The callback can throw exceptions
        (including BackpressureStop) and they will be caught & handled.
    */
    forEach(callback: (stream: Stream<ItemType>, metadata: MetadataType) => void) {
        let anyClosed = false;

        for (let index = 0; index < this.listeners.length; index++) {
            const stream = this.listeners[index][0];
            const metadata = this.listeners[index][1];

            try {
                callback(stream, metadata);
            } catch (e) {
                if (exceptionIsBackpressureStop(e)) {
                    anyClosed = true;
                    this.listeners[index] = null;
                    continue;
                }

                if (this.recordUnhandledExceptions)
                    recordUnhandledError(e);
            }
        }

        if (anyClosed)
            this.listeners = this.listeners.filter(item => item !== null);
    }
}
