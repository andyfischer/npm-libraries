
import { c_done, c_fail, captureError, exceptionIsBackpressureStop, recordUnhandledError, Stream } from '@andyfischer/streams'
import { JsonSplitDecoder } from '../utils/splitJson';
import { ConnectionTransport, TransportEventType, TransportMessage, TransportRequest } from '../TransportTypes';
import { IDSource } from '@andyfischer/streams'
import { readStreamingFetchResponse } from '../utils/readStreamingFetchResponse';

const VerboseLogHttpClient = false;

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
}

export class HttpClient<RequestType, ResponseType> implements ConnectionTransport<RequestType, ResponseType> {
    name = "HttpClient"
    incomingEvents: Stream<TransportMessage<RequestType>> = new Stream();

    httpRequestId = new IDSource();
    queuedOutgoingRequests: TransportRequest<RequestType>[] = [];

    outgoingRequestFlushTimer = null;
    flushDelayMs = 50;
    setupOptions: SetupOptions
    fetchImpl: FetchImpl

    constructor(setupOptions: SetupOptions) {
        this.setupOptions = setupOptions;

        this.fetchImpl = setupOptions.fetch;

        if (!this.fetchImpl) {
            if (!globalThis.fetch) {
                throw new Error(`HttpClient: no fetch implementation provided and no global fetch available`);
            }
            this.fetchImpl = globalThis.fetch.bind(globalThis);
        }

        // The HTTP fetch is made on-demand, so immediately put us in 'ready' state.
        this.incomingEvents.item({ t: TransportEventType.connection_ready });
    }

    send(message: TransportMessage<RequestType>) {
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
                const error = {
                    ...captureError(e),
                    errorLayer: 'http_client',
                };

                if (VerboseLogHttpClient)
                    console.log(`HttpClient (req #${httpRequestId})  got a fetch exception, closing with error`, { e });

                try {
                    this.incomingEvents.item({ t: TransportEventType.connection_lost, cause: error, shouldRetry: false });
                } catch (e) { }

                return;
            }

            // Handle a failure status code
            if (fetchResponse.status !== 200) {
                const error = {
                    errorType: 'http_error_status',
                    errorLayer: 'http_client',
                    errorMessage: `HTTP request had failure status code (${fetchResponse.status})`,
                    errorMessageBody: await fetchResponse.text(),
                }

                const shouldRetry = fetchResponse.status === 429 || fetchResponse.status === 503;

                if (VerboseLogHttpClient) {
                    console.log(`HttpClient (req #${httpRequestId}) got an error code, closing all with error`);
                    console.log(new Error());
                }

                try {
                    this.incomingEvents.item({ t: TransportEventType.connection_lost, cause: error, shouldRetry });
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
                if (VerboseLogHttpClient)
                    console.log(`HttpClient (req #${httpRequestId}) onChunk`, chunk)

                if (!chunk)
                    continue;
                    
                try {
                    for (let message of jsonSplitDecoder.receive(chunk)) {
                        message = message as TransportMessage<ResponseType>;
                        if (VerboseLogHttpClient)
                            console.log(`HttpClient (req #${httpRequestId}) received message:`, message);

                        switch (message.t) {
                            // Check if this closes any open streams in streamIdsInThisBatch.
                            case TransportEventType.response_event:
                                if (message.evt.t === c_fail || message.evt.t === c_done) {
                                    openStreamsInThisRequest.delete(message.streamId);
                                }
                                break;
                        }

                        try {
                            this.incomingEvents.item(message);
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

            if (VerboseLogHttpClient)
                console.log(`HttpClient (req #${httpRequestId})  onResponseStreamDone`)

            // Finished handling all the incoming data from the HTTP response.

            // If the remote side had any leftover open streams, close them now.
            if (openStreamsInThisRequest.size > 0) {
                if (VerboseLogHttpClient) {
                    console.log(`HttpClient (req #${httpRequestId}): Finished reading response body, closing unfinished streams:`, openStreamsInThisRequest);
                }
                for (const streamId of openStreamsInThisRequest.keys()) {
                    try {
                        this.incomingEvents.item({
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
