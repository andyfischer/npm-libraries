import { CommandSet } from "./CommandSet";
import { NodeKeepalive } from "./NodeKeepalive";
import { InputCommandType, InterruptError, readInputCommand } from "./readInput";

interface ReplContext {
    prompt?: string
    commands?: CommandSet;
    onCommand?(str: string): Promise<void> | void;
}

async function handleCommandStr(context: ReplContext, commandStr: string) {
    try {
        if (context.onCommand) {
            await context.onCommand(commandStr);
            return;
        }

        if (context.commands && context.commands.hasCommand(commandStr)) {
            await context.commands.runCommand(commandStr);
            return;
        }

        console.error('Unknown command:', commandStr);

    } catch (err) {
        console.error(`Unhandled exception while running ${commandStr}:`);
        console.error(err);
    }
}

export async function replLoop(context: ReplContext) {

    const keepalive = new NodeKeepalive();

    try {
        while (true) {
            const command = await readInputCommand({
                prompt: context.prompt,
                autocomplete: context.commands && ((input) => context.commands.autocomplete(input))
            });

            // console.log('got command:', command);

            switch (command.type) {

            case InputCommandType.blank_line:
                continue;

            case InputCommandType.sigint:
                return;

            case InputCommandType.input:
                await handleCommandStr(context, command.value);
                break;
            }
        }
    } finally {
        keepalive.stop();
    }
}