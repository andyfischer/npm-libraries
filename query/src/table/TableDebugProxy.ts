
import { Schema } from '../schema/Schema';
import { Table } from './Table';

export function wrapTableInDebugProxy(table: Table) {
    return new Proxy(table, {
        get(target, methodOrAttributeName) {

            const found = target[methodOrAttributeName as string];
            if (found) {
                return target[methodOrAttributeName as string];
            }

            // ignore some common attributes that get checked for
            if (methodOrAttributeName === 'then' || methodOrAttributeName === 'catch')
                return undefined;

            if (methodOrAttributeName === '_unproxy')
                return table;

            // error case
            const schema: Schema = table.schema;
            if (methodOrAttributeName === 'listen') {
                throw new Error(
                    `Schema ${schema.name} doesn't support .listen() (fix: add 'listen' to funcs)`);
            }

            throw new Error(`${schema.name} table doesn't support: ${String(methodOrAttributeName)}()`);
        }
    });
}
