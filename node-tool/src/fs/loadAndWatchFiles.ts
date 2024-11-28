
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { recursiveWalk } from "./RecursiveWalk2";

interface LoadSettings {
    rootDir: string
    onFileLoad(filename: string): Promise<void>
    onFileDelete?(filename: string): Promise<void>
}

export interface FileWatcher {
    close(): void
    finishedInitialLoad: Promise<void>
}

export function loadAndWatchFiles(settings: LoadSettings): FileWatcher {
    let stillDoingInitialLoad = true;
    const filenamesLoaded = new Set();

    let fsWatcher = fs.watch(settings.rootDir, { recursive: true }, (eventType, relFilename) => {

        const filename = path.join(settings.rootDir, relFilename);

        (async () => {
            // Check if the file still exists, maybe it was deleted.

            let exists = false;
            try {
                await fsp.access(filename);
                exists = true;
            } catch (e) {
            } 

            if (exists) {
                await settings.onFileLoad(filename);
            } else {
                if (settings.onFileDelete)
                    await settings.onFileDelete(filename);
            }
        })()
        .catch(e => {
            console.error("Uncaught error loading file:", filename, e);
        });


        // console.log("File changed:", filename, eventType);

    });

    process.on('exit', () => {
        if (fsWatcher) {
            fsWatcher.close();
        }
    });

    const finishedInitialLoad = recursiveWalk(settings.rootDir, async (filename) => {
        filenamesLoaded.add(filename);

        try {
            await settings.onFileLoad(filename);
        } catch (e) {
            console.error("Error loading JSON file:", filename, e);
        }
    });

    stillDoingInitialLoad = false;

    return {
        close() {
            if (fsWatcher) {
                fsWatcher.close();
                fsWatcher = null;
            }
        },
        finishedInitialLoad
    }
}

