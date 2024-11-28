import { Graph, Query } from "../graph";
import { MatchContext, HandlerToQueryMatch, checkOneMatch } from "./checkOneMatch";
import { VerboseTraceFindMatch, WarnOnMultipleMatches } from "../Config"

export function findBestMatch(ctx: MatchContext, graph: Graph, query: Query): HandlerToQueryMatch | null {
    if (!graph)
        throw new Error("missing graph");

    if (VerboseTraceFindMatch)
        console.log('FindMatch searching for: ', query.toQueryString());

    let matches: HandlerToQueryMatch[] = [];

    let numberChecked = 0;
    for (const handler of graph.eachHandler()) {
        const match = checkOneMatch(ctx, query, handler);
        numberChecked++;

        if (match)
            matches.push(match);
    }

    if (matches.length === 0) {
        if (VerboseTraceFindMatch) {
            console.error('FindMatch no match found for: ', query.toQueryString());
            if (numberChecked == 0)
                console.error('(graph has no handlers)');
        }
        return null;
    }

    // Rank the results

    // Prefer fewer missed optionals
    matches.sort((a,b) => a.unusedOptionalsCount - b.unusedOptionalsCount);

    // Error on ambiguous match (future: maybe do something better here)
    if (matches.length > 1 && matches[0].unusedOptionalsCount === matches[1].unusedOptionalsCount) {
        if (WarnOnMultipleMatches)
            console.warn("ambiguous match warning: multiple found for: " + query.toQueryString());
    }

    const match = matches[0];

    return match;
}