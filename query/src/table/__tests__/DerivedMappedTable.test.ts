
import { it, expect } from 'vitest'
import { compileSchema } from '..'
import { createDerivedMappedTable } from '../../derivedtables/DerivedMappedTable'

it("correctly gives results for .each and .listAll", () => {
    const source = compileSchema({
        name: 'Source',
        funcs: [
            'listAll',
            'each',
        ]
    }).createTable();

    const derived = createDerivedMappedTable({
        source,
        schema: compileSchema({
            name: 'Derived',
            funcs: [
                'listAll',
                'each',
            ]
        }),
        mapper: item => ({ ...item, sum: item.a + item.b }),
    });

    expect(derived.listAll()).toEqual([]);
    expect(Array.from(derived.each())).toEqual([]);

    source.insert({ a: 1, b: 2 });

    expect(derived.listAll()).toEqual([{a: 1, b: 2, sum: 3}]);
    expect(Array.from(derived.each())).toEqual([{a: 1, b: 2, sum: 3}]);
});
