
import Path from 'path'
import { DatabaseLoader } from '@andyfischer/sqlite-helper'
import type { SqliteDatabase } from '@andyfischer/sqlite-helper';

const replDatabaseFilename = Path.join(__dirname, '../../.repl.sqlite');

let _db = new DatabaseLoader({
    filename: replDatabaseFilename,
    schema: {
        name: 'ReplDatabase',
        statements: [
            `create table history(
                line_index number not null primary key,
                line text not null
            )`,
            `create table inquire_default(
                key text not null primary key,
                value text not null
            )`,
            `create table next_value(
                name text not null primary key,
                value number not null
            )`,
        ]
    }
});

export function getDatabase(): SqliteDatabase {
    return _db.load();
}

export function getNextIndexValue(name: string) {
    const db = getDatabase();
    const row = db.get(`select value from next_value where name = ?`, [name]);
    if (!row) {
        return null;
    }
    return row.value;
}

export function setNextIndexValue(name: string, value) {
    const db = getDatabase();
    const found = db.get(`select value from next_value where name = ?`, [name]);
    if (!found) {
        db.run(`insert into next_value(value, name) values(?, ?)`, [value, name]);
    } else {
        db.run(`update next_value set value = ? where name = ?`, [value, name]);
    }
}

export function historyAppend(line: string) {
    const db = getDatabase();
    let index = getNextIndexValue('history_index');

    if (index == null) {
        index = 0;
    }

    db.run(`insert into history(line_index, line) values(?, ?)`, [index, line]);
    setNextIndexValue('history_index', index + 1);
}

export function setCommandPromptDefault(key: string, value: string) {
    const db = getDatabase();
    db.run(`insert into inquire_default(key, value) values(?, ?)`
        + ' on conflict(key) do update set value = excluded.value'
        , [key, value]);
}

export function getCommandPromptDefault(key: string) {
    const db = getDatabase();
    const row = db.get(`select value from inquire_default where key = ?`, [key]);
    if (!row) {
        return null;
    }
    return row.value;
}