
import { ErrorDetails } from '@andyfischer/streams'
import { red, grey } from './AnsiColors'

export function terminalFormatError(item: ErrorDetails) {
    let out = `${red("error")} (${item.errorType})`;

    if (item.errorMessage)
        out += `: ${item.errorMessage}`;

    for (const [key, value] of Object.entries(item)) {
        if (key === 'errorType' || key === 'stack' || key === 'message')
            continue;

        if (key === 'fromQuery' && value == null)
            continue;

        out += `\n  ${key}: ${JSON.stringify(value)}`
    }

    if (item.stack)
        out += `\n${grey(item.stack)}`

    return out;
}

export function consoleLogError(item: ErrorDetails) {
    console.error(terminalFormatError(item));
}
