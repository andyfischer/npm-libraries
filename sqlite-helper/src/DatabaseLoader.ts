
import { SqliteDatabase } from './SqliteDatabase'
import Database from 'better-sqlite3'
import { DatabaseSchema } from './DatabaseSchema';
import { createNestedLoggerStream } from '@andyfischer/streams';

interface SetupOptions {
    filename: string
    schema: DatabaseSchema
}

export class DatabaseLoader {
    options: SetupOptions
    db: SqliteDatabase | null = null

    constructor(options: SetupOptions) {
        this.options = options;
    }

    load() {
        if (!this.db) {
            this.db = new SqliteDatabase(
                new Database(this.options.filename),
                createNestedLoggerStream(this.options.schema.name)
            );

            this.db.migrateToSchema(this.options.schema);
            this.db.runDatabaseSloppynessCheck(this.options.schema);
        }
        return this.db;
    }
}