
import { Query, QueryTag } from '../query/Query'
import { Graph } from '../graph'
import { VerboseTraceFindMatch, VerboseTraceFindMatchFails } from '../Config'
import { ErrorDetails } from '@andyfischer/streams'
import { Handler } from '../handler'

// Exact match: the query specifies the exact same thing that
// the mount provides.
//
// This might be a universal attribute ("attribute") or it might
// be a specific value("attribute=x").

export interface AttrExactMatch {
    t: 'exact'
}

export interface AttrPositionalMatch {
    t: 'positional'
    handlerAttr: string
    queryTagIndex: number
}

// Partially filled / underprovided: The query asks for a universal
// match and the mount provides a specific subset.
//
// In this situation we might combine the results of multiple mounts,
// to deliver all the possible values that the query asks for.
export interface AttrPartiallyFilled {
    t: 'attr_partially_filled'
}

// Overprovided: The query asks for a specific attribute value, and
// the provider gives a universal match.
//
// In this situation we'll probably use the mount, and then we'll
// add a "where" filter on the results.
//
// Slightly deprecated - only used when the graph has .enableOverprovideFilter=true
export interface AttrOverprovided {
    t: 'attr_overprovided'
}

export interface UnusedOptional {
    t: 'unused_optional'
}

export interface FailedMatch {
    t: 'fail'
    reason: FailReason
}

export type FailReason = 'handler_doesnt_have_attr' | 'handler_requires_value';

export type AttrMatch = AttrExactMatch | AttrPositionalMatch | AttrPartiallyFilled | AttrOverprovided | UnusedOptional;
export type AttrMatchResult = AttrMatch | FailedMatch

/*
  Record of how this handler was matched to the query.
*/
export interface HandlerToQueryMatch {
    handler: Handler

    // For each handler attribute, the AttrMatch object stores how it was matched to the query.
    attrs: Map<string, AttrMatch>

    unusedOptionalsCount: number
}

export class MatchContext {

}

/*
 * findOneQueryTagOnHandler
 *
 * Search the Handler to find a tag matching this query tag.
 */
function tryMatchingOneTag(ctx: MatchContext, queryTag: QueryTag, tagIndex: number, handler: Handler): AttrMatchResult {
    const attr = queryTag.attr;

    // const queryHasKnownValue = tag.value.t !== 'no_value' && tag.value.t !== 'abstract';
    // const queryWillHaveValue = queryHasKnownValue || (tag.value.t === 'abstract') || !!tag.identifier;
    const handlerTag = handler.getTag(queryTag.attr);

    if (!handlerTag) {
        // Mount does not provide this attribute.
        if (VerboseTraceFindMatchFails) {
            console.log(`  match failed, handler does not have attr '${attr}':`, handler.toDeclString());
        }

        if (queryTag.isAttrOptional) {
            // Handler does not have this tag, but it's marked optional on the query.
            return { t: 'unused_optional' }
        }

        const handlerTagWithPosition = handler.tags[tagIndex];
        if (handlerTagWithPosition && handlerTagWithPosition.isPositional) {
            return { t: 'positional', handlerAttr: handlerTagWithPosition.attr, queryTagIndex: tagIndex }
        }

        return { t: 'fail', reason: 'handler_doesnt_have_attr' }
    }

    if (handlerTag.requiresValue && !queryTag.hasValue() && !queryTag.isParameter) {
        // Mount requires a value and the query doesn't provide.
        if (VerboseTraceFindMatchFails) {
            console.log(`  match failed, handler requires value for '${attr}':`, handler.toDeclString());
        }

        return { t: 'fail', reason: 'handler_requires_value' }
    }

    /*
    if (handlerTag.specificValue) {
        if (queryHasKnownValue) {
            if (tvalEquals(handlerTag.specificValue, tag.value)) {
                return { t: 'exact' };
            } else {
                // Value not equal
                if (VerboseTraceFindMatchFails) {
                    console.log(`  match failed, unequal known value for ${attr}:`, handler.toDeclString());
                }
                return null;
            }
        }

        if (queryWillHaveValue) {
            console.warn(`warning: can't yet support a match that is conditional on value (${attr})`);
            if (VerboseTraceFindMatchFails) {
                console.log(`  match failed, dynamic value for ${attr}:`, handler.toDeclString());
            }
            return null;
        }

        return null;
    }
    */

    /*
    if (tag.hasValue() && (!handlerTag.requiresValue && !handlerTag.isParameter)) {
        // Query provides a value and the mount does accept one, this will overprovide data
        // and the results will need to be filtered.
        
        if (handler.graph.enableOverprovideFilter)
            return { t: 'attr_overprovided' };
        else
            return null;
    }*/

    // Query provides a value and the mount accepts a value.
    return { t: 'exact' };
}

