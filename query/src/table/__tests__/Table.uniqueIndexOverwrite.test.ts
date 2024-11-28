
import { it, expect } from 'vitest'
import { compileSchema } from '..';

it("supports unique index with overwrite", () => {
    const table = compileSchema({
        name: 'unique index test',
        attrs: [
            'uniqueKey unique(overwrite)',
        ],
        funcs: [
            'listAll',
        ]
    }).createTable();

    table.insert({ uniqueKey: 'a', index: 1 });

    expect(table.listAll()).toEqual([{ uniqueKey: 'a', index: 1 }]);

    table.insert({ uniqueKey: 'a', index: 2 });

    expect(table.listAll()).toEqual([{ uniqueKey: 'a', index: 2 }]);
});

it("errors when combining a unique index on a list() func", () => {
    expect(() => {
        compileSchema({
            name: 'test',
            attrs: [
                'id unique',
            ],
            funcs: [
                'list(id)'
            ]
        });
    }).toThrowErrorMatchingInlineSnapshot(`[Error: Index conflict (on id): cannot require both single and multi value index]`);
});