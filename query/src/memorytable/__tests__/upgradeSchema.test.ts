
import { it, expect } from 'vitest'
import { compileSchema } from '../../table'

it.skip("supports upgrading the table schema", () => {
    const table = compileSchema({
        name: 'UpgradeSchemaTest',
        funcs: [
            'listAll','each','get(a)','upgradeSchema'
        ]
    }).createTable();

    table.insert({ a: 1, b: 2 });
    expect(table.get_with_a(1).b).toEqual(2);
    expect(table.supportsFunc('delete(a)')).toEqual(false);

    table.upgradeSchema({
        funcs: ['delete(a)']
    });

    expect(table.listAll()).toEqual([{ a: 1, b: 2 }]);
    expect(table.get_with_a(1).b).toEqual(2);

    table.insert({ a: 3, b: 4 });

    table.delete_with_a(1);
    expect(table.listAll()).toEqual([{ a: 3, b: 4 }]);
});
