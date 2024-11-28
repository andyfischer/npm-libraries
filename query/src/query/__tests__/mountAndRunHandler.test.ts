
import { it, expect } from 'vitest'
import { Graph } from '../../graph'

it("should be able to mount and run a simple function using a query", () => {
    const graph = new Graph();
    graph.exposeFunc("the_func -> result", () => {
        return { result: 'the result' }
    });

    expect(graph.query("the_func result").takeItemSync())
        .toEqual({ result: 'the result' });
});

it("can run a handler with a positional arg", () => {
    const graph = new Graph();
    const calls = [];
    graph.exposeFunc("the_func $arg(positional)", (arg) => {
        calls.push({arg});
    });

    graph.query("the_func xyz");
    expect(calls).toEqual([{arg: 'xyz'}]);
});

it("nested queries can use parametrized values", () => {
    const graph = new Graph();
    const calls = [];
    graph.exposeFunc("the_func $where", (where) => {
        calls.push({where: where.toQueryString()});
    });

    graph.query("the_func where($nested_param)", { nested_param: '123' });
    expect(calls).toEqual([{
        where: 'nested_param=123'
    }]);
});