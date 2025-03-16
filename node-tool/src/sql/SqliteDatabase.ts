
import Database from 'better-sqlite3'
import { parseSql } from './parser'
import { getGeneratedMigration, runDatabaseSloppynessCheck, MigrationOptions } from './migration'
import { DatabaseSchema } from './DatabaseSchema'
import { performTableRebuild } from './tableRebuild'
import { Stream, ErrorDetails, captureError } from '@andyfischer/streams'

function paramsToArray(params) {
    if (params === undefined)
        return [];

    if (Array.isArray(params))
        return params;

    return [params];
}

export interface RunResult {
    changes: number
    lastInsertRowid: number
}

export class SqliteDatabase {
    db: Database
    logs?: Stream

    constructor(db: Database, logs: Stream) {
        this.db = db;
        this.logs = logs;
    }

    // Return first matching item
    get(sql: string, params?: any): any {
        try {
            const statement = this.db.prepare(sql);
            params = paramsToArray(params);
            return statement.get.apply(statement, params);
        } catch (e) {
            const error = captureError(e, [{ sql }]);
            e.errorMessage = `Error trying to get() with SQL: ${e.message}`;
            this.error(captureError(error));
            throw e;
        }
    }

    // Return a list of items
    list(sql: string, params?: any): any[] {
        try {
            const statement = this.db.prepare(sql);
            params = paramsToArray(params);
            return statement.all.apply(statement, params);
        } catch (e) {
            const error = captureError(e, [{ sql }]);
            e.errorMessage = `Error trying to list() with SQL: ${e.message}`;
            this.error(captureError(error));
            throw e;
        }
    }

    *each(sql: string, params?: any) {
        if (typeof sql !== 'string')
            throw new Error("first arg (sql) should be a string");

        try {
            const statement = this.db.prepare(sql);
            params = paramsToArray(params);
            yield* statement.iterate.apply(statement, params);
        } catch (e) {
            this.error(captureError(e));
            throw e;
        }
    }

    run(sql: string, params?: any): RunResult {
        try {
            const statement = this.db.prepare(sql);
            params = paramsToArray(params);
            return statement.run.apply(statement, params);
        } catch (e) {
            const error = captureError(e, [{ sql }]);
            e.errorMessage = `Error trying to run() SQL: ${e.message}`;
            this.error(captureError(error));
            throw e;
        }
    }

    pragma(statement: string) {
        try { 
            return this.db.pragma(statement, { simple: true });
        } catch (e) {
            this.error(captureError(e));
            throw e;
        }
    }
    
    // SQL building helper functions

    // sql: looks like "from table where ..."
    exists(sql: string, params?: any) {
        const selecting = `exists(select 1 ${sql})`;
        const result = this.get(`select ` + selecting, params);
        return result[selecting] == 1;
    }

    // sql: looks like "from table where ..."
    count(sql: string, params?: any): number {
        const result = this.get(`select count(*) ` + sql, params);
        return result['count(*)'];
    }

    insert(tableName: string, object: any) {
        let column_names = [];
        let valuePlaceholders = [];
        let values = [];

        for (const [ name, value ] of Object.entries(object)) {
            column_names.push(name);
            valuePlaceholders.push('?');
            values.push(value);
        }

        const sql = `insert into ${tableName} (${column_names.join(', ')}) values (${valuePlaceholders.join(', ')})`;

        return this.run(sql, values);
    }

    update(tableName: string, where: string, whereValues: any[], object: any) {
        let setParams = [];
        let values = [];

        if (typeof whereValues === 'string')
            whereValues = [whereValues];

        // safety check the ? placeholders in 'where'
        if ((where.match(/\?/g) || []).length !== whereValues.length) {
            throw new Error(`'where' (${where}) placeholders didn't match the number of values (${whereValues.length})`);
        }

        for (const [ name, value ] of Object.entries(object)) {
            setParams.push(`${name} = ?`);
            values.push(value);
        }

        values = values.concat(whereValues);

        const sql = `update ${tableName} set ${setParams.join(', ')} where ${where}`;
        return this.run(sql, values);
    }

    migrateCreateStatement(createStatement: string, options: MigrationOptions) {
        const statement = parseSql(createStatement);
        // console.log(statement)
        if (statement.t == 'create_table') {
            const existingTable: any = this.get(`select sql from sqlite_schema where name = ?`, statement.name);
            
            if (!existingTable) {
                // Table doesn't exist yet, create it.
                this.run(createStatement);
                return;
            }

            const migration = getGeneratedMigration(existingTable.sql, statement);

            for (const migrationStatement of migration.statements) {
                if (migrationStatement.isDestructive && !options.includeDestructive) {
                    this.warn(`not automatically performing destructive migration: ${migrationStatement.sql}`);
                    continue;
                }

                this.info(`migrating table ${statement.name}: ${migrationStatement.sql}`)
                this.run(migrationStatement.sql);
            }

            for (const warning of migration.warnings)
                this.warn(`table ${statement.name} had migration warning: ${warning}`);

        } else if (statement.t === 'create_index') {
            const existingIndex: any = this.get(`select sql from sqlite_schema where name = ?`, statement.index_name);

            if (!existingIndex) {
                // Index doesn't exist yet, create it.
                this.run(createStatement);
                return;
            }

            // TODO: Check if the index needs to be replaced/updated?

            return;
        } else {
            throw new Error("Unsupported statement in migrate(). Only supporting 'create table' right now");
        }
    }

    setupInitialData(statement: string) {
        const parsed = parseSql(statement);

        if (parsed.t !== 'insert_item') {
            console.log(`expected insert statement in .initialData, found: ` + statement);
            return;
        }

        const getExistingCount = this.get(`select count(*) from ${parsed.table_name}`);
        const count = getExistingCount['count(*)'];

        if (count === 0) {
            // Run the insert
            this.run(statement);
        }
    }

    migrateToSchema(schema: DatabaseSchema, options: MigrationOptions = {}) {
        for (const statement of schema.statements) {
            this.migrateCreateStatement(statement, options);
        }

        for (const statement of schema.initialData || []) {
            this.setupInitialData(statement);
        }

        // this.info('finished migrating to schema: ' + schema.name)
    }

    performRebuild(schema: DatabaseSchema, tableName: string) {
        performTableRebuild(this, schema, tableName);
    }

    runDatabaseSloppynessCheck(schema: DatabaseSchema) {
        runDatabaseSloppynessCheck(this, schema);
    }

    error(error: ErrorDetails) {
        this.logs.logError({
            errorMessage: "SqliteDatabase error",
            ...error,
        });
    }

    warn(msg: any) {
        this.logs.warn(msg);
    }
    info(msg: any) {
        this.logs.info(msg);
    }

    close() {
        return this.db.close();
    }
}
