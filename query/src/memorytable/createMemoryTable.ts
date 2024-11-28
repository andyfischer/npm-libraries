import { Table } from '../table/Table'
import { initializeNewTableWithStatus } from '../statustable/StatusTable'
import { Schema, SchemaFunc } from '../schema/Schema'
import { getSingleValue, listAll, each, count,
        deleteWithAttrs, deleteAll, replaceAll,
        first } from './RuntimeFunctions'
import { diffTables } from '../table/diff'
import { wrapTableInDebugProxy } from '../table/TableDebugProxy'
import { c_item, StreamListeners } from '@andyfischer/streams'
import { EnableTableProxyWrapper, EnableDebugMonitor } from '../Config'
import { preInsert } from './RuntimeInsert'
import { getWithAttrs, groupByAttrs, hasWithAttr, listWithAttr, listWithAttrs } from './RuntimeGet'

import { SingleValueIndex } from './SingleValueIndex'
import { TableIndex } from '../table/TableIndex'
import { getIndexKeyForArgs } from '../table/IndexUtils'
import { listenToStream, listenToTable, tableToStream } from '../table/Listeners'
import type { SchemaDecl } from '../table'
import { upgradeSchema } from './upgradeSchema'
import { receiveUpdate } from '../table/streamToTable'
import { prepareUpdateAllFunction, prepareUpdateFunction } from './RuntimeUpdate'
import { MemoryTable } from './MemoryTable'

function getCallbackForSchemaFunc(func: SchemaFunc, schema: Schema, table: Table) {
    switch (func.funcName) {

    case 'preInsert':
        return (...args) => preInsert(schema, table, args[0]);

    case 'each':
        return function*() {
            yield* each(table);
        }
    case 'eachWithFilter':
        return function*(...args) {
            if (args.length !== 1)
                throw new Error("eachWithFilter usage error: expected 1 arg")

            const condition = args[0];

            for (const item of each(table)) {
                if (condition(item))
                    yield item;
            }
        }

    case 'getWithIndexKey': {
        const indexSchema = schema.indexesByName.get(func.indexName);

        if (!indexSchema)
            throw new Error("internal error: expected to find index: " + func.indexName);

        return (...args) => {
            return getWithAttrs(schema, func.publicName, func.indexName, table, args)
        }
    }

    case 'listAll':
        return (...args) => listAll(schema, 'listAll', table);

    case 'listWithIndexKey': {
        const indexSchema = schema.indexesByName.get(func.indexName);
        if (!indexSchema)
            throw new Error("internal error: expected to find index: " + func.indexName);
        return (...args) => {
            return listWithAttrs(schema, func.publicName, func.indexName, table, args);
        }
    }

    case 'group_by': {
        return () => groupByAttrs(schema, func.publicName, func.indexName, table);
    }

    case 'count':
        return (...args) => count(schema, table, args);

    case 'getSingleValue':
        return (...args) => {
            if (args.length !== 0)
                throw new Error(`(${schema.name}).${func.publicName} usage error: expected zero args`)

            return getSingleValue(schema, func.publicName, table);
        }

    case 'has':
        return (...args) => hasWithAttr(schema, func.publicName, func.indexName, table, args);

    case 'first':
        return (...args) => first(table);

    case 'setSingleValue': {
        return (...args) => {
            if (args.length !== 1)
                throw new Error(`${schema.name}.${func.publicName} usage error: expected a single arg`)

            const item = args[0];
            const index: TableIndex = table.defaultIndex;

            if (index.indexType !== 'single_value')
                throw new Error(`${schema.name}.${func.publicName} internal error: expected 'single_value' index, got: ${table.indexType}`);

            (index as SingleValueIndex).item = item;

            if (schema.supportsListening)
                table.listenerStreams.event({ t: c_item, item });
        }
    }

    case 'listen':
        return (options) => listenToTable(table, options);

    case 'receiveUpdate':
        return (update) => receiveUpdate(table, table.status, update);

    case 'itemEquals': {
        const primaryUniqueIndex = schema.indexesByName.get(schema.primaryUniqueAttr);
        return (a, b) => {
            return primaryUniqueIndex.getIndexKeyForItem(a) === primaryUniqueIndex.getIndexKeyForItem(b);
        }
    }

    case 'item_to_uniqueKey': {
        const primaryUniqueIndex = schema.indexesByName.get(schema.primaryUniqueAttr);

        return (...args) => {
            if (args.length !== 1)
                throw new Error('item_to_uniqueKey expected 1 arg');

            const item = args[0];
            
            if (!item)
                throw new Error('item_to_uniqueKey expected an item');

            return primaryUniqueIndex.getIndexKeyForItem(item);
        }
    }
    case 'item_matches_uniqueKey':
        return (...args) => {
            if (args.length !== 2)
                throw new Error('item_matches_uniqueKey expected 2 args');

            const item = args[0];
            const uniqueKey = args[1];

            if (!item)
                throw new Error('item_matches_uniqueKey expected an item');

            return item[schema.primaryUniqueAttr] === uniqueKey;
        }
    case 'get_using_uniqueKey': {
        const indexName = schema.primaryUniqueAttr;
        return (...args) => {
            return getWithAttrs(schema, 'get_using_uniqueKey', indexName, table, args);
        }
    }

    case 'delete_using_uniqueKey': {
        const primaryUniqueIndex = schema.indexesByName.get(schema.primaryUniqueAttr);
        return (...args) => {
            if (args.length !== 1)
                throw new Error('delete_using_uniqueKey expected 1 arg');
            const indexKey = getIndexKeyForArgs(args);
            return deleteWithAttrs(schema, 'delete_using_uniqueKey', primaryUniqueIndex.name, table, indexKey);
        }
    }

    case 'deleteItem': {
        const primaryUniqueIndex = schema.indexesByName.get(schema.primaryUniqueAttr);
        return (...args) => {
            if (args.length !== 1)
                throw new Error('deleteItem expected 1 arg');

            const item = args[0];
            const indexKey = primaryUniqueIndex.getIndexKeyForItem(item);
            return deleteWithAttrs(schema, 'deleteItem', primaryUniqueIndex.name, table, indexKey);
        }
    }

    case 'update': {
        const updateFn = prepareUpdateAllFunction(schema, table);
        return updateFn;
    }

    case 'updateWithIndexKey': {
        const indexSchema = schema.indexesByName.get(func.indexName);
        const updateFn = prepareUpdateFunction(schema, indexSchema, table);
        return updateFn;
    }

    case 'deleteAll':
        return (...args) => deleteAll(schema, table, args);
    case 'deleteWithIndexKey': {
        return (...args) => {
            const indexKey = getIndexKeyForArgs(args);
            deleteWithAttrs(schema, func.publicName, func.indexName, table, indexKey);
        }
    }
    case 'replaceAll':
        return (...args) => replaceAll(schema, table, args);
    case 'listenToStream':
        return (...args) => listenToStream(table, args);
    case 'diff':
        return (...args) => {
            if (args.length !== 1)
                throw new Error(`diff expected 1 arg`);
            const compareTable = args[0];
            return diffTables(table, compareTable);
        }

    case 'getStatus':
        return () => table.status.get();

    case 'upgradeSchema':
        return (upgradeDecl: SchemaDecl) => {
            upgradeSchema(table, upgradeDecl);
        }
    }

    throw new Error("getCallbackForSchemaFunc didn't recognize: " + func.funcName);
}

