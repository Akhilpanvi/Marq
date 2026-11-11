import { Stat } from './ui'

type M = { total: number; companies: number; inProgress: number; written: number; technical: number; hr: number; offers: number; accepted: number; rejected: number }

export function AppMetricTiles({ m }: { m: M }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Companies applied" value={m.companies} />
      <Stat label="Total applications" value={m.total} />
      <Stat label="In progress" value={m.inProgress} />
      <Stat label="Written tests" value={m.written} />
      <Stat label="Technical rounds" value={m.technical} />
      <Stat label="HR rounds" value={m.hr} />
      <Stat label="Offers received" value={m.offers} />
      <Stat label="Accepted offers" value={m.accepted} />
      <Stat label="Rejections" value={m.rejected} />
    </div>
  )
}
