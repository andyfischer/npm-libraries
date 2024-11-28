
import { it, expect, vi } from 'vitest'
import { Graph } from '../../graph';

it("throws an error if a required param is not provided", () => {
    const graph = new Graph();

    const handler = vi.fn();
    graph.exposeFunc("call $a", handler);

    const result = graph.query("call $a");
    expect(handler).not.toHaveBeenCalled();
    expect(result.takeErrorSync()).toMatchInlineSnapshot(`
      {
        "errorMessage": "Missing required parameter: a",
        "errorType": "missing_parameter",
        "related": [
          {
            "missingParameterFor": "a",
            "query": "call $a",
          },
        ],
      }
    `);
});