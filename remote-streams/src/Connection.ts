
import { Table, compileSchema } from '@andyfischer/query'
import { RequestClient } from './RequestClient'
import { Stream, c_done, c_fail, BackpressureStop, StreamProtocolValidator,
    recordUnhandledError, ErrorDetails, StreamEvent, 
    IDSource} from '@andyfischer/streams'
import { MessageBuffer } from './MessageBuffer'
import { TransportEventType } from './TransportTypes'
import type { Transport, TransportEvent, TransportInitFunc, TransportRequest, TransportToConnectionLayer } from './TransportTypes'

const EnableVerboseLog = false;
const EnableVeryVerboseLog = false;

export type ConnectionChangeEvent = { t: 'connected' } | { t: 'disconnected' }
export enum ConnectionStatus {
    waiting_for_ready = 'waiting_for_ready',
    ready = 'ready',
    sleep = 'sleep',
    failure_temporary_back_off = 'failure_temporary_back_off',
    permanent_close = 'permanent_close',
}

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
    connect: TransportInitFunc<OutgoingRequestType,IncomingRequestType>

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

    transport: Transport<RequestType, IncomingRequestType>;
    currentTransportId: number = -1;
    nextTransportId = new IDSource();

    recentAttempts: Table
    reconnectTimer: NodeJS.Timeout
    reconnectSchedule: ReconnectionSchedule
    
    // Client streams - streams where this connection is the client. These are started by
    // a local call to .sendRequest.
    clientStreams = new Map<StreamId, Stream>();
    clientStreamValidators = new Map<StreamId, StreamProtocolValidator>();
    nextClientStreamId = new IDSource();

    // Server streams - streams where this connection is the server.
    serverStreams = new Map<StreamId, Stream>();
    serverStreamValidators = new Map<StreamId, StreamProtocolValidator>();

    closedStreamIds = new Set<StreamId>()

    outgoingRequestBuffer: MessageBuffer

    logs?: Stream

    constructor(options: SetupOptions<RequestType, IncomingRequestType>) {
        this.name = options.name || 'Connection';
        this.connectionId = options.connectionId;
        this.options = options;
        this.logs = options.logs;
        this.recentAttempts = connectionAttemptsSchema.createTable();
        this.outgoingRequestBuffer = new MessageBuffer({ timeoutMs: options.bufferedMessageTimeout });
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

        verboseLog(`new instance: ${this.name}`)

        this.status = ConnectionStatus.waiting_for_ready;
        this.tryEstablishConnection();
    }

    isReady() {
        return this.status === 'ready';
    }

    close() {
        this.closeCurrentTransport();
        this.closeAllActiveStreams();
        this.setStatus(ConnectionStatus.permanent_close);
        if (this.options.onClose) {
            this.options.onClose(this);
        }
        this.options = null;
    }

    setStatus(newStatus: ConnectionStatus) {
        // console.log('setStatus', newStatus);

        if (newStatus === this.status)
            return;

        if (this.status === ConnectionStatus.permanent_close) {
            throw new Error("internal error: Connection tried to change status from permanent_close");
        }

        verboseLog(`${this.name}: changed status from ${this.status} to ${newStatus}`);

        this.status = newStatus;

        switch (newStatus) {
        case ConnectionStatus.permanent_close:
        case ConnectionStatus.failure_temporary_back_off:
            this.closeCurrentTransport();
            this.closeAllActiveStreams();
            this.clearReconnectTimer();

            // console.log('closing outgoingBuffer: ', this.outgoingBuffer);

            this.outgoingRequestBuffer.closeAllWithError({ errorMessage: "connection_failed", errorType: 'connection_failed' });
            break;
        }
    }

    initializeNewTransport() {
        const newTransportId = this.nextTransportId.take();
        this.currentTransportId = newTransportId;
        let transportInstance: Transport<RequestType, IncomingRequestType>;

        const incomingEvents: TransportToConnectionLayer = {
            sendTransportEvent: (evt: TransportEvent<any>) => {
                // Make sure we're not getting events after the transport has been closed.
                if (this.currentTransportId !== newTransportId) {
                    if (transportInstance)
                        transportInstance.close();  
                    transportInstance = null;
                    return;
                }

                // Send events on a delay to avoid concurrency bugs.
                setTimeout(() => this.onTransportEvent(evt), 0);
            }
        }

        transportInstance = this.options.connect(incomingEvents);

        this.transport = transportInstance;
    }

    closeCurrentTransport() {
        if (this.transport)
            this.transport.close();

        this.transport = null;
        this.currentTransportId = -1;
    }

    onTransportEvent(evt: TransportEvent<any>) {
        if (EnableVeryVerboseLog)
            console.log(`${this.name}: incoming transport event:`, evt); 

        switch (this.status) {
        case ConnectionStatus.permanent_close:
            return;
        }

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

            const shouldRetry: boolean = evt.shouldRetry || (evt.shouldRetry == undefined);

            if (this.logs)
                this.logs.logError({ errorMessage: "connection lost", cause: evt.cause });

            if (EnableVerboseLog)
                console.log(`${this.name}: connection has disconnected (shouldRetry=${shouldRetry})`); 

            if (!shouldRetry) {
                this.failAllActiveStreams(evt.cause || { errorMessage: "connection_lost", errorType: 'connection_lost' });
                this.close();
            } else {
                this.setStatus(ConnectionStatus.waiting_for_ready);
                this.closeCurrentTransport();
                this.closeAllActiveStreams();
                this.scheduleReconnectionTimer(10);
            }
            break;
        }

        case TransportEventType.request: {
            // Remote side has sent us a request.
            const streamId = evt.streamId;

            if (!this.handleRequest) {
                // This connection is not set up to handle requests.
                this.transport.send({
                    t: TransportEventType.response_event,
                    streamId,
                    evt: {
                        t: c_fail,
                        error: {
                            errorMessage: "Connection is not set up to handle requests",
                            errorType: 'no_handler'
                        },
                    }
                });
                return;
            }

            let stream: Stream;

            if (streamId) {
                stream = this.newServerStream(streamId);

                stream.pipe(evt => {
                    if (this.status !== 'ready')
                        throw new BackpressureStop();

                    this.transport.send({ t: TransportEventType.response_event, evt, streamId, });

                    switch (evt.t) {
                    case c_done:
                    case c_fail:
                        this.closeServerStream(streamId);
                    }
                });
            } else {
                // No streamId - Other side is not expecting a response.
                stream = Stream.newNullStream();
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

            this.onResponseStreamEvent(evt.streamId, evt.evt);

            break;

        case TransportEventType.set_connection_metadata:
            if (evt.sender)
                this.sender = evt.sender;
            break;

        default:
            console.warn('Connection.onIncomingEvent unhandled:', evt);
        }
    }

    /*
    sendRequest

    Start a new request stream where this connection is the client.
    */
    sendRequest(req: RequestType, output?: Stream) {

            veryVerboseLog('sendRequest', req, { status: this.status });

        if (output && !output.isStream()) {
            throw new Error("'output' param must be a Stream");
        }

        if (!output)
            output = new Stream();

        switch (this.status) {
        case ConnectionStatus.waiting_for_ready:
            // Queue the request until we are ready.
            this.outgoingRequestBuffer.push(req, output);
            break;

        case ConnectionStatus.failure_temporary_back_off:
        case ConnectionStatus.sleep:
            // Wake up and try another attempt.
            this.outgoingRequestBuffer.push(req, output);
            this.tryEstablishConnection();
            return

        case ConnectionStatus.permanent_close:
            // Fail because we're permanently closed.
            output.closeWithError({ errorMessage: 'connection_closed', errorType: 'connection_closed' });
            return

        case ConnectionStatus.ready: {
            // Ready status - We can send the request immediately.
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
            msg.streamId = this.nextClientStreamId.take();
        }

        this.newClientStream(msg.streamId, output);

        this.transport.send(msg);
    }

    /*
    onResponseStreamEvent

    The remote side has sent us a response event for one of our client requests.
    Dispatch it to the local stream object.
    */
    onResponseStreamEvent(streamId: number, evt: StreamEvent) {

        if (EnableVerboseLog)
            console.log('Connection - onResponseStreamEvent on stream id: ' + streamId, evt);

        const stream = this.clientStreams.get(streamId);

        if (!stream) {
            if (this.closedStreamIds.has(streamId))
                return;

            this.transport.send({
                t: TransportEventType.response_event,
                streamId: streamId,
                evt: {
                    t: c_fail,
                    error: { errorMessage: "no active stream with ID" },
                }
            });
            return;
        }

        this.clientStreamValidators.get(streamId).check(evt);

        try {
            stream.event(evt);
        } catch (e) {
            if (e.backpressure_stop || e.is_backpressure_stop) {
                if (EnableVerboseLog)
                    console.log('Connection - backpressure closed stream id: ' + streamId);

                this.clientStreams.delete(streamId);
                this.clientStreamValidators.delete(streamId);
                this.closedStreamIds.add(streamId);

                this.transport.send({
                    t: TransportEventType.response_event,
                    streamId: streamId,
                    evt: {
                        t: c_fail,
                        error: { errorMessage: "backpressure stop" },
                    }
                });
                return;
            }

            recordUnhandledError(e);
        }

        // Followup - Check if the stream is now closed.
        switch (evt.t) {
        case c_done:
        case c_fail:
            if (EnableVerboseLog)
                console.log('Connection - close event on stream id: ' + streamId);
            this.clientStreams.delete(streamId);
            this.clientStreamValidators.delete(streamId);
            this.closedStreamIds.add(streamId);
        }
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

    tryEstablishConnection() {
        if (this.status === ConnectionStatus.ready || this.status === ConnectionStatus.permanent_close) {
            verboseLog(`${this.name}: not attempting connection (status=${this.status})`);
            return;
        }

        verboseLog(`${this.name}: now attempting reconnection`);

        this.clearReconnectTimer();
        this.closeCurrentTransport();
        this.setStatus(ConnectionStatus.waiting_for_ready);

        try {
            this.initializeNewTransport();

        } catch (err) {
            console.log(`${this.name}: connect() failed`, err);

            if (this.logs)
                this.logs.logError({ errorMessage: "connect() attempt failed: " + err.message});

        } finally {
            this.recentAttempts.insert({ time: Date.now() });
        }
    }

    enterReadyState() {
        this.setStatus(ConnectionStatus.ready);
        this.recentAttempts.deleteAll();

        if (this.options.onEstablish) {
            this.options.onEstablish(this);
        }

        for (const { req, output } of this.outgoingRequestBuffer.takeAll()) {
            this._actuallySendRequest({ t: TransportEventType.request, req, streamId: null }, output);
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
            if (EnableVerboseLog)
                console.log(`${this.name}: checkAndMaybeReconnect doing nothing (status=${this.status}`); 
            return;
        }

        if (this.options.enableReconnection === false) {
            this.close();
            return;
        }

        const { recentCount, mostRecentAttempt } = this.countRecentAttempts();

        if (recentCount === 0) {
            if (EnableVerboseLog)
                console.log(`${this.name}: attempting reconnection (recentCount=${recentCount})`); 
            this.tryEstablishConnection();
            return;
        }

        const delayForNextAttempt = this.reconnectSchedule.delayMsForAttempt(recentCount);

        if (delayForNextAttempt === 'failure_temporary_back_off') {
            if (EnableVerboseLog)
                console.log(`${this.name}: giving up after ${recentCount} attempts`);

            if (this.logs)
                this.logs.logError({ errorMessage: "entering backoff state, too many failed attempts" });

            this.setStatus(ConnectionStatus.failure_temporary_back_off);
            return;
        }

        let timeToAttempt = delayForNextAttempt + mostRecentAttempt - Date.now();

        if (EnableVerboseLog)
            console.log(`${this.name}: next attempt (${recentCount}) has delay of ${delayForNextAttempt}ms`);

        if (timeToAttempt < 10)
            timeToAttempt = 0;

        if (timeToAttempt === 0) {
            this.tryEstablishConnection();
            return;
        }

        if (EnableVerboseLog)
            console.log(`${this.name}: scheduled next reattempt for ${timeToAttempt}ms`, { recentCount, mostRecentAttempt });

        this.scheduleReconnectionTimer(timeToAttempt);
    }

    /*
      newServerStream

      Start a Stream object that was initiated by the remote side.
    */
    newServerStream(id: StreamId) {
        if (this.serverStreams.has(id))
            throw new Error("Protocol error: Tried to create a stream with a duplicate id: " + id);

        if (EnableVerboseLog)
            console.log('newServerStream created stream with id: ' + JSON.stringify(id));

        let stream = new Stream();
        this.serverStreams.set(id, stream);
        this.serverStreamValidators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    /*
      newClientStream

      Start a Stream object that was initiated by this client, as part of a call to .sendRequest.
    */
    newClientStream(id: StreamId, stream: Stream) {
        if (!stream)
            throw new Error("newClientStream usage error: missing stream");

        if (this.clientStreams.has(id))
            throw new Error("newClientStream usage error: duplicate id: " + id);
        
        verboseLog('newClientStream created stream with id: ' + JSON.stringify(id));

        this.clientStreams.set(id, stream);
        this.clientStreamValidators.set(id, new StreamProtocolValidator(`stream validator for socket id=${id}`));
        return stream;
    }

    garbageCollect() {
        for (const [ id, stream ] of this.clientStreams.entries()) {
            if (stream.isClosed()) {
                this.clientStreams.delete(id);
                this.clientStreamValidators.delete(id);
                this.closedStreamIds.add(id);
            }
        }
    }

    getOpenCount() {
        return this.clientStreams.size;
    }

    closeClientStream(id: StreamId) {
        const stream = this.clientStreams.get(id);

        this.clientStreams.delete(id);
        this.clientStreamValidators.delete(id);

        if (stream) {
            stream.stopListening();
        }
    }

    closeServerStream(id: StreamId) {
        const stream = this.serverStreams.get(id);

        this.serverStreams.delete(id);
        this.serverStreamValidators.delete(id);

        if (stream) {
            stream.stopListening();
        }
    }

    failAllActiveStreams(error: ErrorDetails) {
        for (const [ id, stream ] of this.clientStreams.entries()) {
            stream.fail(error);
            this.closedStreamIds.add(id);
        }

        this.clientStreams.clear();
        this.clientStreamValidators.clear();
    }

    closeAllActiveStreams() {
        for (const stream of this.clientStreams.values()) {
            stream.stopListening();
        }

        for (const id of this.clientStreams.keys())
            this.closedStreamIds.add(id);

        this.clientStreams.clear();
        this.clientStreamValidators.clear();
    }
}

function verboseLog(...args) {
    if (EnableVerboseLog)
        console.log(...['[Connection]',...args]);
}

function veryVerboseLog(...args) {
    if (EnableVeryVerboseLog)
        console.log(...['[Connection]',...args]);
}