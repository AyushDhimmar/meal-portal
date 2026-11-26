/** Saves rows as a CSV that Excel opens correctly (UTF-8 with BOM, quoted cells). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const text = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
