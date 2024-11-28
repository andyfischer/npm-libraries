
import fs from 'fs';
import crypto from 'crypto';

export function getFileHash(path: string) {
    return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(path);
    rs.on('error', reject);
    rs.on('data', chunk => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
   });
}