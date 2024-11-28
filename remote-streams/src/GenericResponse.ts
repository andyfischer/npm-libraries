import { changeSchema, lazySchema } from "@andyfischer/query";
import { c_schema, StreamEvent } from "@andyfischer/streams";

const GenericResponse = lazySchema({
    name: 'GenericResponse',
    funcs: [
        'get', 'each', 'listAll', 'deleteAll', 'status', 'listenToStream'
    ]
});

const GenericSingleItem = lazySchema({
    name: 'GenericSingleItem',
    funcs: [ 'get', 'each', 'listAll', 'deleteAll', 'status', 'listenToStream' ]
});

const GenericList = lazySchema({
    name: 'GenericList',
    funcs: [ 'each', 'listAll', 'deleteAll', 'status', 'listenToStream', 'count' ]
});

export function setupGenericResponseTable() {
    let hasSpecialized = false;

    const table = GenericResponse.createTable();

    return {
        table, 
        receiveEvent(evt: StreamEvent) {
            switch (evt.t) {
            case c_schema:
                if (!hasSpecialized && evt.schema.hint) {
                    if (evt.schema.hint === 'value') {
                        hasSpecialized = true;
                        changeSchema(table, GenericSingleItem.get());
                    } else if (evt.schema.hint === 'list') {
                        hasSpecialized = true;
                        changeSchema(table, GenericList.get());
                    }
                }
                break;
            }

            table.receiveUpdate(evt);
        }
    }
}