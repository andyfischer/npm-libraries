
import { Table } from './Table'
import { c_delta, c_done, c_fail, c_item, c_restart, c_schema, recordUnhandledError,
    Stream, StreamEvent } from "@andyfischer/streams"
import { compileSchema } from '../schema/compileSchema';

const VerboseLogStreamToTable = false;

export interface StreamSetup {
    input: Stream
    table: Table
    afterUpdate?: () => void
    afterDone?: () => void
}

export interface StreamToTableCallbacks {
    afterUpdate?: () => void
    afterDone?: () => void
}

/*
 * Start listening to the 'input' table and use it to populate the items in 'table'.
 *
 * The receiving table should be enabled to have a 'status' table.
 *
 * Incoming stream events have the following effect:
 *
 *  item event: calls table.insert
 *  delete event: calls table.delete
 *  done, error, close events: updates the 'status' table
 *  restart event: clears the existing table contents
 */

export function streamToTable(setup: StreamSetup) {
    const { input, table, afterUpdate, afterDone } = setup;

    table.assertSupport("getStatus");
    table.assertSupport("deleteAll");

    table.status.set({
        statusType: 'loading',
    });

    input.pipe((evt: StreamEvent) => {

        if (VerboseLogStreamToTable)
            console.log('streamToTable received event: ', evt)

        try {
            receiveUpdate(table, table.status, evt);
        } catch (e) {
            recordUnhandledError(e);
        }

        if (afterUpdate) {
            try {
                afterUpdate();
            } catch (e) {
                recordUnhandledError(e);
            }
        }
        
        if (afterDone && evt.t === c_done) {
            try {
                afterDone();
            } catch (e) {
                recordUnhandledError(e);
            }
        }
    });
}

export function receiveUpdate(destinationTable: Table, status: Table, event: StreamEvent) {
    let currentStatus = status.get().statusType;

    if (VerboseLogStreamToTable) {
        console.log(`streamToTable to ${destinationTable.schema.name} (currentStatus=${currentStatus}): got event:`, event);
    }

    switch (event.t) {

    case c_item:
        destinationTable.insert(event.item);
        break;

    case c_delta: {
        // Safety check
        if (!event.func.startsWith('delete'))
            throw new Error("streamToTable: unexpected delta event: " + event.func);

        destinationTable.assertSupport(event.func);

        if (!destinationTable[event.func]) {
            console.error("streamToTable: internal error: table is missing: " + event.func);
            console.error("table actually supports: ", Array.from(Object.keys(destinationTable)));
        }

        destinationTable[event.func](...event.params);
        break;
    }

    case c_fail:
        if (currentStatus !== 'error') {
            status.set({
                statusType: 'error',
                error: event.error,
            });
        }
        break;

    case c_done:
        if (currentStatus !== 'error')
            status.set({ statusType: 'done' });

        break;

    case c_restart:
        destinationTable.status.set({
            statusType: 'loading',
        });
        destinationTable.deleteAll();
        break;

    case c_schema: {
        const compiledSchema = compileSchema(event.schema);
        try {
            destinationTable.schema.assertFitsSchema(compiledSchema);
        } catch (e) {
            if (destinationTable.supportsFunc('upgradeSchema')) {
                // Perform a schema upgrade
                destinationTable.upgradeSchema(event.schema);
            } else {
                if (!destinationTable.schema.decl.disableGlobalErrors)
                    recordUnhandledError(/*destinationTable.schema*/ e);

                status.set({ statusType: 'error', error: {
                    errorMessage: `streamToTable Destination ${destinationTable.schema.name} doesn't support upstream: ${e.message}`
                }});
            }
        }
        break;
    }
    }

    if (VerboseLogStreamToTable) {
        const newStatus = status.get().statusType;
        if (newStatus !== currentStatus)
            console.log(`streamToTable to ${destinationTable.schema.name}: has changed status to: ${newStatus}`);
    }
}
