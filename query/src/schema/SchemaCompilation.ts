import { OnConflictOption, Schema, SchemaAttr, SchemaFunc, SchemaFuncParams } from './Schema'
import { SchemaDecl } from './SchemaDecl'

export interface IndexDemand {
    attrs: string[]
    implySingleIndex?: boolean
    requireSingleIndex?: boolean
    requireMultiIndex?: boolean
}

export class SchemaCompilation {
    decl: SchemaDecl
    indexesNeeded = new Map<string, IndexDemand >();
    attrByStr = new Map<string, SchemaAttr>();
    schema: Schema

    constructor(decl: SchemaDecl) {
        this.decl = decl;
        this.schema = new Schema(decl);
    }

    addIndexDemand(demand: IndexDemand) {
        const name = demand.attrs.join(',');

        if (!this.indexesNeeded.has(name)) {
            this.indexesNeeded.set(name, demand);
            return { name }
        }

        const existing = this.indexesNeeded.get(name)!;

        existing.implySingleIndex = existing.implySingleIndex || demand.implySingleIndex;
        existing.requireMultiIndex = existing.requireMultiIndex || demand.requireMultiIndex;
        existing.requireSingleIndex = existing.requireSingleIndex || demand.requireSingleIndex;

        if (existing.requireSingleIndex && existing.requireMultiIndex)
            throw new Error(`Index conflict (on ${demand.attrs}): cannot require both single and multi value index`);

        return { name }
    }

    declareFunc(funcParams: SchemaFuncParams) {
        const func = new SchemaFunc(funcParams);

        if (this.schema.funcsByPublicName.has(func.publicName))
            return;
        
        this.schema.funcs.push(func);
        this.schema.funcsByPublicName.set(func.publicName, func);

        if (func.declaredName)
            this.schema.funcsByDeclaredName.set(func.declaredName, func);
    }

    demandFunction_has(funcDeclStr: string, attrs: string[]) {
        const { name: indexName } = this.addIndexDemand({ attrs });
        const publicName = 'has_' + (attrs.join('_'));;
        this.declareFunc({ funcName: 'has', declaredName: funcDeclStr, publicName, paramAttrs: attrs, indexName });
    }
}

