
import { c_done, c_fail, captureError, ErrorDetails, exceptionIsBackpressureStop, recordUnhandledError, Stream } from '@andyfischer/streams'
import { JsonSplitDecoder } from '../utils/splitJson';
import { Transport, TransportEventType, TransportEvent, TransportRequest, TransportToConnectionLayer } from '../TransportTypes';
import { IDSource } from '@andyfischer/streams'
import { readStreamingFetchResponse } from '../utils/readStreamingFetchResponse';

const EnableVerboseLogs = false;

export interface PostBody<RequestType> {
    messages: TransportRequest<RequestType>[]
}

export type FetchImpl = (url: string, fetchOptions: { method: 'POST', headers: any, body: string }) => any;

interface SetupOptions {
    url: string

    requestStyle?: 'post-batch' | 'get-cacheable';

    // Implementation of the fetch() function.
    // If we're running in a browser, this does not need to be provided (we'll use globaThis.fetch).
    // If we're running in Node.js, this DOES need to be provided. (such as from the 'node-fetch' package)
    fetch?: FetchImpl

    connection: TransportToConnectionLayer
}

export class HttpClient<RequestType, ResponseType> implements Transport<RequestType, ResponseType> {
    name = "HttpClient"
    connection: TransportToConnectionLayer

    httpRequestId = new IDSource();
    queuedOutgoingRequests: TransportRequest<RequestType>[] = [];

    outgoingRequestFlushTimer = null;
    flushDelayMs = 50;
    setupOptions: SetupOptions
    fetchImpl: FetchImpl

    constructor(setupOptions: SetupOptions) {
        verboseLog('new client created', setupOptions);

        this.setupOptions = setupOptions;
        this.connection = setupOptions.connection;

        this.fetchImpl = setupOptions.fetch;

        if (!this.fetchImpl) {
            if (!globalThis.fetch) {
                throw new Error(`HttpClient: no fetch implementation provided and no global fetch available`);
            }
            this.fetchImpl = globalThis.fetch.bind(globalThis);
        }

        // The HTTP fetch is made on-demand, so immediately put us in 'ready' state.
        this.connection.sendTransportEvent({ t: TransportEventType.connection_ready });
    }

    send(message: TransportEvent<RequestType>) {
        verboseLog('send()', message);

        switch (message.t) {
            case TransportEventType.request:
                this.queuedOutgoingRequests.push(message);

                // Queue up a flush callback if needed
                if (!this.outgoingRequestFlushTimer) {
                    this.outgoingRequestFlushTimer = setTimeout((() => {
                        clearTimeout(this.outgoingRequestFlushTimer);
                        this.outgoingRequestFlushTimer = null;

                        this.onFlushOutgoingRequests();
                    }), this.flushDelayMs);
                }

                break;
        }
    }

    onFlushOutgoingRequests() {
        if (this.queuedOutgoingRequests.length === 0)
            return;

        if (this.setupOptions.requestStyle === 'get-cacheable') {
            const outgoingMessages = this.queuedOutgoingRequests;
            this.queuedOutgoingRequests = [];

            for (const message of outgoingMessages) {
                this._sendHttpRequest([message]);
            }

        } else {
            // Send batch
            const outgoingMessages = this.queuedOutgoingRequests;
            this.queuedOutgoingRequests = [];
            this._sendHttpRequest(outgoingMessages);
        }
    }

