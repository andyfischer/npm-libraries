import { Schema, Table } from "../table";
import { deleteTableCallbacks, setupTableCallbacks } from "./createMemoryTable";
import { MemoryTable } from "./MemoryTable";

export function changeSchema(table: Table, schema: Schema) {
    table = (table as any)._unproxy || table;

    if (!(table instanceof MemoryTable))
        throw new Error("changeSchema only supported on MemoryTable instances");

    let memoryTable = table as MemoryTable;

    deleteTableCallbacks(memoryTable.schema, table);
    memoryTable.setSchema(schema);
    setupTableCallbacks(memoryTable.schema, table);
}