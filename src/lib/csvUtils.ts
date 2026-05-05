// ─── CSV Export ───────────────────────────────────────────────────────────────

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── CSV Template ─────────────────────────────────────────────────────────────

export function downloadTemplate(filename: string, headers: string[], exampleRow: (string | number)[]) {
  downloadCSV(filename, headers, [exampleRow])
}

// ─── CSV Parse ────────────────────────────────────────────────────────────────

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^﻿/, '').replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line)
    const row: Record<string, string> = {}
    rawHeaders.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  }).filter(r => Object.values(r).some(v => v !== ''))
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// ─── Print HTML ───────────────────────────────────────────────────────────────

export function printDocument(title: string, bodyHTML: string) {
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Sarabun','Tahoma',sans-serif;font-size:12px;color:#111;background:#fff;padding:12mm 14mm}
      h1{font-size:18px;font-weight:800;margin-bottom:4px}
      h2{font-size:13px;font-weight:700;margin:14px 0 6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#888;padding:6px 8px;border-bottom:2px solid #111}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
      tr:last-child td{border-bottom:none}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:700}
      .meta{font-size:10px;color:#888;margin-bottom:10px}
      .total-row td{font-weight:700;border-top:2px solid #111;border-bottom:none}
      @media print{@page{size:A4;margin:10mm} body{padding:0}}
    </style>
  </head><body>${bodyHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}
