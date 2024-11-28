import { it, expect } from 'vitest'
import { LexedText } from '../LexedText';

it("correctly calculates leading indent", () => {
    const text = 
        'first-line also-first-line\n' +
        '  second-line\n' +
        'third-line also-third-line\n' +
        ' fourth-line\n';

    const lexed = new LexedText(text);
    for (const token of lexed.tokens.each()) {
        const text = lexed.getText(token);

        switch (text) {
        case 'first-line':
            expect(token.leadingIndent).toEqual(0);
            break;
        case 'also-first-line':
            expect(token.leadingIndent).toEqual(0);
            break;
        case 'second-line':
            expect(token.leadingIndent).toEqual(2);
            break;
        case 'third-line':
            expect(token.leadingIndent).toEqual(0);
            break;
        case 'also-third-line':
            expect(token.leadingIndent).toEqual(0);
            break;
        case 'fourth-line':
            expect(token.leadingIndent).toEqual(1);
            break;
        }
    }
});