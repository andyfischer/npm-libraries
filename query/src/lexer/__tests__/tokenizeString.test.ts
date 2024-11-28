
import { it, expect } from 'vitest'

import { lexifyString } from "..";

it('pairs braces', () => {
    const lexed = lexifyString('{ }');
    expect(lexed.tokens.length).toEqual(3);
    expect(lexed.tokens[0].pairsWithIndex).toEqual(2);
    expect(lexed.tokens[2].pairsWithIndex).toEqual(0);
});