function* listTableCallbacks(schema: Schema, table: Table) {
    // Create callbacks for each func.
    for (const func of schema.funcsByPublicName.values()) {
        if (func.funcName === 'insert')
            // builtin
            continue;

        const callback = getCallbackForSchemaFunc(func, schema, table);

        yield {
            methodName: func.publicName,
            callback
        }

        if (func.declaredName && func.declaredName !== func.publicName) {
            if (table[func.declaredName]) {
                console.warn('createMemoryTable internal error: overwriting existing function (declaredName): ' + func.declaredName);
            }

            yield {
                methodName: func.declaredName,
                callback
            }
        }
    }
}

export function setupTableCallbacks(schema: Schema, table: Table) {
    for (const { methodName, callback } of listTableCallbacks(schema, table)) {
        if (table[methodName])
            console.warn('createMemoryTable internal error: overwriting existing function: ' + methodName);

        table[methodName] = callback;
    }
}

export function deleteTableCallbacks(schema: Schema, table: Table) {
    for (const { methodName, callback } of listTableCallbacks(schema, table)) {
        delete table[methodName];
    }
}

export function createMemoryTable<ItemType = any>(schema: Schema): Table<ItemType> {
    const memoryTable = new MemoryTable();
    memoryTable.setSchema(schema);
    const table = memoryTable as any as Table<ItemType>;

    setupTableCallbacks(schema, table);

    // Run initializiation steps
    for (const step of schema.setupTable) {
        switch (step.t) {
        case 'init_table_auto_attr': {
            if (!table.attrData.has(step.attr))
                table.attrData.set(step.attr, {})
            table.attrData.get(step.attr).next = 1;
            break;
        }
        case 'init_listener_streams': {
            table.listenerStreams = new StreamListeners();
            break;
        }
        case 'run_initializer': {
            step.initialize(table);
            break;
        }
        }
    }

    if (schema.supportsUpdateEvents)
        initializeNewTableWithStatus(table);

    let result: Table;

    if (EnableTableProxyWrapper) {
        // Create a proxy for better error messages (todo- make this an optional debugging mode?)
        result = wrapTableInDebugProxy(table);
    } else {
        result = table;
    }

    return result;
}

