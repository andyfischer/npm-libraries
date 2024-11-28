
import { Graph, QueryParametersLike, QueryLike } from '@andyfischer/query'

let _graph: Graph;

export function getGraph() {
    if (!_graph) {
        _graph = new Graph();
    }

    return _graph;
}

export function exposeFunc(decl: string, func: Function) {
    return getGraph().exposeFunc(decl, func);
}

export function query(queryStr: QueryLike, params?: QueryParametersLike) {
    return getGraph().query(queryStr, params);
}
