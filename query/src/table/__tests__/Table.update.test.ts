
import { it, expect } from 'vitest'
import { compileSchema } from '..'
import { checkInvariantsOnTable } from '../checkInvariants'

it("supports update on a single value table", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['get', 'update'],
    }).createTable();

    table.set(1);
    table.update(item => item + 1)

    expect(table.get()).toEqual(2);
});

it("supports update on a list table", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['listAll', 'update'],
    }).createTable();

    table.insert(1);
    table.insert(2);
    table.insert(3);
    table.update(item => item + 1)

    expect(table.listAll()).toEqual([2,3,4]);
    checkInvariantsOnTable(table);
});

it("supports update on a map table", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['get(a)', 'listAll', 'update'],
    }).createTable();

    table.insert({a:1});
    table.insert({a:2});
    table.insert({a:3});

    table.update(item => {
        if (item.a === 2)
            item.a = 4;
    });

    expect(table.listAll()).toEqual([{ a: 1 }, { a: 3 }, { a: 4 }]);
    checkInvariantsOnTable(table);
});


it("supports update on a specific attr", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['a'],
        funcs: ['listAll', 'update(a)'],
    }).createTable();

    table.insert({ a: 1, count: 0 });
    table.insert({ a: 2, count: 0 });

    table.update_with_a(1, item => { item.count = item.count + 1});

    expect(table.listAll()).toEqual([
        {a: 1, count: 1},
        {a: 2, count: 0},
    ]);

    table.update_with_a(2, item => { item.count += 3 });

    expect(table.listAll()).toEqual([
        {a: 1, count: 1},
        {a: 2, count: 3},
    ]);
});

it("supports update on an alternate index", () => {
    const table = compileSchema({
        name: 'Test',
        attrs: ['id auto'],
        funcs: [
            'get(id)',
            'get(alt)',
            'update(id)',
            'update(alt)',
        ]
    }).createTable();

    table.insert({ alt: 'alt1' });
    table.insert({ alt: 'alt2' });
    table.insert({ alt: 'alt3' });

    expect(table.get_with_alt('alt1')).toEqual({ id: 1, alt: 'alt1' });
    expect(table.get_with_alt('alt2')).toEqual({ id: 2, alt: 'alt2' });

    table.update_with_alt('alt2', item => {
        item.updated = 'update 1';
    });

    expect(table.get_with_alt('alt2')).toEqual({ id: 2, alt: 'alt2', updated: 'update 1' });
    checkInvariantsOnTable(table);
});

for (const updateMethod of ['update in place', 'update with new value']) {
    it(`update can change the indexed value on the target index (map index) (${updateMethod})`, () => {
        const table = compileSchema({
            name: 'Test',
            attrs: ['id auto'],
            funcs: [
                'get(id)',
                'get(alt)',
                'update(id)',
                'update(alt)',
                'listAll',
            ]
        }).createTable();
    
        table.insert({ alt: 'alt1', item: 1 });
        table.insert({ alt: 'alt2', item: 2 });
        table.insert({ alt: 'alt3', item: 3 });
    
        expect(table.get_with_id(1).item).toEqual(1);
        expect(table.get_with_alt('alt1').item).toEqual(1);
    
        table.update_with_id(2, item => {
            if (updateMethod === 'update in place') {
                item.id = 4;
            } else {
                return {
                    ...item,
                    id: 4,
                }
            }
        });
    
        expect(table.listAll()).toEqual([
            { id: 1, alt: 'alt1', item: 1 },
            { id: 3, alt: 'alt3', item: 3 },
            { id: 4, alt: 'alt2', item: 2 },
        ]);
    
        expect(table.get_with_id(2)).toBeFalsy();
        expect(table.get_with_id(4).item).toEqual(2);
        checkInvariantsOnTable(table);
    });
}

for (const updateMethod of ['update in place', 'update with new value']) {
    it(`update can change the indexed value on the target index (multimap index) (${updateMethod})`, () => {
        const table = compileSchema({
            name: 'Test',
            funcs: [
                'list(group)',
                'update(group)',
                'listAll',
            ]
        }).createTable();

        table.insert({ group: 'a', item: 1 });
        table.insert({ group: 'a', item: 2 });
        table.insert({ group: 'b', item: 3 });

        table.update_with_group('a', item => {
            if (item.item === 2) {
                if (updateMethod === 'update in place') {
                    item.updated = true;
                    item.group = 'c'
                } else {
                    return { ...item, updated: true, group: 'c' }
                }
            }
        });

        expect(table.listAll()).toEqual([
            { group: 'a', item: 1 },
            { group: 'b', item: 3 },
            { group: 'c', updated: true, item: 2 },
        ]);

        expect(table.list_with_group('a')).toEqual([{ group: 'a', item: 1 }]);
        expect(table.list_with_group('b')).toEqual([{ group: 'b', item: 3 }]);
        expect(table.list_with_group('c')).toEqual([{ group: 'c', updated: true, item: 2 }]);
        checkInvariantsOnTable(table);
    });
}

for (const updateMethod of ['update in place', 'update with new value']) {
    it(`update can change the indexed value on affected indexes (${updateMethod})`, () => {
        const table = compileSchema({
            name: 'Test',
            funcs: [
                'get(id)',
                'update(id)',
                'list(group)',
                'update(group)',
                'get(altId)',
                'listAll',
            ]
        }).createTable();

        table.insert({ id: 1, group: 'a', altId: 'x', });
        table.insert({ id: 2, group: 'a', altId: 'y', });
        table.insert({ id: 3, group: 'b', altId: 'z', });

        // Change the group of item 1.
        table.update_with_id(1, item => {
            if (updateMethod === 'update in place') {
                item.group = 'c';
            } else {
                return { ...item, group: 'c' }
            }
        });

        expect(table.listAll()).toEqual([
            { id: 1, group: 'c', altId: 'x' },
            { id: 2, group: 'a', altId: 'y' },
            { id: 3, group: 'b', altId: 'z' },
        ]);

        expect(table.list_with_group('a')).toEqual([ { id: 2, group: 'a', altId: 'y' } ]);
        expect(table.list_with_group('b')).toEqual([ { id: 3, group: 'b', altId: 'z' } ]);
        expect(table.list_with_group('c')).toEqual([ { id: 1, group: 'c', altId: 'x' } ]);

        // Change the altId of item 2.
        table.update_with_id(2, item => {
            if (updateMethod === 'update in place') {
                item.altId = 'w';
            } else {
                return { ...item, altId: 'w' }
            }
        });

        expect(table.listAll()).toEqual([
            { id: 1, group: 'c', altId: 'x' },
            { id: 2, group: 'a', altId: 'w' },
            { id: 3, group: 'b', altId: 'z' },
        ]);

        expect(table.get_with_altId('x')).toEqual({ id: 1, group: 'c', altId: 'x' });
        expect(table.get_with_altId('y')).toBeFalsy();
        expect(table.get_with_altId('z')).toEqual({ id: 3, group: 'b', altId: 'z' });
        expect(table.get_with_altId('w')).toEqual({ id: 2, group: 'a', altId: 'w' });

        checkInvariantsOnTable(table);
    });
}
