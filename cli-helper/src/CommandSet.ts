import { InputContext } from "./readInput";

export class CommandSet {
    commands = new Map<string, () => void>();

    register(command: string, callback: () => void) {
        this.commands.set(command, callback);
    }

    hasCommand(command: string): boolean {
        return this.commands.has(command);
    }

    runCommand(command: string) {  
        const func = this.commands.get(command);
        return func();
    }

    autocomplete(input: string) {
        return Array.from(this.commands.keys()).filter(command => command.startsWith(input));
    }
}