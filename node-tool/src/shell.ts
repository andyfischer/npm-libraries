
import { Stream, StreamEvent, c_done, c_item, captureError } from '@andyfischer/streams'
import { spawn as nodeSpawn } from 'child_process'

type SpawnOptions = Parameters<typeof nodeSpawn>[2];

export type ProcessEvent = StdoutEvent | StderrEvent | ExitEvent;

export interface StdoutEvent {
    t: 'stdout'
    line: string
}

export interface StderrEvent {
    t: 'stderr'
    line: string
}

export interface ExitEvent {
    t: 'exit'
    code: number
}

export interface SpawnProcess {
    output: Stream<ProcessEvent>
    proc: any
}

export function spawn(command: string | string[], options: SpawnOptions = {}): SpawnProcess {

    if (typeof command === 'string') {
        command = command.split(' ')
    }

    command = command as string[];

    const output = new Stream<ProcessEvent>();

    const proc = nodeSpawn(command[0], command.slice(1), options);

    proc.stdout.on('data', data => {
        const dataStr = data.toString();
        for (const line of dataStr.split('\n')) {
            output.item({ t: 'stdout', line })
        }
    });

    proc.stderr.on('data', data => {
        const dataStr = data.toString();
        for (const line of dataStr.split('\n')) {
            output.item({ t: 'stderr', line })
        }
    });

    proc.on('error', err => {
        output.logError({errorMessage: err.message, errorType: 'child_process_error', cause: captureError(err)});
    });

    proc.on('close', code => {
        if (output.isClosed())
            return;

        output.item({ t: 'exit', code });
        output.done();
    });

    return { output, proc }
}

export function spawnAndCollectOutput(command: string | string[], options: SpawnOptions = {}): Stream<string> {
    let outputLines = [];
    let outputStream = new Stream();

    spawn(command, options).output.pipe((evt: StreamEvent<ProcessEvent>) => {
        switch (evt.t) {
            case c_item:
                switch (evt.item.t) {
                    case 'stdout':
                        outputLines.push(evt.item.line);
                        break;
                    case 'stderr':
                        outputStream.logError({ errorMessage: evt.item.line });
                        break;
                }
                break;

            case c_done:
                outputStream.item(outputLines.join(''));
                outputStream.done();
                break;

            default:
                outputStream.event(evt);
                break;
        }
    });

    return outputStream;
}