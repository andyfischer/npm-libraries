
import { Table } from '../table/Table'
import { Schema } from '../table'
import { Stream, c_delta, c_restart, } from '@andyfischer/streams'
import { ItemEqualityFn, getIndexKeyForArgs, } from '../table/IndexUtils'
import { TableListenPlan } from '../table/Listeners';

export function getSingleValue(schema: Schema, funcName: string, table: Table) {
    return table.defaultIndex.getAsValue();
}

export function listAll(schema: Schema, funcName: string, table: Table) {
    return (table.defaultIndex.getAllAsList());
}

export function* each(table: Table) {
    yield* table.defaultIndex.iterateAll();
}

export function* eachWithAttrs(schema: Schema, funcName: string, indexName: string, table: Table, args: any[]) {
    const index = table.indexes.get(indexName);
    const indexKey = getIndexKeyForArgs(args);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${indexName}`);

    yield* index.iterateWithIndexKey(indexKey);
}

export function deleteWithAttrs(schema: Schema, funcName: string, indexName: string, table: Table, indexKey: any) {

    const index = table.indexes.get(indexName);

    for (const item of index.iterateWithIndexKey(indexKey)) {
        if (!item)
            throw new Error("internal error: null item in deleteWithAttrs?")

        // Lazily create the isEqual function
        let isEqualFn: ItemEqualityFn = null;

        function getIsEqualFn() {
            if (!isEqualFn) {
                isEqualFn = (otherItem) => {
                    if (!otherItem)
                        throw new Error("internal error: otherItem is null?");

                    const itemKeyOnDeletionIndex = index.schema.getIndexKeyForItem(otherItem);
                    return indexKey === itemKeyOnDeletionIndex;
                }
            }
            return isEqualFn;
        }

        // Delete from affected indexes.
        for (const affectedIndexSchema of schema.indexes) {
            const affectedIndex = table.indexes.get(affectedIndexSchema.name);
            const affectedIndexKey = affectedIndexSchema.getIndexKeyForItem(item);

            if (affectedIndexSchema.name === indexName) {
                // Shortcut when updating the deletion index.
                affectedIndex.deleteAllWithIndexKey(affectedIndexKey);
            } else {
                affectedIndex.deleteItem(affectedIndexKey, getIsEqualFn());
            }
        }

        if (schema.supportsListening) {
            table.listenerStreams.forEach((stream: Stream, plan: TableListenPlan) => {
                if (plan?.deletionIndexName) {
                    const index = schema.indexesByName.get(plan.deletionIndexName);
                    const deletionIndexKey = index.getIndexKeyForItem(item);
                    stream.event({ t: c_delta, func: plan.deletionFunc, params: [deletionIndexKey] });
                } else {
                    // Use the same indexName as the request
                    const funcName = table.schema.getPublicFuncNameForDeleteUsingIndex(indexName);
                    stream.event({ t: c_delta, func: funcName, params: [indexKey] });
                }
            });
        }
    }
}

export function deleteAll(schema: Schema, table: Table, args: any[]) {
    if (args.length !== 0)
        throw new Error("expected zero args for .deleteAll");

    for (const indexSchema of schema.indexes) {
        const index = table.indexes.get(indexSchema.name);

        index.deleteAll();
    }

    if (schema.supportsListening) {
        table.listenerStreams.event({ t: c_restart });
    }
}

export function replaceAll(schema: Schema, table: Table, args: any[]) {
    if (args.length !== 1)
        throw new Error("expected one arg for .replaceAll: items[]");

    const items = args[0];

    deleteAll(schema, table, []);

    for (const item of items)
        table.insert(item);
}

export function count(schema: Schema, table: Table, args: any[]) {
    if (args.length !== 0)
        throw new Error("expected zero args for .count");

    return table.defaultIndex.getCount();
}

export function first(table: Table) {
    for (const item of table.each()) {
        return item;
    }
}

