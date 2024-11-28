
import { it, expect } from 'vitest'
import { compileSchema } from '..'

it("supports has()", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['get(a)', 'has(a)'],
    }).createTable();

    expect(table.has_a(1)).toEqual(false)

    table.insert({ a: 1 })
    expect(table.has_a(1)).toEqual(true)
});

it("supports has() (multivalue index)", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['list(a)', 'has(a)'],
    }).createTable();

    expect(table.has_a(1)).toEqual(false)

    table.insert({ a: 1 })
    expect(table.has_a(1)).toEqual(true)

    table.checkInvariants();
});
