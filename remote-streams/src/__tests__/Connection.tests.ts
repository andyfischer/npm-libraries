
import { it, expect } from 'vitest'
import { Connection } from '../Connection'
import { TransportMessage, TransportEventType } from '../TransportTypes'
import { Stream, c_done, c_item } from '@andyfischer/streams'

function fakeTransport({simulateFailure}: { simulateFailure?: () => boolean } = {}) {
    let log = [];
    let incomingEvents: Stream<TransportMessage<any>>;

    return {
        log,
        getIncomingEventsStream() {
            return incomingEvents;
        },
        connect() {
            log.push('called connect()');

            if (incomingEvents && !incomingEvents.isClosed())  {
                throw new Error("Old listener stream was not cleaned up");
            }

            incomingEvents = new Stream();

            if (simulateFailure && simulateFailure()) {
                log.push('simulating connection failure');
                incomingEvents.item({t: TransportEventType.connection_lost});
            } else {
                log.push('simulating connection success');
                incomingEvents.item({t: TransportEventType.connection_ready});
            }

            return {
                send(msg) {
                    log.push('send: ' + JSON.stringify(msg));
                },
                incomingEvents,
                close() {
                    log.push('called close()');
                }
            }
        }
    }
}

it("creates a connection using the connect() function", () => {
    const { log, connect } = fakeTransport();

    const connection = new Connection({
        connect,
    });

    expect(connection.status).toEqual('ready');
    connection.sendRequest('req1', new Stream());

    expect(log).toEqual([
        'called connect()',
        'simulating connection success',
        'send: {"t":602,"req":"req1","streamId":1}'
    ]);
});

it("reattempts connection if it fails (initial attempt)", () => {
    let failures = 1;
    const { log, connect } = fakeTransport({
        simulateFailure() {
            if (failures > 0) {
                failures--;
                return true;
            }
            return false;
        }
    });

    const connection = new Connection({
        connect,
    });

    return; // fixme

    expect(connection.status).toEqual('ready');
    connection.sendRequest('req1', new Stream());

    expect(log).toEqual([
        'called connect()',
        'simulating connection failure',
        'called close()',
        'called connect()',
        'simulating connection success',
        'send: {"t":"request","req":"req1","streamId":1}'
    ]);
});

it("cleans up on close", () => {
    const { log, connect, getIncomingEventsStream } = fakeTransport();

    const connection = new Connection({
        connect,
    });

    expect(connection.status).toEqual('ready');

    const req1stream = new Stream();
    connection.sendRequest('req1', req1stream);

    connection.close();

    expect(connection.status).toEqual('permanent_close');
    expect(getIncomingEventsStream().isClosed()).toEqual(true);
    expect(req1stream.isClosed()).toEqual(true);
});

it("sends messages over the transport", () => {
    const { log, connect, getIncomingEventsStream } = fakeTransport();

    const connection = new Connection({
        connect,
    });

    expect(connection.status).toEqual('ready');

    const req1stream = new Stream();
    connection.sendRequest('req1', req1stream);

    getIncomingEventsStream().item({ t: TransportEventType.response_event, streamId: 1, evt: { t: c_item, item: 123 }});
    getIncomingEventsStream().item({ t: TransportEventType.response_event, streamId: 1, evt: { t: c_done }});

    expect(req1stream.takeItemsSync()).toEqual([123]);
});

