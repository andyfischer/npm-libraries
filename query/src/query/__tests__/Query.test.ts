
import { Query, toQuery } from '..';
import { it, expect, describe } from 'vitest'

describe("withInlinedParams", () => {
    it("withInlinedParms handles a nested query", () => {
        const query = toQuery("func($a $b)");
        const params = new Map();
        params.set("a", "123");
        params.set("b", "456");

        const inlined = query.withInlinedParams(params);

        const nested = inlined.getNestedQuery("func");
        expect(nested.getStringValue("a")).toEqual("123");
        expect(nested.getStringValue("b")).toEqual("456");
    });

    it("handles a tag where the paramName is different than the attr", () => {
        const query = toQuery("func(a=$b)");
        const params = new Map();
        params.set("b", "123");

        const inlined = query.withInlinedParams(params);
        const nested = inlined.getNestedQuery("func");
        expect(nested.getStringValue("a")).toEqual("123");
    });
});