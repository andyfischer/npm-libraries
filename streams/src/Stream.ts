
import { toException, ErrorDetails } from './Errors'
import { captureError, } from './Errors'
import { StreamSuperTrace, StreamSuperDuperTrace } from './Config'
import type { SchemaDecl } from './SchemaDecl'
import { callbackBasedIterator } from './callbackBasedIterator'
import { BackpressureStop, exceptionIsBackpressureStop } from './BackpressureStop'
import { StreamEvent, c_item, c_done, c_fail, c_schema, c_restart, c_log_info, c_log_warn, c_log_error } from './EventType'
import { eventTypeToString, formatStreamEvent } from './formatStreamEvent'

const TraceCloseEvents = false;

export interface EventReceiver<ItemType = any> {
    event(event: StreamEvent<ItemType>): void
    isClosed?: () => boolean
}

export type EventReceiverCallback<ItemType = any> = (event: StreamEvent<ItemType>) => void

export type LooseEventReceiver<ItemType = any> = EventReceiver<ItemType> | EventReceiverCallback<ItemType>

export class Stream<ItemType = any> implements EventReceiver {
    t = 'stream'
    id?: number
    receiver: EventReceiver = null
    closedByUpstream = false;
    closedByDownstream = false;

    // Backlog data (if the output isn't connected yet)
    backlog: StreamEvent[] = [];

    // Debugging metadata
    upstreamMetadata?: { name: string, closeTrace?: any }
    downstreamMetadata?: { name: string, closeTrace?: any }

    constructor({name}: { name?: string } = {}) {
        if (name)
            this.upstreamMetadata = { name };
    }

    isStream() {
        return true;
    }

    isClosed() {
        return this.closedByUpstream || this.closedByDownstream;
    }

    hasDownstream() {
        return !!this.receiver;
    }

    // Internal function: Actually send one event to the .receiver.
    _sendToReceiver(event: StreamEvent) {
        try {
            this.receiver.event(event);
        } catch (e) {
            if (exceptionIsBackpressureStop(e)) {
                this.stopListening();
                return;
            }

            throw e;
        }
    }

    event(event: StreamEvent) {
        if (this.closedByDownstream)
            throw new BackpressureStop();

        if (StreamSuperTrace || StreamSuperDuperTrace) {
            console.log(`${this.getDebugLabel()} received:`, event);

            if (StreamSuperDuperTrace) {
                const trace = ((new Error()).stack + '').replace(/^Error:/, '');
                console.log('at: ' + trace);
            }
        }

        if (this.closedByUpstream)
            throw new ProtocolError(`${this.getDebugLabel()} Got '${eventTypeToString(event.t)}' event after closed`);

        // Check for closing events.
        switch (event.t) {
        case c_done:
        case c_fail:
            this.closedByUpstream = true;

            if (TraceCloseEvents) {
                this.upstreamMetadata = {
                    ...this.upstreamMetadata,
                    closeTrace: (new Error()).stack,
                }
            }
            break;
        }

        if (this.receiver) {
            this._sendToReceiver(event);
        } else if (this.backlog) {
            this.backlog.push(event);
        }
    }

    // Helper functions to put events
    item(item: ItemType) {
        this.event({ t: c_item, item });
    }

    done() {
        this.event({t: c_done});
    }

    fail(error: Error | ErrorDetails) {
        if (error instanceof Error)
            error = captureError(error);
        this.event({ t: c_fail, error });
    }

    restart() { this.event({ t: c_restart }); }

    schema(schema: SchemaDecl) { this.event({ t: c_schema, schema }); }

    info(message: string, details?: Record<string, any>) {
        this.event({ t: c_log_info, message, details });
    }

    warn(message: string, details?: Record<string, any>) {
        this.event({ t: c_log_warn, message, details });
    }

    logError(error: ErrorDetails) {
        this.event({ t: c_log_error, error });
    }

    closeWithError(error: ErrorDetails) {
        if (this.isClosed())
            return;

        this.event({t: c_fail, error});
    }

