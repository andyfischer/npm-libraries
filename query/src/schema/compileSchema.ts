import { toQueryNode, } from '../query/toQuery'
import { Table } from '../table/Table'
import { OnConflictOption, Schema, SchemaAttr, SchemaFunc, SchemaFuncParams } from './Schema'
import { Query } from '../query'
import { SchemaDecl } from './SchemaDecl'
import { IndexSchema } from '../table/IndexSchema'
import { queryToString } from '../query/queryToString'
import { SchemaCompilation } from './SchemaCompilation'


function parseAttrs(compilation: SchemaCompilation) {
    for (const attrDecl of compilation.decl.attrs || []) {
        let parsed = toQueryNode(attrDecl);

        parsed = parsed as Query;

        // first tag should be the attr name
        const attrTag = parsed.tags[0];
        const attrName = parsed.tags[0].attr;

        const attrInfo = new SchemaAttr(attrName);

        if (compilation.attrByStr.has(attrName))
            throw new Error("duplicate attr: " + attrName);

        if (attrTag.isQuery()) {
            for (const tag of (attrTag.value as Query).tags) {
                switch (tag.attr) {
                case 'auto':
                    attrInfo.isAuto = true;
                    break;
                default:
                    throw new Error(`unrecognized tag on attr "${attrName}": ${tag.attr}`);
                }
            }
        }

        for (const tag of parsed.tags.slice(1)) {
            switch (tag.attr) {
            case 'auto':
                attrInfo.isAuto = true;
                break;

            case 'unique': {
                let onConflict: OnConflictOption = 'error';

                if (tag.isQuery()) {
                    for (const subTag of (tag.value as Query).tags) {
                        switch (subTag.attr) {
                        case 'error':
                            onConflict = 'error';
                            break;
                        case 'overwrite':
                            onConflict = 'overwrite';
                            break;
                        default:
                            throw new Error(`unrecognized setting on 'unique' tag "${attrName}": ${subTag.attr}`);
                        }
                    }
                }

                compilation.addIndexDemand({ attrs: [attrName], requireSingleIndex: true });
                compilation.schema.constraints.push({ attrs: [attrName], onConflict });

                break;
            }

            default: 
                throw new Error(`unrecognized tag on attr "${attrName}": ${tag.attr}`);
            }
        }

        compilation.attrByStr.set(attrName, attrInfo);
        compilation.schema.attrs.push(attrInfo);
    }
}

