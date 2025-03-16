
import { Table, compileSchema } from '@andyfischer/query'
import { RequestClient } from './RequestClient'
import { Stream, c_done, c_fail, c_item, BackpressureStop, StreamProtocolValidator,
    recordUnhandledError, ErrorDetails, StreamEvent } from '@andyfischer/streams'
import { MessageBuffer } from './MessageBuffer'
import { TransportEventType } from './TransportTypes'
import type { ConnectionTransport, TransportMessage, TransportRequest } from './TransportTypes'

const VerboseLog = false;
const VeryVerboseLog = false;

export type ConnectionChangeEvent = { t: 'connected' } | { t: 'disconnected' }
export type ConnectionStatus = 'waiting_for_ready' | 'ready' | 'sleep' | 'failure_temporary_back_off' | 'permanent_close'

export interface Connection<RequestType> extends RequestClient<RequestType> {
    listenToConnectionChange: () => Stream<ConnectionChangeEvent>
}

type HandleRequestFunc<IncomingType> = (req: IncomingType, connection: any, output: Stream) => void

interface ReconnectionSchedule {
    delayMsForAttempt: (attempt: number) => number | 'failure_temporary_back_off'
}

interface RequestHandler<IncomingRequestType> {
    handleRequest(req: IncomingRequestType, connection, output: Stream): void
    protocolDetails?: Table
}

interface SetupOptions<OutgoingRequestType,IncomingRequestType> {
    // Name for debugging
    name?: string

    // Optional ID - created by owner.
    connectionId?: any

    // Set up a connection. Maybe be called multiple times as the connection is
    // reestablished.
    connect: () => ConnectionTransport<OutgoingRequestType, IncomingRequestType>

    // Whether to enable reconnection behavior.
    //
    // If enabled then the connection will automatically try to re-create a transport when lost.
    // (using connect()). If disabled then the connection will be permanently closed when
    // the transport is lost.
    enableReconnection?: boolean

    // Optional - RequestHandler instance. If provided, this will be used for the 'handleRequest' callback.
    api?: RequestHandler<IncomingRequestType>

    // Callback to handle incoming requests.
    handleRequest?: HandleRequestFunc<IncomingRequestType>

    // Optional callback triggered when the connection is established (or reestablished).
    onEstablish?: (connection: Connection) => void

    // Optional callback triggered when the connection is closed.
    onClose?: (connection: Connection) => void

    reconnectSchedule?: ReconnectionSchedule

    // Delay (in ms) to fail a message when it's stuck in the buffer. The buffer is used whenever
    // a message is sent but the connection is still being established.
    bufferedMessageTimeout?: number

    // Optional - Log stream to send errors.
    logs?: Stream
}

const ReconnectionRecentWindowTime = 30;

const connectionAttemptsSchema = compileSchema({
    name: 'ConnectionAttempts',
    attrs: [
        'id auto',
        'time',
    ],
    funcs: [
        'each',
        'delete(id)',
        'deleteAll',
    ]
});

type StreamId = number | string;

export class Connection<RequestType = any, IncomingRequestType = any> implements RequestClient<RequestType> {
    name: string

    connectionId?: any
    sender?: any
    requestContext?: any
    authentication?: any

    options: SetupOptions<RequestType, IncomingRequestType>
    handleRequest: HandleRequestFunc<IncomingRequestType>

    status: ConnectionStatus;

    recentAttempts: Table
    reconnectTimer: NodeJS.Timeout
    reconnectSchedule: ReconnectionSchedule

    transport: ConnectionTransport<RequestType, IncomingRequestType>;
    transportIncomingEvents: Stream;
    
    streams = new Map<StreamId, Stream>();
    validators = new Map<StreamId, StreamProtocolValidator>();
    closedStreamIds = new Set<StreamId>()

    nextRequestStreamId = 1
    outgoingBuffer: MessageBuffer

    logs?: Stream

