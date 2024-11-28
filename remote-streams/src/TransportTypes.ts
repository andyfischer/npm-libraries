
import { ErrorDetails, Stream, StreamEvent } from '@andyfischer/streams'

export enum TransportEventType {
    // Start a request. The respoding side will start sending TransportResponseEvents with the
    // same streamId.
    request = 602,

    // Response data for a request.
    response_event = 603,

    // Transport status change: connection is ready.
    connection_ready = 604,

    // Transport status change: connection is no longer ready.
    connection_lost = 605,

    // Transport level: set connection metadata.
    set_connection_metadata = 606,
}

/*
 * ListenToTableRequest
 *
 * Connection-level message. Start listening to the given table.
 */
/*
export interface ListenToTableRequest {
    t: TransportEventType.connection_level_request
    reqType: 'ListenToTable'
    name: string
    streamId: number
    options: ListenToTableOptions
}

export type ConnectionRequest = ListenToTableRequest;
*/

/*
 * TransportRequest
 *
 * Send a client-level request.
 */
export interface TransportRequest<RequestType> {
    t: TransportEventType.request
    req: RequestType
    streamId: number
}

/*
 * TransportResponse
 *
 * Receive a response event to a client-level request.
 */
export interface TransportResponseEvent {
    t: TransportEventType.response_event
    evt: StreamEvent
    streamId: number
}

/*
 * ConnectionEstablished
 *
 * Status change event - the transport connection is ready.
 */
export interface ConnectionReady {
    t: TransportEventType.connection_ready
}

/*
 * ConnectionEstablished
 *
 * Status change event - the transport connection has closed.
 */
interface ConnectionLost {
    t: TransportEventType.connection_lost
    cause?: ErrorDetails
    shouldRetry?: boolean
}

/*
 * ConnectionMetadata
 *
 * Used by the transport implementation to send metadata about the established connection.
 */
interface ConnectionMetadata {
    t: TransportEventType.set_connection_metadata
    sender?: any
}

export type TransportMessage<RequestType> =
    TransportRequest<RequestType>
    | TransportResponseEvent
    | ConnectionReady
    | ConnectionLost
    | ConnectionMetadata;

/*
 * TransportConnection
 *
 * Interface for the implementation used by Connection.
 *
 * This is used to implement the actual connection (whether it's a web socket, HTTP or other).
 */
export interface ConnectionTransport<RequestType, ResponseType> {
    send(message: TransportMessage<RequestType>): void
    incomingEvents: Stream< TransportMessage<RequestType> >
    close(): void
}
