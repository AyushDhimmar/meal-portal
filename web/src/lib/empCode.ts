/** Mirrors private.normalize_emp_code(): '0123', '123', '1r-0123', '1R0123' → '1R-0123'. */
export function normalizeEmpCode(input: string): string {
  const v = input.replace(/\s/g, '').toUpperCase()
  if (/^1R-\d{4}$/.test(v)) return v
  if (/^1R-?\d{1,4}$/.test(v)) return '1R-' + v.replace(/^1R-?/, '').padStart(4, '0')
  if (/^\d{1,4}$/.test(v)) return '1R-' + v.padStart(4, '0')
  return v
}

export const isValidEmpCode = (code: string) => /^1R-\d{4}$/.test(code)
