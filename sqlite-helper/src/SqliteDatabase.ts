
import DatabaseImpl from 'better-sqlite3'
import { parseSql } from './parser'
import { runDatabaseSloppynessCheck, MigrationOptions, runMigrationForCreateStatement } from './migration'
import { DatabaseSchema } from './DatabaseSchema'
import { performTableRebuild } from './rebuildTable'
import { Stream, ErrorDetails, captureError } from '@andyfischer/streams'
import { prepareInsertStatement, prepareUpdateStatement } from './sqlStatementBuilders'
import { runUpsert } from './sqlOperations'
import { SingletonAccessor } from './SingletonAccessor'

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
    db: DatabaseImpl
    logs?: Stream

    constructor(db: DatabaseImpl, logs: Stream) {
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

    /*
      Convenience function to build and run an 'insert into' statement.

      Each key in 'object' is a column name, and the value is the value to insert.
    */
    insert(tableName: string, row: Record<string,any>) {
        const { sql, values } = prepareInsertStatement(tableName, row);
        return this.run(sql, values);
    }

    update(tableName: string, where: string, whereValues: any[], object: any) {
        const { sql, values } = prepareUpdateStatement(tableName, where, whereValues, object);
        return this.run(sql, values);
    }

    upsert(tableName: string, where: Record<string,any>, row: Record<string,any>) {
        return runUpsert(this, tableName, where, row);
    }
    
    singleton(tableName: string) {
        return new SingletonAccessor(this, tableName);
    }

    migrateCreateStatement(createStatement: string, options: MigrationOptions) {
        runMigrationForCreateStatement(this, createStatement, options);
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
