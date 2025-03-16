

import { c_item, c_fail, c_log_info, c_log_warn, c_log_error } from './EventType'
import { Stream, } from './Stream'
import { captureError, ErrorDetails } from './Errors'
import { colorize, } from './console/AnsiColors'

export interface LogEvent {
    message?: string
    level?: typeof c_log_info | typeof c_log_warn | typeof c_log_error
    topic?: string
    stack?: any
    error?: ErrorDetails
    errorCode?: string
    details?: any
}

const red = str => colorize({ r: 255, g: 120, b: 130}, str);
const grey = str => colorize({ r: 120, g: 120, b: 120}, str);
const yellow = str => colorize({ r: 255, g: 255, b: 120}, str);

function timestamp() {
    return (new Date()).toISOString()
}

function recursiveFormatErrors({ error, indent, alreadyPrintedMessage }: { error: ErrorDetails, indent: string, alreadyPrintedMessage?: boolean }) {

    let lines = [];

    if (error.errorMessage && !alreadyPrintedMessage) {
      lines.push(indent + `"${error.errorMessage}"`);
      indent = indent + '  ';
    }

    if (error.errorId)
        lines.push(indent + `errorId: ${error.errorId}`);

    if (error.errorType)
        lines.push(indent + `errorType: ${error.errorType}`);

    for (const related of error.related || []) {
        lines.push(indent + JSON.stringify(related));
    }

    if (error.stack) {
        lines.push(indent + 'Stack trace:');
        const stackLines = error.stack.split('\n');
        for (const stackLine of stackLines)
            lines.push(indent + '  ' + stackLine);
    }

    if (error.cause) {
        lines.push(indent + `Caused by:`);
        lines = lines.concat(
            recursiveFormatErrors({ error: error.cause, indent: indent + '  ', alreadyPrintedMessage: false})
        );
    }

    return lines;
}

export function logEvent(event: LogEvent) {

    // console.log('logEvent', JSON.stringify(event, null, 2));

    let ts = timestamp();

    let level = event.level || c_log_info;

    if (event.error || event.errorCode)
        level = c_log_error;

    let tsForConsole = (new Date(ts)).toLocaleTimeString().split(' ')[0];

    let message = event.message || event.error?.errorMessage || '';
    let consoleText = `${tsForConsole} ${message}`

    if (event?.topic) {
        consoleText = `[${event.topic}] ` + consoleText;
    }

    const otherContext = {
        ...event.details,
    }

    let anyOtherContext = false;

    for (const [ key, value ] of Object.entries(otherContext)) {
        if (value != null)
            anyOtherContext = true;
    }

    if (anyOtherContext)
        consoleText += ' ' + JSON.stringify(otherContext);

    let logger = null;

    switch (level) {
    case c_log_info:
        logger = line => console.log(line);
        break;
    case c_log_warn:
        logger = line => console.warn(yellow(line));
        break;
    case c_log_error:
        logger = line => console.error(red(line));
        break;
    default:
        logger = line => console.log(line);
        break;
    }

    logger(consoleText);

    if (event.error) {
        for (const line of recursiveFormatErrors({ error: event.error, indent: '  ', alreadyPrintedMessage: true })) {
            logger(line);
        }
    }
}

function errorToLogEvent(error: Error | ErrorDetails | string, details?: any): LogEvent {
    const errorItem: ErrorDetails = captureError(error);

    const logEvent: LogEvent = {
        ...errorItem,
        message: null,
        level: c_log_error,
        details,
    }

    if (logEvent.error?.errorMessage) {
        logEvent.message = logEvent.error?.errorMessage;
    }

    if (!logEvent.message) {
        logEvent.message = errorItem.errorType;
    }

    if (!logEvent.message) {
        logEvent.message = "(no .errorMessage or .errorType)"
    }

    return logEvent;
}

export function logInfo(message: string, context?: LogEvent) {
    logEvent({ ...context, level: c_log_info, message });
}

export function logWarn(message: string, context?: LogEvent) {
    logEvent({ ...context, level: c_log_warn, message });
}

export function logError(error: Error | ErrorDetails | string, details?: any) {
    const event = errorToLogEvent(error, details);
    logEvent(event);
}

export function createNestedLoggerStream(topic: string) {
    const stream = new Stream<LogEvent>();

    stream.pipe(evt => {
        switch (evt.t) {
            case c_item: {
                logEvent({
                    ...evt.item,
                    topic,
                });
                break;
            }

            case c_fail: {
                logEvent({
                    ...errorToLogEvent(evt.error),
                    topic,
                });
                break;
            }

            case c_log_info:
                logEvent({
                    ...evt,
                    level: c_log_info,
                    topic,
                });
                break;

            case c_log_warn:
                logEvent({
                    ...evt,
                    level: c_log_warn,
                    topic,
                });
                break;

            case c_log_error:
                logEvent({
                    ...evt,
                    level: c_log_error,
                    topic,
                });
                break;

            default: {
                console.warn('unrecognized event type sent to createNestedLoggerStream', evt);
            }
        }
    });

    return stream;
}
