'use client'

/** Sets every radio with the given value inside the closest form. */
export function MarkAll({ value, label }: { value: string; label: string }) {
  return (
    <button type="button" className="btn-outline py-1.5 text-xs" onClick={e => e.currentTarget.form?.querySelectorAll<HTMLInputElement>(`input[type=radio][value=${value}]`).forEach(r => (r.checked = true))}>
      {label}
    </button>
  )
}