    constructor(options: SetupOptions<RequestType, IncomingRequestType>) {
        this.name = options.name || 'Connection';
        this.connectionId = options.connectionId;
        this.options = options;
        this.logs = options.logs;
        this.recentAttempts = connectionAttemptsSchema.createTable();
        this.outgoingBuffer = new MessageBuffer({ timeoutMs: options.bufferedMessageTimeout });

        this.handleRequest = options.handleRequest;

        if (options.api && options.handleRequest) {
            throw new Error("Connection: cannot provide both 'api' and 'handleRequest' options");
        }

        if (options.api) {
            this.handleRequest = options.api.handleRequest.bind(options.api);
        }

        this.reconnectSchedule = {
            ...options.reconnectSchedule || {},
            delayMsForAttempt: (attempt: number) => {
                if (attempt > 5)
                    return 'failure_temporary_back_off';
                return (2 ** attempt) * 500
            }
        };

        if (VerboseLog)
            console.log(`created: ${this.name}`)

        this.status = 'waiting_for_ready';
        this.attemptReconnection();
    }

    isReady() {
        return this.status === 'ready';
    }

    close() {
        this.clearCurrentTransport();
        this.closeAllActiveStreams();
        this.setStatus('permanent_close');
        if (this.options.onClose) {
            this.options.onClose(this);
        }
        this.options = null;
    }

    setStatus(newStatus: ConnectionStatus) {
        // console.log('setStatus', newStatus);

        if (newStatus === this.status)
            return;

        if (VerboseLog)
            console.log(`${this.name}: changed status from ${this.status} to ${newStatus}`);

        this.status = newStatus;

        switch (newStatus) {
        case 'permanent_close':
        case 'failure_temporary_back_off':
            this.clearCurrentTransport();
            this.closeAllActiveStreams();
            this.clearReconnectTimer();

            // console.log('closing outgoingBuffer: ', this.outgoingBuffer);

            this.outgoingBuffer.closeAllWithError({ errorMessage: "connection_failed", errorType: 'connection_failed' });
            break;
        }
    }

    takeNextRequestId() {
        const id = this.nextRequestStreamId;
        this.nextRequestStreamId++;
        return id;
    }

    sendRequest(req: RequestType, output?: Stream) {

        if (VeryVerboseLog)
            console.log('starting sendRequest', this.status, req);

        if (output && !output.isStream()) {
            throw new Error("'output' param must be a Stream");
        }

        if (!output)
            output = new Stream();

        switch (this.status) {
        case 'waiting_for_ready':
            // Queue the request until we are ready.
            this.outgoingBuffer.push(req, output);
            break;

        case 'failure_temporary_back_off':
        case 'sleep':
            // Wake up and try another attempt.
            this.outgoingBuffer.push(req, output);
            this.attemptReconnection();
            return

        case 'permanent_close':
            // Fail because we're permanently closed.
            output.closeWithError({ errorMessage: 'connection_closed', errorType: 'connection_closed' });
            return

        case 'ready': {
            // We can send the request immediately.
            this._actuallySendRequest({ t: TransportEventType.request, req, streamId: null }, output);
            break;
        }
        default:
            console.warn('internal error: unhandled case in Connection.sendRequest:', this.status);
        }

        return output;
    }

    _actuallySendRequest(msg: TransportRequest<RequestType>, output: Stream) {
        if (!msg.streamId) {
            msg.streamId = this.takeNextRequestId();
        }

        this.addRequestStream('req_' + msg.streamId, output);

        this.transport.send(msg);
    }

    // count the number of connection attempts in the recent window time.
    countRecentAttempts() {
        let recentCount = 0;
        let mostRecentAttempt = null;
        const now = Date.now();
        const recentWindow = ReconnectionRecentWindowTime * 1000;

        for (const item of this.recentAttempts.each()) {
            if ((item.time + recentWindow) < now) {
                this.recentAttempts.delete_with_id(item.id);
                continue;
            }

            if (mostRecentAttempt === null || item.time > mostRecentAttempt)
                mostRecentAttempt = item.time;

            recentCount++;
        }

        return { recentCount, mostRecentAttempt }
    }

