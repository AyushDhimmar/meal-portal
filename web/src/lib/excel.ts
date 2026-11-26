import writeXlsxFile from 'write-excel-file/browser'

type Value = string | number | null | undefined

/** Downloads a one-sheet .xlsx with a bold header row (opens cleanly in Excel and Google Sheets). */
export async function downloadXlsx(fileName: string, header: string[], rows: Value[][], widths?: number[], sheet = 'Sheet1') {
  const data = [
    header.map((h) => ({ value: h, fontWeight: 'bold' as const })),
    ...rows.map((r) => r.map((v) => (v === undefined || v === '' ? null : v))),
  ]
  await writeXlsxFile(data, { sheet, columns: (widths ?? header.map(() => 18)).map((width) => ({ width })) }).toFile(fileName)
}
