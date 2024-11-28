import { compileSchema } from '..'
import { diffTables, DiffItem } from '../diff';
import { it, expect } from 'vitest'

const exampleSchema = compileSchema({
      name: 'test',
      funcs: [
          'each',
          'get(id)',
          'diff',
      ]
  });



  it('should return empty diff when comparing the same table', () => {
      const originalTable = exampleSchema.createTable();
  originalTable.insert({ id: 1, name: 'John' });
  originalTable.insert({ id: 2, name: 'Jane' });
  originalTable.insert({ id: 3, name: 'Bob' });

    const compareTable = exampleSchema.createTable();
  compareTable.insert({ id: 1, name: 'John' });
  compareTable.insert({ id: 2, name: 'Jane' });
  compareTable.insert({ id: 3, name: 'Bob' });

    const diff = diffTables(originalTable, compareTable);

    expect(Array.from(diff)).toEqual([]);
  });

  it('should return diff with deleted item', () => {
      const originalTable = exampleSchema.createTable();
  originalTable.insert({ id: 1, name: 'John' });
  originalTable.insert({ id: 2, name: 'Jane' });
  originalTable.insert({ id: 3, name: 'Bob' });

    const compareTable = exampleSchema.createTable();
  compareTable.insert({ id: 2, name: 'Jane' });
  compareTable.insert({ id: 3, name: 'Bob' });

    const expectedDiff: DiffItem[] = [{ t: 'delete', key: 1, item: { id: 1, name: 'John' } }];

    const diff = diffTables(originalTable, compareTable);

    expect(Array.from(diff)).toEqual(expectedDiff);
  });

  it('should return diff with put item', () => {
    const originalTable = exampleSchema.createTable();
    originalTable.insert({ id: 1, name: 'John' });
    originalTable.insert({ id: 2, name: 'Jane' });
    originalTable.insert({ id: 3, name: 'Bob' });

    const compareTable = exampleSchema.createTable();
    compareTable.insert({ id: 1, name: 'John' });
    compareTable.insert({ id: 2, name: 'Jane' });
    compareTable.insert({ id: 3, name: 'Bob' });
    compareTable.insert({ id: 4, name: 'Alice' });

    const expectedDiff: DiffItem[] = [{ t: 'put', key: 4, item: { id: 4, name: 'Alice' } }];

    const diff = diffTables(originalTable, compareTable);

    expect(Array.from(diff)).toEqual(expectedDiff);
  });

  it('should return diff with put and deleted items', () => {
    const originalTable = exampleSchema.createTable();
    originalTable.insert({ id: 1, name: 'John' });
    originalTable.insert({ id: 2, name: 'Bob' });

    const compareTable = exampleSchema.createTable();
    compareTable.insert({ id: 2, name: 'Bob' });
    compareTable.insert({ id: 3, name: 'Alice' });
    const expectedDiff: DiffItem[] = [
      { t: 'delete', key: 1, item: { id: 1, name: 'John' } },
      { t: 'put', key: 3, item: { id: 3, name: 'Alice' } },
    ];

    const diff = diffTables(originalTable, compareTable);

    expect(Array.from(diff)).toEqual(expectedDiff);
  });