/*
 Try to match this query with this handler.
*/
export function checkOneMatch(ctx: MatchContext, query: Query, handler: Handler): HandlerToQueryMatch {

    if (VerboseTraceFindMatch) {
        console.log('checkOneMatch looking at handler: ' + handler.toDeclString())
    }

    const attrMatches = new Map();
    let unusedOptionalsCount = 0;

    // Check each query tag and try to find it on the handler.
    for (let tagIndex = 0; tagIndex < query.tags.length; tagIndex++) {
        const tag = query.tags[tagIndex];
        if (tag.attr === undefined || tag.attr === 'undefined')
            throw new Error("attr = undefined?");
        
        if (!tag.attr)
            continue;
        
        const match = tryMatchingOneTag(ctx, tag, tagIndex, handler);
        if (!match)
            throw new Error("internal error: missing match");

        if (match.t === 'fail') {
            if (VerboseTraceFindMatch)
                console.log(`  tried matching one tag: ${tag.attr} -> ${match.t} (${match.reason})`);
            return null;
        }

        let matchedHandlerAttr = tag.attr;
        if (match.t === 'positional') {
            matchedHandlerAttr = match.handlerAttr;
        }

        attrMatches.set(matchedHandlerAttr, match);
    }

    // Check each tag on the mount to see if we missed anything required.
    for (const handlerTag of handler.tags) {
        const isSpecialTag = handlerTag.attr === 'task';
        if (handlerTag.isRequired && !attrMatches.has(handlerTag.attr) && !isSpecialTag) {
            // Handler requires this attribute.
            if (VerboseTraceFindMatch) {
                console.log(`  match failed, handler requires attr: ${handlerTag.attr}:`, handler.toDeclString());
            }
            return null;
        }
    }

    if (VerboseTraceFindMatch) {
        console.log(`  match success for:`, handler.toDeclString(), { attrMatches });
    }

    return {
        handler,
        attrs: attrMatches,
        unusedOptionalsCount,
    }
}

export function getClosestWrongQueryMountMatch(ctx: MatchContext, query: Query, handler: Handler) {

    const attrMatches = new Map();
    const matchProblems = [];
    let unusedOptionalsCount = 0;

    // Check each attribute on the query.
    for (let tagIndex = 0; tagIndex < query.tags.length; tagIndex++) {
        const tag = query.tags[tagIndex];
        if (!tag.attr)
            continue;
        
        let match = tryMatchingOneTag(ctx, tag, tagIndex, handler);

        if (!match) {
            if (tag.isAttrOptional) {
                match = { t: 'unused_optional' }
                unusedOptionalsCount++;
                continue;
            }

            if (handler.hasAttr(tag.attr) && handler.requiresValue(tag.attr) && !query.hasValue(tag.attr)) {
                matchProblems.push({
                    attr: tag.attr,
                    t: 'missing_required_value',
                });
                continue;
            }

            matchProblems.push({
                attr: tag.attr,
                t: 'missing_from_point',
            });

            continue;
        }

        attrMatches.set(tag.attr, match);
    }

    // Double check each attr on the handler to see if we missed anything required.
    for (const handlerTag of handler.tags) {
        if (handlerTag.isRequired && !query.hasAttr(handlerTag.attr)) {
            // Handler requires this attribute.
            matchProblems.push({
                t: 'missing_from_query',
                attr: handlerTag.attr,
            });
        }
    }

    return {
        attrs: attrMatches,
        unusedOptionalsCount,
        matchProblems,
    }
}

export function findClosestWrongMatches(ctx: MatchContext, graph: Graph, query: Query) {
    let bestScore = null;
    let bestMatches = null;

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

export function errorForNoTableFound(ctx: MatchContext, graph: Graph, query: Query): ErrorDetails {

    const closestMatches = findClosestWrongMatches(ctx, graph, query);

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