    _sendHttpRequest(outgoingMessages: TransportRequest<RequestType>[]) {
        const jsonSplitDecoder = new JsonSplitDecoder();
        const openStreamsInThisRequest = new Set(outgoingMessages.map(m => m.streamId));
        const httpRequestId = this.httpRequestId.take();

        let body: any;
        let query = '';
        let method = null;

        if (this.setupOptions.requestStyle === 'get-cacheable') {
            method = 'GET';
            query = `?msgs=${encodeURIComponent(JSON.stringify(outgoingMessages))}`;
        } else {
            method = 'POST';
            body = JSON.stringify({
                messages: outgoingMessages,
            });
        }

        const fullUrl = this.setupOptions.url + query;

        (async () => {
            let fetchResponse;

            try {
                if (EnableVerboseLogs) {
                    console.log('HttpClient (req #${httpRequestId}) sending HTTP request');
                }

                fetchResponse = await this.fetchImpl(
                    fullUrl, {
                    method,
                    headers: {
                        'content-type': 'text/plain',
                    },
                    body,
                });

            } catch (e) {

                // Protocol error when trying to call fetch(). Kill all requests with an error.
                const error: ErrorDetails = {
                    ...captureError(e),
                    errorType: 'connection_failed',
                };

                verboseLog(`HttpClient (req #${httpRequestId})  got a fetch exception, closing with error`, { e });

                try {
                    this.connection.sendTransportEvent({ t: TransportEventType.connection_lost, cause: error, shouldRetry: false });
                } catch (e) { }

                return;
            }

            // Handle a failure status code
            if (fetchResponse.status !== 200) {
                const error = {
                    errorType: 'http_error_status',
                    errorMessage: `HTTP request had failure status code (${fetchResponse.status})`,
                    errorMessageBody: await fetchResponse.text(),
                    details: {
                        httpStatus: fetchResponse.status,
                        httpStatusText: fetchResponse.statusText,
                    }
                }

                const shouldRetry = fetchResponse.status === 429 || fetchResponse.status === 503;

                if (EnableVerboseLogs) {
                    console.log(`HttpClient (req #${httpRequestId}) got an error code, closing all with error`);
                    console.log(new Error());
                }

                try {
                    this.connection.sendTransportEvent({ t: TransportEventType.connection_lost, cause: error, shouldRetry });
                } catch (e) {
                    console.error('HttpClient: uncaught error while sending error message', { e });
                    if (exceptionIsBackpressureStop(e))
                        return;

                    recordUnhandledError(e);
                }

                return;
            }

            // Read the response body as a stream of JSON messages.
            for await (const chunk of readStreamingFetchResponse(fetchResponse)) {
                if (EnableVerboseLogs)
                    console.log(`HttpClient (req #${httpRequestId}) onChunk`, chunk)

                if (!chunk)
                    continue;
                    
                try {
                    for (let event of jsonSplitDecoder.receive(chunk)) {
                        event = event as TransportEvent<ResponseType>;
                        if (EnableVerboseLogs)
                            console.log(`HttpClient (req #${httpRequestId}) received message:`, event);

                        switch (event.t) {
                            // Check if this closes any open streams in streamIdsInThisBatch.
                            case TransportEventType.response_event:
                                if (event.evt.t === c_fail || event.evt.t === c_done) {
                                    openStreamsInThisRequest.delete(event.streamId);
                                }
                                break;
                        }

                        try {
                            this.connection.sendTransportEvent(event);
                        } catch (e) {
                            if (exceptionIsBackpressureStop(e)) {
                                console.log(`HttpClient (req #${httpRequestId}) is backpressure stopped`);
                                // This connection is closed, throw away the remaining incoming messages;
                            } else {
                                recordUnhandledError(e);
                            }
                        }

                    }
                } catch (err) {
                    console.error('HttpClient: uncaught error while parsing received data', { err, chunk });
                }
            }

            if (EnableVerboseLogs)
                console.log(`HttpClient (req #${httpRequestId})  onResponseStreamDone`)

            // Finished handling all the incoming data from the HTTP response.

            // If the remote side had any leftover open streams, close them now.
            if (openStreamsInThisRequest.size > 0) {
                verboseLog(`HttpClient (req #${httpRequestId}): Finished reading response body, closing unfinished streams:`, openStreamsInThisRequest);
                for (const streamId of openStreamsInThisRequest.keys()) {
                    try {
                        this.connection.sendTransportEvent({
                            t: TransportEventType.response_event,
                            streamId,
                            evt: { t: c_fail, error: {
                                errorMessage: 'HTTP request did not finish stream',
                                errorType: 'http_request_didnt_finish_stream'
                            }}
                        });
                    } catch (e) {
                    }
                }
            }

        })();
    }

    close() {
    }
}

function verboseLog(...args: any[]) {
    if (EnableVerboseLogs)
        console.log(...['[HttpClient]', ...args]);
}