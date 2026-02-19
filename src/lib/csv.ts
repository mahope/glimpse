const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/** Escape a CSV field value (handles commas, quotes, newlines, formula injection) */
function escapeField(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  // Prevent CSV formula injection (OWASP recommendation)
  const safe = FORMULA_PREFIXES.some(p => str.startsWith(p)) ? `\t${str}` : str
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/** Build a CSV string from headers and rows */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeField).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','))
  }
  return lines.join('\n')
}

/** Create a CSV Response with proper headers */
export function csvResponse(csv: string, filename: string): Response {
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const encoded = encodeURIComponent(filename)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
