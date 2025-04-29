import { LexedText, t_hash, t_line_comment, t_semicolon, t_space } from "../lexer";
import { Query, QueryNode } from "../query";
import { parseQueryFromTokens } from "./parseQuery";

export function parseFile(fileContents: string): Query[] {
    let queries: Query[] = [];

    try {
        const lexed = new LexedText(fileContents, {
            bashStyleLineComments: true,
        });

        const it = lexed.startIterator();
        // const ctx: ParseContext = {};

        while (!it.finished()) {
            if (it.tryConsume(t_semicolon))
                continue;

            if (it.tryConsume(t_line_comment))
                continue;

            const result = parseQueryFromTokens(it);

            if (result.t === 'parseError')
                throw result;

            if (result.t === 'tag') {
                queries.push(new Query([result]));
                continue;
            }

            if (result.t === 'query') {
                if (result.tags.length === 0)
                    continue;

                queries.push(result);
                continue;
            }

            if (result.t === 'multistep') {
                throw new Error(`Didn't expect multistep query in parseFile: ` + result.toQueryString() );
            }
        }

        return queries;
    } catch (err) {
        throw err;
    }
}

