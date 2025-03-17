import { StreamDispatcher } from "@andyfischer/streams";
import { Schema, Table } from "../table";
import { checkInvariantsOnTable } from "../table/checkInvariants";
import { consoleLogTable } from "../table/debugFunctions";
import { TableListenPlan, tableToStream } from "../table/Listeners";
import { TableIndex } from "../table/TableIndex";
import { createIndex } from "./createIndex";
import { insert } from "./RuntimeInsert";

/*

const indexes = new Map<string,TableIndex>()

    for (const schemaIndex of schema.indexes) {
        const newTableIndex = createIndex(schema, schemaIndex);
        indexes.set(schemaIndex.name, newTableIndex);
    }

    let defaultIndex: TableIndex = null;
    if (schema.defaultIndex) {
        defaultIndex = indexes.get(schema.defaultIndex.name);
    }

    const attrData = new Map();

 t: 'table',
        schema,
        indexes,
        defaultIndex,
        attrData,
        items: defaultIndex && defaultIndex.items,
        indexType: (defaultIndex && defaultIndex.indexType) || null,
        listenerStreams: null,

        insert: (...args) => {
            if (args.length !== 1)
                throw new Error(`(${schema.name}).insert usage error: expected a single arg (item)`)
        
            const item = args[0];

            insert(schema, tableObject, item);
        },

        toStream: () => tableToStream(tableObject),

        supportsFunc(funcName: string) {
            return schema.supportsFunc(funcName);
        },
        assertSupport(funcName: string) {
            schema.assertSupportsFunc(funcName);
        },
        assertFitsSchema(schema: Schema) {
            schema.assertFitsSchema(schema);
        },
        checkInvariants() {
            checkInvariantsOnTable(tableObject)
        },
        consoleLog(options) {
            consoleLogTable(tableObject, options);
        },
        */

export class MemoryTable<ItemType = any> {
    t: 'table' = 'table';

    schema: Schema
    indexes: Map<string,TableIndex>
    defaultIndex?: TableIndex<any>;
    attrData = new Map<string, any>();
    listenerStreams: StreamDispatcher<ItemType, TableListenPlan> = null;
    items: any;
    indexType: any;

    setSchema(schema: Schema) {
        this.schema = schema;

        // Set up indexes
        this.indexes = new Map<string,TableIndex>()

        for (const schemaIndex of schema.indexes) {
            const newTableIndex = createIndex(schemaIndex);
            this.indexes.set(schemaIndex.name, newTableIndex);
        }

        if (schema.defaultIndex) {
            this.defaultIndex = this.indexes.get(schema.defaultIndex.name);
            this.items = this.defaultIndex.items;
            this.indexType = this.defaultIndex.indexType;
        }
    }

    insert(item: ItemType) {
        const table = this as any as Table<ItemType>;
        return insert(this.schema, table, item) as ItemType;
    }

    toStream() {
        const table = this as any as Table<ItemType>;
        return tableToStream(table);
    }

    supportsFunc(funcName: string) {
        return this.schema.supportsFunc(funcName);
    }
    assertSupport(funcName: string): void {
        this.schema.assertSupportsFunc(funcName);
    }
    assertFitsSchema(schema: Schema) {
        this.schema.assertFitsSchema(schema);
    }
    checkInvariants() {
        const table = this as any as Table<ItemType>;
        checkInvariantsOnTable(table)
    }
    consoleLog(options) {
        const table = this as any as Table<ItemType>;
        consoleLogTable(table, options);
    }
}