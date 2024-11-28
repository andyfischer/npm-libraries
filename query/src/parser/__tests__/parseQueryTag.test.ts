import { parseQueryTag } from "../parseQueryTag";
import { it, expect, describe } from 'vitest'
import { QueryTag } from '../../query'
import { TagSpecialValueType } from "../../query/QueryTag";

function checkTag(actual, desired) {
    expect(actual.attr).toEqual(desired.attr);
    expect(actual.value).toEqual(desired.value);
    expect(actual.paramName).toEqual(desired.paramName);
    expect(actual.isParameter()).toEqual(desired.isParameter || false);
}

describe("with sample: 'theattr=123'", () => {
    it("should return a single query tag with attr of 'theattr' and a value of '123'", () => {
        const parsed: QueryTag = parseQueryTag('theattr=123');

        // Check that the tag has attr = 'theattr' and value = '123'
        expect(parsed.attr).toEqual('theattr');
        expect(parsed.getStringValue()).toEqual('123');
    });
});

it("parses a tag with just an attr", () => {
    checkTag(parseQueryTag("theattr"), {
        attr: "theattr",
        value: undefined,
    });
});

it("parses attr=value", () => {
  checkTag(parseQueryTag("theattr=123"), {
    attr: "theattr",
    value: 123,
  });
});

it("parses allowed characters in attr", () => {
  checkTag(parseQueryTag("the/attr.123=123"), {
    attr: "the/attr.123",
    value: 123,
  });
});

it("parses a URL", () => { 
  checkTag(parseQueryTag("url=https://example.com"), {
    attr: "url",
    value: "https://example.com",
  });
});

it("parses a URL with port", () => { 
  checkTag(parseQueryTag("url=https://example.com:8080"), {
    attr: "url",
    value: "https://example.com:8080",
  });
});

it("parses an attr with dashes", () => { 
  checkTag(parseQueryTag("test-tag"), {
    attr: "test-tag",
  });

  checkTag(parseQueryTag("intake-facts"), {
    attr: "intake-facts",
  });

  expect(
    parseQueryTag("test-tag").toQueryString()
  ).toEqual("test-tag");
});

it(`parses attr="value"`, () => {
  checkTag(parseQueryTag('theattr="123"'), {
    attr: "theattr",
    value: '123',
  });
});

it(`parses $attr`, () => {
  checkTag(parseQueryTag('$theattr'), {
    attr: "theattr",
    value: undefined,
    paramName: 'theattr',
    isParameter: true,
  });
});

it(`parses attr=$paramName`, () => {
  checkTag(parseQueryTag('theattr=$paramName'), {
    attr: "theattr",
    value: undefined,
    paramName: 'paramName',
    isParameter: true,
  });
});

it(`parses attr=*"`, () => {
    const parsed: QueryTag = parseQueryTag('attr=*');

    // Check that the tag has attr = 'theattr' and value = '123'
    expect(parsed.attr).toEqual('attr');
    expect((parsed.value as any).t).toEqual(TagSpecialValueType.star);
});

it("parses attr=(tuple)", () => {
    const parsed = parseQueryTag("theattr=(a b c)");

    expect(parsed.attr).toEqual('theattr');
    expect(parsed.t).toEqual('tag');
    expect((parsed.value as any).t).toEqual('query');
    expect((parsed.value as any).tags).toEqual([
      {
        "attr": "a",
        "t": "tag",
      },
      {
        "attr": "b",
        "t": "tag",
      },
      {
        "attr": "c",
        "t": "tag",
      },
    ]);
});

it("parses attr(tuple)", () => {
  const parsed = parseQueryTag("theattr(a b c)");
  expect(parsed.attr).toEqual('theattr');
  expect((parsed.value as any).t).toEqual('query');
  expect((parsed.value as any).tags).toEqual([
    {
      "attr": "a",
      "t": "tag",
    },
    {
      "attr": "b",
      "t": "tag",
    },
    {
      "attr": "c",
      "t": "tag",
    },
  ]);
});

it("parses attr (tuple)", () => {
  const parsed = parseQueryTag("theattr (a b c)");
  expect(parsed.attr).toEqual('theattr');
  expect((parsed.value as any).t).toEqual('query');
  expect((parsed.value as any).tags).toEqual([
    {
      "attr": "a",
      "t": "tag",
    },
    {
      "attr": "b",
      "t": "tag",
    },
    {
      "attr": "c",
      "t": "tag",
    },
  ]);
});

it("parses ? for optional", () => {
  expect(parseQueryTag("x?")).toEqual(
    {
      "attr": "x",
      "isAttrOptional": true,
      "t": "tag",
    }
  );
  expect(parseQueryTag("x?=val")).toEqual(
    {
      "attr": "x",
      "isAttrOptional": true,
      "t": "tag",
      "value": 'val',
    }
  );
});

describe("with sample: 'theattr:(nested-query)'", () => {
    it("should return a query tag with a nested query having 'nested-query' as the first tag", () => {
        const parsed = parseQueryTag('theattr:(nested-query)');

        // Check that the tag has attr = 'theattr' and nested query with 'nested-query'
        expect(parsed.attr).toEqual('theattr');
        expect(parsed.isQuery()).toEqual(true);
        expect(parsed.getQuery().tagAtIndex(0).attr).toEqual('nested-query');
    });

    it("should return the same thing if there is a space between the colon and the paren", () => {
        const parsed = parseQueryTag('theattr: (nested-query)');

        // Check that the tag has attr = 'theattr' and nested query with 'nested-query' even with space
        expect(parsed.attr).toEqual('theattr');
        expect(parsed.isQuery()).toEqual(true);
        expect(parsed.getQuery().tagAtIndex(0).attr).toEqual('nested-query');
    });
});

describe("with sample: 'theattr:'", () => {
    it("throws an error if nothing is after the colon", () => {
        expect(() => parseQueryTag('theattr:')).toThrow();
    });

    it("throws an error if there is a closing parentheses after the colon", () => {
        expect(() => parseQueryTag('theattr:)')).toThrow();
    });
});