    // Perform a reconnection attempt
    attemptReconnection() {
        if (this.status === 'ready' || this.status === 'permanent_close') {
            if (VerboseLog)
                console.log(`${this.name}: not attempting connection (status=${this.status})`);
            return;
        }

        if (VerboseLog)
            console.log(`${this.name}: now attempting reconnection`);

        this.clearReconnectTimer();
        this.clearCurrentTransport();
        this.setStatus('waiting_for_ready');

        try {
            this.transport = this.options.connect(); 
            
            this.transportIncomingEvents = this.transport.incomingEvents;

            this.transportIncomingEvents.pipe(evt => {
                switch (evt.t) {
                case c_item:
                    this.onIncomingEvent(evt.item);
                    break;
                }
            });

        } catch (err) {
            console.log(`${this.name}: connect() failed`, err);

            if (this.logs)
                this.logs.logError({ errorMessage: "connect() attempt failed: " + err.message});

            this.onIncomingEvent({ t: TransportEventType.connection_lost });
        } finally {
            this.recentAttempts.insert({ time: Date.now() });
        }
    }

    onIncomingEvent(evt: TransportMessage<IncomingRequestType>) {

        if (VeryVerboseLog)
            console.log(`${this.name}: incoming event:`, evt); 

        switch (evt.t) {

            case TransportEventType.connection_ready:
                this.clearReconnectTimer();

                if (this.status === 'ready')
                    return;

                if (this.logs)
                    this.logs.info("connection is ready");

                this.enterReadyState();
                break;

            case TransportEventType.connection_lost: {

                const shouldRetry = evt.shouldRetry || (evt.shouldRetry == undefined);

                if (this.logs)
                    this.logs.logError({ errorMessage: "connection lost", cause: evt.cause });

                if (VerboseLog)
                    console.log(`${this.name}: connection has disconnected (shouldRetry=${shouldRetry})`); 

                if (shouldRetry === false) {
                    this.failAllActiveStreams(evt.cause || { errorMessage: "connection_lost", errorType: 'connection_lost' });
                    this.close();
                } else {
                    this.setStatus('waiting_for_ready');
                    this.clearCurrentTransport();
                    this.closeAllActiveStreams();
                    this.scheduleReconnectionTimer(10);
                }
                break;
            }


            case TransportEventType.request: {
                // Remote side has sent us a request.
                const streamId = evt.streamId;

                let stream: Stream;

                if (streamId) {
                    stream = this.addIncomingStream('res_' + streamId);

                    stream.pipe(evt => {
                        if (this.status !== 'ready')
                            throw new BackpressureStop();

                        this.transport.send({ t: TransportEventType.response_event, evt, streamId, });

                        switch (evt.t) {
                            case c_done:
                            case c_fail:
                                this.closeStream('res_' + streamId);
                        }
                    });
                } else {
                    // No streamId - Other side is not expecting a response.
                    stream = Stream.newNullStream();
                }

                if (!this.handleRequest) {
                    stream.closeWithError({ errorType: 'no_handler', errorMessage: "Connection is not set up to handle requests" });
                    return;
                }

                switch (evt.t) {
                case TransportEventType.request:
                    this.handleRequest(evt.req, this, stream);
                    break;
                }

                break;
            }

            case TransportEventType.response_event:
                // Remote side is providing a response to one of our requests.
                const streamId = 'req_' + evt.streamId;

                if (this.isStreamOpen(streamId)) {
                    this.receiveMessage(streamId, evt.evt);

                } else {
                    // Stream isn't active (it may have been closed on our side). Tell the remote
                    // side to close it.
                    this.transport.send({
                        t: TransportEventType.response_event,
                        streamId: evt.streamId ,
                        evt: {
                            t: c_fail,
                            error: { errorMessage: "stream not found", errorType: 'stream_id_not_found', },
                        }
                    });
                }
                break;

            case TransportEventType.set_connection_metadata:
                if (evt.sender)
                    this.sender = evt.sender;
                break;

            default:
                console.warn('Connection.onIncomingEvent unhandled:', evt);
        }
    }

