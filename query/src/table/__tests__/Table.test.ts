
import { it, expect } from 'vitest'
import { compileSchema } from '..'
import { Stream, c_item, c_restart, c_schema, recordUnhandledError } from '@andyfischer/streams'

it("table3 supports read & write by a single attr", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['get(a)'],
    })

    const table = schema.createTable();

    table.insert({ a: 1, value: 'first' });
    table.insert({ a: 2, value: 'second' });

    const found = table.get_with_a(1);

    expect(found).toEqual({ a: 1, value: 'first' });
});

it("table3 supports listing by a single attr", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['list(a)'],
    })

    const table = schema.createTable();

    table.insert({ a: 1, value: 'x' });
    table.insert({ a: 1, value: 'y' });
    table.insert({ a: 2, value: 'z' });

    expect(table.list_with_a(1)).toEqual([{ a: 1, value: 'x' },{ a: 1, value: 'y'}]);
    expect(table.list_with_a(2)).toEqual([{ a: 2, value: 'z' }]);
});


it("table3 supports multiple accessing indexes", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a','b'],
        funcs: ['get(a)','get(b)'],
    })

    const table = schema.createTable();

    table.insert({ a: 1, b: 10, value: 'first' });
    table.insert({ a: 2, b: 11, value: 'second' });

    expect(table.get_with_a(1)).toEqual({ a: 1, b: 10, value: 'first' });
    expect(table.get_with_b(11)).toEqual({ a: 2, b: 11, value: 'second' });
})

it("table3 supports auto increment attrs", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['id auto','a'],
        funcs: ['get(id)','get(a)'],
    })

    const table = schema.createTable();

    table.insert({ a: 100, value: 'first' });
    table.insert({ a: 200, value: 'second' });

    expect(table.get_with_a(100)).toEqual({ a: 100, value: 'first', id: 1 })
    expect(table.get_with_id(2)).toEqual({ a: 200, value: 'second', id: 2 })
});

it("table3 supports item listening", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['id auto'],
        funcs: ['listen'],
    }).createTable();

    const stream = table.listen();

    expect(stream.takeBacklog()).toEqual([
        { t: c_schema, schema: {name: 'Test/listener', funcs: []} },
        { t: c_restart },
    ]);

    table.insert({ a: 123 })

    expect(stream.takeBacklog()).toEqual([
        { t: c_item, item: { a: 123, id: 1 } },
    ]);
});

it("table3 supports single value usage", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['id auto'],
        funcs: ['get'],
    }).createTable();

    table.set({a: 1});

    expect(table.get()).toEqual({a: 1});
});

it("table3 supports count - map index", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['id auto'],
        funcs: ['get(id)','count'],
    }).createTable();

    expect(table.count()).toEqual(0);
    table.insert({});
    expect(table.count()).toEqual(1);
    table.insert({});
    expect(table.count()).toEqual(2);
});

it("table3 supports count - multimap index", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['id auto'],
        funcs: ['list(id)','count'],
    }).createTable();

    expect(table.count()).toEqual(0);
    table.insert({});
    expect(table.count()).toEqual(1);
    table.insert({});
    expect(table.count()).toEqual(2);
});
