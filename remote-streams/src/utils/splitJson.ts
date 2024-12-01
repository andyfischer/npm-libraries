
/*
 splitJson

 Reads and parses a string that contains concatenated JSON values.

 Outputs an iterator with each JSON value seperated.
*/

interface OutputItem {
    jsonStr?: string;
    leftover?: string;
}

export function* splitJson(str: string): IterableIterator<OutputItem> {
    if (!str)
        return;

    let itemStart = 0;
    let betweenItems = true;
    let insideString = false;
    let depth = 0;
    let escape = false;

    for (let lookahead = 0; lookahead < str.length; lookahead++) {
        if (betweenItems) {
            if (str[lookahead] !== '{')
                throw new Error(`syntax error at char ${lookahead}: expected '{', saw: ${str[lookahead]}`);

            itemStart = lookahead;
            depth = 1;
            betweenItems = false;
            continue;
        }

        if (escape) {
            escape = false;
            continue;
        }

        switch (str[lookahead]) {
        case '"':
            insideString = !insideString;
            continue;
        case '\\':
            escape = true;
            continue;
        case '{':
            if (insideString)
                continue;

            depth++;
            continue;
        case '}':
            if (insideString)
                continue;

            depth--;

            if (depth === 0) {
                yield { jsonStr: str.slice(itemStart, lookahead + 1) }
                betweenItems = true;
            }

            continue;
        }
    }

    if (!betweenItems) {
        yield { leftover: str.slice(itemStart) }
    }
}


/*
 JsonSplitDecoder

 Receives a string that has concatenated JSON messages and yields complete parsed objects
 when they are ready.

 Maintains a .leftover state field for messages that are incomplete.
*/
export class JsonSplitDecoder {
    leftover: string = null;

    *receive(str: string) {
        if (this.leftover) {
            str = this.leftover + str;
            this.leftover = null;
        }

        for (const result of splitJson(str)) {
            if (result.jsonStr) {
                yield JSON.parse(result.jsonStr);
            }

            if (result.leftover) {
                this.leftover = result.leftover;
                return;
            }
        }
    }
}
