import { ErrorDetails } from "./Errors";
import { SchemaDecl } from "./SchemaDecl";

export enum EventType {
    /// Core stream events ///

    // 'item' - A response item
    c_item = 100,

    // 'done' - The request was successful and all data items were sent. The stream is closed.
    c_done = 200,

    // 'fail' - The request failed. Any sent items may have been incomplete. The stream is closed.
    c_fail = 400,
    
    /// Stream metadata events ///

    // 'log' - A log message related to the server operation. Should only be used for debugging,
    //         not for anything semantically meaningful.
    c_log = 600,

    // 'schema' - Describes the shape of upcoming data items.
    c_schema = 601,

    // 'related' - An item that is not directly part of the original request but is related.
    //             The server may use this for various purposes.
    c_related = 150,

    /// Streaming Update Events ///

    // 'restart' - the stream is about to re-send the result from the beginning. (using c_item events).
    c_restart = 300,

    // 'delta' - a message that reflects a change event on an item that was already sent.
    c_delta = 123,
};

export enum StreamLogLevel {
    c_info = 601,
    c_warn = 609,
    c_error = 699,
}

export const c_item = EventType.c_item;
export const c_done = EventType.c_done;
export const c_fail = EventType.c_fail;
export const c_log = EventType.c_log;
export const c_related = EventType.c_related;
export const c_schema = EventType.c_schema;
export const c_restart = EventType.c_restart;
export const c_delta = EventType.c_delta;

export const c_log_info = StreamLogLevel.c_info;
export const c_log_warn = StreamLogLevel.c_warn;
export const c_log_error = StreamLogLevel.c_error;

export interface StreamItem<ItemType = any> { t: EventType.c_item, item: ItemType }
export interface StreamFail { t: EventType.c_fail, error: ErrorDetails, }
export interface StreamDone { t: EventType.c_done }

export interface StreamSchema { t: EventType.c_schema, schema: SchemaDecl }
export interface StreamRelatedItem { t: EventType.c_related, item: any }
export interface StreamRestart { t: EventType.c_restart }

export interface StreamLogMessage {
    t: EventType.c_log,
    message: string,
    level: StreamLogLevel.c_info | StreamLogLevel.c_warn,
    details?: Record<string, any>
}

export interface StreamErrorLogMessage {
    t: EventType.c_log,
    level: StreamLogLevel.c_error
    error: ErrorDetails
}
export interface StreamDelta { t: EventType.c_delta, func: string, params: any[] }

export type StreamEvent<ItemType = any> =
    StreamSchema
    | StreamItem<ItemType>
    | StreamFail
    | StreamRelatedItem
    | StreamLogMessage | StreamErrorLogMessage
    | StreamDone
    | StreamRestart | StreamDelta ;
