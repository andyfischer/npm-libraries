
import { ErrorWithDetails, Stream, c_done, c_fail, callbackToStream, logWarn,
    LogEvent, c_item, c_log_error, 
    c_log_info,
    c_log_warn} from '@andyfischer/streams'
import { Table, lazySchema } from '@andyfischer/query'

interface SetupOptions {
    name: string
    handlers?: Table
    protocolDetails?: Table<HandlerDetails>
    fixIncomingRequestData?: (req: any) => any
    fixOutgoingResponseData?: (req: any) => any
    defaultTimingWarningAfterMs?: number
    logs?: Stream<LogEvent>
    onRequest?: (req: any) => void
}

interface Handler {
    name: string
    callback: (req: any, connection: any) => any
}

interface HandlerDetails {
    name?: string
    responseSchema?: any
    timeoutWarningAfterMs?: number | null
    onSuccessInvalidateCache?: any[]
}

const HandlersTableSchema = lazySchema({
    name: "RequestDispatchHandlers",
    funcs: [
        'each',
        'get(name)',
        'listAll',
    ]
});

const HandlerDetailsTableSchema = lazySchema({
    name: "RequestDispatchHandlerDetails",
    funcs: [
        'each',
        'get(name)',
        'listAll',
    ]
});

export class RequestDispatch<RequestType> {
    name: string
    handlerDetails?: Table<HandlerDetails>
    handlers: Table<Handler>
    logs: Stream<LogEvent>
    onRequest?: (req: any) => void
    setupOptions: SetupOptions
    defaultTimingWarningAfterMs?: number | null

    constructor(options: SetupOptions) {
        if (options.handlers) {
            options.handlers.assertSupport('get_with_name');
        }

        if (options.protocolDetails) {
            options.protocolDetails.assertSupport('get_with_name');
        }

        this.name = options.name;
        this.handlers = options.handlers;
        this.handlerDetails = options.protocolDetails;
        this.logs = options.logs || Stream.newNullStream();
        this.onRequest = options.onRequest;
        this.setupOptions = options;
        
        if (!this.handlers) {
            this.handlers = HandlersTableSchema.createTable();
        }
    }

    add(requestName: string, callback: Handler['callback'], details?: HandlerDetails) {
        this.handlers.insert({ name: requestName, callback });

        if (details) {
            if (!this.handlerDetails) {
                this.handlerDetails = HandlerDetailsTableSchema.createTable();
            }

            this.handlerDetails.insert({ ...details, name: requestName });
        }
    }

    wrapOutgoingStream(reqName: string, req: any, output: Stream) {
        const wrapped = new Stream();
        const details: HandlerDetails = this.handlerDetails && this.handlerDetails.get_with_name(reqName);

        let timeoutWarningAfterMs = null;
        let timeoutCheck = null;

        if (details && (details.timeoutWarningAfterMs || details.timeoutWarningAfterMs === null))
            timeoutWarningAfterMs = details.timeoutWarningAfterMs;
        else
            timeoutWarningAfterMs = this.defaultTimingWarningAfterMs;

        if (timeoutWarningAfterMs) {
            timeoutCheck = setTimeout((() => {
                this.logs.logError({
                    errorMessage: `Request (${reqName}) is still unfinishedj `
                    +`after the warning threshold (${timeoutWarningAfterMs}ms)`,
                    related: [{ request: req }]
            });

            }), timeoutWarningAfterMs);
        }

        wrapped.pipe(evt => {
            switch (evt.t) {
            case c_item:
                if (this.setupOptions.fixOutgoingResponseData) {
                    evt.item = this.setupOptions.fixOutgoingResponseData(evt.item);
                }
                break;
            case c_log_info:
            case c_log_warn:
                if (this.setupOptions.fixOutgoingResponseData) {
                    evt.details = this.setupOptions.fixOutgoingResponseData(evt.details);
                }
                break

            case c_fail:
                this.logs.logError({ errorMessage: `API error response (${req.t})`, cause: evt.error, related: [{ request: req }] });
                clearTimeout(timeoutCheck);
                break;
            case c_done:
                clearTimeout(timeoutCheck);
                break;
            }

            output.event(evt);
        });

        return wrapped;
    }

    handleRequest(req: RequestType, connection: any, output: Stream) {

        if (this.setupOptions.fixIncomingRequestData) {
            req = this.setupOptions.fixIncomingRequestData(req);
        }
        
        const reqName = (req as any).reqName || (req as any).req || (req as any).t;
        const wrappedOutput = this.wrapOutgoingStream(reqName, req, output);

        callbackToStream(() => {
            if (!reqName) {
                this.logs.warn('bad request, missing name (or .req): ', { req });
                throw new ErrorWithDetails({ errorType: "bad_request", errorMessage: "request object missing .name or .req"});
            }

            const handler = this.handlers.get_with_name(reqName);

            if (this.onRequest)
                this.onRequest(req);

            if (handler)
                return handler.callback(req, connection);

            // Unhandled case

            logWarn(`${this.name} API: Received unrecognized request: ${reqName}`);
            logWarn(`${this.name} Requests we know about: ${this.handlers.listAll().map(h => h.name).join(', ')}`);

            throw new ErrorWithDetails({
                errorType: "unhandled_request",
                errorMessage: `API '${this.name}' doesn't have a handler for: ${reqName}`
            });
        }, wrappedOutput);
    }
}
