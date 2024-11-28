import { IndexSchema } from '../table/IndexSchema'
import { MapIndex } from './MapIndex'
import { MultiMapIndex } from './MultiMapIndex'
import { ListIndex } from './ListIndex'
import { TableIndex } from '../table/TableIndex';
import { SingleValueIndex } from './SingleValueIndex';

export function createIndex(indexSchema: IndexSchema): TableIndex {
    switch (indexSchema.indexType) {
        case 'map':
            return new MapIndex(indexSchema);

        case 'list':
            return new ListIndex(indexSchema);

        case 'multimap':
            return new MultiMapIndex(indexSchema);

        case 'single_value':
            return new SingleValueIndex(indexSchema);

        default:
            throw new Error("internal error, unrecognized index type: " + this.indexType);
    }
}
