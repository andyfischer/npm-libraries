
import readline from 'readline'
import { ReplInputState } from './ReplInputState';
import { IDSource } from '@andyfischer/streams';
import { getCommandPromptDefault, setCommandPromptDefault } from './ReplSqliteDatabase';

export class InterruptError extends Error {
    constructor() {
        super('Interrupted');
    }
}

export enum InputCommandType {
    input,
    blank_line,
    sigint
}

export interface InputCommand {
    type: InputCommandType;
    value?: string;
}

export interface InputContext {
    prompt?: string
    autocomplete?: (input: string) => string[];
    persistDefaultWithKey?: string;
}

let _hasSetupStdin = false;
let _keypressListener: any;
let _currentOperationId = null;
let _currentOperationType: string | null = null;
let _nextOperationId = new IDSource();

function initializeStdinListener() {
    if (_hasSetupStdin) {
        return;
    }

    // console.log('Setting up stdin listener');

    readline.emitKeypressEvents(process.stdin);
    _hasSetupStdin = true;

    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.on('keypress', (str, key) => {
        if (_keypressListener) {
            _keypressListener(str, key);
        }
    });
    process.stdin.resume();
}

export function closeStdinListener() {
    if (_hasSetupStdin) {
        process.stdin.pause();
        process.stdin.removeAllListeners('keypress');
        _hasSetupStdin = false;
    }
}

function idleKeypressListener(str, key) {
    key = key || {};

    const isControlKey = key.ctrl === true && key.shift === false && key.meta === false;

    if (isControlKey) {
        const lowerCaseKey = key.name && key.name.toLowerCase();
        switch (lowerCaseKey) {
        case 'c':
            // Treat as sigint
            process.exit(0);
            break;
        case 'd':
            // Treat as sigint
            process.exit(0);
            break;
        }
    }
}

export function readInputCommand(context: InputContext): Promise<InputCommand> {
    initializeStdinListener();

    if (_currentOperationType) {
        throw new Error(`readInputLine called while another input operation (${_currentOperationType}) is in progress`);
    }

    const operationId = _nextOperationId.take();
    _currentOperationId = operationId;
    _currentOperationType = 'readInputLine';

    const inputState = new ReplInputState({
        prompt: context.prompt,
    });
    let resolve;

    const promise = new Promise<InputCommand>((_resolve, reject) => {
        resolve = _resolve;
    });

    function finish(input: InputCommand) {
        if (_currentOperationId !== operationId) {
            console.log('dangling finish()');
            return;
        }

        _currentOperationId = null;
        _currentOperationType = null;
        _keypressListener = idleKeypressListener;
        resolve(input);
    }

    _keypressListener = (str, key) => {
        key = key || {};

        const isControlKey = key.ctrl === true && key.shift === false && key.meta === false;

        if (isControlKey) {
            const lowerCaseKey = key.name && key.name.toLowerCase();

            // console.log('lowerCaseKey:', lowerCaseKey);

            switch (lowerCaseKey) {
            case 'a':
                inputState.toLineStart();
                inputState.ttyRedraw();
                return;

            case 'e':
                inputState.toLineEnd();
                inputState.ttyRedraw();
                return;

            case 'c':
                console.log('got control-c');
                // Treat as sigint
                process.exit(0);
                /*
                finish({
                    type: InputCommandType.sigint
                });
                */
                return;

            case 'd':
                finish({
                    type: InputCommandType.sigint
                });
                return;

            default:
                // unrecognized control key
                return
            }
        }

        switch (key.name) {
            case 'left':
                inputState.left();
                inputState.ttyRedraw();
                return;

            case 'right':
                inputState.right();
                inputState.ttyRedraw();
                return;

            case 'up':
                inputState.historyBack();
                inputState.ttyRedraw();
                return;

            case 'down':
                inputState.historyForward();
                inputState.ttyRedraw();
                return;

            case 'backspace':
                inputState.backspace();
                inputState.ttyRedraw();
                return;

            case 'tab':
                if (context.autocomplete) {
                    const completions = context.autocomplete(inputState.text);
                    if (completions.length > 0) {
                        inputState.setText(completions[0]);
                        inputState.ttyRedraw();
                    }
                }
                return;

            case 'return':
                process.stdout.write('\n');

                if (inputState.text.trim() === '') {
                    finish({
                        type: InputCommandType.blank_line
                    });
                    return;
                }

                inputState.onSubmit();
                finish({
                    type: InputCommandType.input,
                    value: inputState.text
                });
                return;
        }

        if (str != null) {
            inputState.insertText(str);
            inputState.ttyRedraw();
        }
    }

    inputState.ttyRedraw();

    return promise;
}

export async function readInputLine(context: InputContext): Promise<string> {

    // Set up prompt string
    let defaultInput = null;
    if (context.persistDefaultWithKey) {
        defaultInput = getCommandPromptDefault(context.persistDefaultWithKey);
    }

    let prompt = context.prompt || '';
    if (defaultInput != null) {
        prompt += ` [${defaultInput}] `;
    }

    const command = await readInputCommand({
        ...context,
        prompt,
    });

    switch (command.type) {
        case InputCommandType.blank_line:
            if (defaultInput != null) {
                return defaultInput;
            }
            return '';

        case InputCommandType.sigint:
            throw new InterruptError();

        case InputCommandType.input:

            if (context.persistDefaultWithKey) {
                setCommandPromptDefault(context.persistDefaultWithKey, command.value);
            }

            return command.value;
    }
}