
import { Stream, c_done, c_fail, c_item,  } from '@andyfischer/streams'
import { streamToCsv, Options as CsvOptions } from '../csv/streamToCsv'
import Fs from 'fs'

export interface Options extends CsvOptions {
    flags?: string
}

export function streamToCsvFile(input: Stream, options: Options, filename: string) {
    // Open a file stream and write the CSV to it.

    const fileOut = Fs.createWriteStream(filename, { flags: options.flags });

    streamToCsv(input, options)
    .pipe(evt => {
        switch (evt.t) {
            case c_item:
                fileOut.write(evt.item.line + '\n')
                break;
            case c_done:
                fileOut.close();
                break;
            case c_fail:
                console.error(evt.error);
                break;
    }});
}
