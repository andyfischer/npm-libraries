
export async function* readStreamingFetchResponse(fetchResponse) {
    if (fetchResponse.body.getReader) {
        // Browser standard support for streaming fetch.
        const reader = fetchResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            return;
          }

          const text = decoder.decode(value);
          yield text;
        }
    } else {
        // Node.js alternative for streaming fetch.
        for await (const chunk of fetchResponse.body) {
            yield chunk.toString();
        }
    }
}

