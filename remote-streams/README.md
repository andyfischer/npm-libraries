
# Outline #

Library for remote transmission of data on Stream objects. (using `@andyfischer/streams`).

Each connection is multiplexed so it can support multiple streams at once.
For example, the HTTP client can receive data for multiple Streams as part of a single HTTP request.

Supports a few builtin transport types and supports custom transports.

Provides a generic Connection interface, so that most of the code can be agnostic about
what the connection's transport is.

# Builtin transports #

 * HttpClient - Client using `fetch` to make HTTP requests.
 * MessagePort - Client using Javascript `MessagePort` objects (used in web workers)
 * WebSocket - Client using a WebSocket connection.
 * HttpServer - Server that handles HTTP requests.
 * WebSocketServer - Server that handles WebSocket connections.

# Overview #

Each remote connection has two layers:

 * *Connection* layer
   - Implemented by the `Connection` class.
   - Same class used for all types of protocols.
   - Handles multiplexing of request & response streams across the transport.
   - Handles the connection state (connected / closed / etc)
   - Handles creating the Transport as needed.
   - Handles queueing of incoming messages if we're waiting to establish the connection.

 * *Transport* layer
   - Seperate implementations for different protocols: HTTP, WebSocket, etc.
   - Lower level, handles the details of sending the message across some remote protocol.
   - Responsible for transporting messages to & from the Connection.

# Examples #

## Creating a WebSocket client ##

```
import { Connection, WebSocketClient } from "@andyfischer/remote-streams";

...

    const client = new Connection({
        connect: () => {
            return new WebSocketClient(
                new WebSocket(url)
            )
        },
        logs: createNestedLoggerStream('remote connection')
    });
```
