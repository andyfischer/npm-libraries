
import { Handler } from '../handler'
import { QueryLike, toQuery } from '../query'
import { Stream } from '@andyfischer/streams'
import { Table, Schema, lazySchema } from '../table'
import { GraphModule } from './GraphModule'
import { declaredFunctionToHandler } from '../handler/NativeCallback';
import { createPlan, ExpectedValue, executePlan, QueryParameters } from '../query'
import { parseFile } from '../parser/parseFile'

export type QueryParametersLike = Map<string,any> | object

const ModulesSchema = lazySchema({
    name: 'Graph.Modules',
    attrs: [
        'id(auto)'
    ],
    funcs: [
        'listAll',
        'get(id)',
        'each',
    ]
});


const GraphTablesSchema = lazySchema({
    name: 'graph.tables',
    attrs: [
        'id(auto)'
    ],
    funcs: [
        'get(id)',
        'has(name)',
        'get(name)',
        'listAll',
        'each',
    ]
});

export interface GraphLike {
    query(queryLike: QueryLike, params?: QueryParametersLike): Stream
    eachHandler(): IterableIterator<Handler>
}

export function toQueryParameters(paramsLike: QueryParametersLike): QueryParameters {
    if (!paramsLike)
        return new Map();

    if (paramsLike instanceof Map)
        return paramsLike;

    const map = new Map();

    for (const [k,v] of Object.entries(paramsLike)) {
        map.set(k,v);
    }

    return map;
}

interface GraphTable {
    id?: string
    name: string
    table: Table
}

export class Graph implements GraphLike {
    modules: Table<GraphModule>
    tables: Table<GraphTable>

    constructor() {
        this.modules = ModulesSchema.createTable();
        this.tables = GraphTablesSchema.createTable();
    }

    newModule() {
        const graphModule = new GraphModule(this);
        this.modules.insert(graphModule);
        return graphModule;
    }

    onModuleChange(graphModule: GraphModule) {
        // future
    }

    query(queryLike: QueryLike, paramsLike?: QueryParametersLike): Stream {
        const query = toQuery(queryLike);

        if (query.t !== 'query')
            throw new Error("Expected a query (not multistep)");

        const params = toQueryParameters(paramsLike);
        const expectedInput: ExpectedValue = params.has('$input') ? { t: 'some_value' } : { t: 'no_value' };
        const plan = createPlan(this, {}, query, expectedInput);

        const output = new Stream({ name: `Graph.query(${query.toQueryString()})`});

        executePlan(plan, params, output);
        return output;
    }

    runQueryFile(contents: string) {
        const parsed = parseFile(contents);
        for (const query of parsed) {
            const output = this.query(query);
        }
    }

    mount(handlers: Handler[]) {
        const mountModule = this.newModule();
        mountModule.redefine(handlers);
        return mountModule;
    }

    exposeFunc(decl: string, func: Function) {
        const handler = declaredFunctionToHandler(decl, func);
        return this.mount([ handler ]);
    }

    *eachHandler() {
        for (const eachModule of this.modules.each()) {
            for (const { handler } of eachModule.handlers.each()) {
                yield handler;
            }
        }
    }

    setupTable(schema: Schema) {
        if (this.tables.has_name(schema.name)) {
            throw new Error("already have a table with name: " + schema.name);
        }

        this.tables.insert( { name: schema.name, table: schema.createTable() });
    }

    tableByName(name: string) {
        const entry = this.tables.get_with_name(name);
        return entry?.table as Table;
    }
}
