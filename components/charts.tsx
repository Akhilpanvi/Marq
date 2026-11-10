'use client'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Fixed categorical order, validated light + dark (globals.css). Never cycled: >4 series fold into "Other".
export const SERIES = ['var(--color-c1)', 'var(--color-c2)', 'var(--color-c3)', 'var(--color-c4)']
const axis = { stroke: 'var(--color-muted)', fontSize: 11, tickLine: false, axisLine: false }
const tip = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 12, color: 'var(--color-fg)' },
  labelStyle: { color: 'var(--color-muted)', marginBottom: 2 },
  itemStyle: { color: 'var(--color-fg)', padding: 0 },
  cursor: { fill: 'var(--color-subtle)', stroke: 'var(--color-line)' },
}
type S = { key: string; label: string }
type Row = Record<string, string | number | null>
const legendText = (v: string) => <span style={{ color: 'var(--color-muted)' }}>{v}</span>
const fmt = (v: unknown) => (typeof v === 'number' ? Math.round(v * 10) / 10 : String(v ?? '—'))

function Frame({ height, children, empty }: { height: number; children: React.ReactElement; empty: boolean }) {
  if (empty) return <div className="grid place-items-center rounded-lg border border-dashed border-line text-sm text-muted" style={{ height }}>No data yet</div>
  return <div style={{ height }} className="w-full min-w-0"><ResponsiveContainer>{children}</ResponsiveContainer></div>
}

export function Bars({ data, x, series, height = 260, stacked, domain, horizontal }: { data: Row[]; x: string; series: S[]; height?: number; stacked?: boolean; domain?: [number, number]; horizontal?: boolean }) {
  return (
    <Frame height={height} empty={!data.length}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 8 : -16, bottom: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--color-line)" strokeDasharray="0" />
        {horizontal ? <><XAxis type="number" {...axis} domain={domain} allowDecimals={!!domain} /><YAxis type="category" dataKey={x} {...axis} width={110} /></> : <><XAxis dataKey={x} {...axis} interval="preserveStartEnd" /><YAxis {...axis} domain={domain} allowDecimals={!!domain} /></>}
        <Tooltip {...tip} formatter={fmt} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={legendText} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} stackId={stacked ? 'a' : undefined} stroke="var(--color-surface)" strokeWidth={stacked ? 1 : 0}
            radius={stacked ? (i === series.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </Frame>
  )
}

export function Lines({ data, x, series, height = 260, domain, reversed }: { data: Row[]; x: string; series: S[]; height?: number; domain?: [number, number]; reversed?: boolean }) {
  return (
    <Frame height={height} empty={!data.length}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis dataKey={x} {...axis} interval="preserveStartEnd" />
        <YAxis {...axis} domain={domain} allowDecimals={!!domain} reversed={reversed} />
        <Tooltip {...tip} formatter={fmt} cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '3 3' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={legendText} />}
        {series.map((s, i) => (
          <Line key={s.key} dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: 'var(--color-surface)' }} activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }} connectNulls />
        ))}
      </LineChart>
    </Frame>
  )
}

/** Part-to-whole for ≤4 parts; anything more is folded into "Other" by the caller. */
export function Donut({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Frame height={height} empty={!total}>
        <PieChart>
          <Tooltip {...tip} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={1} stroke="var(--color-surface)" strokeWidth={2}>
            {data.map((d, i) => <Cell key={d.name} fill={d.name === 'Other' ? 'var(--color-c5)' : SERIES[i % SERIES.length]} />)}
          </Pie>
        </PieChart>
      </Frame>
      {total > 0 && (
        <ul className="w-full space-y-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: d.name === 'Other' ? 'var(--color-c5)' : SERIES[i % SERIES.length] }} />
              <span className="flex-1 text-muted">{d.name}</span>
              <span className="font-medium tabular-nums">{d.value.toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
