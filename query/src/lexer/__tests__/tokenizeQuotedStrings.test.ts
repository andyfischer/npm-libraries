
import { lexifyString, OldLexedText } from "..";
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

it("handles single quote strings", () => {
  const tokens = consise(lexifyString('"there"'));
  expect(tokens[0].matchName).toEqual("quoted_string");
  expect(tokens.length).toEqual(1);
});

it("handles double quote strings", () => {
  const tokens = consise(lexifyString("'there'"));
  expect(tokens[0].matchName).toEqual("quoted_string");
  expect(tokens.length).toEqual(1);
});

it("handles quotes inside strings", () => {
  const result = lexifyString(`"contains a 'quoted' section"`);
  const tokens = result.tokens;
  expect(tokens[0].match.name).toEqual("quoted_string");
  expect(result.getTokenText(result.tokens[0])).toEqual(`"contains a 'quoted' section"`);
  expect(tokens.length).toEqual(1);
});

it("handles escaped quotes inside strings", () => {
  const result = lexifyString(`"the \\" character"`);
  const tokens = result.tokens;
  expect(tokens[0].match.name).toEqual("quoted_string");
  expect(result.getTokenText(result.tokens[0])).toEqual(`"the \\" character"`);
  expect(tokens.length).toEqual(1);
});

it("getUnquotedText gets the correct string", () => {
    const result = lexifyString(`"the string"`);
    expect(result.getUnquotedText(result.tokens[0])).toEqual("the string");
});

it("getUnquotedText unescapes", () => {
    const result = lexifyString(`"the \\" character"`);
    expect(result.getUnquotedText(result.tokens[0])).toEqual(`the " character`);
});

it("getUnquotedText unescapes multiple", () => {
    const result = lexifyString(`"\\a \\b \\c \\d \\e"`);
    expect(result.getUnquotedText(result.tokens[0])).toEqual(`a b c d e`);
});

it("has correct position on multiline strings", () => {
    const result = lexifyString("`line 1\nline 2\nline 3` following_token");
    expect(result.tokens[2].lineStart).toEqual(3);
    expect(result.tokens[2].columnStart).toEqual(9);
});
