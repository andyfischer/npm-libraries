
import { it, expect } from 'vitest'
import { getIndexKeyForItem } from '../IndexUtils';

it("creates an index key for a single attr", () => {
  const item = { attr1: 'value1' };
  const attrs = ['attr1'];
  const indexKey = getIndexKeyForItem(attrs, item);
  expect(indexKey).toEqual('value1');
})

it("creates an index key for multiple attrs", () => {
  const item = { attr1: 'value1', attr2: 'value2' };
  const attrs = ['attr1', 'attr2'];
  const indexKey = getIndexKeyForItem(attrs, item);
  expect(indexKey).toEqual('value1/value2');
})

it("creates an index key for multiple attrs when there are slashes", () => {
    const item = { attr1: 'value1', attr2: 'value2/withSlash' };
    const attrs = ['attr1', 'attr2'];
    const indexKey = getIndexKeyForItem(attrs, item);
    expect(indexKey).toEqual('value1/value2\\/withSlash');
})