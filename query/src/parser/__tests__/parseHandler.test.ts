
import { parseHandler } from '../parseHandler'
import { describe, it, expect } from 'vitest'
import { Handler } from '../../handler'

describe('a: (required)', () => {
    const sample = 'a: (required)';

    it('creates a handler with one required input with attr "a"', () => {
        const parsed: Handler = parseHandler(sample);
        expect(parsed.tags[0].attr).toEqual('a');
        expect(parsed.tags[0].isRequired).toBeTruthy();
    });
});

describe("a: (required integer)", () => {
    it("should create a handler with one required input of type integer", () => {
        const sample = 'a: (required integer)';
        const parsed = parseHandler(sample);

        expect(parsed.tags[0].attr).toEqual('a');
        expect(parsed.tags[0].isRequired).toBeTruthy();
        expect(parsed.tags[0].expectedType).toEqual('integer');
    });
});

describe("a: (required integer)", () => {
    it("should create a handler with one required input of type integer", () => {
        const sample = 'a: (required integer)';
        const parsed = parseHandler(sample);

        expect(parsed.tags[0].attr).toEqual('a');
        expect(parsed.tags[0].isRequired).toBeTruthy();
        expect(parsed.tags[0].expectedType).toEqual('integer');
    });
});

describe("a: (optional integer)", () => {
    it("should create a handler with one optional input of type integer", () => {
        const sample = 'a: (optional integer)';
        const parsed = parseHandler(sample);

        expect(parsed.tags[0].attr).toEqual('a');
        expect(parsed.tags[0].isRequired).toEqual(false);
        expect(parsed.tags[0].expectedType).toEqual('integer');
    });
});

describe("a(postional)", () => {
    it("should create a positional input", () => {
        const sample = 'a(positional)';
        const parsed = parseHandler(sample);

        expect(parsed.tags[0].attr).toEqual('a');
        expect(parsed.tags[0].isPositional).toEqual(true);
    });

    it("supports $ syntax", () => {
        const sample = '$a(positional)';
        const parsed = parseHandler(sample);

        expect(parsed.tags[0].attr).toEqual('a');
        expect(parsed.tags[0].isParameter).toEqual(true);
        expect(parsed.tags[0].isPositional).toEqual(true);
    });
});

describe("various cases", () => {
    let sample = "a $b $c? d=? -> e"
    it("correctly parses: " + sample, () => {
        const result = parseHandler(sample);
        expect(result.tags[0]).toEqual({ attr: 'a', isRequired: true, requiresValue: false, isParameter: false, isOutput: false });
        expect(result.tags[1]).toEqual({ attr: 'b', isRequired: true, requiresValue: true, isParameter: true, isOutput: false });
        expect(result.tags[2]).toEqual({ attr: 'c', isRequired: false, requiresValue: true, isParameter: true, isOutput: false });
        expect(result.tags[3]).toEqual({ attr: 'd', isRequired: true, requiresValue: false, isParameter: true, isOutput: false });
    });
});