import { ErrorDetails } from "./Errors";
import { SchemaDecl } from "./SchemaDecl";

export enum EventType {
    /// Core stream events ///

    // 'item' - A response item.
    c_item = 100,

    // 'done' - The request was successful and all data items were sent. The stream is closed.
    c_done = 200,

    // 'fail' - The request failed. Any sent items may have been incomplete. The stream is closed.
    c_fail = 400,

    /// Streaming Update Events ///

    // 'restart' - the stream is about to re-send the result from the beginning. (using c_item events).
    c_restart = 300,

    // 'delta' - a message that reflects a change event on an item that was already sent.
    c_delta = 123,
    
    /// Stream metadata events ///

    // 'schema' - Describes the shape of upcoming data items.
    c_schema = 600,

    // 'log_info' - An info-level log message related to the server operation. Should only be used for debugging,
    c_log_info = 701,

    // 'log_warn' - An warning-level log message related to the server operation. Should only be used for debugging,
    c_log_warn = 702,

    // 'log_error' - An error-level log message related to the server operation. Should only be used for debugging,
    c_log_error = 703,

};

export enum StreamLogLevel {
    c_info = 601,
    c_warn = 609,
    c_error = 699,
}

export const c_item = EventType.c_item;
export const c_done = EventType.c_done;
export const c_fail = EventType.c_fail;

export const c_schema = EventType.c_schema;
export const c_restart = EventType.c_restart;
export const c_delta = EventType.c_delta;

export const c_log_info = EventType.c_log_info;
export const c_log_warn = EventType.c_log_warn;
export const c_log_error = EventType.c_log_error;

export interface StreamItem<ItemType = any> { t: EventType.c_item, item: ItemType }
export interface StreamFail { t: EventType.c_fail, error: ErrorDetails, }
export interface StreamDone { t: EventType.c_done }

export interface StreamSchema { t: EventType.c_schema, schema: SchemaDecl }
export interface StreamRestart { t: EventType.c_restart }

export interface StreamLogInfo {
    t: EventType.c_log_info
    message: string
    details?: Record<string, any>
}

export interface StreamLogWarn {
    t: EventType.c_log_warn
    message: string
    details?: Record<string, any>
}

export interface StreamLogError {
    t: EventType.c_log_error
    error: ErrorDetails
}
export interface StreamDelta { t: EventType.c_delta, func: string, params: any[] }

export type StreamEvent<ItemType = any> =
    StreamSchema
    | StreamItem<ItemType>
    | StreamFail
    | StreamLogInfo | StreamLogWarn | StreamLogError
    | StreamDone
    | StreamRestart | StreamDelta ;
