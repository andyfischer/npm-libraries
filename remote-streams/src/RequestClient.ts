
import type { Stream } from '@andyfischer/streams'

export interface RequestClient<RequestType> {
    sendRequest(request: RequestType, output?: Stream): Stream
    close(): void
}
