
import { it, expect } from 'vitest'
import { compileSchema } from '..'

it("table supports deleteItem", () => {
    const table = compileSchema({
        name: 'Test',
        funcs: ['get(a)','has(a)','listAll'],
    }).createTable();

    const item1 = table.insert({ a: 1 })
    const item2 = table.insert({ a: 2 })

    expect(table.has_a(1)).toEqual(true)
    expect(table.listAll()).toEqual([item1, item2])

    table.deleteItem(item1);
    
    expect(table.has_a(1)).toEqual(false)
    expect(table.listAll()).toEqual([item2])

    table.deleteItem(item2);
    expect(table.has_a(2)).toEqual(false)
    expect(table.listAll()).toEqual([])
})

it("deletion test on sample schema with list() attribute", () => {
    const table = compileSchema({
        name: 'MessageQueue',
        attrs: ['id(auto)', 'tabId','msg'],
        funcs: [
            'get(id)', // future: maybe don't require them to declare this?
            'list(tabId)',
            'listAll',
            'each',
        ]
    }).createTable();

    const item = table.insert({ a: 1 });

    table.deleteItem(item);
});