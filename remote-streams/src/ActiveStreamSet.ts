
import { ErrorDetails, Stream, StreamEvent, StreamProtocolValidator, c_done, c_fail, recordUnhandledError } from '@andyfischer/streams'

const VerboseLog = false;

/*
 ActiveStreamSet

 An ActiveStreamSet manages a set of open streams, each with a unique ID. The caller
 can post events to a stream directly using an ID.

 This is useful when sending data across a remote protocol like a socket.

 This class handles a bunch of common responsibilities:

  - Streams are deleted when done
  - Errors are caught (including the BackpressureStop exception)
  - Helper functions can bulk close all streams. (useful when the socket is closed)
  - Stream events are validated using a StreamProtocolValidator.
  - Closed streams are remembered, so that we can ignore messages for recently closed streams.

*/

type StreamId = number | string

export class ActiveStreamSet {
    streams = new Map<StreamId, Stream>();
    validators = new Map<StreamId, StreamProtocolValidator>();
    closedStreamIds = new Set<StreamId>()
    
    startStream(id: StreamId) {
        if (this.streams.has(id))
            throw new Error("ActiveStreamSet protocol error: already have stream with id: " + id);

        if (VerboseLog)
            console.log('ActiveStreamSet - startStream with id: ' + JSON.stringify(id));

        let stream = new Stream();

        this.streams.set(id, stream);
        this.validators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    addStream(id: StreamId, stream: Stream) {
        if (!stream) {
            throw new Error("ActiveStreamSet usage error: missing stream");
        }

        if (this.streams.has(id))
            throw new Error("ActiveStreamSet protocol error: already have stream with id: " + id);
        
        if (VerboseLog)
            console.log('ActiveStreamSet - addStream with id: ' + id);

        this.streams.set(id, stream);
        this.validators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    isStreamOpen(id: StreamId) {
        return this.streams.has(id);
    }

    garbageCollect() {
        for (const [ id, stream ] of this.streams.entries()) {
            if (stream.isClosed()) {
                this.streams.delete(id);
                this.validators.delete(id);
                this.closedStreamIds.add(id);
            }
        }
    }

    getOpenCount() {
        return this.streams.size;
    }

    receiveMessage(id: StreamId, msg: StreamEvent) {
        if (VerboseLog)
            console.log('ActiveStreamSet - receiveMessage on stream id: ' + id, msg);

        const stream = this.streams.get(id);

        if (!stream) {
            if (this.closedStreamIds.has(id))
                return;

            console.error("ActiveStreamSet protocol error: no stream with id: " + id, msg);
            throw new Error("ActiveStreamSet protocol error: no stream with id: " + id);
        }

        this.validators.get(id).check(msg);

        switch (msg.t) {
        case c_done:
        case c_fail:
            if (VerboseLog)
                console.log('ActiveStreamSet - close event on stream id: ' + id);
            this.streams.delete(id);
            this.validators.delete(id);
            this.closedStreamIds.add(id);
        }

        try {
            stream.event(msg);
        } catch (e) {
            if (e.backpressure_stop || e.is_backpressure_stop) {
                if (VerboseLog)
                    console.log('ActiveStreamSet - backpressure closed stream id: ' + id);
                this.streams.delete(id);
                this.validators.delete(id);
                this.closedStreamIds.add(id);
                return;
            }

            recordUnhandledError(e);
        }
    }

    closeStream(id: StreamId) {
        const stream = this.streams.get(id);

        if (!stream)
            return;

        this.streams.delete(id);
        this.validators.delete(id);
        this.closedStreamIds.add(id);

        stream.stopReceiving();
    }

    failAll(error: ErrorDetails) {
        for (const [ id, stream ] of this.streams.entries()) {
            stream.fail(error);
            this.closedStreamIds.add(id);
        }

        this.streams.clear();
        this.validators.clear();
    }

    closeAll() {
        for (const stream of this.streams.values()) {
            try {
                stream.stopReceiving();
            } catch (e) {
                if (e.backpressure_stop || e._is_backpressure_stop)
                    continue;

                recordUnhandledError(e);
            }
        }

        for (const id of this.streams.keys())
            this.closedStreamIds.add(id);

        this.streams.clear();
        this.validators.clear();
    }
}


