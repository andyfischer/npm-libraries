
import { Task } from '../task'
import { Stream } from '@andyfischer/streams'

export type TaskCallback = (task: Task) => Stream

export interface HandlerTag {
    attr: string
    isParameter: boolean
    isRequired?: boolean
    requiresValue?: boolean
    assumeInclude?: boolean
    isOutput?: boolean
    expectedType?: 'integer' | 'boolean' | 'string'
    isPositional?: boolean
}

export class Handler {
    t = 'handler'

    tags: HandlerTag[]
    run: TaskCallback
    primaryAttr?: string
    byAttr: Map<string,number>
    frozen: boolean

    constructor(tags: HandlerTag[]) {
        this.tags = tags;
        this.compile();
    }

    setCallback(callback: TaskCallback) {
        if (this.frozen)
            throw new Error("handler is frozen");
        this.run = callback;
    }

    freeze() {
        if (this.frozen)
            return;

        for (const tag of this.tags) { Object.freeze(tag) }
        Object.freeze(this.tags);
        Object.freeze(this.byAttr);
        this.frozen = true;
        Object.freeze(this);
    }

    compile() {
        const firstTag = this.tags[0];
        if (firstTag && !firstTag.requiresValue && !firstTag.isOutput)
            this.primaryAttr = firstTag.attr;

        this.byAttr = new Map();

        for (let i = 0; i < this.tags.length; i++) {
            const tag = this.tags[i];
            if (this.byAttr.has(tag.attr))
                throw new Error("duplicate attr: " + tag.attr);
            this.byAttr.set(tag.attr, i);
        }
    }

    hasAttr(attr: string) {
        return this.byAttr.has(attr);
    }

    requiresAttr(attr: string) {
        const tag = this.getTag(attr);
        return tag && tag.isRequired;
    }

    requiresValue(attr: string) {
        const tag = this.getTag(attr);
        return tag && tag.requiresValue;
    }

    getTag(attr: string) {
        if (!this.hasAttr(attr))
            return null;

        return this.tags[this.byAttr.get(attr)];
    }

    without(attr: string) {
        const tags = this.tags.filter(tag => tag.attr !== attr);
        return new Handler(tags);
    }

    withParameter(attr: string) {
        return new Handler(
            this.tags.concat([ { attr, isParameter: true } ])
        );
    }

    addTag(tag: HandlerTag) {
        return new Handler(
            this.tags.concat([tag])
        );
    }

    withCallback(callback: TaskCallback) {
        const out = new Handler(this.tags);
        out.run = callback;
        return out;
    }

    getParamAttrs() {
        const attrs: string[] = []
        for (const tag of this.tags)
            if (tag.isParameter)
                attrs.push(tag.attr)
        return attrs;
    }


    toDeclString() {
        return handlerToDeclString(this);
    }
}

function handlerToDeclString(handler: Handler) {
    const inputTags = [];
    const outputTags = [];

    for (const tag of handler.tags) {
        if (tag.isOutput && !tag.isRequired && !tag.isParameter) {
            outputTags.push(tag.attr);
        } else {
            let mustUseQuerySyntax = tag.isPositional;

            if (mustUseQuerySyntax) {
                let queryElements = [];
                if (!tag.isRequired)
                    queryElements.push('optional');
                if (tag.isPositional)
                    queryElements.push('positional');
                const tagStr = `${tag.attr}(${queryElements.join(' ')})`;
                inputTags.push(tagStr);
            } else {
                let tagStr = tag.attr;
                if (tag.requiresValue)
                    tagStr = '$' + tagStr;

                if (!tag.isRequired)
                    tagStr += '?';

                if (tag.isParameter && !tag.requiresValue)
                    tagStr += '=?';

                inputTags.push(tagStr);
            }
        }
    }

    let str = inputTags.join(' ');
    if (outputTags.length > 0) {
        if (str !== '')
            str += ' ';
        str += '-> ' + outputTags.join(' ');
    }

    return str;
}
