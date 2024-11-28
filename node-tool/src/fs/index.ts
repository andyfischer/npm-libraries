import Fs from 'fs/promises'
import { constants as FsConstants } from 'fs'
import Path from 'path'

export { recursiveWalk, recursiveWalkRelative } from './RecursiveWalk'

export async function fileExists(path: string) {
    try {
        await Fs.stat(path);
        return true;
    } catch (err) {
        return false;
    }
}

export async function ensureDir(path: string) {
    if (!path)
        return;

    const parent = Path.dirname(path);

    if (parent && parent != path)
        await ensureDir(parent);

    let stat;

    try {
        stat = await Fs.stat(path);
    } catch (e) {
        // file not found, create it
        await Fs.mkdir(path);
        return;
    }

    if (!stat.isDirectory())
        throw new Error('Path is not a directory' + path);
}

export async function ensureParentDir(path: string) {
    return ensureDir(Path.dirname(path));
}

export async function ensureWritable(path: string) {
    try {
        await Fs.access(path, FsConstants.W_OK);
        return;
    } catch (e) {
        if (e.code === 'ENOENT') {
            return;
        }

        if (e.code === 'EACCES') {
            await Fs.chmod(path, 0o666);
            return;
        }

        throw e;
    }
}