import { IndexSchema } from "../table/IndexSchema";
import { Schema } from "../schema/Schema";
import { Table } from "../table/Table";
import { Item } from "../table";
import { isObject } from "../utils/isObject";

/*
  UpdatePlan

  Metadata about indexes when preparing to do an update.
*/
interface UpdatePlan {
    schema: Schema

    directUpdateIndex?: IndexSchema

    // affectedIndexes - The indexes that may need to be updated after the update is
    // performed. This happens when the update makes changes to indexed field(s) on
    // the item.
    affectedIndexes: IndexSchema[]
    
    resultMustBeObject: boolean
}

function getHintsForIndex(index: IndexSchema) {
    switch (index.indexType) {
        case 'map':
            return { mainIndexPriority: 0, allowAsRelatedUpdate: true }
        case 'multimap':
            return { mainIndexPriority: 1, allowAsRelatedUpdate: true }
        case 'list':
            return { mainIndexPriority: 2, allowAsRelatedUpdate: false }
        case 'single_value':
            return { mainIndexPriority: 0, allowAsRelatedUpdate: false }
        default:
            throw new Error('internal error: unrecognized index type: ' + index.indexType);
    }
}

function pickBestIndexForUpdateAll(schema: Schema): IndexSchema | null {
    let bestMainIndex: IndexSchema | undefined;
    let bestMainIndexPriority = -1;

    // Find the best choice as the main index
    for (const index of schema.indexes) {
        const hints = getHintsForIndex(index);

        if (hints.mainIndexPriority > bestMainIndexPriority) {
            bestMainIndex = index;
            bestMainIndexPriority = hints.mainIndexPriority;
        }
    }

    return bestMainIndex;
}

function getUpdatePlan(schema: Schema, updateType: 'update_all' | 'update_indexed'): UpdatePlan {

    let resultMustBeObject = false;
    let directUpdateIndex: IndexSchema | null;
    const affectedIndexes: IndexSchema[] = [];

    for (const index of schema.indexes) {

        if (index.indexType === 'list' || index.indexType === 'single_value') {
            // 'list' and 'single_value' indexes need direct updates.
            if (directUpdateIndex) {
                throw new Error("Table config internal error: Two indexes need direct update");
            }

            if (updateType === 'update_indexed') {
                throw new Error("Table config internal error: cannot use indexed update on list or single_value indexes");
            }

            directUpdateIndex = index;
        } else {
            // 'map' and 'multimap' indexes are treated as 'affectedIndexes' and are updated differently.
            resultMustBeObject = true;
            affectedIndexes.push(index);
        }
    }

    return { schema, resultMustBeObject, directUpdateIndex, affectedIndexes };
}

function captureExistingIndexKeys(plan: UpdatePlan, item: Item) {
    if (plan.affectedIndexes.length === 0)
        return null;

    const existingIndexes = [];
    for (const index of plan.affectedIndexes) {

        existingIndexes.push(
            index.getIndexKeyForItem(item)
        )
    }

    return existingIndexes;
}

export function prepareIsEqualFunction(schema: Schema) {
    const primaryUniqueIndex = schema.indexesByName.get(schema.primaryUniqueAttr);

    return (a: Item, b: Item): Boolean => {
        return primaryUniqueIndex.getIndexKeyForItem(a) === primaryUniqueIndex.getIndexKeyForItem(b);
    }
}

function updateOneItem(plan: UpdatePlan, table: Table, item: Item, updateCallbackFn: (item: Item) => Item) {

    const oldIndexKeys = captureExistingIndexKeys(plan, item);

    // Perform the update
    let newItem = updateCallbackFn(item);
    if (newItem == null) {
        newItem = item;
    }

    if (newItem !== item && plan.resultMustBeObject && !isObject(newItem)) {
        throw new Error("Usage error: update callback should return an object, got: " + newItem);
    }

    // Update affected indexes
    for (let indexIndex = 0; indexIndex < plan.affectedIndexes.length; indexIndex++) {
        const indexSchema = plan.affectedIndexes[indexIndex];
        const index = table.indexes.get(indexSchema.name);

        const oldIndexKey = oldIndexKeys[indexIndex];
        const newIndexKey = indexSchema.getIndexKeyForItem(newItem);

        if (oldIndexKey === newIndexKey) {
            if (item !== newItem) {
                // A new item was created during the update. Replace the old item with the new one.
                index.replaceItemUsingRefEquality(newIndexKey, item, newItem);
            }
        } else {
            // The index key changed, remove the old entry and re-index the item.
            index.deleteItemUsingRefEquality(oldIndexKey, item);
            index.insert(newItem);
        }
    }

    return newItem;
}

export function prepareUpdateFunction(schema: Schema, targetIndex: IndexSchema, table: Table) {
    const plan = getUpdatePlan(schema, 'update_indexed');
    const index = table.indexes.get(targetIndex.name);

    return (...args) => {
        if (args.length != 2) 
            throw new Error("update: expected two args");

        const indexKey = args[0];
        const updateCallbackFn = args[1];
        // const mainIndex = table.indexes.get(plan.targetIndex.name);

        if (!indexKey) {
            throw new Error('update: expected a non-null index key');
        }

        if (typeof updateCallbackFn !== 'function')
            throw new Error("update: expected a function as the first arg");

        const found = index.getListWithIndexKey(indexKey);

        for (const item of found) {
            updateOneItem(plan, table, item, updateCallbackFn);
        }
    }
}

export function prepareUpdateAllFunction(schema: Schema, table: Table) {
    const targetIndex = pickBestIndexForUpdateAll(schema);
    if (!targetIndex) {
        throw new Error("prepare error: no index found to support updateAll");
    }

     const plan = getUpdatePlan(schema, 'update_all');

    return (...args) => {
        if (args.length > 1)
            throw new Error("updateAll: expected zero args");

        const mainIndex = table.indexes.get(targetIndex.name);
        const updateCallbackFn = args[0];

        if (typeof updateCallbackFn !== 'function')
            throw new Error("updateAll: expected a function as the first arg");

        if (plan.directUpdateIndex) {
            const index = table.indexes.get(plan.directUpdateIndex.name);
            index.updateAll(item => {
                return updateOneItem(plan, table, item, updateCallbackFn);
            });
        } else {
            for (const item of mainIndex.iterateAll()) {
                updateOneItem(plan, table, item, updateCallbackFn);
            }
        }
    }
}