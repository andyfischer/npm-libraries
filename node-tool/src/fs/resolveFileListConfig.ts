
import Path from 'path'
import Fs from 'fs/promises'
import { Query } from '../../query'
import { Table, lazySchema } from '../../table'
import { parseFileQueries } from '../../parser/parseFile';


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
*/

interface FileEntry {
    id?: number;
    localPath: string;
    relPath: string
}

type ParsedConfig = Query[];

export const FileListSchema = lazySchema<FileEntry>({
    name: 'FileList',
    attrs: [
        'id(auto)',
        'localPath',
        'relPath',
    ],
    funcs: [
        'listAll',
        'get(id)',
        'has(localPath)',
        'get(localPath)',
        'get(relPath)',
        'getStatus',
        'deleteAll',
    ]
});

async function isDirectory(path: string) {
    return (await Fs.lstat(path)).isDirectory();
}

export async function resolveFileListConfig(sourceDir: string, configInput: string | ParsedConfig): Promise<Table<FileEntry>> {

    let config: ParsedConfig;

    if (typeof configInput === 'string') {
        config = parseFileQueries(configInput) as ParsedConfig;
    } else {
        config = configInput as ParsedConfig;
    }

    // Validate config
    for (const directive of config) {
        if (directive.t !== 'query') {
            throw new Error("Error with config: expected query, got: " + JSON.stringify(directive));
        }
    }

    if (!await isDirectory(sourceDir)) {
        throw new Error('Usage error: sourceDir must be a directory');
    }

    function getRelPath(localPath: string) {
        return Path.relative(sourceDir, localPath);
    }

    function shouldInclude(localPath: string, defaultValue: boolean) {
        // Returns whether the file should be included (based on the config rules)
        const relPath = getRelPath(localPath);

        for (const directive of config) {
            if (directive.getCommand() === 'include' && directive.getPositionalAttr(1) === relPath)
                return true;
        }

        for (const directive of config) {
            if (directive.getCommand() === 'exclude' && directive.getPositionalAttr(1) === relPath)
                return false;
        }

        return defaultValue;
    }

    async function recursiveIncludeSubDirectory(localDir: string, assumeIncludeContents: boolean) {
        // Include the contents of this directory.
        //
        // assumeIncludeContents:
        //  - Set to 'false' when processing the top-level source directory. We don't include a top
        //    level file unless it is explicitly included.
        //  - Set to 'true' when processing a subdirectory. The subdirectory already matched an
        //    'include' rule so the full recursive contents are included unless otherwise stated.

        const dirContents = await Fs.readdir(localDir);

        for (const dirRelFile of dirContents) {
            const localSubFile = Path.join(localDir, dirRelFile);

            if (!shouldInclude(localSubFile, assumeIncludeContents)) {
                continue;
            }

            if (await isDirectory(localSubFile)) {
                await recursiveIncludeSubDirectory(localSubFile, true);
                continue;
            }

            if (shouldInclude(localSubFile, true)) {
                sourceFiles.insert({
                    localPath: localSubFile,
                    relPath: getRelPath(localSubFile),
                });
            }
        }
    }

    // Populate SourceFiles
    const sourceFiles = FileListSchema.createTable();

    await recursiveIncludeSubDirectory(sourceDir, false);

    return sourceFiles;
}