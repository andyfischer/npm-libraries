import { MultiMap } from "../utils/MultiMap";
import { IndexSchema } from "../table/IndexSchema";
import { ItemEqualityFn } from "../table/IndexUtils";
import { TableIndexType } from "../table/Table";
import { TableIndex } from "../table/TableIndex";
import { Item } from "../table";

export class MultiMapIndex<ItemType = Item> implements TableIndex {
    items = new MultiMap<any, ItemType>();
    schema: IndexSchema;
    indexType: TableIndexType = 'map';

    constructor(schema: IndexSchema) {
        this.schema = schema;
    }

    insert(item: ItemType): void {
        const indexKey = this.schema.getIndexKeyForItem(item);
        this.items.add(indexKey, item);
    }

    getWithIndexKey(indexKey: any) {
        const found = this.items.get(indexKey);
        if (!found)
            return null;
        return found[0];
    }
    getListWithIndexKey(indexKey: any): ItemType[] {
        return this.items.get(indexKey);
    }
    hasIndexKey(indexKey: any): boolean {
        return this.items.has(indexKey);
    }
    getAllAsList(): any[] {
        return Array.from(this.items.values());
    }
    getAsValue() {
        return Array.from(this.items.values());
    }
    *iterateWithIndexKey(indexKey: any): IterableIterator<any> {
        yield* this.items.get(indexKey)
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
    deleteItem(indexKey, isEqual: ItemEqualityFn): void {
        this.items.filterItemsOnKey(indexKey, existingItem => {
            return !isEqual(existingItem);
        });
    }
    updateItemChangedIndexKey(item: ItemType, isEqual: ItemEqualityFn, oldIndex: any, newIndex: any): void {
        this.items.filterItemsOnKey(oldIndex, existingItem => {
            return isEqual(existingItem);
        });

        this.items.add(newIndex, item);
    }
    getCount(): number {
        return this.items.valueCount()
    }
    updateAll(updateCallbackFn: (item: ItemType) => any): void {
        let needToAdd: any[] = [];

        for (const key of this.items.keys()) {
            this.items.mapItemsOnKey(key, existingItem => {
                const newItem = updateCallbackFn(existingItem);
                const newKey = this.schema.getIndexKeyForItem(newItem);
                if (newKey === key) {
                    return newItem;
                } else {
                    needToAdd.push([newKey, newItem]);
                    return null;
                }
            });
        }

        for (const [newKey, newItem] of needToAdd) {
            this.items.add(newKey, newItem);
        }
    }
    updateWithIndexKey(indexKey: any, updateCallbackFn: (item: ItemType) => ItemType): void {
        this.items.mapItemsOnKey(indexKey, updateCallbackFn);
    }

    replaceItemUsingRefEquality(indexKey: any, oldItem: ItemType, newItem: ItemType): void {
        this.items.mapItemsOnKey(indexKey, foundItem => {
            if (foundItem === oldItem)
                return newItem;
            else
                return foundItem;
        });
    }

    deleteItemUsingRefEquality(indexKey: any, item: ItemType): void {
        this.items.filterItemsOnKey(indexKey, foundItem => {
            return foundItem != item;
        });
    }
}