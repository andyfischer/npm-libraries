import { parseQuery } from "../parseQuery";
import { it, expect } from 'vitest'

it("parseQuery parses a single step query", () => {
    const result = parseQuery("a b c");
    expect(result.tags[0].attr).toEqual('a');
    expect(result.tags[1].attr).toEqual('b');
    expect(result.tags[2].attr).toEqual('c');
});

it("parseQuery ignores commas between tags", () => {
    const result = parseQuery("b,c");

    expect(result.tags[0].attr).toEqual('b');
    expect(result.tags[1].attr).toEqual('c');
})

it("parseQuery ignores commas inside expressions", () => {
    const result = parseQuery("get(b,c)");
    const get = result.tags[0];

    expect(get.getQuery().tags[0].attr).toEqual('b');
    expect(get.getQuery().tags[1].attr).toEqual('c');
});

it("parseQuery throws an error on a piped query", () => {
    let error;

    try {
        parseQuery("a b=2 | join b c=1");
    } catch (e) {
        error = e;
    }

    expect(error?.message).include("parseQuery didn't expect a multistep query");
});

it("parseQuery handles tags with no attr", () => {
    const parsed = parseQuery(`(key example "string")`);
    expect(parsed.t).toEqual('query');
    delete (parsed as any).tags[0].value.tagsByAttr;
    expect(parsed.tags).toMatchInlineSnapshot(`
      [
        QueryTag {
          "t": "tag",
          "value": Query {
            "frozen": false,
            "t": "query",
            "tags": [
              QueryTag {
                "attr": "key",
                "t": "tag",
              },
              QueryTag {
                "attr": "example",
                "t": "tag",
              },
              QueryTag {
                "attr": "string",
                "t": "tag",
              },
            ],
          },
        },
      ]
    `);
});

it("parseQuery handles --flag syntax", () => {
    const parsed = parseQuery(`call --flag`);
    expect(parsed.tags[0].attr).toEqual('call');
    expect(parsed.tags[1].attr).toEqual('flag');
    expect(parsed.tags[1].value).toEqual(true);
});