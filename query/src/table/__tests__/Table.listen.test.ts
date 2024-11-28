
import { it, expect } from 'vitest'
import { compileSchema } from '..'
import { c_delta, c_done, c_item, c_schema, c_restart } from '@andyfischer/streams'

it("should receive change events when the table is modified", () => {
    const table = compileSchema({
        name: 'listen test',
        funcs: [
            'listAll',
            'listen',
        ]
    }).createTable();

    table.insert({ a: 1 });

    const stream = table.listen();
    expect(stream.takeBacklog()).toEqual([
        { t: c_schema, schema: {name: 'listen test/listener', funcs: []} },
        { t: c_restart },
    ]);

    table.insert({ a: 2 });

    expect(stream.takeBacklog()).toEqual([
        { t: c_item, item: { a: 2 }}
    ]);
});

it("should receive the entire existing list of items when getInitialData=true", () => {
    const table = compileSchema({
        name: 'listen test',
        funcs: [
            'listAll',
            'listen',
        ]
    }).createTable();

    table.insert({ a: 1 });

    const stream = table.listen({getInitialData:true});
    expect(stream.takeBacklog()).toEqual([
        { t: c_schema, schema: {name: 'listen test/listener', funcs: []} },
        { t: c_item, item: { a: 1 }},
        { t: c_restart },
    ]);

    table.insert({ a: 2 });

    expect(stream.takeBacklog()).toEqual([{ t: c_item, item: { a: 2 }}]);
});

it("can synchronize two tables", () => {
    const sourceTable = compileSchema({
        name: 'source table',
        funcs: [
            'listAll',
            'listen',
            'get(a)',
            'delete(a)',
        ]
    }).createTable();

    const mirrorTable = compileSchema({
        name: 'mirror table',
        funcs: [
            'listenToStream',
            'listAll',
            'delete(a)',
        ]
    }).createTable();

    const stream = sourceTable.listen();
    mirrorTable.listenToStream(stream);

    sourceTable.insert({ a: 1 });
    sourceTable.insert({ a: 2 });

    expect(mirrorTable.listAll()).toEqual(sourceTable.listAll());

    sourceTable.delete_with_a(1);
    expect(mirrorTable.listAll()).toEqual(sourceTable.listAll());
});

it("uses the deletion index name if provided", () => {
    const sourceTable = compileSchema({
        name: 'source table',
        funcs: [
            'listAll',
            'listen',
            'get(a)',
            'delete(a)',
            'delete(b)',
        ]
    }).createTable();

    const stream = sourceTable.listen({deletionIndexName: 'b'});

    expect (stream.takeBacklog()).toEqual([
        {t: c_schema, schema: {name: 'source table/listener/b', funcs: [`delete(b)`]}},
        {t: c_restart}
    ]);

    sourceTable.insert({ a: 1, b: 2 });

    stream.takeBacklog();

    sourceTable.delete_with_a(1);

    expect (stream.takeBacklog()).toEqual([{
        t: c_delta,
        func: 'delete(b)',
        params: [2]
    }]);
});