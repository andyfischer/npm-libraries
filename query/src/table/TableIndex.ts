import type { IndexSchema } from "./IndexSchema"
import { TableIndexType } from "./Table"

export interface TableIndex<ItemType = any> {
    schema: IndexSchema
    items?: any
    indexType: TableIndexType

    getWithIndexKey(indexKey: any): ItemType
    getListWithIndexKey(indexKey: any): ItemType[]
    hasIndexKey(indexKey: any): boolean
    getAllAsList(): ItemType[]
    getAsValue(): any
    iterateAll(): IterableIterator<ItemType>
    iterateWithIndexKey(indexKey: any): IterableIterator<ItemType>
    deleteAll(): void
    deleteAllWithIndexKey(indexKey: any): void
    deleteItem(indexKey: any, matchesItem: (existingItem: ItemType) => Boolean): void

    getCount(): number
    insert(item): void

    updateAll(updateCallbackFn: (item: ItemType) => ItemType): void
    updateWithIndexKey(indexKey: any, updateCallbackFn: (item: ItemType) => ItemType): void

    // Look for 'oldItem' and if found, replace the object with 'newItem', using
    // reference based equality. This is used during an update, when the update
    // has created a new object.
    replaceItemUsingRefEquality(indexKey: any, oldItem: ItemType, newItem: ItemType): void

    // Look for 'oldItem' and if found, delete it. Used during updates in case
    // the indexed key has changed.
    deleteItemUsingRefEquality(oldIndexKey: any, item: ItemType): void
}