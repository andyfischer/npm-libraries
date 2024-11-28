
import { it } from 'vitest'
import { compileSchema } from '../../table'

it("creates callback functions using the original declared function name", () => {
    const table = compileSchema({
        name: 'CreateMemoryTableTest',
        funcs: [
            'get(a)',
            'delete(a)',
        ]
    }).createTable();

    table.assertSupport('get(a)');
    table.assertSupport('delete(a)');
});