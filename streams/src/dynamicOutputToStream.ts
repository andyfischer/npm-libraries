import { exceptionIsBackpressureStop } from "./BackpressureStop";
import { recordUnhandledError } from "./Errors";
import { Stream } from "./Stream";


/*
 Take a function's output, check the runtime type, and convert it to
 Stream events using these rules:
 
  The output value can be:
     - Stream object: pipe it into the result stream.
     - Array: send all the items in the array as stream items.
     - Other object: send it as a single stream item.
     - Promise/Async: wait for the promise to resolve, then handle the value as above.

 */
export function dynamicOutputToStream(output: any, stream: Stream) {
    if (!output) {
        stream.done();
        return;
    }

    if (output.t === 'stream') {
        output.pipe(stream);
        return;
    }

    if (output.t === 'table') {
        for (const item of output.each())
            stream.item(item);
        stream.done();
        return;
    }

    if (Array.isArray(output)) {
        stream.schema({hint: 'list'});
        for (const el of output)
            stream.item(el);
        stream.done();
        return;
    }

    const isObject = typeof output === 'object';

    if (isObject && output[Symbol.iterator] !== undefined) {
        stream.schema({hint: 'list'});
        for (const el of output)
            stream.item(el);
        stream.done();
        return;
    }

    if (isObject && output[Symbol.asyncIterator] !== undefined) {
        stream.schema({hint: 'list'});
        (async () => {
            for await (const el of output)
                stream.item(el);
            stream.done();
        })();
        return;
    }

    if (output.then) {
        output.then(resolved => {
            dynamicOutputToStream(resolved, stream);
        })
        .catch(e => {

            console.error('caught error .catch', e);

            if (stream.closedByUpstream) {
                recordUnhandledError(e);
                return;
            }

            stream.fail(e);
        });

        return;
    }

    stream.schema({hint: 'value'});
    stream.item(output);
    stream.done();
}

/*
  Call the callback function and send its output to the stream, using
  the conversion rules in dynamicOutputToStream.

  This style has the advantage that it will catch any (synchronous)
  exceptions thrown, and send them as stream failures.
*/
export function callbackToStream(callback: Function, stream: Stream) {
    try {
        const output = callback();
        dynamicOutputToStream(output, stream);

    } catch (e) {

        console.error('caught error (catch{})', e);

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
}
