
import { it, expect, vi } from 'vitest'
import { Graph } from '../../graph';

it('query execution handles input values', () => {
    const graph = new Graph();

    const handler = vi.fn();
    graph.exposeFunc("call $a", handler);

    graph.query("call a=1");

    expect(handler).toHaveBeenCalledWith(1);
});

it('query execution handles a flag-style tag', () => {
    const graph = new Graph();

    const handler = vi.fn();
    graph.exposeFunc("call $flag?", handler);

    graph.query("call --flag");
    expect(handler).toHaveBeenCalledWith(true);

    handler.mockClear();
    graph.query("call");
    expect(handler).toHaveBeenCalledWith(null);
});