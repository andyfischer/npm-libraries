
import type { Query, QueryNode } from '../query'

export type TagValue = string | number | boolean | Query | QueryNode | TagStarValue;

export enum TagSpecialValueType {
    star = 1200
}

export interface TagStarValue {
    t: TagSpecialValueType.star
}

export class QueryTag {
    t: 'tag' = 'tag'
    attr: string
    value: TagValue
    isValueOptional: boolean
    isAttrOptional: boolean
    paramName: string
    frozen: boolean

    constructor(attr?: string, value?: TagValue) {
        this.t = 'tag'
        if (attr)
            this.attr = attr;

        if (value != null)
            this.value = value || null
    }

    freeze() {
        if (this.frozen)
            return;
        this.frozen = true;
        Object.freeze(this);
    }

    hasValue() {
        return this.value != null;
    }

    hasStringValue() {
        return typeof this.value === 'string';
    }

    isParameter() {
        return this.paramName != null;
    }

    isQuery() {
        return (this.value as any)?.t === 'query';
    }

    isStar() {
        return (this.value as any)?.t === TagSpecialValueType.star;
    }

    getQuery() {
        if (!this.isQuery()) {
            throw new Error("Tag value is not a query");
        }

        return this.value as Query;
    }

    getTaggedValue() {
        return this.value;
    }

    getValue() {
        if (this.value == null)
            return this.value;

        if ((this.value as any)?.t === TagSpecialValueType.star)
            throw new Error(".getValue usage error: tag has special value (star)");

        return this.value;
    }

    getStringValue(): string {
        if (this.value == null)
            throw new Error("getStringValue usage error: not a string (value is null)");

        if (typeof this.value === 'string')
            return this.value;

        if (typeof this.value === 'number')
            return this.value + '';

        throw new Error("getStringValue usage error: not a string");
    }

    getNumberValue(): number {
        if (this.value == null)
            throw new Error("getNumberValue usage error: not a number (value is null)");

        if (typeof this.value === 'string')
            return parseFloat(this.value);

        if (typeof this.value === 'number')
            return this.value;

        throw new Error("getNumberValue usage error: not a number");
    }
    
    toQueryString() {
        if (this.attr === '*')
            return '*';

        let out = '';

        if (this.isParameter() && this.paramName === this.attr)
            out += '$';

        /*
        if (this.identifier) {
            if (this.identifier === attr)
                out += '$'
            else
                out += `[$${this.identifier}] `
        }
        */

        out += this.attr;

        if (this.isAttrOptional)
            out += '?';

        if (this.isParameter() && this.paramName !== this.attr)
            out += `=$${this.paramName}`;

        else if (this.hasValue()) {
            if (this.isQuery()) {
                out += `(${(this.value as Query).toQueryString()})`;
            } else {
                out += `=`;

                if (this.isStar()) {
                    out += '*';
                } else {
                    out += '' + this.getValue();
                }
            }
        }

        return out;
    }
}
