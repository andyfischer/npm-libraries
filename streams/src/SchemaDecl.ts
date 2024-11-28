
export interface SchemaDecl {
    name?: string
    attrs?: string[]
    hint?: 'list' | 'value'
    funcs?: string[]
}