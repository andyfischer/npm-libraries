import { DatabaseLoader } from "../DatabaseLoader";
import { describe, it, expect } from 'vitest'

const filename = ':memory:';
const db = (new DatabaseLoader({filename, 
    schema: {
        name: 'SqliteDatabase.test.ts',
        statements: [
            `create table users (id integer primary key, name text, age integer, email text)`,
        ]
    }
})).load();

describe('SqliteDatabase.insert', () => {
    it('should insert a single row with one field', () => {
        const result = db.insert('users', { name: 'John' });
        expect(result.changes).toBe(1);
        
        const inserted = db.get('select * from users where name = ?', 'John');
        expect(inserted.name).toBe('John');
    });

    it('should insert a single row with multiple fields', () => {
        const result = db.insert('users', {
            name: 'Jane',
            age: 30,
            email: 'jane@example.com'
        });
        expect(result.changes).toBe(1);
        
        const inserted = db.get('select * from users where name = ?', 'Jane');
        expect(inserted.name).toBe('Jane');
        expect(inserted.age).toBe(30);
        expect(inserted.email).toBe('jane@example.com');
    });
});

describe('SqliteDatabase.update', () => {
    it('should update a single row with one field', () => {
        // Insert test data first
        db.insert('users', { name: 'Bob', age: 25 });
        
        const result = db.update('users', 'name = ?', ['Bob'], { age: 26 });
        expect(result.changes).toBe(1);
        
        const updated = db.get('select * from users where name = ?', 'Bob');
        expect(updated.age).toBe(26);
    });

    it('should update multiple rows matching where clause', () => {
        // Insert test data
        db.insert('users', { name: 'Alice', age: 20 });
        db.insert('users', { name: 'Charlie', age: 20 });
        
        const result = db.update('users', 'age = ?', [20], { age: 21 });
        expect(result.changes).toBe(2);
        
        const count = db.count('from users where age = ?', 21);
        expect(count).toBe(2);
    });
});

describe('SqliteDatabase.upsert', () => {
    it('should update existing row when where clause matches', () => {
        db.run('delete from users');

        // Insert initial data
        db.insert('users', { name: 'Alice', age: 25, email: 'alice@test.com' });
        
        // Upsert should update since record exists
        db.upsert('users', { name: 'Alice' }, { age: 26, email: 'alice.new@test.com' });
        
        const result = db.get('select * from users where name = ?', 'Alice');
        expect(result.age).toBe(26);
        expect(result.email).toBe('alice.new@test.com');
        
        // Should only have one record
        const count = db.count('from users where name = ?', 'Alice');
        expect(count).toBe(1);
    });

    it('should insert new row when where clause does not match', () => {
        // Upsert should insert since no matching record exists
        db.upsert('users', { name: 'Bob' }, { age: 30, email: 'bob@test.com' });
        
        const result = db.get('select * from users where name = ?', 'Bob');
        expect(result.name).toBe('Bob');
        expect(result.age).toBe(30);
        expect(result.email).toBe('bob@test.com');
    });

    it('should handle multiple where conditions', () => {
        // Insert initial data
        db.insert('users', { name: 'Charlie', age: 35 });
        
        // Upsert with multiple where conditions
        db.upsert(
            'users',
            { name: 'Charlie', age: 35 },
            { email: 'charlie@test.com' }
        );
        
        const result = db.get('select * from users where name = ?', 'Charlie');
        expect(result.age).toBe(35);
        expect(result.email).toBe('charlie@test.com');
    });
});