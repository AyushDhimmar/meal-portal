import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'

/** `line` = the row number people see in Excel or a text editor (headers are line 1). */
export type ImportRow = { emp_code: string; name: string; email: string; department: string; status: string; line: number }
export type ParsedFile = { rows: ImportRow[]; missingColumns: string[]; ignoredColumns: string[] }

// Header names people actually use → our field. Compared lower-case, ignoring spaces, _ and -.
type Field = Exclude<keyof ImportRow, 'line'>
const ALIASES: Record<Field, string[]> = {
  emp_code: ['empcode', 'employeecode', 'code', 'employeeid', 'empid', 'id'],
  name: ['name', 'fullname', 'employeename', 'employee'],
  email: ['email', 'emailaddress', 'workemail', 'mail', 'email id', 'emailid'],
  department: ['department', 'dept', 'team'],
  status: ['status', 'active', 'state'],
}
const REQUIRED: Field[] = ['emp_code', 'name', 'email']
// HR exports often say Yes/No or True/False in an "Active" column
function normalizeStatus(v: string) {
  const s = v.toLowerCase()
  if (['yes', 'y', 'true', '1', 'active'].includes(s)) return 'active'
  if (['no', 'n', 'false', '0', 'inactive', 'left', 'resigned'].includes(s)) return 'inactive'
  return v
}
const key = (h: string) => h.toLowerCase().replace(/[\s_-]/g, '')

function mapRows(header: string[], body: unknown[][]): ParsedFile {
  const index: Partial<Record<Field, number>> = {}
  const used = new Set<number>()
  for (const field of Object.keys(ALIASES) as Field[]) {
    const i = header.findIndex((h, n) => !used.has(n) && ALIASES[field].map(key).includes(key(h)))
    if (i >= 0) { index[field] = i; used.add(i) }
  }
  const cell = (r: unknown[], f: Field) => {
    const i = index[f]
    const v = i === undefined ? '' : r[i]
    return v === null || v === undefined ? '' : String(v).trim()
  }
  const rows = body
    .map((r, i) => ({ r, line: i + 2 }))                                              // header is line 1
    .filter(({ r }) => r.some((v) => v !== null && String(v ?? '').trim() !== ''))   // skip blank lines
    .map(({ r, line }) => ({
      emp_code: cell(r, 'emp_code'), name: cell(r, 'name'), email: cell(r, 'email'),
      department: cell(r, 'department'), status: normalizeStatus(cell(r, 'status')), line,
    }))
  return {
    rows,
    missingColumns: REQUIRED.filter((f) => index[f] === undefined),
    ignoredColumns: header.filter((h, i) => h.trim() !== '' && !used.has(i)),
  }
}

export async function parseEmployeeFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    const text = await file.text()
    const res = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: false })
    const [header = [], ...body] = res.data
    return mapRows(header.map(String), body)
  }
  if (name.endsWith('.xlsx')) {
    const sheet = await readSheet(file)   // first sheet
    const [header = [], ...body] = sheet
    return mapRows(header.map((h) => String(h ?? '')), body)
  }
  throw new Error('Choose a .csv or .xlsx file. Older .xls files: open in Excel and “Save as” .xlsx first.')
}

export const TEMPLATE: string[][] = [
  ['emp_code', 'name', 'email', 'department', 'status'],
  ['1R-0123', 'Priya Shah', 'priya.shah@1rivet.com', 'Engineering', 'active'],
]
