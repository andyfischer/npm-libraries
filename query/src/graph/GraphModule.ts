
import { Table, lazySchema } from '../table';
import { Handler } from '../handler'
import { Graph } from './Graph'

interface HandlerEntry {
    id?: any
    handler: Handler
}

const HandlersSchema = lazySchema<HandlerEntry>({
    name: 'Graph.Handlers',
    attrs: [
        'id(auto)',
    ],
    funcs: [
        'listAll',
        'get(id)',
        'each',
        'deleteAll',
    ]
});

export class GraphModule {
    graph: Graph
    handlers: Table<HandlerEntry>

    constructor(graph: Graph) {
        this.graph = graph;
        this.handlers = HandlersSchema.createTable();
    }

    redefine(handlers: Handler[]) {
        this.handlers.deleteAll();

        for (const handler of handlers) {
            handler.freeze();
            this.handlers.insert({ handler });
        }

        this.graph.onModuleChange(this);
    }
}
