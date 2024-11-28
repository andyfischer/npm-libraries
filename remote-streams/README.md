
# Outline #

The remote API consists of these layers:

 * The *Connection* layer
   - Single implementation (class Connection) which handles lots of use cases.
   - Handles matching requests with responses.
   - Handles the connection state (connected / closed / etc)
   - Handles creating the Transport as needed.
   - Handles the queueing of incoming messages if we're waiting to establish the connection.

* The *Transport* layer
   - Lower level, handles the details of transporting messages.
   - Seperate implementations for different protocols: HTTP, WebSocket, etc.
   - Responsible for transporting messages to & from the Connection.
   - Does not need to worry about request / response streams, just messages.

# How to write a new Transport #

The transport interface looks like:

    interface ConnectionTransport<RequestType, ResponseType> {
        send(message: TransportMessage<RequestType>): void
        incomingEvents: Stream< TransportMessage<RequestType> >
        close(): void
    }

### incomingEvents stream ###

This stream object is created and owned by the Transport.

The transport should .put events into the stream as needed.

This includes:
    - Incoming data from the remote side:
      - TransportEventType.request
      - TransportEventType.response (the remote side is sending us a response to our request)
    - Connection status change events
      - TransportEventType.connection_established
      - TransportEventType.connection_lost

### .send method ###

This method is called by the Connection to send messages to the remote side.

This includes:
    - Outgoing data:
      - TransportEventType.request
      - TransportEventType.response (responding to a remote request)