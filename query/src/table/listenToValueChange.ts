
import { Table } from './Table'
import { Stream, recordUnhandledError } from '@andyfischer/streams'

export function listenToValueChange<T = any>(table: Table<T>, callback: (newValue: T, oldValue: T | null) => void): Stream {
    const stream = table.listen!();

    let current = table.get!();

    callback(current, null);

    stream.pipe(msg => {
        let latest = table.get!();
        if (current != latest) {
            try {
                callback(latest, current);
            } catch (e) {
                recordUnhandledError(e);
            }
        }
        current = latest;
    })

    return stream;
}

