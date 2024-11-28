
import { it, expect } from 'vitest'
import { Connection, } from '../Connection'
import { Stream, c_fail } from '@andyfischer/streams'
import { createLocalPortPair } from '../../utils/Port'
import { MessagePortTransport } from '../MessagePortTransport'

it("passes the local message port test", () => {
    const [ clientPort, serverPort ] = createLocalPortPair();

    const clientConnection = new Connection({
        connect() {
            return new MessagePortTransport(clientPort)
        }
    });

    const serverConnection = new Connection({
        connect() {
            return new MessagePortTransport(serverPort)
        },
        handleRequest(req, connection, output) {
            output.item({ responseTo: req });
            output.done();
        }
    });

    const req1output = new Stream();
    clientConnection.sendRequest({ request: 1 }, req1output);

    expect(req1output.takeItemsSync()).toEqual([
        { responseTo: { request: 1 }}
    ]);
    expect(req1output.isClosed()).toEqual(true);

    // Expect an error if the server tries to initiate a request.
    const serverReqOutput = new Stream();
    serverConnection.sendRequest({}, serverReqOutput);

    expect(serverReqOutput.takeEventsSync()).toEqual([
        { t: c_fail, error: { errorMessage: 'Connection is not set up to handle requests', errorType: 'no_handler' } },
    ]);
});

it("provides the sender information", () => {
    const [ clientPort, serverPort ] = createLocalPortPair();

    const log = [];

    const wrappedPort = {
        postMessage(msg) { return serverPort.postMessage(msg) },
        onMessage: {
            addListener(callback) {
                serverPort.onMessage.addListener(message => {
                    callback(message, { sender: 'sender_123' });
                });
            }
        },
        onDisconnect: {
            addListener() {}
        }
    } as any;

    const clientConnection = new Connection({
        connect() {
            return new MessagePortTransport(clientPort)
        }
    });

    const serverConnection = new Connection({
        name: 'ServerConnection',
        connect() {
            return new MessagePortTransport(wrappedPort)
        },
        handleRequest(req, connection, output) {
            log.push(`handle request (sender=${connection.sender}): ${JSON.stringify(req)}`);

            output.item({ responseTo: req });
            output.done();
        }
    });

    clientConnection.sendRequest({ req: 1 });

    expect(log).toEqual(['handle request (sender=sender_123): {"req":1}']);

});