    // Set up a receiver for this stream. All events will be sent to the receiver.
    pipe<T = any>(receiver: LooseEventReceiver<T>) {
        if (typeof receiver === 'function')
            receiver = { event: receiver };

        if (this.hasDownstream())
            throw new UsageError(`${this.getDebugLabel()} already has a receiver`);

        if (!receiver.event)
            throw new UsageError("invalid StreamReceiver, missing .putEvent")

        this.receiver = receiver;

        if (StreamSuperTrace) {
            console.log(`${this.getDebugLabel()} is now sending to:`,
                        (receiver as any).getDebugLabel ? (receiver as any).getDebugLabel() : 'anonymous receiver');
        }

        if (this.backlog) {
            // Send the pending backlog.
            const backlog = this.backlog;
            delete this.backlog;

            for (const event of backlog) {
                if (this.closedByDownstream || !this.receiver)
                    // they don't want our events anymore.
                    break;

                this._sendToReceiver(event);
            }
        }
    }

    // Event consuming callbacks //

    // Receive all events until the stream is closed, then call the callback with the list of events.
    takeEvents(callback: (events: StreamEvent[]) => void) {
        let events: StreamEvent[] = [];

        this.pipe((msg: StreamEvent) => {
            if (events === null)
                return;

            if (events)
                events.push(msg);

            // Check for closing events.
            switch (msg.t) {
                case c_fail:
                case c_done:

                if (events != null) {
                    callback(events);
                    events = null;
                    callback = null;
                }
                return;
            }
        });
    }

    // Try to receive all events synchronously. If the stream doesn't finish synchronously, throw an exception.
    takeEventsSync(): StreamEvent[] {
        let events: StreamEvent[] = null;

        this.takeEvents(_events => { events = _events });

        if (events === null)
            throw new UsageError(`${this.getDebugLabel()} did not finish synchronously`);

        return events;
    }

    // Try to receive all events synchronously. If the stream doesn't finish synchronously, throw an exception.
    takeItemsSync(): ItemType[] {
        const items: ItemType[] = [];
        for (const event of this.takeEventsSync()) {
            switch (event.t) {
                case c_fail:
                    throw toException(event.error);
                case c_item:
                    items.push(event.item);
            }
        }
        return items;
    }

    // Try to take a failure event synchronously. If the stream doesn't finish synchronously, throw an exception.
    takeErrorSync(): ErrorDetails {
        for (const event of this.takeEventsSync()) {
            switch (event.t) {
                case c_fail:
                    return event.error;
            }
        }
        throw new UsageError(`takeErrorSync on ${this.getDebugLabel()}: Stream did not return any error`);
    }

    // Try to receive a single item synchronously. If the stream doesn't finish synchronously, throw an exception.
    takeItemSync(): ItemType {
        const items = this.takeItemsSync();
        if (items.length === 0)
            throw new UsageError(`collectOneItemSync on ${this.getDebugLabel()}: Stream did not return any items`);
        return items[0];
    }

    // Collect all events and receive them as a promise.
    promiseEvents() {
        return new Promise<StreamEvent[]>((resolve) => {
            this.takeEvents(resolve);
        });
    }

    // Collect all items and return them as a promise.
    // If the stream fails, the promise will be rejected with the error.
    promiseItems() {
        if (this.hasDownstream())
            throw new UsageError(".promiseItems(): stream is already consumed");

        return new Promise<ItemType[]>((resolve, reject) => {
            let items: ItemType[] = [];

            this.pipe((msg: StreamEvent) => {
                switch (msg.t) {
                case c_item:
                    items.push(msg.item)
                    break;
                case c_done:
                    if (items !== null)
                        resolve(items);
                    items = null;
                    break;
                case c_fail:
                    reject(toException(msg.error));
                    break;
                }
            });
        });
    }

    // Promise a single item.
    // If the stream fails, the promise will be rejected with the error.
    promiseItem() {
        if (this.hasDownstream())
            throw new UsageError(".promiseItem(): stream is already consumed");

        return new Promise<ItemType>((resolve, reject) => {
            this.pipe((msg: StreamEvent) => {
                switch (msg.t) {
                case c_item:
                    resolve(msg.item);
                    this.stopListening();
                    break;
                case c_fail:
                    reject(toException(msg.error));
                    break;
                }
            });
        });
    }

