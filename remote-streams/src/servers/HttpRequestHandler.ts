
import type { IncomingMessage as HttpRequest, ServerResponse as HttpResponse } from 'http'
import { Stream, c_done, c_fail, recordUnhandledError, IDSource, captureError } from '@andyfischer/streams'
import { Connection, RequestDispatch } from '..'
import { TransportEventType, TransportMessage, TransportRequest } from '../TransportTypes';
import { PostBody } from '../clients/HttpClient';
import { callbackBasedIterator } from '@andyfischer/streams';

const VerboseLogHttpServer = false;

interface SetupOptions<RequestType, ResponseType> {
    handleRequest?: (req: RequestType, connection: Connection<RequestType, any>, output: Stream) => void
}

async function* parseDataChunks(data) {
    const { send, done, it } = callbackBasedIterator();

    data.on('data', chunk => {
        send(chunk);
    });
    data.on('end', () => {
        done();
    });
    yield* it;
}

async function readFullBuffer(data) {
    let chunks: string[] = [];
    for await (const chunk of parseDataChunks(data)) {
        chunks.push(chunk.toString());
    }
    return chunks.join('');
}

export class HttpRequestHandler<RequestType = any, ResponseType = any> {
    handleRequest?: (req: RequestType, connection: Connection<RequestType, any>, output: Stream) => void 
    nextRequestId = new IDSource();

    constructor({ handleRequest }: SetupOptions<RequestType, ResponseType>) {
        this.handleRequest = handleRequest;
    }

    async handleHttpRequest(httpReq: HttpRequest, httpRes: HttpResponse) {
        const requestId = this.nextRequestId.take();

        let messages: TransportRequest<RequestType>[] = [];

        if (httpReq.method === 'GET') {
            // Parse query string
            const qs = httpReq.url!.split('?')[1];
            const parsed = new URLSearchParams(qs);
            if (!parsed.has('msgs')) {
                httpRes.writeHead(400);
                httpRes.end("error: expected query string to contain 'msgs'");
                return;
            }

            try {
                messages = JSON.parse(decodeURIComponent(parsed.get('msgs')!));
            } catch (e) {
                httpRes.writeHead(400);
                httpRes.end("error: failed to parse 'msgs' query string as JSON");
            }
        } else {
            const bodyText = await readFullBuffer(httpReq);

            if (VerboseLogHttpServer)
                console.log(`HTTPServer (req #${requestId}) received post body:`, bodyText);

            let body: PostBody<RequestType> | null = null;

            try {
                body = JSON.parse(bodyText);
            } catch (e) {
                httpRes.writeHead(400);
                httpRes.end("error: expected body to be parsable as JSON");
                return;
            }

            if (!body!.messages) {
                httpRes.writeHead(400);
                httpRes.end("error: expected JSON body to contain { messages }");
                return;
            }

            messages = body!.messages;
        }

        // Start handling the request messages

        httpRes.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
        });

        // Track the stream IDs so that we know when all the responses are done.
        const streamIdsInThisBatch = new Set<number>();
        
        for (const message of messages) {
            if (!message.streamId) {
                console.warn('HTTPRequestHandler: malformed incoming message, missing streamId');
                continue;;
            }
            streamIdsInThisBatch.add(message.streamId);
        }
        
        let connection: Connection<any,any> | null = null;

        const transport = {
            incomingEvents: new Stream<TransportMessage<any>>(),
            send(message: TransportMessage<any>) {
                try {
                    if (VerboseLogHttpServer)
                        console.log(`HTTPServer (req #${requestId}) sending response chunk:`, message);

                    let str: string;
                    
                    try {
                        str = JSON.stringify(message);
                    } catch (e) {
                        const error = captureError(e);
                        error.errorMessage = "Failed to serialize message as JSON";
                        recordUnhandledError(error);
                        return;
                    }

                    httpRes.write(str);
                } catch (e) {
                    recordUnhandledError(e);
                }

                switch (message.t) {
                    case TransportEventType.response_event:
                        switch (message.evt.t) {
                            case c_done:
                            case c_fail:
                                streamIdsInThisBatch.delete(message.streamId);
                        }

                        if (streamIdsInThisBatch.size === 0) {
                            setImmediate(() => {
                                connection!.close();
                            });
                        }

                        break;
                }

            },
            close() {
                // Close the HTTP response
                if (VerboseLogHttpServer)
                    console.log(`HTTPServer (req #${requestId}) closing response`);
                httpRes.end();
            }
        }

        transport.incomingEvents.item({ t: TransportEventType.connection_ready });

        // Bring in all incoming requests from the POST.
        for (const message of messages) {
            transport.incomingEvents.item(message);
        }
        
        // Set up the Connection with the api, which will consume all the incoming events.
        connection = new Connection<ResponseType, RequestType>({
            enableReconnection: false,
            connect: () => transport,
            handleRequest: this.handleRequest,
        });
    }
}