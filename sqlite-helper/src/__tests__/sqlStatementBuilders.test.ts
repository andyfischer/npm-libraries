import { describe, it, expect } from 'vitest';
import { prepareInsertStatement, prepareUpdateStatement, prepareUpdateStatement_v2 } from '../sqlStatementBuilders';

describe('SQL Statement Builders', () => {
    describe('prepareInsertStatement', () => {
        it('should create correct insert statement with single field', () => {
            const result = prepareInsertStatement('users', { name: 'John' });
            expect(result.sql).toBe('insert into users (name) values (?)');
            expect(result.values).toEqual(['John']);
        });

        it('should create correct insert statement with multiple fields', () => {
            const result = prepareInsertStatement('users', {
                name: 'John',
                age: 30,
                email: 'john@example.com'
            });
            expect(result.sql).toBe('insert into users (name, age, email) values (?, ?, ?)');
            expect(result.values).toEqual(['John', 30, 'john@example.com']);
        });
    });

    describe('prepareUpdateStatement', () => {
        it('should create correct update statement with single where value', () => {
            const result = prepareUpdateStatement('users', 'id = ?', [1], { name: 'John' });
            expect(result.sql).toBe('update users set name = ? where id = ?');
            expect(result.values).toEqual(['John', 1]);
        });

        it('should create correct update statement with multiple where values', () => {
            const result = prepareUpdateStatement(
                'users',
                'id = ? AND age > ?',
                [1, 25],
                { name: 'John', status: 'active' }
            );
            expect(result.sql).toBe('update users set name = ?, status = ? where id = ? AND age > ?');
            expect(result.values).toEqual(['John', 'active', 1, 25]);
        });

        it('should throw error when where placeholders do not match values', () => {
            expect(() => {
                prepareUpdateStatement('users', 'id = ? AND age > ?', [1], { name: 'John' });
            }).toThrow();
        });
    });

    describe('prepareUpdateStatement_v2', () => {
        it('should create correct update statement with single where condition', () => {
            const result = prepareUpdateStatement_v2(
                'users',
                { id: 1 },
                { name: 'John' }
            );
            expect(result.sql).toBe('update users set name = ? where id = ?');
            expect(result.values).toEqual(['John', 1]);
        });

        it('should create correct update statement with multiple where conditions', () => {
            const result = prepareUpdateStatement_v2(
                'users',
                { id: 1, status: 'pending' },
                { name: 'John', age: 30 }
            );
            expect(result.sql).toBe('update users set name = ?, age = ? where id = ? and status = ?');
            expect(result.values).toEqual(['John', 30, 1, 'pending']);
        });
    });
});
