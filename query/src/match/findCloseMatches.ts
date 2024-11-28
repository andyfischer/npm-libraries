import { ErrorDetails } from "@andyfischer/streams"
import { Graph, Query } from "../graph";

export function findClosestWrongMatches(graph: Graph, query: Query) {
    let bestScore = null;
    let bestMatches = null;

    // TODO
    /*
    const points = graph.everyMountPoint();
    for (const handler of points) {
        const match = getClosestWrongQueryMountMatch(ctx, query, handler);

        const score = match.attrs.size;

        if (bestScore === null || score > bestScore) {
            bestScore = score;
            bestMatches = [{handler, match}];
        } else if (score == bestScore) {
            bestMatches.push({handler, match});
        }
    }
    */

    return {
        bestMatches
    }
}

export function errorForNoTableFound(graph: Graph, query: Query): ErrorDetails {

    const closestMatches = findClosestWrongMatches(graph, query);

    let error: ErrorDetails = {
        errorType: 'no_handler_found',
        errorMessage: 'No handler found for query: ' + query.toQueryString(),
        related: [{ query: query.toQueryString() }]
    }

    /*
    if (graph.tracingName) {
        error.data = error.data || [];
        error.data.push({
            searchedGraph: null,
            graph_name: graph.tracingName,
        });
    }

    if (closestMatches?.bestMatches?.length > 0) {
        error.data = error.data || [];

        let maxClosestPointsIncluded = 5;
        let count = 0;
        for (const { match, handler } of closestMatches.bestMatches) {
            error.data.push({
                nearbyMatch: null,
                point_id: handler.localId,
                point_decl: handler.toDeclString(),
                match_problems: match.matchProblems,
            });


            count++;
            if (count > maxClosestPointsIncluded)
                break;
        }
    }
    */

    return error;
}