export function compileSchema<ItemType = any>(decl: SchemaDecl): Schema<Table<ItemType>> {
    const compilation = new SchemaCompilation(decl);
    const schema = compilation.schema;

    // First step: parse the 'attrs' section
    parseAttrs(compilation);

    // Default functions that are always included.
    compilation.declareFunc({funcName: 'each'});
    compilation.declareFunc({funcName: 'insert'});
    compilation.declareFunc({funcName: 'preInsert'});

    const parsedFuncDecls: Query[] = [];

    for (const funcDecl of decl.funcs || []) {
        const funcDeclStr = queryToString(funcDecl);
        const parsed = toQueryNode(funcDecl) as Query;
        parsedFuncDecls.push(parsed);
        const parsedFuncName = parsed.tags[0].attr;
        
        // console.log(`parsed func decl (${funcDecl}):`, parsed)

        if (parsedFuncName === 'get' && parsed.tags[0].isQuery()) {
            // Single attr get
            const queryArgs = (parsed.tags[0].value as Query);
            const attrStrs = queryArgs.tags.map(tag => tag.attr);
            const { name: indexName } = compilation.addIndexDemand({ attrs: attrStrs, implySingleIndex: true });

            // get_with_x_y
            const publicName = 'get_with_' + (attrStrs.join('_'));
            compilation.declareFunc({ declaredName: funcDeclStr, funcName: 'getWithIndexKey', publicName, paramAttrs: attrStrs, indexName });

            // Automatically add a has() function when there is a get()
            compilation.demandFunction_has(null, attrStrs);
            continue;
        }

        if (parsedFuncName === 'get' && parsed.tags[0].value == null) {
            // Single value get
            
            compilation.declareFunc({ funcName: 'getSingleValue', publicName: 'get' });
            compilation.declareFunc({ funcName: 'setSingleValue', publicName: 'set' });
            const index = new IndexSchema(schema);
            index.indexType = 'single_value';
            schema.indexes.push(index)

            continue;
        }

        if (parsedFuncName === 'has') {
            const queryArgs = (parsed.tags[0].value as Query)
            const attrStrs = queryArgs.tags.map(tag => tag.attr);

            if (!queryArgs)
                throw new Error("has() requires a parameter")

            if (queryArgs.tags.length === 0)
                throw new Error("has() requires a parameter")

            compilation.demandFunction_has(funcDeclStr, attrStrs);
            continue;
        }

        if (parsedFuncName === 'list') {
            const queryArgs = (parsed.tags[0].value as Query)
            const attrStrs = queryArgs.tags.map(tag => tag.attr);
            const { name: indexName } = compilation.addIndexDemand({ attrs: attrStrs, requireMultiIndex: true });

            // list_with_x_y
            const publicName = 'list_with_' + (attrStrs.join('_'));
            compilation.declareFunc({ funcName: 'listWithIndexKey', declaredName: funcDeclStr, publicName, paramAttrs: attrStrs, indexName });
            continue;
        }

        if (parsedFuncName === 'listAll') {
            compilation.declareFunc({ funcName: 'listAll' });
            continue;
        }

        if (parsedFuncName === 'group_by') {
            const queryArgs = (parsed.tags[0].value as Query)
            const attrStrs = queryArgs.tags.map(tag => tag.attr);
            const { name: indexName } = compilation.addIndexDemand({ attrs: attrStrs, requireMultiIndex: true });
            const publicName = 'group_by_' + (attrStrs.join('_'));
            compilation.declareFunc({ funcName: 'group_by', declaredName: funcDeclStr, publicName, paramAttrs: attrStrs, indexName});
            continue;
        }

        if (parsedFuncName === 'upgradeSchema') {
            compilation.declareFunc({ funcName: 'upgradeSchema' });
            continue;
        };

        if (parsedFuncName === 'update') {
            let args: Query = null;

            if (parsed.tags[0] && parsed.tags[0].isQuery()) {
                args = (parsed.tags[0].value as Query)
            }

            if (!args) {
                compilation.declareFunc({ funcName: 'update' });
            } else if (args.tags.length === 1) {
                const attr = args.tags[0].attr;
                const { name: indexName } = compilation.addIndexDemand({ attrs: [attr] });
                const publicName = 'update_with_' + attr;
                compilation.declareFunc({ publicName, declaredName: funcDeclStr, funcName: 'updateWithIndexKey', paramAttrs: [attr], indexName });
            } else {
                throw new Error("unexpected: update() has more than one param");
            }
            continue;
        }

        if (parsedFuncName === 'each') {
            compilation.declareFunc({ funcName: 'each' });
            continue;
        }

        if (parsedFuncName === 'listen') {
            schema.supportsListening = true;
            compilation.declareFunc({ funcName: 'listen' });
            continue;
        }

        if (parsedFuncName === 'delete') {
            const queryArgs = (parsed.tags[0].value as Query);
            const attrStrs = queryArgs.tags.map(tag => tag.attr);
            const { name: indexName } = compilation.addIndexDemand({ attrs: attrStrs });

            // delete_with_x_y
            const publicName = 'delete_with_' + (attrStrs.join('_'));
            compilation.declareFunc({ publicName, declaredName: funcDeclStr, funcName: 'deleteWithIndexKey', paramAttrs: attrStrs, indexName });
            continue;
        }

        if (parsedFuncName === 'delete') {
            compilation.declareFunc({ funcName: 'deleteItem' });
            continue;
        }

        if (parsedFuncName === 'deleteAll') {
            compilation.declareFunc({ funcName: 'deleteAll' });
            continue;
        }

        if (parsedFuncName === 'replaceAll') {
            compilation.declareFunc({ funcName: 'replaceAll' });
            continue;
        }

        if (parsedFuncName === 'status') {
            schema.supportsUpdateEvents = true;
            continue;
        }

        if (parsedFuncName === 'receiveUpdate') {
            schema.supportsUpdateEvents = true;
            continue;
        }

        if (parsedFuncName === 'getStatus') {
            schema.supportsUpdateEvents = true;
            continue;
        }

        if (parsedFuncName === 'count') {
            compilation.declareFunc({ funcName: 'count' });
            continue;
        }

        if (parsedFuncName === 'diff') {
            compilation.declareFunc({ funcName: 'diff' });
            continue;
        }

        if (parsedFuncName === 'listenToStream') {
            schema.supportsUpdateEvents = true;
            compilation.declareFunc({ funcName: 'listenToStream' });
            continue;
        }

        if (parsedFuncName === 'first') {
            compilation.declareFunc({ funcName: 'first' });
            continue;
        }

        throw new Error("compileSchema: unrecognized func: " + parsed.tags[0].attr);
    }

    if (schema.supportsUpdateEvents) {
        compilation.declareFunc({ funcName: 'getStatus' });
        compilation.declareFunc({ funcName: 'receiveUpdate' });
        compilation.declareFunc({ funcName: 'deleteAll' });
    }

    // Create indexes for indexesNeeded
    for (const [ name, indexInfo ] of compilation.indexesNeeded.entries()) {
        const index = new IndexSchema(schema);
        index.name = name;

        if (indexInfo.requireMultiIndex) {
            index.indexType = 'multimap';
        } else if (indexInfo.implySingleIndex || indexInfo.requireSingleIndex) {
            index.indexType = 'map';
        } else {
            index.indexType = 'multimap';
        }
        index.attrs = indexInfo.attrs;
        schema.addIndex(index);
    }

    // maybe add init_listener_streams
    if (schema.supportsListening) {
        schema.setupTable.push({ t: 'init_listener_streams' });
    }

    // any attrs with isAuto need an PreInsertStep
    for (const attr of schema.attrs) {
        if (attr.isAuto) {
            schema.setupTable.push({t: 'init_table_auto_attr', attr: attr.attr });
            schema.preInsert.push({t: 'init_auto_attr', attr: attr.attr});
        }
    }

    // if we didn't find any indexes, create a ListIndex
    if (schema.indexes.length == 0) {
        const index = new IndexSchema(schema);
        index.indexType = 'list';
        schema.addIndex(index)
    }

    // Figure out the primary unique index
    for (const index of schema.indexes) {
        if (index.indexType === 'map' && index.attrs.length === 1) {
            schema.primaryUniqueIndex = index;
            break;
        }
    }

    // Add some functions that rely on having a primary unique index
    if (schema.primaryUniqueIndex) {
        schema.primaryUniqueAttr = schema.primaryUniqueIndex.attrs[0];

        compilation.declareFunc({funcName: 'itemEquals'});
        compilation.declareFunc({funcName: 'item_to_uniqueKey'});
        compilation.declareFunc({funcName: 'item_matches_uniqueKey'});
        compilation.declareFunc({funcName: 'get_using_uniqueKey'});
        compilation.declareFunc({funcName: 'delete_using_uniqueKey'});
        compilation.declareFunc({funcName: 'deleteItem'});
    }

    // Figure out the default index
    if (schema.primaryUniqueIndex) {
        schema.defaultIndex = schema.primaryUniqueIndex;
    } else {
        for (const index of schema.indexes) {
            schema.defaultIndex = index;
            break;
        }
    }

    // Other callbacks
    if (decl.initialize) {
        schema.setupTable.push({ t: 'run_initializer', initialize: decl.initialize });
    }
    
    // Final validation
    for (const parsed of parsedFuncDecls) {
        const parsedFuncName = parsed.tags[0].attr;

        if (parsedFuncName === "delete" && !schema.primaryUniqueIndex && schema.supportsListening) {
            throw new Error("Validation error: cannot support both listen() and delete() unless there is a primary unique index");
        }
    }

    return schema;
}
