
import { StreamListeners } from './StreamListeners'
import { c_item, c_log, c_log_error, StreamErrorLogMessage } from './EventType'
import { randomAlpha } from './randomHex'

export interface ErrorDetails {
    errorId?: string
    errorType?: string
    errorMessage: string
    stack?: any
    cause?: ErrorDetails
    related?: any[]
}

function newErrorId() {
    return randomAlpha(10);
}

let _globalErrorListeners: StreamListeners;

export class ErrorWithDetails extends Error {
    is_error_extended = true
    errorItem: ErrorDetails

    constructor(errorItem: ErrorDetails) {
        super(errorItem.errorMessage);
        this.errorItem = errorItem;
    }

    toString() {
        return errorItemToString(this.errorItem);
    }
}

function errorItemToString(item: ErrorDetails) {
    let out = `error`;
    if (item.errorType)
        out += ` (${item.errorType})`;

    if (item.errorMessage)
        out += `: ${item.errorMessage}`;

    if (item.stack)
        out += `\nStack trace: ${item.stack}`

    return out;
}


export function toException(item: ErrorDetails): ErrorWithDetails {
    return new ErrorWithDetails(item);
}

export function captureError(error: Error | ErrorDetails | string, related?: any[]): ErrorDetails {
    
    if (!error) {
        return {
            errorMessage: 'Unknown error',
            errorType: 'unknown_error',
            related,
        }
    }

    // ErrorExtended instance
    if ((error as ErrorWithDetails).errorItem) {
        const errorExtended = error as ErrorWithDetails;
        const errorItem = errorExtended.errorItem;

        return {
            ...errorItem,
            errorMessage: errorItem.errorMessage,
            errorId: errorItem.errorId || newErrorId(),
            stack:  errorItem.stack || errorExtended.stack,
            related: [...(errorItem.related || []), ...(related || [])],
        }
    }

    // Error instance (but not an ErrorExtended)
    if (error instanceof Error) {
        // Received an Error instance.
        let guessedErrorType = 'unhandled_exception';

        if (error.message.startsWith('Not found:')) {
            guessedErrorType = 'not_found';
        }

        return {
            errorMessage: error.message,
            errorId: newErrorId(),
            stack: error.stack,
            errorType: guessedErrorType,
            related,
        };
    }

    // String value.
    if (typeof error === 'string') {
        return {
            errorMessage: error,
            errorId: newErrorId(),
            errorType: 'generic_error',
            related
        };
    }

    // Maybe an ErrorItem-like object
    return {
        ...error,
        errorMessage: (error as any).errorMessage || (error as any).message,
        stack: (error as any).stack,
        errorType: (error as any).errorType || 'unknown_error',
        errorId: (error as any).errorId || newErrorId(),
        related: [...(error.related || []), ...(related || [])],
    };
}

export function errorAsStreamEvent(error: ErrorDetails): StreamErrorLogMessage {
    return { t: c_log, level: c_log_error, error: error };
}

function getGlobalErrorListeners() {
    if (!_globalErrorListeners) {
        _globalErrorListeners = new StreamListeners();
    }

    return _globalErrorListeners;
}

export function recordUnhandledError(error: Error | ErrorDetails) {
    const errorDetails = captureError(error);
    console.error('Unhandled error:', errorDetails, new Error())
    getGlobalErrorListeners().event({ t: c_item, item: errorDetails });
}

export function startGlobalErrorListener() {
    return getGlobalErrorListeners().add();
}

