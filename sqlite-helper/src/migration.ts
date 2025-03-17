
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

export function getOneTableMigration(fromTableLoose: CreateTable | string, toTableLoose: CreateTable | string): Migration {
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

export function runMigrationForCreateStatement(db: SqliteDatabase, createStatement: string, options: MigrationOptions) {
    const statement = parseSql(createStatement);
    // console.log(statement)
    if (statement.t == 'create_table') {
        const existingTable: any = db.get(`select sql from sqlite_schema where name = ?`, statement.name);
        
        if (!existingTable) {
            // Table doesn't exist yet, create it.
            db.run(createStatement);
            return;
        }

        const migration = getOneTableMigration(existingTable.sql, statement);

        for (const migrationStatement of migration.statements) {
            if (migrationStatement.isDestructive && !options.includeDestructive) {
                db.warn(`not automatically performing destructive migration: ${migrationStatement.sql}`);
                continue;
            }

            db.info(`migrating table ${statement.name}: ${migrationStatement.sql}`)
            db.run(migrationStatement.sql);
        }

        for (const warning of migration.warnings)
            db.warn(`table ${statement.name} had migration warning: ${warning}`);

    } else if (statement.t === 'create_index') {
        const existingIndex: any = db.get(`select sql from sqlite_schema where name = ?`, statement.index_name);

        if (!existingIndex) {
            // Index doesn't exist yet, create it.
            db.run(createStatement);
            return;
        }

        // TODO: Check if the index needs to be replaced/updated?

        return;
    } else {
        throw new Error("Unsupported statement in migrate(). Only supporting 'create table' right now");
    }
}