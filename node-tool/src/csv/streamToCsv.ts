
import { Stream, c_item, c_done, } from '@andyfischer/streams'

export interface Options {
    attrs: string[]
    seperator?: '\t' | ','
}

function maybeQuote(s: string) {
    if (s == null)
        return '';

    if (typeof s !== 'string') {
        s = s + '';
    }

    const needsQuote = s.includes(',') ||
        s.includes('\r') || s.includes('\n') || s.includes('\t')
        || s.includes('"');

    if (needsQuote) {
        return `"${s.replace(/"/g, '""')}"`
    } else {
        return s;
    }
}


export function streamToCsv(input: Stream, options: Options): Stream {
    const output = new Stream();

    let seperator = options.seperator || ',';

    let headerLine = '';

    let first = true;
    for (const attr of options.attrs) {
        if (!first)
            headerLine += seperator
        headerLine += maybeQuote(attr);
        first = false;
    }

    output.item({ line: headerLine });

    input.pipe((msg) => {
        switch (msg.t) {
        case c_item: {
            const item = msg.item;
            let line = ''

            let first = true;
            for (const attr of options.attrs) {
                if (!first)
                    line += seperator;
                let value = item[attr];
                if (value == null)
                    value = ''
                    
                line += maybeQuote(value);
                first = false;
            }

            output.item({ line });
            break;
        }
        case c_done:
            output.event(msg);
            break;
        }
    });

    return output;
}