    enterReadyState() {
        this.setStatus('ready');
        this.recentAttempts.deleteAll();

        if (this.options.onEstablish) {
            this.options.onEstablish(this);
        }

        for (const { req, output } of this.outgoingBuffer.takeAll()) {
            this._actuallySendRequest({ t: TransportEventType.request, req, streamId: null }, output);
        }
    }

    clearCurrentTransport() {
        if (this.transport)
            this.transport.close();

        this.transport = null;

        if (this.transportIncomingEvents) {
            this.transportIncomingEvents.stopListening();
            this.transportIncomingEvents = null;
        }
    }

    clearReconnectTimer() {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    scheduleReconnectionTimer(delayMs: number) {
        if (!this.reconnectTimer)
            this.reconnectTimer = setTimeout(() => this.checkAndMaybeReconnect(), delayMs);
    }

    // Check if we should possibly try to reconnect, based on the number of recent attempts.
    checkAndMaybeReconnect() {
        this.reconnectTimer = null;

        if (this.status === 'ready' || this.status === 'permanent_close') {
            if (VerboseLog)
                console.log(`${this.name}: checkAndMaybeReconnect doing nothing (status=${this.status}`); 
            return;
        }

        if (this.options.enableReconnection === false) {
            this.close();
            return;
        }

        const { recentCount, mostRecentAttempt } = this.countRecentAttempts();

        if (recentCount === 0) {
            if (VerboseLog)
                console.log(`${this.name}: attempting reconnection (recentCount=${recentCount})`); 
            this.attemptReconnection();
            return;
        }

        const delayForNextAttempt = this.reconnectSchedule.delayMsForAttempt(recentCount);

        if (delayForNextAttempt === 'failure_temporary_back_off') {
            if (VerboseLog)
                console.log(`${this.name}: giving up after ${recentCount} attempts`);

            if (this.logs)
                this.logs.logError({ errorMessage: "entering backoff state, too many failed attempts" });

            this.setStatus('failure_temporary_back_off');
            return;
        }

        let timeToAttempt = delayForNextAttempt + mostRecentAttempt - Date.now();

        if (VerboseLog)
            console.log(`${this.name}: next attempt (${recentCount}) has delay of ${delayForNextAttempt}ms`);

        if (timeToAttempt < 10)
            timeToAttempt = 0;

        if (timeToAttempt === 0) {
            this.attemptReconnection();
            return;
        }

        if (VerboseLog)
            console.log(`${this.name}: scheduled next reattempt for ${timeToAttempt}ms`, { recentCount, mostRecentAttempt });

        this.scheduleReconnectionTimer(timeToAttempt);
    }

    /*
      addIncomingStream

      Start a Stream object that was initiated by the remote side.
    */
    addIncomingStream(id: StreamId) {
        if (this.streams.has(id))
            throw new Error("ActiveStreamSet protocol error: already have stream with id: " + id);

        if (VerboseLog)
            console.log('ActiveStreamSet - startStream with id: ' + JSON.stringify(id));

        let stream = new Stream();

        this.streams.set(id, stream);
        this.validators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    /*
      addRequestStream

      Start a Stream object that was initiated by this client, as part of a call to .sendRequest.
    */
    addRequestStream(id: StreamId, stream: Stream) {
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

        stream.stopListening();
    }

    failAllActiveStreams(error: ErrorDetails) {
        for (const [ id, stream ] of this.streams.entries()) {
            stream.fail(error);
            this.closedStreamIds.add(id);
        }

        this.streams.clear();
        this.validators.clear();
    }

    closeAllActiveStreams() {
        for (const stream of this.streams.values()) {
            try {
                stream.stopListening();
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
