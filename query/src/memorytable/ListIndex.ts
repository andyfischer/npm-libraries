import { Item } from "../table";
import { IndexSchema } from "../table/IndexSchema";
import { Table, TableIndexType } from "../table/Table";
import { TableIndex } from "../table/TableIndex";

export class ListIndex<ItemType = Item> implements TableIndex {
    items: ItemType[] = [];
    schema: IndexSchema;
    indexType: TableIndexType = 'list';

    constructor(schema: IndexSchema) {
        this.schema = schema;
    }

    insert(item: ItemType): void {
        this.items.push(item);
    }

    getWithIndexKey(indexKey: any) {
        throw new Error("List index: does not support getWithIndexKey");
    }
    getListWithIndexKey(indexKey: any): any[] {
        throw new Error("List index: does not support getListWithIndexKey");
    }
    hasIndexKey(indexKey: any): boolean {
        throw new Error("List index: does not support hasIndexKey");
    }
    getAllAsList() {
        return this.items;
    }
    getAsValue() {
        return this.items;
    }
    iterateWithIndexKey(indexKey: any): IterableIterator<any> {
        throw new Error("List index: does not support iterateWithIndexKey");
    }
    *iterateAll(): IterableIterator<any> {
        yield* this.items;
    }
    deleteAll() {
        if (this.items.length > 0)
            this.items = [];
    }
    deleteItem(): void {
        throw new Error("List index: does not support deleteItem");
    }
    deleteExistingItemWithIndexKey(indexKey: any): void {
        throw new Error("List index: does not support deleteWithIndexKey");
    }
    deleteAllWithIndexKey(indexKey: any): void {
        throw new Error("List index: does not support deleteAllWithIndexKey");
    }
    updateItemChangedIndexKey(item: any, existingIndex: any, newIndex: any) {
        // Nothing to do
    }

    getCount(): number {
        return this.items.length;
    }
    updateAll(updateCallbackFn: (item: any) => any): void {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i] = updateCallbackFn(this.items[i]);
        }
    }
    updateWithIndexKey(indexKey: any, updateCallbackFn: (item: any) => any): void {
        throw new Error("List index: does not support updateWithIndexKey");
    }
    updateAfterItemChangedIndexKey(table: Table, item: any, oldKey: any, newKey: any): void {
        throw new Error("List index: does not support updateAfterItemChangedIndexKey");
    }
    deleteItemWithStaleIndexKey(item: ItemType, existingIndexKey: any): void {
        // Nothing to do
    }
    replaceItemUsingRefEquality(indexKey: any, oldItem: ItemType, newItem: ItemType): void {
        throw new Error("List index: does not support replaceItemWithRefEquality");
    }
    deleteItemUsingRefEquality(indexKey: any, item: ItemType): void {
        throw new Error("List index: does not support deleteItemUsingRefEquality");
    }
}