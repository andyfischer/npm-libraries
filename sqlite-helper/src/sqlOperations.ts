import { SqliteDatabase } from "./SqliteDatabase";
import { prepareInsertStatement, prepareUpdateStatement_v2 } from "./sqlStatementBuilders";

export function runUpsert(db: SqliteDatabase, tableName: string, where: Record<string,any>, row: Record<string,any>) {
    const update = prepareUpdateStatement_v2(tableName, where, row);

    // Try to update
    const changesMade = db.run(update.sql, update.values);

    if (changesMade.changes === 0) {
        // If no rows were updated, then insert.
        const insert = prepareInsertStatement(tableName, {
            ...where,
            ...row
        });

        db.run(insert.sql, insert.values);
    }
}