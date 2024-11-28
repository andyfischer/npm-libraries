import { it, expect } from 'vitest'
import { Stream } from '../Stream'
import { c_item, c_done, c_fail } from '../EventType'

it('collectEventsSync works correctly on a successfully closed stream', () => {
    const stream = new Stream();
    stream.item(1);
    stream.item(2);
    stream.done();
    const events = stream.takeEventsSync();
    expect(events).toEqual([
        { t: c_item, item: 1 },
        { t: c_item, item: 2 },
        { t: c_done },
    ]);
});

it('collectEventsSync works correctly on an errored stream', () => {
    const stream = new Stream();
    stream.item(1);
    stream.fail({ errorMessage: 'Oops!' });
    const events = stream.takeEventsSync();
    expect(events).toEqual([
        { t: c_item, item: 1 },
        { t: c_fail, error: { errorMessage: 'Oops!'} },
    ]);
});

