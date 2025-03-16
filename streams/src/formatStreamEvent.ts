import { c_delta, c_done, c_fail, c_item, c_log_error, c_log_info, c_log_warn, c_restart, c_schema, EventType, StreamEvent } from "./EventType";
import util from 'util';

export function eventTypeToString(type: EventType) {
    switch (type) {
        case c_item: return 'item';
        case c_done: return 'done';
        case c_fail: return 'fail';
        case c_log_info: return 'log_info';
        case c_log_warn: return 'log_warn';
        case c_log_error: return 'log_error';
        case c_schema: return 'schema';
        case c_restart: return 'restart';
        case c_delta: return 'delta';
        default: return `unknown(${type})`;
    }
}

export function formatStreamEvent(evt: StreamEvent): string {
    let messageBody: any = '';

    switch (evt.t) {
    case c_item:
        messageBody = evt.item;
        break;

    case c_fail:
        messageBody = evt.error;
        break;

    case c_done:
        messageBody = '';
        break;

    default:
        const logEvt = { ...evt };
        delete logEvt.t;
        messageBody = logEvt;
        break;
    }

    return util.format(`[${eventTypeToString(evt.t)}] %s`, messageBody);
}

