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

/** Create a streaming CSV Response that writes rows in chunks */
export function csvStreamResponse(
  headers: string[],
  rowGenerator: () => AsyncGenerator<(string | number | null | undefined)[], void, unknown>,
  filename: string,
): Response {
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const encoded = encodeURIComponent(filename)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Write header row
        controller.enqueue(encoder.encode(headers.map(escapeField).join(',') + '\n'))

        // Write data rows in chunks
        const CHUNK_SIZE = 200
        let buffer: string[] = []
        for await (const row of rowGenerator()) {
          buffer.push(row.map(escapeField).join(','))
          if (buffer.length >= CHUNK_SIZE) {
            controller.enqueue(encoder.encode(buffer.join('\n') + '\n'))
            buffer = []
          }
        }
        if (buffer.length > 0) {
          controller.enqueue(encoder.encode(buffer.join('\n') + '\n'))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
