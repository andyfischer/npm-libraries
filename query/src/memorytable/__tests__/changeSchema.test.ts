
import { it, expect } from 'vitest'
import { compileSchema } from '../../schema/compileSchema';
import { changeSchema } from '../changeSchema';

it("changeSchema works", () => {
    const table = compileSchema({
        name: 'UpgradeSchemaTest',
        funcs: [
            'listAll','each','get(a)','upgradeSchema'
        ]
    }).createTable();

    const newSchema = compileSchema({
        funcs: ['delete(a)']
    });

    changeSchema(table, newSchema);
});