import { RequestDispatch } from "../RequestDispatch";
import { randomHex } from "@andyfischer/streams"

let MyUpdateId = (new Date()).toISOString() + '-' + randomHex(8);

export function setupServerInfo(api: RequestDispatch<any>) {
    api.add('GetServerInfo', () => {
        return {
            updateId: MyUpdateId
        }
    });
}