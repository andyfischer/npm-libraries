import { lexifyString, OldLexedText, t_line_comment } from "..";
import { it, expect } from 'vitest'


function consise(result: OldLexedText) {
  return result.tokens.map((token: any) => {
    token = {
      matchName: token.match && token.match.name,
      ...token
    };
    delete token.match;
    return token;
  });
}

it("handles identifiers", () => {
  expect(consise(lexifyString("hello-there"))).toEqual(
    [
      {
        "columnStart": 1,
        "textEnd": 11,
        "leadingIndent": 0,
        "length": 11,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "plain_value",
        "textStart": 0,
        "tokenIndex": 0,
      },
    ]
  );
  expect(consise(lexifyString("hello there"))).toEqual(
    [
      {
        "columnStart": 1,
        "textEnd": 5,
        "leadingIndent": 0,
        "length": 5,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "plain_value",
        "textStart": 0,
        "tokenIndex": 0,
      },
      {
        "columnStart": 6,
        "textEnd": 6,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "space",
        "textStart": 5,
        "tokenIndex": 1,
      },
      {
        "columnStart": 7,
        "textEnd": 11,
        "leadingIndent": 0,
        "length": 5,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "plain_value",
        "textStart": 6,
        "tokenIndex": 2,
      },
    ]
  );

  expect(consise(lexifyString("_abc123"))).toEqual(
    [
      {
        "columnStart": 1,
        "textEnd": 7,
        "leadingIndent": 0,
        "length": 7,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "plain_value",
        "textStart": 0,
        "tokenIndex": 0,
      },
    ]
  );
});

it("handles spaces", () => {
  expect(consise(lexifyString("  -    "))).toEqual(
    [
      {
        "columnStart": 1,
        "textEnd": 2,
        "leadingIndent": 2,
        "length": 2,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "space",
        "textStart": 0,
        "tokenIndex": 0,
      },
      {
        "columnStart": 3,
        "textEnd": 3,
        "leadingIndent": 2,
        "length": 1,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "plain_value",
        "textStart": 2,
        "tokenIndex": 1,
      },
      {
        "columnStart": 4,
        "textEnd": 7,
        "leadingIndent": 2,
        "length": 4,
        "lineStart": 1,
        "lineEnd": 1,
        "matchName": "space",
        "textStart": 3,
        "tokenIndex": 2,
      },
    ]
  );
});

it("handles special characters", () => {
  expect(consise(lexifyString("%$!/"))).toEqual(
        [
          {
            "columnStart": 1,
            "textEnd": 1,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "lineEnd": 1,
            "matchName": "percent",
            "textStart": 0,
            "tokenIndex": 0,
          },
          {
            "columnStart": 2,
            "textEnd": 2,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "lineEnd": 1,
            "matchName": "dollar",
            "textStart": 1,
            "tokenIndex": 1,
          },
          {
            "columnStart": 3,
            "textEnd": 3,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "lineEnd": 1,
            "matchName": "exclamation",
            "textStart": 2,
            "tokenIndex": 2,
          },
          {
            "columnStart": 4,
            "textEnd": 4,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "lineEnd": 1,
            "matchName": "slash",
            "textStart": 3,
            "tokenIndex": 3,
          },
        ]
    );
});

it("provides identifier text", () => {
  const result = lexifyString("apple banana-cherry");
  expect(result.tokens.length).toEqual(3);
  expect(result.getTokenText(result.tokens[0])).toEqual("apple");
  expect(result.getTokenText(result.tokens[2])).toEqual("banana-cherry");
});

it("handles line comments", () => {
  const result = lexifyString("apple # banana", { bashStyleLineComments: true });
  expect(result.tokens.length).toEqual(3);
  expect(result.getTokenText(result.tokens[0])).toEqual("apple");
  expect(result.tokens[2].match).toEqual(t_line_comment);
  expect(result.getTokenText(result.tokens[2])).toEqual("# banana");
});

