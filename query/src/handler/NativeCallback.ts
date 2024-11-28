
import { Stream, exceptionIsBackpressureStop, recordUnhandledError, dynamicOutputToStream } from '@andyfischer/streams';
import { parseHandler } from '../parser/parseHandler';
import { Task } from '../task';
import { Query } from '../query';

/*
 * Execute a callback and send the result to the output Stream.
 *
 * This uses resolveOutputToStream for resolving the output value.
 * This function also catches exceptions and sends them as an error
 * into the Stream.
 */
export function callbackToStream(callback: Function, stream: Stream) {

    let output;

    try {
        output = callback();

    } catch (e) {
        if (stream.closedByUpstream) {
            recordUnhandledError(e);
            return;
        }

        if (exceptionIsBackpressureStop(e)) {
            // Function was deliberately killed by a BackpressureStop exception.
            return;
        }

        stream.fail(e);
        return;
    }

    dynamicOutputToStream(output, stream);
}

export function declaredFunctionToHandler(decl: string, callback: Function) {

    const handler = parseHandler(decl);

    const params = handler.getParamAttrs();

    handler.setCallback((task: Task) => {
        const stream = new Stream();

        callbackToStream(() => {
            const inputs: any[] = [];

            function addInputValue(value: any) {
                if (value?.t === 'query') {
                    const nestedQuery: Query = value as Query;

                    // Capture parameters
                    value = nestedQuery.withInlinedParams(task.queryParameters);
                }

                inputs.push(value);
            }

            // Fetch input values
            for (const inputPlan of task.plan.inputValues) {
                switch (inputPlan.t) {

                    case 'input_value_from_params':
                        addInputValue(task.queryParameters.get(inputPlan.attr));
                        break;
                    case 'input_value_from_query_attr':
                        addInputValue(task.withQuery.getAttr(inputPlan.attr).getValue());
                        break;
                    case 'input_value_not_provided':
                        addInputValue(null);
                        break;
                    case 'input_attr_from_query_index':
                        addInputValue(task.withQuery.tagAtIndex(inputPlan.index).attr);
                        break;
                    case 'special_input_value_task':
                        addInputValue(task);
                        break;

                    default:
                        console.error("internal error: unknown input plan type", inputPlan);

                }
            }

            return callback(...inputs);

        }, stream);

        return stream;
    });

    return handler;
}
