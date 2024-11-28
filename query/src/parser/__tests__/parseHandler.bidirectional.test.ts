import { it, expect, describe } from 'vitest'
import { parseHandler } from '../parseHandler'

const bidirectionalTestCases = [
    'a',
    '$a',
    'a b',
    'a $b',
    'a?',
    'key -> val',
    '$key -> val',
    'key? -> val',
    'key -> a b c',
    '$a $b $c? -> key',
];

describe("birectional tests for parse -> toDeclString", () => {
    for (const str of bidirectionalTestCases) {
        it("handles: " + str, () => {
            expect(parseHandler(str).toDeclString()).toEqual(str);
        })
    }
});