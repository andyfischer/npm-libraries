import { Table } from './Table'
import { c_restart, c_schema, Stream, } from '@andyfischer/streams'
import { streamToTable, StreamToTableCallbacks } from './streamToTable'
import { Schema } from '../schema/Schema'
import { Query } from '../query/Query'
import { toQueryNode } from '../query/toQuery'
import { SchemaDecl } from '../schema/SchemaDecl'

export interface TableListenPlan {
    deletionIndexName?: string
    deletionFunc?: string
}

export interface ListenToTableOptions {
    getInitialData?: boolean
    deletionIndexName?: string
}

function getSchemaForListener(schema: Schema): SchemaDecl {
    const output: SchemaDecl = {name: schema.name + '/listener', funcs: []};

    for (const funcDecl of schema.decl.funcs || []) {
        const parsed = toQueryNode(funcDecl) as Query;
        const parsedFuncName = parsed.tags[0].attr;

        if (parsedFuncName === 'delete') {
            output.funcs.push(funcDecl);
        }
    }

    return output;
}

export function listenToTable(table: Table, options: ListenToTableOptions = {}) {
    let stream: Stream;

    if (options.deletionIndexName) {
        const index = table.schema.indexesByName.get(options.deletionIndexName);
        if (!index)
            throw new Error("No index with name: " + options.deletionIndexName);

        const deletionFuncName = table.schema.getPublicFuncNameForDeleteUsingIndex(options.deletionIndexName);

        const plan: TableListenPlan = {
            deletionIndexName: options.deletionIndexName,
            deletionFunc: deletionFuncName,
        };

        stream = table.listenerStreams.add(plan);

        // Prepare for deletion events using this specific key.
        const schema: SchemaDecl = {
            name: table.schema.name + '/listener/' + plan.deletionIndexName,
            funcs: [
                plan.deletionFunc,
            ],
        };
        stream.event({ t: c_schema, schema: schema as any });
    } else {
        // No listen plan. Prepare for any deletion events that the table supports.
        stream = table.listenerStreams.add();
        stream.event({ t: c_schema, schema: getSchemaForListener(table.schema) as any });
    }

    if (options?.getInitialData) {
        for (const item of table.each())
            stream.item(item);
    }

    stream.event({ t: c_restart });

    return stream;
}

export function listenToStream(table: Table, args: any[]) {
    if (args.length == 0)
        throw new Error("expected one or two args for .listenToStream");

    const input: Stream = args[0];
    const callbacks: StreamToTableCallbacks = args[1] || {}

    return streamToTable({ input, table, ...callbacks });
}

export function tableToStream(table: Table) {
    const out = new Stream();

    out.event({ t: c_schema, schema: table.schema.decl as any });

    for (const item of table.each()) {
        out.item(item);
    }

    out.done();
    return out;
}