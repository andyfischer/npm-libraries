
import { toQuery } from '..';
import { it, expect } from 'vitest'
import { queryToString } from '../queryToString';

it("handles bidirectional tests", () => {
    function bidirectionalTest(queryStr: string) {
        const parsed = toQuery(queryStr);
        const backToStr = queryToString(parsed);
        expect(backToStr).toEqual(queryStr);
    }

    bidirectionalTest("a");
    bidirectionalTest("a b");
    bidirectionalTest("a=1 b");
    bidirectionalTest("func(a)");
    bidirectionalTest("func(a b)");
});