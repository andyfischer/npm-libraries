
import { it, expect } from 'vitest'
import { compileSchema } from '..'

it("supports an .initialize function", () => {
    const table = compileSchema({
        name: 'Test',
        funcs: [
            'get(a)',
        ],
        initialize(table) {
            table.insert({ a: 1, b: 1 });
            table.insert({ a: 2, b: 2 });
        }
    }).createTable();

    expect(table.get_with_a(1).b).toEqual(1);
    expect(table.get_with_a(2).b).toEqual(2);
});
