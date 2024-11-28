
/*
  callbackBasedIterator

  Utility function that creates an AsyncIterator which is driven by a callback-based API.

  Returns an object with three properties:

    - send(item: ItemType): void
      - Sends an item to the iterator.

    - done(): void
      - Closes the iterator.

    - it: AsyncIterable<ItemType>
      - The actual iterator, which will yield items sent to send()

  Example code:

    const { send, done, it } = callbackBasedIterator<number>();

    // Send items to the iterator.
    send(1);
    send(2);
    send(3);

    // Mark the iterator as done.
    done();

    // Iterate over the items.
    for await (const item of it) {
        console.log(item);
    }
*/
export function callbackBasedIterator<ItemType = any>() {

    let incoming: ItemType[] = [];
    let isDone = false;
    let unpauseIterator: () => void = null;

    // 'Send' callback - Push to 'incoming' list and unpauses the iterator loop.
    function send(item: ItemType) {
        if (isDone)
            throw new Error('usage error: called send() after done()');

        incoming.push(item);

        if (unpauseIterator)
            unpauseIterator();
    }
    
    // 'Done' callback - Marks us as done and unpauses the iterator loop.
    function done() {
        isDone = true;

        if (unpauseIterator)
            unpauseIterator();
    }
    
    // Async iterator loop - Reads from the 'incoming' list and pauses when idle.
    const it: AsyncIterable<ItemType> = {
        [Symbol.asyncIterator]: async function* () {
            while (true) {
                while (incoming.length > 0) {
                    // Pass along all items from the 'incoming' list.
                    const received: ItemType[] = incoming;
                    incoming = [];

                    for (const msg of received) {
                        yield msg;
                    }
                }

                if (isDone)
                    return;

                // Wait until the callbacks trigger unpauseIterator.
                await new Promise<void>(r => { unpauseIterator = r });
                unpauseIterator = null;
            }
        }
    };

    return {
        send,
        done,
        it,
    }
}

