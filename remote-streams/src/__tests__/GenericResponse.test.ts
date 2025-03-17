
import { it, expect } from "vitest"
import { setupGenericResponseTable } from "../GenericResponse"
import { dynamicOutputToStream, Stream } from "@andyfischer/streams";

it("handles incoming schema hints - single item result", () => {
    const { table, receiveEvent } = setupGenericResponseTable();

    expect(table.get()).toBeFalsy();
    expect(Array.from(table.each())).toEqual([]);

    const stream = new Stream();
    stream.pipe(receiveEvent);

    dynamicOutputToStream({ itemData: 123 }, stream);

    expect(table.get()).toEqual({ itemData: 123});
    expect(Array.from(table.each())).toEqual([{itemData: 123}]);
});

it("handles incoming schema hints - list result", () => {
    const { table, receiveEvent } = setupGenericResponseTable();

    expect(table.get()).toBeFalsy();
    expect(Array.from(table.each())).toEqual([]);

    const stream = new Stream();
    stream.pipe(receiveEvent);

    dynamicOutputToStream([ 1, 2, 3], stream);

    expect(Array.from(table.each())).toEqual([1,2,3]);
    expect(table.supportsFunc('get')).toBeFalsy();
});