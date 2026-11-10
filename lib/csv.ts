/** Minimal RFC4180 CSV reader: quoted cells, escaped quotes, CRLF or LF. */
export function parseCsv(text: string) {
  const rows: string[][] = [[]]
  let cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') cell += text[++i]
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') rows.at(-1)!.push(cell.trim()), (cell = '')
    else if (c === '\n') rows.at(-1)!.push(cell.trim()), rows.push([]), (cell = '')
    else if (c !== '\r') cell += c
  }
  rows.at(-1)!.push(cell.trim())
  const [head, ...body] = rows.filter(r => r.some(Boolean))
  if (!head) return []
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])))
}
