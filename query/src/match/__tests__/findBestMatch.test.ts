
import { parseHandler } from '../../parser/parseHandler';
import { Graph, Query } from '../../graph';
import { it, expect } from 'vitest'
import { MatchContext, } from '../checkOneMatch';
import { findBestMatch } from '../findBestMatch';
import { toQuery } from '../../query';

function setupGraph(handlers: string[]) {
    const graph = new Graph();
    graph.mount(handlers.map(str => parseHandler(str)));
    return graph;
}

function find(graph: Graph, queryStr: string) {
    const ctx = new MatchContext();
    const query = toQuery(queryStr) as Query;
    const found = findBestMatch(ctx, graph, query);

    if (!found)
        return null;
    
    return found.handler.toDeclString();
}

it("finds a simple match", () => {
    const graph = setupGraph([
        'a',
        'a b',
        'a b c',
    ]);

    expect(find(graph, 'a')).toEqual('a');
    expect(find(graph, 'a b')).toEqual('a b');
});

it("handles no match found (overspecified)", () => {
    const graph = setupGraph([
        'a b',
    ]);
    expect(find(graph, 'a b c')).toEqual(null);
});

it("handles an unmatched optional tag in the query", () => {
    const graph = setupGraph([
        'a b',
    ]);
    expect(find(graph, 'a b c?')).toEqual('a b');
});

it("handles an unmatched optional parameter in the handler", () => {
    const graph = setupGraph([
        'a b? c',
    ]);
    expect(find(graph, 'a c')).toEqual('a b? c');
});

it("handles no match found (underspecified)", () => {
    const graph = setupGraph([
        'a b c',
    ]);
    expect(find(graph, 'a b')).toEqual(null);
});

it("handles a positional arg", () => {
    const graph = setupGraph([
        'a b c(positional)',
    ]);

    expect(find(graph, 'a b xyz')).toEqual('a b c(positional)');
});