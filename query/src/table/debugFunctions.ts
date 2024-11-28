
import { Table } from './Table'
import { formatTable, CustomFormatOptions } from '../console/TableFormatter'

export type { CustomFormatOptions } from '../console/TableFormatter'

export function consoleLogTable(table: Table, options: CustomFormatOptions = {}) {
    for (const line of formatTable(table, options))
        console.log(line);
}
