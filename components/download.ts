'use client'
/** Builds a CSV in the browser and downloads it. Nothing is written server-side. */
export function downloadCsv(name: string, rows: string[][]) {
  const text = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: name })
  a.click()
  URL.revokeObjectURL(a.href)
}
