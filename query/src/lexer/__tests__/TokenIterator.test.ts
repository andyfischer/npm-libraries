
import { it, expect } from 'vitest'
import { OldTokenIterator } from '../OldTokenIterator'
import { t_plain_value, t_space, lexifyString } from '..';

//describe('sourcePosToHere', () => {
    it('sourcePosToHere gives correct ranges', () => {
        const iterator = new OldTokenIterator(lexifyString("x yyy zzzzzzz"));

        expect(iterator.toSourcePos(iterator.next(), iterator.next(2))).toEqual({
           columnEnd: 6,
           columnStart: 1,
           lineEnd: 1,
           lineStart: 1,
           posEnd: 5,
           posStart: 0,
        });
        
        expect(iterator.toSourcePos(iterator.next(2), iterator.next(5))).toEqual({
           columnEnd: 14,
           columnStart: 3,
           lineEnd: 1,
           lineStart: 1,
           posEnd: 13,
           posStart: 2,
        });
    });
//});

//describe('lexifyString', () => {
    it('lexifyString gives correct results', () => {
        const iterator = new OldTokenIterator(lexifyString("apple banana cinnamon"));

        expect(iterator.next().match).toEqual(t_plain_value);
        expect(iterator.nextIs(t_plain_value)).toBeTruthy();
        expect(iterator.finished()).toBeFalsy();
        iterator.consume(t_plain_value);
        expect(iterator.next().match).toEqual(t_space);
        expect(iterator.nextIs(t_space)).toBeTruthy();
        expect(iterator.finished()).toBeFalsy();
        iterator.consume(t_space);
        expect(iterator.next().match).toEqual(t_plain_value);
        expect(iterator.nextIs(t_plain_value)).toBeTruthy();
        expect(iterator.finished()).toBeFalsy();
        iterator.consume(t_plain_value);
        iterator.consume(t_space);
        iterator.consume(t_plain_value);
        expect(iterator.next().match).not.toEqual(t_plain_value);
        expect(iterator.nextIs(t_plain_value)).toBeFalsy();
        expect(iterator.finished()).toBeTruthy();
    });
//});

