
import { QueryParameters } from '../graph'
import { QueryTag, TagValue } from './QueryTag'

export type QueryLike = string | Query | QueryNode
export type QueryNode = MultistepQuery | Query | QueryTag
export { QueryTag } from './QueryTag'

export class MultistepQuery {
    t: 'multistep' = 'multistep'
    steps: Query[]

    constructor(steps: Query[]) {
        this.steps = steps
    }

    toQueryString() {
        let sections = this.steps.map(step => step.toQueryString());
        return sections.join(' | ');
    }
}

export class Query {
    t: 'query' = 'query'
    tags: QueryTag[]
    tagsByAttr: Map<string, QueryTag>
    frozen: boolean = false

    constructor(tags: QueryTag[]) {
        this.tags = tags;
        this._refresh();
    }

    addTag(attr: string, value: TagValue = null) {
        if (this.frozen)
            throw new Error("Query is frozen");

        const tag = new QueryTag(attr, value);
        this.tags.push(tag);
        return tag;
    }

    freeze() {
        if (this.frozen)
            return;
        this.frozen = true;
        for (const tag of this.tags)
            tag.freeze();
        Object.freeze(this);
    }

    withoutFirstTag() {
        return new Query(this.tags.slice(1));
    }

    has(attr: string) {
        return this.tagsByAttr.has(attr);
    }

    hasAttr(attr: string) {
        return this.tagsByAttr.has(attr);
    }

    hasValue(attr: string) {
        const tag = this.getAttr(attr);
        return tag && tag.hasValue();
    }

    getValue(attr: string) {
        const tag = this.getAttr(attr);
        if (!tag)
            throw new Error("no value for: " + attr);
        return tag.getValue();
    }

    getStringValue(attr: string) {
        const tag = this.getAttr(attr);
        if (!tag)
            throw new Error("no value for: " + attr);
        return tag.getStringValue();
    }
    
    getNumberValue(attr: string) {
        const tag = this.getAttr(attr);
        if (!tag)
            throw new Error("no value for: " + attr);
        return tag.getNumberValue();
    }

    getQueryValue(attr: string) {
        const tag = this.getAttr(attr);
        if (!tag)
            throw new Error("no value for: " + attr);
        return tag.getQuery();
    }

    getOptionalNumberValue(attr: string, defaultValue: number) {
        const tag = this.getAttr(attr);
        if (!tag || !tag.hasValue())
            return defaultValue;
        return tag.getNumberValue();
    }

    getNumber(attr: string): number {
        const tag = this.getAttr(attr);
        if (!tag)
            throw new Error("no value for: " + attr);
        return tag.getNumberValue();
    }

    getAttr(attr: string) {
        return this.tagsByAttr.get(attr);
    }

    getNestedQuery(attr: string) {
        const tag = this.getAttr(attr);
        if (!tag) {
            throw new Error("no value for: " + attr);
        }
        return tag.getQuery();
    }

    tagAtIndex(index: number) {
        return this.tags[index];
    }

    getPositionalAttr(index: number) {
        return this.tags[index]?.attr;
    }

    getCommand() {
        return this.tags[0].attr;
    }

    *tagsAfterCommand() {
        for (let i=1; i < this.tags.length; i++)
            yield this.tags[i];
    }

    getPositionalValue(index: number) {
        return this.tags[index].getValue();
    }

    toQueryString() {
        const out = [];

        for (const tag of this.tags) {
            out.push(tag.toQueryString());
        }

        return out.join(' ');
    }

    toItemValue() {
        const item: any = {};
        for (const tag of this.tags) {
            item[tag.attr] = tag.getValue();
        }

        return item;
    }

    withInlinedParams(params: QueryParameters) {
        const newTags: QueryTag[] = [];
        let anyChanged = false;

        for (const tag of this.tags) {
            if (tag.isQuery()) {
                const fixedNestedQuery = new QueryTag(tag.attr, tag.getQuery().withInlinedParams(params))
                newTags.push(fixedNestedQuery);
                anyChanged = true;
                continue;
            }

            if (tag.isParameter() && params.has(tag.paramName)) {
                const fixedTag = new QueryTag(tag.attr, params.get(tag.paramName));
                newTags.push(fixedTag);
                anyChanged = true;
                continue;
            }

            newTags.push(tag);
        }

        if (!anyChanged)
            return this;
        
        const out = new Query(newTags);
        out.freeze();
        return out;
    }

    dataAsObject() {
        let out = {};

        for (const tag of this.tags) {
            if (tag.hasValue())
                out[tag.attr] = tag.getValue();
        }

        return out;
    }

    _refresh() {
        this.tagsByAttr = new Map<string, QueryTag>()
        for (const tag of this.tags)
            if (tag.attr)
                this.tagsByAttr.set(tag.attr, tag);
    }
}


