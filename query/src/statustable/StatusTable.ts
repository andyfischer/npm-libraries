

import { Table } from '../table/Table'
import { ErrorDetails, StreamEvent } from '@andyfischer/streams'
import { lazySchema } from '../schema/LazySchema'

export interface StatusTableItem {
    statusType: 'loading' | 'error' | 'done';
    error?: ErrorDetails
}

const StatusTableSchema = lazySchema<StatusTableItem>({
    name: 'TableStatus',
    funcs: [
        'get',
        'listen',
    ]
});

function tableIsLoading() {
    const status = this.status.get();
    if (!status)
        throw new Error("StatusTable internal error: missing status value?");
    return status.statusType === 'loading'
}

function tableIsReady() {
    const status = this.status.get();
    if (!status)
        throw new Error("StatusTable internal error: missing status value?");
    return status.statusType === 'done';
}

function tableHasError() {
    const status = this.status.get();
    if (!status)
        throw new Error("StatusTable internal error: missing status value?");
    return status.statusType === 'error';
}

function tableGetError() {
    const status = this.status.get();
    if (!status)
        throw new Error("StatusTable internal error: missing status value?");
    if (status.statusType !== 'error')
        return null;

    return status.error;
}

function tableWaitForData() {
    const table: Table = this;
    let resolve, reject;
    const promise = new Promise<void>((_resolve, _reject) => { resolve = _resolve; reject = _reject; });

    if (table.hasError()) {
        reject(table.getError());
        return promise;
    }

    if (!table.isLoading()) {
        resolve();
        return promise;
    }

    const listenerStream = table.status.listen();

    listenerStream.pipe((msg: StreamEvent) => {
        if (table.hasError()) {
            listenerStream.stopListening();
            reject(table.getError());
        }
        else if (!table.isLoading()) {
            listenerStream.stopListening();
            resolve();
        }
    });

    return promise;
}

export function createStatusTable() {
    const statusTable = StatusTableSchema.get().createTable();
    statusTable.set({ statusType: 'loading' });
    return statusTable;
}

export function initializeNewTableWithStatus(tableObject: Table) {
    const statusTable = createStatusTable();
    tableObject.status = statusTable;
    tableObject.isLoading = tableIsLoading;
    tableObject.isReady = tableIsReady;
    tableObject.hasError = tableHasError;
    tableObject.getError = tableGetError;
    tableObject.waitForData = tableWaitForData;
}
