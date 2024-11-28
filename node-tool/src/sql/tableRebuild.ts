
import { SqliteDatabase } from './SqliteDatabase'
import { DatabaseSchema } from './DatabaseSchema'
import { CreateTable, SqlStatement, parseSql, createTableWithReplacedTableName } from './parser'
import { randomHex } from '@andyfischer/streams'
import { captureError, ErrorDetails } from '@andyfischer/streams'

/*
 * Recreate a new table from scratch (using the schema) and migrate all existing rows over.
 *
 * This is required for some migrations in SQLite, such as dropping a column.
 */
export function performTableRebuild(db: SqliteDatabase, schema: DatabaseSchema, tableName: string) {

    db.info("Starting a table rebuild");

    // Based on: https://www.sqlite.org/lang_altertable.html#otheralter
    db.pragma('foreign_keys=OFF');

    const temporaryTableName = 'temp_' + tableName + '_' + randomHex(6);

    let parsedStatements: SqlStatement[] = [];
    let createTableSql: string;
    let createTable: CreateTable;

    for (const sql of schema.statements) {
        const parsed = parseSql(sql);

        parsedStatements.push(parsed);

        if (!createTable && parsed.t === 'create_table' && parsed.name === tableName) {
            createTable = parsed;
            createTableSql = sql;
        }
    }

    if (!createTable)
        throw new Error("couldn't find a 'create table' statement in the schame for: " + tableName);
    
    // Start transaction
    const perform = db.db.transaction(() => {
        // Delete all existing views & indexes related to the table
        for (const item of db.each('select type, name, sql FROM sqlite_schema where tbl_name = ?', tableName)) {
            if (item.type === 'table')
                continue;

            if (item.name.startsWith("sqlite_autoindex"))
                continue;

            console.log('TODO: Delete existing resource', item);
        }

        //
        // Create the new_xxx table
        const newTableSql = createTableWithReplacedTableName(createTableSql, temporaryTableName);
        db.run(newTableSql);

        // Copy all the rows over
        const allColumns = createTable.columns.map(column => column.name).join(', ');
        db.run(`INSERT INTO ${temporaryTableName} SELECT ${allColumns} FROM ${tableName};`);

        // Delete the old table
        db.run(`DROP TABLE ${tableName}`)
        
        // Rename the temp table
        db.run(`ALTER TABLE ${temporaryTableName} RENAME TO ${tableName}`);
        
        // Perform migration to recreate any indexes
        db.migrateToSchema(schema, { includeDestructive: false });
        
        db.pragma('foreign_key_check');
    });

    try {
        perform();
    } catch (e) {
        db.error({ errorMessage: "Tried a full migration but failed", cause: captureError(e)});
    }

    db.pragma('foreign_keys=ON');
    db.info("Finished a full migration");
}
