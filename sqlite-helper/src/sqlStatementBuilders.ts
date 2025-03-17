
export function prepareSelectStatement(tableName: string, selectedRows: string[], where: Record<string,any>) {
    let whereParams = [];
    let whereValues = [];

    for (const [ whereColumn, whereValue ] of Object.entries(where)) {
        whereParams.push(`${whereColumn} = ?`);
        whereValues.push(whereValue);
    }

    const sql = `select ${selectedRows.join(', ')} from ${tableName} where ${whereParams.join(' and ')}`;
    return {
        sql,
        values: whereValues
    }
}

export function prepareInsertStatement(tableName: string, row: Record<string,any>) {
    let columns = [];
    let valuePlaceholders = [];
    let values = [];

    for (const [ name, value ] of Object.entries(row)) {
        columns.push(name);
        valuePlaceholders.push('?');
        values.push(value);
    }

    const sql = `insert into ${tableName} (${columns.join(', ')}) values (${valuePlaceholders.join(', ')})`;

    return {
        sql,
        values
    }
}

export function prepareUpdateStatement(tableName: string, whereClause: string, whereValues: any[], row: Record<string,any>) {
    let setParams = [];
    let resultValues = [];

    if (typeof whereValues === 'string')
        whereValues = [whereValues];

    // safety check the ? placeholders in 'where'
    if ((whereClause.match(/\?/g) || []).length !== whereValues.length) {
        throw new Error(`'where' (${whereClause}) placeholders didn't match the number of values (${whereValues.length})`);
    }

    for (const [ name, value ] of Object.entries(row)) {
        setParams.push(`${name} = ?`);
        resultValues.push(value);
    }

    resultValues = resultValues.concat(whereValues);

    const sql = `update ${tableName} set ${setParams.join(', ')} where ${whereClause}`;
    return {
        sql,
        values: resultValues
    }
}

export function prepareUpdateStatement_v2(tableName: string, where: Record<string,any>, row: Record<string,any>) {
    let whereParams = [];
    let whereValues = [];
    let setParams = [];
    let setValues = [];

    for (const [ whereColumn, whereValue ] of Object.entries(where)) {
        whereParams.push(`${whereColumn} = ?`);
        whereValues.push(whereValue);
    }

    for (const [ name, value ] of Object.entries(row)) {
        setParams.push(`${name} = ?`);
        setValues.push(value);
    }

    const sql = `update ${tableName} set ${setParams.join(', ')} where ${whereParams.join(' and ')}`;
    return {
        sql,
        values: setValues.concat(whereValues)
    }
}

