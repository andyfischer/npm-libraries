
import { callbackToStream } from '../handler/NativeCallback'
import { Stream } from "@andyfischer/streams"
import { Task } from './Task'

export type TaskCallback = (task: Task) => Stream

export function runTaskCallback(task: Task, callback: TaskCallback) {
    callbackToStream(() => {
        return callback(task);
    }, task.output);
}
