
import { it, expect } from 'vitest'
import { compileSchema } from '..'

it("can get items using an index with multiple attrs", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a','b','c'],
        funcs: ['get(a b)'],
    });

    expect(schema.indexes.length).toEqual(1);
    expect(schema.indexes[0].name).toEqual('a,b')

    const table = schema.createTable();

    table.insert({ a: 1, b: 2, c: 3, details: 'first one' })
    table.insert({ a: 1, b: 3, c: 4, details: 'second one' })
    table.insert({ a: 2, b: 3, c: 3, details: 'third one' });

    expect(table.get_with_a_b(1, 2).details).toEqual('first one')
});

it("can list items using an index with multiple attrs", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a','b','c'],
        funcs: ['list(a b)','list(b c)'],
    });

    expect(schema.indexes.length).toEqual(2);
    expect(schema.indexes[0].name).toEqual('a,b')
    expect(schema.indexes[1].name).toEqual('b,c')

    const table = schema.createTable();

    table.insert({ a: 1, b: 2, c: 3, details: 'first one' })
    table.insert({ a: 1, b: 2, c: 4, details: 'second one' })
    table.insert({ a: 2, b: 2, c: 4, details: 'third one' });

    expect(table.list_with_a_b(1, 2).map(item => item.details)).toEqual(['first one', 'second one']);
    expect(table.list_with_b_c(2, 4).map(item => item.details)).toEqual(['second one', 'third one']);
});

it("can delete items from an index with multiple attrs", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a','b','c'],
        funcs: ['list(a b)','delete(a)','listAll'],
    });

    const table = schema.createTable();

    table.insert({ a: 1, b: 1, c: 1, details: 'first one' })
    table.insert({ a: 1, b: 2, c: 3, details: 'second one' })
    table.insert({ a: 2, b: 2, c: 2, details: 'third one' });

    table.delete_with_a(1);

    expect(table.listAll().map(item => item.details)).toEqual(['third one']);
});

it("can delete (with multi attr) items from an index with multiple attrs", () => {
    const schema = compileSchema({
        name: 'Test',
        attrs: ['a','b','c'],
        funcs: ['list(a b)','delete(b c)','listAll'],
    });

    const table = schema.createTable();

    table.insert({ a: 1, b: 2, c: 1, details: 'first one' })
    table.insert({ a: 1, b: 2, c: 3, details: 'second one' })
    table.insert({ a: 2, b: 2, c: 3, details: 'third one' });

    table.delete_with_b_c(2, 3);

    expect(table.listAll().map(item => item.details)).toEqual(['first one']);
});
