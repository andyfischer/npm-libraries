
import { CreateTable, parseSql } from './parser'
import { SqliteDatabase } from './SqliteDatabase'
import { DatabaseSchema } from './DatabaseSchema'

interface Migration {
    statements: MigrationStatement[]
    warnings: string[]
}

interface MigrationStatement {
    sql: string
    isDestructive: boolean
}

export interface MigrationOptions {
    includeDestructive?: boolean
}

function parseCreateTable(input: CreateTable | string): CreateTable {
    if (typeof input === 'string') {
        const parsed = parseSql(input);
        if (parsed.t !== 'create_table')
            throw new Error("expected a 'create table' statement");

        return parsed;
    }

    return input;
}

export function getGeneratedMigration(fromTableLoose: CreateTable | string, toTableLoose: CreateTable | string): Migration {
    const needToInsert = [];
    const needToDelete = [];
    const needToModify = [];
    const warnings: string[] = [];

    const fromTable = parseCreateTable(fromTableLoose);
    const toTable = parseCreateTable(toTableLoose);

    function findColumn(table: CreateTable, name: string) {
        for (const column of table.columns)
            if (column.name === name)
                return column;
        return null;
    }

    for (const fromColumn of fromTable.columns) {
        const toColumn = findColumn(toTable, fromColumn.name);

        if (!toColumn) {
            needToDelete.push(fromColumn);
            continue;
        }

        if (fromColumn.definition !== toColumn.definition) {

            if (fromColumn.definition.replace('not null', '').trim() ===
                toColumn.definition.replace('not null', '').trim()) {
                warnings.push("can't add/remove a 'not null' constraint");
                continue;
            }

            // needToModify.push(toColumn);
            warnings.push(`not supported: column modification (${toColumn.name} from "${fromColumn.definition}" to "${toColumn.definition}")`);
            continue;
        }
    }

    for (const toColumn of toTable.columns) {
        const fromColumn = findColumn(fromTable, toColumn.name);
        if (!fromColumn)
            needToInsert.push(toColumn);
    }

    const statements: MigrationStatement[] = [];

    for (const column of needToInsert) {
        let def = column.definition;
        if (def.toLowerCase().indexOf("not null") !== -1) {
            warnings.push(`Latest schema for table '${fromTable.name}' requires a rebuild: Need to alter column ${column.name} to use 'not null'`);
            def = def.replace(/not null ?/i, '');
        }

        statements.push({
            sql: `alter table ${fromTable.name} add column ${column.name} ${def};`,
            isDestructive: false
        });
    }

    for (const column of needToDelete) {
        warnings.push(`Latest schema for table '${fromTable.name}' requires a rebuild: Need to delete column '${column.name}'`);
    }

    return {
        statements,
        warnings,
    };
}

export async function runDatabaseSloppynessCheck(db: SqliteDatabase, schema: DatabaseSchema) {
    const schemaTables = new Map();

    for (const statementText of schema.statements) {
        const statement = parseSql(statementText);

        switch (statement.t) {
        case 'create_table':
            schemaTables.set(statement.name, statement);
            break;
        case 'create_index':
            schemaTables.set(statement.index_name, statement);
            break;
        }
    }

    // Sloppyness check - Look for extra tables
    for (const { name: foundTableName } of db.list(`select name from sqlite_schema`)) {
        if (foundTableName.startsWith('sqlite_'))
            continue;
        if (foundTableName.startsWith('_litestream'))
            continue;
        if (foundTableName === 'dm_database_meta')
            continue;

        if (schemaTables.has(foundTableName)) {
            // future: could examine the contents of the table.
            continue;
        }

        db.warn(`Database has a table or index that's not part of the app schema: ${foundTableName}`
                     + ` (schemaName=${schema.name})`)
    }
}
