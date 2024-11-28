
import { compileSchema } from '..';
import { it, expect } from 'vitest'

it("table supports group_by", () => {
    const table = compileSchema({
        name: 'Test',
        funcs: ['group_by(group)'],
    }).createTable();

    table.insert({ group: 'first', id: 1 })
    table.insert({ group: 'first', id: 2 })
    table.insert({ group: 'second', id: 3 })
    table.insert({ group: 'third', id: 4 })
    table.insert({ group: 'third', id: 5 })

    const groups = table.group_by_group();
    expect(groups).toEqual([
        [ 'first', [
            { group: 'first', id: 1 },
            { group: 'first', id: 2 },
        ]],
        [ 'second', [
            { group: 'second', id: 3 },
        ]],
        [ 'third', [
            { group: 'third', id: 4 },
            { group: 'third', id: 5 },
        ]],
    ]);
});