    // Returns a promise that's resolved when the stream is done. If the stream fails, the promise is rejected.
    // With this calling style, the caller won't receive any items.
    wait() {
        if (this.hasDownstream())
            throw new UsageError(".wait(): stream is already consumed");

        return new Promise<void>((resolve, reject) => {

            let resolved = false;

            this.pipe({
                event(msg: StreamEvent) {
                    switch (msg.t) {
                    case c_done:
                        resolved = true;
                        resolve();
                        break;
                    case c_fail:
                        if (!resolved)
                            reject(toException(msg.error));
                        break;
                    }
                }
            });
        });
    }

    // Consume this stream as a syncronous iterator. If the stream is not finished synchronously,
    // throw an exception.
    *[Symbol.iterator]() {
        yield* this.takeItemsSync();
    }
    
    // Consume this stream as an async iterator.
    async* [Symbol.asyncIterator](): AsyncIterableIterator<ItemType> {
        const { send, it } = callbackBasedIterator<StreamEvent<ItemType>>();

        this.pipe({ event: send });

        for await (const evt of it) {
            switch (evt.t) {
            case c_done:
                return;
            case c_item:
                yield evt.item;
                break;
            case c_fail:
                throw toException(evt.error);
            }
        }
    }

    /*
       takeBacklog

       Take the pending backlog events (if any) and return them.

       If the stream already has a receiver, this will throw an error. (since there are no
       backlogs in this case).
       
       This isn't a common operation to use in prod, but it's useful for testing.
    */
    takeBacklog(): StreamEvent[] {
        if (this.receiver)
            throw new UsageError(`takeBacklog on ${this.getDebugLabel()}, stream has a receiver`);

        const items = this.backlog;
        this.backlog = [];
        return items;
    }

    /*
       takeBacklogItems

       Take the pending backlog items (if any) and return them.

       If the stream already has a receiver, this will throw an error. (since there are no
       backlogs in this case).
       
       This isn't a common operation to use in prod, but it's useful for testing.
    */
    takeBacklogItems(): ItemType[] {
        if (this.receiver)
            throw new UsageError(`takeBacklog on ${this.getDebugLabel()}, stream has a receiver`);

        const items = [];
        for (const evt of this.takeBacklog()) {
            switch (evt.t) {
            case c_item:
                items.push(evt.item);
            }
        }
        return items;
    }

    /*
       spyEvents

       Adds a callback that is triggered for every event that passes through the stream.
       This callback can't modify the events, just watch them.

       Returns a new Stream that includes all the original events.
    */
    spyEvents(callback: (evt: StreamEvent<ItemType>) => void): Stream<ItemType> {
        const output = new Stream<ItemType>();

        this.pipe((evt: StreamEvent<ItemType>) => {
            callback(evt);
            output.event(evt);
        });

        return output;
    }

    /*
       spyItems

       Adds a callback that is triggered for every item that passes through the stream.
       This callback can't modify the items, just watch them.

       Returns a new Stream that includes all the original events.
    */
    spyItems(callback: (item: ItemType) => void): Stream<ItemType> {
        const output = new Stream<ItemType>();

        this.pipe((evt: StreamEvent<ItemType>) => {
            if (evt.t === c_item)
                callback(evt.item);
            output.event(evt);
        });

        return output;
    }

    /*
       map

       Returns a new Stream where items are modified by the callback function.

       The callback will be triggered for each item, and the callback's result
       is sent to the output stream.

       If the callback throws an error, the stream is closed with a 'fail' event.

       If the callback returns a falsy result then the item is discarded. This can
       be used to filter the data.

       Other events (like logs) are passed through without modification.

    */
    map<OutputType = ItemType>(callback: (item: ItemType) => OutputType): Stream<OutputType> {
        const output = new Stream<OutputType>();

        this.pipe((evt: StreamEvent<ItemType>) => {
            switch (evt.t) {
                case c_item:
                    try {
                        const transformed = callback(evt.item);
                        if (transformed)
                            output.item(transformed);
                    } catch (e) {
                        if (exceptionIsBackpressureStop(e))
                            throw e;

                        output.fail(e);
                    }
                    break;
                default:
                    output.event(evt as StreamEvent<OutputType>);
            }
        });

        return output;
    }

