
import { Plan, ExecutionType, OutputFilterReshape } from './QueryPlan'
import { Stream, c_item, c_schema } from '@andyfischer/streams'
import { Task } from '../task'
import { VerboseLogEveryPlanExecution } from '../Config'
import { runTaskCallback } from '../task/runTaskCallback'

export type QueryParameters = Map<string,any>;

function reshapingFilter(plan: Plan, parameters: QueryParameters, output: Stream, filter: OutputFilterReshape): Stream {
    const fixed = new Stream({
        name: 'reshapingFilter for: ' + plan.query.toQueryString()
    });

    fixed.pipe(evt => {
        switch (evt.t) {
        case c_item: {
            const item = evt.item;
            const fixedItem = {};
            let usedAnyValuesFromItem = false;

            for (const outputAttr of filter.shape) {
                const attr = outputAttr.attr;
                switch (outputAttr.t) {
                case 'from_item':
                    if (item[attr] !== undefined) {
                        fixedItem[attr] = item[attr];
                        usedAnyValuesFromItem = true;
                    } else {
                        fixedItem[attr] = null;
                    }
                    break;
                case 'from_param': {
                    fixedItem[attr] = parameters[attr];
                    break;
                }
                case 'constant':
                    if (item[attr] !== undefined) {
                        fixedItem[attr] = item[attr];
                    } else {
                        fixedItem[attr] = outputAttr.value;
                    }
                    break;
                }
            }

            if (plan.overprovidedAttrs.length > 0)
                // Count the item as "used" even if it's shadowed by overprovided query attrs.
                usedAnyValuesFromItem = true;

            if (usedAnyValuesFromItem)
                output.item(fixedItem);

            break;
        }
        default:
            output.event(evt);
        }
    });

    return fixed;
}

export function executePlan(plan: Plan, parameters: QueryParameters, output: Stream, executionType: ExecutionType = 'normal') {

    const input: Stream = parameters.get('$input');

    if (VerboseLogEveryPlanExecution) {
        plan.consoleLog();
    }

    if (plan.knownError) {
        output.fail(plan.knownError);
        return;
    }

    // Check for required parameters
    for (const input of plan.inputValues) {
        if (input.t === 'input_value_from_params') {
            const attr = input.attr;
            if (!parameters.has(attr)) {
                output.fail({
                    errorMessage: `Missing required parameter: ${attr}`,
                    errorType: 'missing_parameter',
                    related: [{
                        query: plan.query.toQueryString(),
                        missingParameterFor: attr
                    }] });
                return;
            }
        }
    }

    let taskOutput = output;

    // Apply filters to the stream.
    for (const filter of plan.outputFilters) {
        switch (filter.t) {
        case 'reshape':
            taskOutput = reshapingFilter(plan, parameters, taskOutput, filter);
            break;
        case 'whereAttrsEqual':
            throw new Error("need to fix: whereAttrsEqual filter");
            // taskOutput = whereAttrsEqualFilter(plan, parameters, taskOutput, filter);
            break;
        }
    }

    const task = new Task({
        plan,
        graph: plan.graph,
        withQuery: plan.query,
        // afterVerb: plan.afterVerb,
        queryParameters: parameters,
        input,
        output: taskOutput,
        // context: plan.context,
        //plan: plan,
        //trace: null,
        //executionType,
        //schemaOnly: executionType === 'schemaOnly',
    });

    if (plan.verb !== 'get') {
        throw new Error("fix? task.streaming");
        // task.streaming(); // awkward special case - verbs assume streaming
    }

    if (plan.outputSchema)
        task.output.event({ t: c_schema, schema: plan.outputSchema as any });

    if (!plan.nativeCallback) {
        throw new Error("executePlan: plan is missing a nativeCallback");
    }

    runTaskCallback(task, plan.nativeCallback);
}

