import { Connection, HttpClient } from ".";

export interface SetupOptions {
    url: string
    fetch?: Function
}

export function createHttpClientConnection(setupOptions: SetupOptions) {

    let fetch = setupOptions.fetch || globalThis.fetch;
    if (!fetch) {
        throw new Error('No fetch implementation is available');
    }

    return new Connection({
        connect: () => new HttpClient({
            url: setupOptions.url,
            fetchImpl: fetch as any,
        })
    });
}