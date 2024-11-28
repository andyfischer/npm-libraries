import { c_item } from "@andyfischer/streams"
import { Schema } from "../schema/Schema";
import { Table } from "../table/Table";
import { Item } from "../table";

export function preInsert(schema: Schema, table: Table, item: Item) {
    for (const step of schema.preInsert) {
        switch (step.t) {
        case 'init_auto_attr':
            if (item[step.attr] != null)
                continue;

            const attrData = table.attrData.get(step.attr);
            if (!attrData) {
                throw new Error(`(${schema.name}) internal error: expected to find attrData for: ${step.attr}`)
            }
            const next = attrData.next;
            attrData.next++;
            item[step.attr] = next;
            break;
        }
    }

    return item;
}
export function insert(schema: Schema, table: Table, item: Item) {
    if (item == null)
        throw new Error("insert usage error: item is null")

    preInsert(schema, table, item);

    // Store object - update every index
    for (const indexSchema of schema.indexes) {
        const index = table.indexes.get(indexSchema.name);
        index.insert(item);
    }

    if (schema.supportsListening)
        table.listenerStreams.event({ t: c_item, item });

    return item;
}
