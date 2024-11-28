import { Stream } from '@andyfischer/streams'
import { callbackToStream, declaredFunctionToHandler } from '../NativeCallback';
import { dynamicOutputToStream } from '@andyfischer/streams';
import { Graph } from '../../graph';
import { it, expect } from 'vitest'

it('should finish stream if output is null or undefined', () => {
  let stream = new Stream();

  dynamicOutputToStream(null, stream);
  expect(stream.takeItemsSync()).toEqual([]);

  stream = new Stream();
  dynamicOutputToStream(undefined, stream);
  expect(stream.takeItemsSync()).toEqual([]);
});

it('should send output to a stream if it is a stream', () => {
  const stream = new Stream();
  const output = new Stream();
  dynamicOutputToStream(output, stream);

  output.item({ x: 1 });
  output.done();

  expect(stream.takeItemsSync()).toEqual([{x:1}]);
});

it('callbackToStream - stream can be resolved syncronously on an error', () => {
    const output = new Stream();
    callbackToStream(() => { throw new Error("test error") }, output);

    let caught = null;
    try {
        const items = output.takeItemsSync();
    } catch (e) {
        caught = e;
    }

    expect(caught?.message).toEqual('test error');
});

/*
it('should put each item of a table into a stream', () => {
    const stream = new Stream();
  const output = {
    t: 'table',
    scan: jest.fn().mockReturnValue(['item1', 'item2']),
  };
  dynamicOutputToStream(output, stream);
  expect(output.scan).toHaveBeenCalledTimes(1);
  expect(stream.put).toHaveBeenCalledTimes(2);
  expect(stream.put).toHaveBeenNthCalledWith(1, 'item1');
  expect(stream.put).toHaveBeenNthCalledWith(2, 'item2');
  expect(stream.finish).toHaveBeenCalledTimes(1);
});
*/

it('should put each element of an array into a stream', () => {
  const stream = new Stream();
  const output = ['item1', 'item2'];
  dynamicOutputToStream(output, stream);
  expect(stream.takeItemsSync()).toEqual(['item1','item2']);
});

it('should handle a resolved promise', async () => {
  const stream = new Stream();
  const output = Promise.resolve('resolved');
  dynamicOutputToStream(output, stream);
  expect(stream.isClosed()).toEqual(false);
  expect(await stream.promiseItems()).toEqual(['resolved']);
});

it('should handle an iterator value', () => {
    const output = (function* () {
        yield { value: 1 };
        yield { value: 2 };
    })();

    const stream = new Stream();
    dynamicOutputToStream(output, stream);
    expect(stream.takeItemsSync()).toEqual([{value:1},{value:2}]);
});

it('should handle an async iterator value', async () => {
    const output = (async function* () {
        yield { value: 1 };
        yield { value: 2 };
    })();

    const stream = new Stream();
    dynamicOutputToStream(output, stream);
    expect(stream.isClosed()).toEqual(false);
    expect(await stream.promiseItems()).toEqual([{value:1},{value:2}]);
});

it("declaredFunctionToHandler correctly finds the params", () => {
    const handler = declaredFunctionToHandler("$a $b c $task", () => {});

    expect(handler.getParamAttrs()).toEqual(['a','b','task']);
});

it("declaredFunctionToHandler should handle the implicit 'task' param", async () => {
    let calls = [];
    const handler = declaredFunctionToHandler("$a $b $task", (a,b,task) => {
        calls.push([a,b,task]);
    });
    
    const graph = new Graph();
    graph.exposeFunc("$a $b $task", (a,b,task) => {
        calls.push([a,b,task]);
    });

    const queryParameters = new Map();
    queryParameters.set('a',1);
    queryParameters.set('b',2);

    const result = graph.query("$a $b", queryParameters);

    expect(calls.length).toEqual(1);
    expect(calls[0][0]).toEqual(1);
    expect(calls[0][2].t).toEqual('task');
});
