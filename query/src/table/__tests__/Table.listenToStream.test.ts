import { it, expect } from 'vitest'
import { compileSchema } from '..'
import { Stream } from '@andyfischer/streams'

it("listenToStream should populate the table's contents from a stream", () => {
    const table = compileSchema({
        name: 'listenToStream test',
        funcs: [
            'listAll',
            'listenToStream',
        ]
    }).createTable();

    const stream = new Stream();

    table.listenToStream(stream);

    expect(table.listAll()).toEqual([]);

    stream.item({ a: 1 })

    expect(table.listAll()).toEqual([{a: 1}]);

    stream.item({ a: 2 })

    expect(table.listAll()).toEqual([{a: 1},{a: 2}]);

    stream.restart();

    expect(table.listAll()).toEqual([]);

    stream.item({ a: 3 })

    expect(table.listAll()).toEqual([{a: 3}]);
});

it("listenToStream should trigger callback like afterDone", () => {
    let callbackCalled = false;
    const afterDoneCallback = () => {
        callbackCalled = true;
    };

    const table = compileSchema({
        name: 'listenToStream test',
        funcs: [
            'listAll',
            'listenToStream',
        ]
    }).createTable();

    const stream = new Stream();

    table.listenToStream(stream, { afterDone: afterDoneCallback });

    expect(callbackCalled).toBe(false);

    stream.item({ a: 1 });
    stream.item({ a: 2 });
    stream.restart();
    stream.item({ a: 3 });

    stream.done();

    expect(callbackCalled).toBe(true);
});
