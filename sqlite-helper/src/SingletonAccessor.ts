import { SqliteDatabase } from "./SqliteDatabase";

export class SingletonAccessor {
    db: SqliteDatabase;
    tableName: string;

    constructor(db: SqliteDatabase, tableName: string) {
        this.db = db;
        this.tableName = tableName;
    }

    get() {
        return this.db.get(`SELECT * FROM ${this.tableName}`);
    }

    set(item: any) {
        this.db.run(`DELETE FROM ${this.tableName}`);
        this.db.insert(this.tableName, item);
    }
}