it("handles line comments 2", () => {
  const result = lexifyString("apple # banana\nsecond line", { bashStyleLineComments: true });
  expect(result.tokens).toEqual(
    [
      {
        "columnStart": 1,
        "textEnd": 5,
        "leadingIndent": 0,
        "length": 5,
        "lineStart": 1,
        "lineEnd": 1,
        "match": {
          "name": "plain_value",
        },
        "textStart": 0,
        "tokenIndex": 0,
      },
      {
        "columnStart": 6,
        "textEnd": 6,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 1,
        "lineEnd": 1,
        "match": {
          "name": "space",
        },
        "textStart": 5,
        "tokenIndex": 1,
      },
      {
        "columnStart": 7,
        "textEnd": 14,
        "leadingIndent": 0,
        "length": 8,
        "lineStart": 1,
        "lineEnd": 1,
        "match": {
          "name": "line_comment",
        },
        "textStart": 6,
        "tokenIndex": 2,
      },
      {
        "columnStart": 15,
        "textEnd": 15,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 1,
        "lineEnd": 1,
        "match": {
          "name": "newline",
          "str": "\n",
        },
        "textStart": 14,
        "tokenIndex": 3,
      },
      {
        "columnStart": 1,
        "textEnd": 21,
        "leadingIndent": 0,
        "length": 6,
        "lineStart": 2,
        "lineEnd": 2,
        "match": {
          "name": "plain_value",
        },
        "textStart": 15,
        "tokenIndex": 4,
      },
      {
        "columnStart": 7,
        "textEnd": 22,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 2,
        "lineEnd": 2,
        "match": {
          "name": "space",
        },
        "textStart": 21,
        "tokenIndex": 5,
      },
      {
        "columnStart": 8,
        "textEnd": 26,
        "leadingIndent": 0,
        "length": 4,
        "lineStart": 2,
        "lineEnd": 2,
        "match": {
          "name": "plain_value",
        },
        "textStart": 22,
        "tokenIndex": 6,
      },
    ]
  );
});

it("finds matching brackets", () => {
  expect(consise(lexifyString("{ 1 2 3 ( 5 ) [ 6 7 ] }")))
    .toEqual(
            [
              {
                "columnStart": 1,
                "textEnd": 1,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "lbrace",
                "pairsWithIndex": 22,
                "textStart": 0,
                "tokenIndex": 0,
              },
              {
                "columnStart": 2,
                "textEnd": 2,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 1,
                "tokenIndex": 1,
              },
              {
                "columnStart": 3,
                "textEnd": 3,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "integer",
                "textStart": 2,
                "tokenIndex": 2,
              },
              {
                "columnStart": 4,
                "textEnd": 4,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 3,
                "tokenIndex": 3,
              },
              {
                "columnStart": 5,
                "textEnd": 5,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "integer",
                "textStart": 4,
                "tokenIndex": 4,
              },
              {
                "columnStart": 6,
                "textEnd": 6,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 5,
                "tokenIndex": 5,
              },
              {
                "columnStart": 7,
                "textEnd": 7,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "integer",
                "textStart": 6,
                "tokenIndex": 6,
              },
              {
                "columnStart": 8,
                "textEnd": 8,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 7,
                "tokenIndex": 7,
              },
              {
                "columnStart": 9,
                "textEnd": 9,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "lparen",
                "pairsWithIndex": 12,
                "textStart": 8,
                "tokenIndex": 8,
              },
              {
                "columnStart": 10,
                "textEnd": 10,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 9,
                "tokenIndex": 9,
              },
              {
                "columnStart": 11,
                "textEnd": 11,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "integer",
                "textStart": 10,
                "tokenIndex": 10,
              },
              {
                "columnStart": 12,
                "textEnd": 12,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 11,
                "tokenIndex": 11,
              },
              {
                "columnStart": 13,
                "textEnd": 13,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "rparen",
                "pairsWithIndex": 8,
                "textStart": 12,
                "tokenIndex": 12,
              },
              {
                "columnStart": 14,
                "textEnd": 14,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 13,
                "tokenIndex": 13,
              },
              {
                "columnStart": 15,
                "textEnd": 15,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "lbracket",
                "pairsWithIndex": 20,
                "textStart": 14,
                "tokenIndex": 14,
              },
              {
                "columnStart": 16,
                "textEnd": 16,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 15,
                "tokenIndex": 15,
              },
              {
                "columnStart": 17,
                "textEnd": 17,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "integer",
                "textStart": 16,
                "tokenIndex": 16,
              },
              {
                "columnStart": 18,
                "textEnd": 18,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 17,
                "tokenIndex": 17,
              },
              {
                "columnStart": 19,
                "textEnd": 19,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "integer",
                "textStart": 18,
                "tokenIndex": 18,
              },
              {
                "columnStart": 20,
                "textEnd": 20,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 19,
                "tokenIndex": 19,
              },
              {
                "columnStart": 21,
                "textEnd": 21,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "rbracket",
                "pairsWithIndex": 14,
                "textStart": 20,
                "tokenIndex": 20,
              },
              {
                "columnStart": 22,
                "textEnd": 22,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "space",
                "textStart": 21,
                "tokenIndex": 21,
              },
              {
                "columnStart": 23,
                "textEnd": 23,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "lineEnd": 1,
                "matchName": "rbrace",
                "pairsWithIndex": 0,
                "textStart": 22,
                "tokenIndex": 22,
              },
            ]
      );
});
