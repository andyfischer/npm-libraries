
import { Query } from '../../query';
import { it, expect } from 'vitest'
import { parseFileQueries } from '../parseFile'

it('parses a file with a single query', () => {
    const parsed = parseFileQueries('a b c');
    expect(parsed.length).toEqual(1);
    expect((parsed[0] as Query).tags[0].attr).toEqual('a');
    expect((parsed[0] as Query).tags[1].attr).toEqual('b');
    expect((parsed[0] as Query).tags[2].attr).toEqual('c');
});

it('parses a file with a single query across multiple lines', () => {
    const parsed = parseFileQueries(`
        include (
            a
            b
            c
        )
    `);

    expect(parsed.length).toEqual(1);
    expect((parsed as any)[0].tags[0].getValue().t).toEqual('query');
    expect((parsed as any)[0].tags[0].getValue().toQueryString()).toEqual('a b c');
});

it('parses a file with multiple queries (seperated by semicolons)', () => {
    const parsed = parseFileQueries(`
        a b c;
        d e f;
    `);

    expect(parsed.map((q:any) => q.toQueryString())).toEqual(['a b c', 'd e f']);
});

it('parses a file with multiple queries (seperated by newlines)', () => {
    const parsed = parseFileQueries(`
        a b c
        d e f
    `);

    expect(parsed.map((q:any) => q.toQueryString())).toEqual(['a b c', 'd e f']);
});

it('parses a file with multiline queries (using indentation)', () => {
    const parsed = parseFileQueries(`
        a
          b c
        d e
          f
    `);

    expect(parsed.map((q:any) => q.toQueryString())).toEqual(['a b c', 'd e f']);
});
it('parses another file with indentation', () => {
    const parsed = parseFileQueries(
        'deploy-settings\n' +
        ' project-name=proj\n' +
        ' dest-url=http://host\n' +
        '\n' +
        'include src\n' +
        'include package.json\n' +
        'include tsconfig.json\n'
    );

    expect(parsed.map((q:any) => q.toQueryString())).toEqual(
    [
        'deploy-settings project-name=proj dest-url=http://host',
        'include src',
        'include package.json',
        'include tsconfig.json'
      ])

});

it('ignores comment lines that start with #', () => {
    const parsed = parseFileQueries(
        '  # this is a comment\n' + 
        'deploy-settings\n' +
        ' dest-url=http://host\n'
    );

    expect(parsed.map((q:any) => q.toQueryString())).toEqual([
        'deploy-settings dest-url=http://host'
    ]);
});

it('ignores comment lines inside a nested query', () => {
    const parsed = parseFileQueries(
        'deploy-settings\n' +
        '  # this is a comment\n' + 
        ' dest-url=http://host\n'
    );

    expect(parsed.map((q:any) => q.toQueryString())).toEqual([
        'deploy-settings dest-url=http://host'
    ]);
});