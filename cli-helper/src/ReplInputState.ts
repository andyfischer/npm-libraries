
import readline from 'readline'
import { getDatabase, getNextIndexValue, historyAppend } from './ReplSqliteDatabase'

export class ReplInputState {
    text: string = '';
    prompt: string = '';
    cursorPosition: number = 0;
    historyIndex: number | null = null;

    constructor({ prompt }: { prompt: string }) {
        this.prompt = prompt || '> ';
    }

    insertText(text: string) {
        this.text = this.text.slice(0, this.cursorPosition) + text + this.text.slice(this.cursorPosition);
        this.cursorPosition += text.length;
    }

    backspace() {
        if (this.cursorPosition > 0) {
            this.text = this.text.slice(0, this.cursorPosition - 1) + this.text.slice(this.cursorPosition);
            this.cursorPosition -= 1;
        }
    }

    left() {
        if (this.cursorPosition > 0) {
            this.cursorPosition--;
        }
    }

    right() {
        if (this.cursorPosition < this.text.length) {
            this.cursorPosition++;
        }   
    }

    historyBack() {
        if (this.historyIndex === null) {
            this.historyIndex = getNextIndexValue('history_index') - 1;
        } else if (this.historyIndex <= 0) {
            return; 
        } else {
            this.historyIndex--;
        }

        const db = getDatabase();
        const row = db.get(`select line from history where line_index = ?`, [this.historyIndex]);
        if (!row) {
            return;
        }

        this.text = row.line;
        this.cursorPosition = this.text.length;
    }

    historyForward() {
        const lastIndex = getNextIndexValue('history_index');

        if (this.historyIndex === null) {
            return;
        }

        if (this.historyIndex >= lastIndex - 1) {
            this.historyIndex = null;
            this.text = '';
            this.cursorPosition = 0;
            return;
        }

        this.historyIndex++;

        const db = getDatabase();
        const row = db.get(`select line from history where line_index = ?`, [this.historyIndex]);
        if (!row) {
            return;
        }

        this.text = row.line;
        this.cursorPosition = this.text.length;
    }

    toLineStart() {
        this.cursorPosition = 0;
    }

    toLineEnd() {
        this.cursorPosition = this.text.length;
    }

    ttyRedraw() {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        process.stdout.write(this.prompt + this.text);
        readline.cursorTo(process.stdout, this.prompt.length + this.cursorPosition);
    }

    setText(text: string) {
        this.text = text;
        this.cursorPosition = text.length;
    }

    onSubmit() {
        // Add to history
        historyAppend(this.text);
        this.historyIndex = null;
    }
}
