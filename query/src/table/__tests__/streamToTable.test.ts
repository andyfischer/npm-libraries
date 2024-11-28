import { it, expect } from 'vitest'
import { compileSchema } from '..'
import { Stream, c_delta, c_item, c_schema } from '@andyfischer/streams'
import { streamToTable } from '../streamToTable'

it("streamToTable supports streaming data into a Table", () => {
    const table = compileSchema({
        name: 'StreamToTableTest',
        funcs: ['get(a)', 'listAll', 'listenToStream'],
    }).createTable();

    const input = new Stream();

    input.item({ a: 123 });
    input.item({ a: 456 });
    input.item({ a: 789 });
    input.done();

    streamToTable({ input, table })

    expect(table.listAll()).toEqual([
        { a: 123 },
        { a: 456 },
        { a: 789 },
    ]);
});

it("streamToTable isLoading=true during the open stream", () => {
    const table = compileSchema({
        name: 'StreamToTableTest',
        funcs: ['get(a)', 'listAll', 'listenToStream'],
    }).createTable();

    const input = new Stream();
    streamToTable({ input, table })

    expect(table.isLoading()).toEqual(true);

    input.item({ a: 123 });
    input.item({ a: 456 });
    input.item({ a: 789 });

    expect(table.isLoading()).toEqual(true);

    input.done();

    expect(table.isLoading()).toEqual(false);
});

it("streamToTable - reports an error if the destination doesn't support the incoming schema", () => {
    const table = compileSchema({
        name: 'StreamToTableTest',
        funcs: ['listAll', 'listenToStream'],
        disableGlobalErrors: true,
    }).createTable();

    const input = new Stream();
    streamToTable({ input, table });

    input.event({ t: c_schema, schema: { name: 'UpstreamSchema', funcs: ["delete(a)"] }});

    const error = table.status.get().error;
    expect(error.errorMessage).toEqual(
        "streamToTable Destination StreamToTableTest doesn't support upstream: Schema doesn't support: delete_with_a()"
    );
});

it.skip("streamToTable - uses upgradeSchema when available", () => {
    const table = compileSchema({
        name: 'StreamToTableTest',
        funcs: ['listAll', 'listenToStream', 'upgradeSchema'],
        disableGlobalErrors: true,
    }).createTable();

    console.log('test has created table:', table);

    const input = new Stream();
    streamToTable({ input, table });

    input.event({ t: c_schema, schema: { name: 'UpstreamSchema', funcs: ["delete(a)"] }});
    input.event({ t: c_item, item: { a: 1 }});
    input.event({ t: c_item, item: { a: 2 }});
    input.event({ t: c_delta, func: 'delete(a)', params: [1] });

    const error = table.status.get().error;
    expect(error).toBeFalsy();

    expect(table.listAll()).toEqual([{ a: 2 }]);
});

it("streamToTable - no error if the destination does support the incoming schema", () => {
    const table = compileSchema({
        name: 'StreamToTableTest',
        funcs: ['listAll', 'listenToStream', 'delete(a)'],
    }).createTable();

    const input = new Stream();
    streamToTable({ input, table });

    input.event({ t: c_schema, schema: { name: 'UpstreamSchema', funcs: ["delete(a)"] }});

    const error = table.status.get().error;
    expect(error).toBeFalsy();
});

it("streamToTable - afterUpdate is triggered after an update", () => {
    let calledAfterUpdate = false;

    const table = compileSchema({
        name: 'StreamToTableTest',
        funcs: ['get(a)', 'listAll', 'listenToStream'],
    }).createTable();

    const input = new Stream();
    streamToTable({
        input,
        table,
        afterUpdate() { calledAfterUpdate = true }
    });

    expect(calledAfterUpdate).toEqual(false);

    input.item({ a: 123 });
    input.item({ a: 456 });
    input.item({ a: 789 });

    expect(calledAfterUpdate).toEqual(true);
    calledAfterUpdate = false;

    input.done();

    expect(calledAfterUpdate).toEqual(true);
});
