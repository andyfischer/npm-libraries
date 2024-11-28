import { IndexSchema } from "../table/IndexSchema";
import { TableIndex } from "../table/TableIndex";
import { ItemEqualityFn } from "../table/IndexUtils";
import { Table, TableIndexType } from "../table/Table";
import { isObject } from "../utils/isObject";

export class MapIndex<ItemType = any> implements TableIndex {
    items = new Map<any, ItemType>();
    schema: IndexSchema;
    indexType: TableIndexType = 'map';

    constructor(schema: IndexSchema) {
        this.schema = schema;
    }

    insert(item: any): void {
        const indexKey = this.schema.getIndexKeyForItem(item);
        this.items.set(indexKey, item);
    }

    getWithIndexKey(indexKey: any) {
        return this.items.get(indexKey);
    }
    getListWithIndexKey(indexKey: any): any[] {
        return [ this.items.get(indexKey) ];
    }
    hasIndexKey(indexKey: any): boolean {
        return this.items.has(indexKey);
    }
    getAllAsList() {
        return Array.from(this.items.values());
    }
    getAsValue() {
        return Array.from(this.items.values());
    }

    *iterateWithIndexKey(indexKey: any): IterableIterator<any> {
        if (this.items.has(indexKey))
            yield this.items.get(indexKey);
    }

    *iterateAll(): IterableIterator<any> {
        yield* this.items.values();
    }
    deleteAll() {
        this.items.clear();
    }
    deleteAllWithIndexKey(indexKey: any): void {
        this.items.delete(indexKey);
    }
    deleteItem(item: any, matchesItem: ItemEqualityFn): void {
        const indexKey = this.schema.getIndexKeyForItem(item);
        const existing = this.items.get(indexKey);

        if (!existing)
            return;

        if (matchesItem(existing))
            this.items.delete(indexKey);
    }
    deleteItem2(indexKey: any, matchesItem: ItemEqualityFn): void {
        const existing = this.items.get(indexKey);

        if (!existing)
            return;

        if (matchesItem(existing))
            this.items.delete(indexKey);
    }
    updateItemChangedIndexKey(item: any, existingIndex: any, newIndex: any) {
        // not implemented?
    }

    getCount(): number {
        return this.items.size
    }

    updateAll(updateCallbackFn: (item: ItemType) => ItemType): void {
        for (const key of this.items.keys()) {
            const newItem = updateCallbackFn(this.items.get(key));

            if (!isObject(newItem)) {
                throw new Error("usage error: item must be an object");
            }

            const newKey = this.schema.getIndexKeyForItem(newItem);

            if (key === newKey) {
                this.items.set(key, newItem);
            } else {
                this.items.delete(key);
                this.items.set(newKey, newItem);
            }
        }
    }
    updateWithIndexKey(indexKey: any, updateCallbackFn: (item: ItemType) => ItemType): void {
        const found = this.items.get(indexKey);

        if (found) {
            const newItem = updateCallbackFn(found);

            if (!isObject(newItem)) {
                throw new Error("Usage error: item must be an object");
            }

            this.items.set(indexKey, updateCallbackFn(found));
        }
    }

    deleteItemWithStaleIndexKey(item: ItemType, existingIndexKey: any): void {

        console.log('MapIndex.deleteItemWithStaleIndexKey', item, { existingIndexKey });

        // Check 'existingIndexKey' to see if the stored item has the wrong index key.
        const existing = this.items.get(existingIndexKey);

        console.log('MapIndex.deleteItemWithStaleIndexKey', {existing});

        if (existing && this.schema.getIndexKeyForItem(existing) !== existingIndexKey) {
            this.items.delete(existingIndexKey);
        }
    }

    replaceItemUsingRefEquality(indexKey: any, oldItem: ItemType, newItem: ItemType): void {
        const found = this.items.get(indexKey);
        if (found === oldItem) {
            this.items.set(indexKey, newItem);
        }
    }

    deleteItemUsingRefEquality(indexKey: any, item: ItemType): void {
        const found = this.items.get(indexKey);
        if (found === item) {
            this.items.delete(indexKey);
        }
    }
}
