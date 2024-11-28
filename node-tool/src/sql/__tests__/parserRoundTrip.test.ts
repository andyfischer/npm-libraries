
import { it, expect } from 'vitest'
import { parseSql, parsedStatementToString } from '../parser'

const testCases = [
    'create table foo (id auto);',
    `create table address (address_id integer primary key autoincrement);`,
    `create table address (address_id integer primary key autoincrement, email_address varchar ( 100 ) unique not null, created_at varchar ( 20 ) not null, last_message_received_at varchar ( 20 ), primary_domain varchar ( 200 ), domains_text text, address_name varchar ( 200 ), address_name_sort_key varchar ( 200 ), user_note text);`,
]

for (const testCase of testCases) {
    it('parserRoundTrip test on: ' + testCase, () => {
        const parsed = parseSql(testCase);
        const backToString = parsedStatementToString(parsed);
        expect(backToString).toEqual(testCase);
    });
}

