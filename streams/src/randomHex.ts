
const hexAlphanumeric = '0123456789abcdef';
const hexAlpha = 'abcdef';
const fullAlpha = 'abcdefghijklmnopqrstuvwxyz';

function randInt(max: number) {
    return Math.floor(Math.random() * Math.floor(max));
}

/*
   Generate a random hex string of the given length.

   Not cryptographically secure.
*/
export function randomHex(length: number) {
    let out = '';

    out += hexAlpha[randInt(hexAlpha.length)];
    length--;

    while (length > 0) {
        out += hexAlphanumeric[randInt(hexAlphanumeric.length)];
        length--;
    }
    return out;
}

/*
   Generate a random string of alphabetic characters.

   Not cryptographically secure.
*/
export function randomAlpha(length: number) {
    let out = '';
    while (length > 0) {
        out += fullAlpha[randInt(fullAlpha.length)];
        length--;
    }
    return out;
}