
import { it, expect } from 'vitest'
import { compileSchema } from '..'

it("supports replaceAll", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['list(a)', 'update', 'listAll', 'replaceAll'],
    }).createTable();

    table.insert({ a: 1 });
    table.insert({ a: 2 });

    expect(table.listAll()).toEqual([{a: 1}, {a: 2}]);

    table.replaceAll([{ a: 3 },{ a: 4 }]);
    expect(table.listAll()).toEqual([{a: 3}, {a: 4}]);
});
