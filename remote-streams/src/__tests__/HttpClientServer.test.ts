import { setupHttpClient } from "../clients/setupHttpClient";
import { Connection } from "../Connection";
import { setupHttpServer } from "../servers/HttpSocketServer";
import { afterAll, beforeAll, expect, it } from 'vitest'
import fetch from 'node-fetch'
import { c_fail } from "@andyfischer/streams";

let server: any;
const port = 8099;

beforeAll(async () => {
    server = await setupHttpServer({
        port,
        handleRequest: (req, connection, output) => {
            output.item({ responseTo: req });
            output.done();
        }
    });
});

afterAll(async () => {
    await server.close();
});

it("can make a simple request with a http client", async () => {
    const client = setupHttpClient({
        url: `http://localhost:${port}/api`,
        fetch: fetch,
    });

    const response = client.sendRequest({ request: 1 });
    const responseItems = await response.promiseItem();

    expect(responseItems).toEqual({ responseTo: { request: 1 } });

    client.close();
});

it("can make multiple concurrent requests with a http client", async () => {
    const client = setupHttpClient({
        url: `http://localhost:${port}/api`,
        fetch: fetch,
    });

    const response1 = client.sendRequest({ request: 1 });
    const response2 = client.sendRequest({ request: 2 });

    expect(await response1.promiseItem()).toEqual({ responseTo: { request: 1 } });
    expect(await response2.promiseItem()).toEqual({ responseTo: { request: 2 } });

    client.close();
});

it("closes any open requests when the http client is closed", async () => {
    const client = setupHttpClient({
        url: `http://localhost:${port}/api`,
        fetch: fetch,
    });

    const response1 = client.sendRequest({ request: 1 });

    client.close();

    const events = await response1.promiseEvents();
    expect(events[0].t).toEqual(c_fail);
});

it("closes request with an error if the hostname is wrong", async () => {
    const client = setupHttpClient({
        url: `http://asjdfkjldsk/api`,
        fetch: fetch,
    });

    const response1 = client.sendRequest({ request: 1 });

    const events = await response1.promiseEvents();
    expect(events[0].t).toEqual(c_fail);
    expect((events[0] as any).error.errorType).toEqual('connection_failed');
});

it("closes request with an error if the URL is wrong", async () => {
    const client = setupHttpClient({
        url: `http://localhost:${port}/asdfkldsafjslk`,
        fetch: fetch,
    });

    const response1 = client.sendRequest({ request: 1 });

    const events = await response1.promiseEvents();
    expect(events[0].t).toEqual(c_fail);
    expect((events[0] as any).error.details.httpStatus).toEqual(404);
});