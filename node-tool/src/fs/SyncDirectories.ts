
import Path from 'path'
import Fs from 'fs/promises'
import { Query } from '../../query'
import { Table, lazySchema } from '../../table'
import { parseFileQueries } from '../../parser/parseFile';
import { getFileHash } from './getFileHash'
import { Stream } from '@andyfischer/streams'
import { fileExists } from '.'

interface SourceFile {
    id?: number;
    localPath: string;
    relPath: string
}

interface SourceManifestEntry {
    id: number
    relPath: string
    sha: string
}

export const SourceManifestSchema = lazySchema<SourceManifestEntry>({
    name: 'SourceManifest',
    attrs: [
        'id(auto)',
        'relPath',
        'sha',
    ],
    funcs: [
        'listAll',
        'get(id)',
        'get(relPath)',
        'getStatus',
        'deleteAll',
    ]
});

/*
Example config file:

const config = `
    include chrome-extension;
    include src;

    exclude .git;
    exclude chrome-extension/dist;
    exclude src/.rqe-import-settings.rqe;
    exclude src/build/exportSource.ts;
    exclude src/resort-tracker;
    exclude src/web-server;
    exclude src/playback-server;
    exclude src/misc-tasks;
    exclude src/task-schedule;

    ignore-destination node_modules;
    ignore-destination .git;
    ignore-destination yarn.lock;
    ignore-destination dist;
    ignore-destination chrome-extension/dist;
    ignore-destination package.json;
    ignore-destination tsconfig.json;
`;
*/

export async function getSourceManifest(sources: Table<SourceFile>) {
    const manifest = SourceManifestSchema.createTable();
    let promises = [];

    for (const source of sources.each()) {
        promises.push((async () => {
            manifest.insert({
                id: source.id,
                relPath: source.relPath,
                sha: await getFileHash(source.localPath),
            });
        })());
    }

    await Promise.all(promises);
    return manifest;
}

interface ApplyManifestOptions {
    targetDir: string
    manifest: Table<SourceManifestEntry>
    config: string
    borrowFilesFromDir?: string
    responseStream: Stream
}

async function setupEmptyDirectories(targetDir: string, manifest: Table<SourceManifestEntry>) {
    const neededLocalDirectories = new Set<string>();

    for (const file of manifest.each()) {
        const localPath = Path.join(targetDir, file.relPath);

        // Check every parent directory
        let nextNeededLocalDir = Path.dirname(localPath);

        while (true) {
            if (neededLocalDirectories.has(nextNeededLocalDir)) {
                // Already known
                break;
            }

            if (nextNeededLocalDir === '.' || nextNeededLocalDir === targetDir || !nextNeededLocalDir.startsWith(targetDir)) {
                // Root directory or outside of targetDir
                break;
            }

            neededLocalDirectories.add(nextNeededLocalDir);
            nextNeededLocalDir = Path.dirname(nextNeededLocalDir);
            continue;
        }
    }

    const neededList = Array.from(neededLocalDirectories).sort((a, b) => a.length - b.length);

    for (const dir of neededList) {
        if (!await fileExists(dir)) {
            await Fs.mkdir(dir);
        }
    }
}

async function deleteExtraFiles(targetDir: string, manifest: Table<SourceManifestEntry>) {
    // TODO
}

async function getOptionalFileHash(localPath: string) {
    try {
        return await getFileHash(localPath);
    } catch (e) {
        return null;
    }
}

export async function checkManifest(targetDir: string, manifest: Table<SourceManifestEntry>) {
    const promises = [];
    const errors = [];
    for (const file of manifest.each()) {
        promises.push((async () => {
            const localPath = Path.join(targetDir, file.relPath);
            const localSha = await getOptionalFileHash(localPath);

            if (!localSha) {
                errors.push("Missing local file: " + file.relPath);
            } else if (localSha !== file.sha) {
                errors.push("Local file has wrong content: " + file.relPath);
            }
        })());
    }

    await Promise.all(promises);
    return {
        ok: errors.length === 0,
        errors
    };
}

export async function applyManifestToDestination(options: ApplyManifestOptions) {
    const config = parseFileQueries(options.config) as Query[];

    await setupEmptyDirectories(options.targetDir, options.manifest);

    // Check the sha of every incoming file
    const promises = [];
    for (const file of options.manifest.each()) {
        promises.push((async () => {
            const localPath = Path.join(options.targetDir, file.relPath);
            const localSha = await getOptionalFileHash(localPath);

            if (localSha && localSha === file.sha) {
                // Existing file is good.
                return;
            }

            if (options.borrowFilesFromDir) {
                const localBorrowPath = Path.join(options.borrowFilesFromDir, file.relPath);
                const borrowPathSha = await getOptionalFileHash(localBorrowPath);
                if (borrowPathSha && borrowPathSha === file.sha) {
                    // We can use the borrow file.
                    // Future: could speed this up with `ln` ?
                    await Fs.copyFile(localBorrowPath, localPath);
                    return;
                }
            }

            // Need the file.
            let reason = (localSha === null) ? 'missing' : 'changed';
            options.responseStream.item({ t: 'need_file', relPath: file.relPath, reason });
        })());
    }

    await deleteExtraFiles(options.targetDir, options.manifest);
    await Promise.all(promises);

    options.responseStream.done();
}
