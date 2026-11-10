export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={`size-1.5 rounded-full ${i <= value ? 'bg-accent' : 'bg-line'}`} />)}
    </span>
  )
}
