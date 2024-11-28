import { getIndexKeyForArgs } from "../table/IndexUtils";
import { Schema } from "../table";
import { Table } from "../table/Table";
import { MultiMapIndex } from "./MultiMapIndex";

export function getWithAttrs(schema: Schema, funcName: string, indexName: string, table: Table, args: any[]) {
    const indexKey = getIndexKeyForArgs(args);
    const index = table.indexes.get(indexName);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${indexName}`);

    return index.getWithIndexKey(indexKey);
}

export function hasWithAttr(schema: Schema, funcName: string, indexName: string, table: Table, args: any[]): boolean {
    const index = table.indexes.get(indexName);
    const indexKey = getIndexKeyForArgs(args);

    if (!index) {
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${indexName}`);
    }

    return index.hasIndexKey(indexKey);
}

export function listWithAttr(schema: Schema, funcName: string, indexName: string, table: Table, args: any[]) {
    if (args.length !== 1)
        throw new Error(`(${schema.name}).${funcName} usage error: expected a single arg (indexed value)`)

    const indexKey = getIndexKeyForArgs(args);
    const index = table.indexes.get(indexName);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${indexName}`);

    return index.getListWithIndexKey(indexKey);
}

export function listWithAttrs(schema: Schema, funcName: string, indexName: string, table: Table, args: any[]) {
    const indexKey = getIndexKeyForArgs(args);
    const index = table.indexes.get(indexName);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${indexName}`);

    return index.getListWithIndexKey(indexKey);
}

export function groupByAttrs(schema: Schema, funcName: string, indexName: string, table: Table) {
    const index = table.indexes.get(indexName);

    if (!index)
        throw new Error(`Schema (${schema.name}) internal error: expected to find index: ${indexName}`);

    const multiMapIndex = index as MultiMapIndex;
    const out = [];
    for (const entry of multiMapIndex.items.items.entries()) {
        out.push(entry);
    }
    return out;
}