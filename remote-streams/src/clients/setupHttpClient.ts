
import { Connection } from "../Connection";
import { HttpClient } from "./HttpClient";

export interface SetupOptions {
    url: string
    
    // Implementation of the fetch() function.
    // If we're running in a browser, this does not need to be provided (we'll use globaThis.fetch).
    // If we're running in Node.js, this DOES need to be provided. (such as from the 'node-fetch' package)
    fetch?(url: string, fetchOptions: { method: 'POST', headers: any, body: string}): any
}

export function setupHttpClient(setupOptions: SetupOptions) {
    return new Connection({
        connect: () => new HttpClient({
            url: setupOptions.url,
            fetch: setupOptions.fetch
        })
    });
}