    /*
       mapcat

       Returns a new Stream where items are modified by the callback function.

       This is similar to .map but in this function, the callback returns an array of items.
       Each item is sent to the output stream. With this function, you can generate multiple
       events from a single input event.
    */
    mapcat<OutputType = ItemType>(callback: (item: ItemType) => OutputType[]): Stream<OutputType> {
        const output = new Stream<OutputType>();

        this.pipe((evt: StreamEvent<ItemType>) => {
            switch (evt.t) {
                case c_item:
                    try {
                        const transformed = callback(evt.item);
                        if (transformed) {
                            for (const item of transformed)
                                output.item(item);
                        }
                    } catch (e) {
                        if (exceptionIsBackpressureStop(e))
                            throw e;

                        output.fail(e);
                    }
                    break;
                default:
                    output.event(evt as StreamEvent<OutputType>);
            }
        });

        return output;
    }

    onItem(callback: (ItemType) => void): void {
        this.pipe({
            event: (evt: StreamEvent) => {
                switch (evt.t) {
                    case c_item:
                        try {
                            callback(evt.item);
                        } catch (e) {
                            if (exceptionIsBackpressureStop(e))
                                throw e;
                            console.error(`${this.getDebugLabel()}: unhandled exception in Stream.onItem: `, e);
                        }
                        break;
                    case c_done:
                        break;
                    case c_fail:
                        break;
                }
            }
        });
    }

    forEach(callback: (ItemType) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pipe({
                event: (evt: StreamEvent) => {
                    switch (evt.t) {
                        case c_item:
                            try {
                                callback(evt.item);
                            } catch (e) {
                                console.error(`${this.getDebugLabel()}: unhandled exception in Stream.forEach: `, e);
                            }
                            break;
                        case c_done:
                            resolve();
                            break;
                        case c_fail:
                            reject(evt.error);
                            break;
                    }
                }
            });
        });
    }

    /*
        stopListening

        This function should only be called by the 'downstream' handler (the code
        that is receiving & processing stream events).

        This closes the stream.

        If the upstream continues to send events, they'll trigger a BackpressureStop exception.
    */
    stopListening() {
        this.closedByDownstream = true;
        this.receiver = null;
        this.backlog = null;
    }
    
    // Debug Metadata //

    getDebugLabel(): string {
        let label = `Stream`;
        
        if (this.id)
            label += this.id;

        let details;
        let downstreamName;
        let upstreamName;

        if (this.upstreamMetadata?.name)
            upstreamName = this.upstreamMetadata?.name;

        if (this.downstreamMetadata?.name)
            downstreamName = this.downstreamMetadata?.name;

        if (!downstreamName && !this.hasDownstream())
            downstreamName = 'backlog';

        if (downstreamName || upstreamName) {
            details = `${upstreamName || "anonymous"} -> ${downstreamName || "anonymous"}`
        }

        if (details)
            label += ` (${details})`

        return label;
    }

    logSpy({label}: {label: string}) {
        const prefix = `${label || this.getDebugLabel()}: `;
        return this.spyEvents(evt => {
            console.log(prefix + formatStreamEvent(evt));
            return evt;
        });
    }

    logToConsole(label?: string) {
        const prefix = `${label || this.getDebugLabel()}: `;
        this.pipe(evt => {
            console.log(prefix + formatStreamEvent(evt));
        });
    }

    sendErrorsToConsole() {
        this.pipe(evt => {
            switch (evt.t) {
            case c_fail:
                console.error(`${this.getDebugLabel()} error:`, evt.error);
            }
        });
    }

    // Static Constructors //

    static newEmptyStream() {
        const stream = new Stream();
        stream.done();
        return stream;
    }

    static fromList<ItemType = any>(items: ItemType[]) {
        const stream = new Stream<ItemType>();
        for (const item of items)
            stream.item(item);
        stream.done();
        return stream;
    }

    static fromEvents<ItemType = any>(events: StreamEvent<ItemType>[]) {
        const stream = new Stream<ItemType>();
        for (const event of events)
            stream.event(event);
        return stream;
    }

    static newNullStream() {
        const stream = new Stream();
        stream.pipe(evt => {});
        return stream;
    }
}

export class ProtocolError extends Error {
    is_stream_protocol_error = true

    constructor(msg: string) {
        super("Stream protocol error: " + msg);
    }
}

export class UsageError extends Error {
    is_stream_usage_error = true

    constructor(msg: string) {
        super("Stream usage error: " + msg);
    }
}

