
import { it } from 'vitest'
import { compileSchema } from '..'

it("bug with each() and empty item", () => {
    const DebugOptions = compileSchema({
        name: 'DebugOptions',
        funcs: [
            'listAll',
            'get(name)',
            'has(name)',
            'update(name)',
            'delete(name)',
            'each',
        ],
    }).createTable()

    DebugOptions.checkInvariants();
});
