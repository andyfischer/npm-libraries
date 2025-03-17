
import { Plan } from '../query/QueryPlan'
import { Graph } from '../graph'
import { Query, QueryLike, QueryParameters } from '../query'
import { c_log_info, Stream } from "@andyfischer/streams"

export interface Args {
    graph: Graph
    withQuery: Query
    input: Stream
    output: Stream
    plan: Plan
    queryParameters: QueryParameters
}

export class Task {
    graph: Graph

    input: Stream
    output: Stream

    withQuery: Query
    queryParameters: QueryParameters

    plan: Plan

    t = 'task'

    constructor(args: Args) {
        this.graph = args.graph;
        this.withQuery = args.withQuery;
        this.queryParameters = args.queryParameters;
        this.input = args.input;
        this.output = args.output;
        this.plan = args.plan;
    }

    // Query accessors
    hasAttr(attr: string) {
        return this.withQuery.hasAttr(attr);
    }

    hasValue(attr: string) {
        const tag = this.withQuery.getAttr(attr);
        if (!tag)
            return false;

        return this.queryParameters.has(attr) || tag.hasValue();
    }

    getValue(attr: string) {
        const tag = this.withQuery.getAttr(attr);
        if (!tag) {
            return null;
        }

        if (this.queryParameters.has(attr))
            return this.queryParameters.get(attr);

        return tag.getValue();
    }

    query(queryLike: QueryLike, params?: QueryParameters): Stream<any> {
        return this.graph.query(queryLike, params);
    }

    put(item: any) {
        this.output.item(item);
    }

    log(message: string, data?: any) {
        this.output.event({ t: c_log_info, message, details: { data } })
    }
}
