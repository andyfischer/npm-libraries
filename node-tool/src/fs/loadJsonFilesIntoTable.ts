import { Table } from "@andyfischer/query"
import fs from 'fs'
import Fs from 'fs/promises';
import Path from 'path'
import { recursiveWalk } from '.'

interface LoadSettings {
    table: Table
    rootDir: string
    enableWatchMode?: boolean
}

export async function loadJsonFilesIntoTable(settings: LoadSettings) {
    const { table } = settings;
    let stillDoingInitialLoad = true;

    if (settings.enableWatchMode) {

        table.assertSupport('has_sourceFilename');
        table.assertSupport('delete_with_sourceFilename');

        const watcher = fs.watch(settings.rootDir, { recursive: true }, (eventType, relFilename) => {
            const filename = Path.join(settings.rootDir, relFilename);

            if (stillDoingInitialLoad && !table.has_sourceFilename(filename)) {
                // Ignore - we haven't loaded this file yet.
                return;
            }

            console.log("File changed:", filename, eventType);

            Fs.readFile(filename, 'utf8').then(contentsText => {
                const contents = JSON.parse(contentsText);
                contents.sourceFilename = filename;
                table.delete_with_sourceFilename(filename);
                table.insert(contents);
            })
            .catch(e => {
                console.error("Error loading updated JSON file:", filename, e);
            });
        });

        process.on('exit', () => {
            watcher.close();
        });
    }

    for await (const filename of recursiveWalk(settings.rootDir)) {
        const validExtension = filename.endsWith('.json');

        if (!validExtension)
            continue;

        try {
            const contentsText = await Fs.readFile(filename, 'utf8');
            const contents = JSON.parse(contentsText);

            contents.sourceFilename = filename;

            table.insert(contents);
        } catch (e) {
            console.error("Error loading JSON file:", filename, e);
        }
    }

    stillDoingInitialLoad = false;
}
