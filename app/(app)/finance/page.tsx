import { Download, Plus, Trash2 } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { getBudget } from '@/lib/settings'
import { programOptions } from '@/lib/options'
import { day, inr } from '@/lib/format'
import { FinancialRecord } from '@/models'
import { Badge, Card, Field, Grid, Meter, PageHeader, Stat, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp } from '@/components/list'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { Bars } from '@/components/charts'
import { decideFinance, deleteFinance, saveFinance, setBudget } from '@/app/actions/admin'

export const metadata = { title: 'Financial Records' }
const CATS = ['Trainer fees', 'Venue', 'Learning platform', 'Content & licences', 'Assessments', 'Travel', 'Catering', 'Equipment', 'Events', 'Other']

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('finance.view')
  const params = await searchParams
  const page = pageOf(params)
  const status = sp(params, 'status'), category = sp(params, 'category')
  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (category) filter.category = category
  const [records, total, budget, byCat, byStatus, monthly, programs] = await Promise.all([
    FinancialRecord.find(filter).sort({ date: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    FinancialRecord.countDocuments(filter),
    getBudget(),
    FinancialRecord.aggregate<{ _id: string; amount: number }>([{ $match: { status: 'approved' } }, { $group: { _id: '$category', amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }]),
    FinancialRecord.aggregate<{ _id: string; amount: number; n: number }>([{ $group: { _id: '$status', amount: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    FinancialRecord.aggregate<{ _id: string; amount: number }>([{ $match: { status: 'approved' } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Kolkata' } }, amount: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    programOptions(),
  ])
  const s = (k: string) => byStatus.find(x => x._id === k) ?? { amount: 0, n: 0 }
  const spent = s('approved').amount

  return (
    <>
      <PageHeader title="Financial Records" description="Authorised training expenditure. Visible only to roles with finance permissions.">
        {(can(me, 'finance.export') || can(me, 'reports.export')) && <a className="btn-outline" href="/api/reports/finance?format=xlsx"><Download className="size-4" />Export</a>}
        {can(me, 'finance.approve') && (
          <Modal label="Set budget" title="Programme budget" className="btn-outline">
            <ActionForm action={setBudget} submit="Save budget" reset={false}><Field label="Total approved budget (INR)"><input name="budget" type="number" min={0} defaultValue={budget || ''} className="input" /></Field></ActionForm>
          </Modal>
        )}
        {can(me, 'finance.create') && (
          <Modal label={<><Plus className="size-4" />Add expense</>} title="Add expense" wide>
            <ActionForm action={saveFinance} submit="Submit for approval">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date *"><input name="date" type="date" required className="input" /></Field>
                <Field label="Category *"><input name="category" required list="fin-cats" className="input" /></Field>
                <datalist id="fin-cats">{CATS.map(c => <option key={c} value={c} />)}</datalist>
                <Field label="Amount (INR) *"><input name="amount" type="number" min={1} step="0.01" required className="input" /></Field>
                <Field label="Vendor"><input name="vendor" className="input" /></Field>
                <Field label="Reference / invoice no."><input name="reference" className="input" /></Field>
                <Field label="Programme"><select name="program" className="input"><option value="">—</option>{programs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="Description *" className="sm:col-span-2"><textarea name="description" required rows={2} className="input" /></Field>
              </div>
            </ActionForm>
          </Modal>
        )}
      </PageHeader>
      <Grid>
        <Stat label="Approved budget" value={budget ? inr(budget) : '—'} hint={budget ? undefined : 'Not set yet'} />
        <Stat label="Approved spend" value={inr(spent)} hint={`${s('approved').n} records`} />
        <Stat label="Pending approval" value={inr(s('pending').amount)} hint={`${s('pending').n} records`} />
        <Stat label="Remaining" value={budget ? inr(budget - spent) : '—'} />
      </Grid>
      {budget > 0 && <div className="card mt-4 p-4"><div className="mb-2 flex justify-between text-xs text-muted"><span>Budget utilisation</span><span>{Math.round((spent / budget) * 100)}%</span></div><Meter value={(spent / budget) * 100} tone={spent > budget ? 'bg-red-500' : 'bg-[var(--color-c1)]'} label="Budget utilisation" /></div>}
      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card title="Approved spend by category"><Bars data={byCat.map(c => ({ category: c._id, amount: c.amount }))} x="category" series={[{ key: 'amount', label: 'INR' }]} horizontal height={Math.max(160, byCat.length * 34)} /></Card>
        <Card title="Approved spend by month"><Bars data={monthly.map(m => ({ month: m._id, amount: m.amount }))} x="month" series={[{ key: 'amount', label: 'INR' }]} /></Card>
      </div>
      <Card pad={false}>
        <Filters params={params} q={false}>
          <Select name="status" value={status} options={[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]} all="All statuses" />
          <Select name="category" value={category} options={CATS} all="All categories" />
        </Filters>
        <Table head={['Date', 'Category', 'Description', 'Vendor', 'Amount', 'Status', '']}>
          {records.map(r => (
            <tr key={String(r._id)}>
              <td className="td text-muted">{day(r.date)}</td>
              <td className="td">{r.category}</td>
              <td className="td max-w-80"><div className="truncate">{r.description}</div>{r.reference && <div className="text-xs text-muted">Ref {r.reference}</div>}</td>
              <td className="td text-muted">{r.vendor || '—'}</td>
              <td className="td text-right tabular-nums">{inr(r.amount)}</td>
              <td className="td"><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Badge></td>
              <td className="td"><div className="flex justify-end gap-1">
                {can(me, 'finance.approve') && r.status !== 'approved' && <ActionButton action={decideFinance} fields={{ id: String(r._id), status: 'approved' }} className="btn-ghost px-2 py-1 text-xs text-emerald-600">Approve</ActionButton>}
                {can(me, 'finance.approve') && r.status !== 'rejected' && <ActionButton action={decideFinance} fields={{ id: String(r._id), status: 'rejected' }} className="btn-ghost px-2 py-1 text-xs" confirm="Reject this record?">Reject</ActionButton>}
                {can(me, 'finance.delete') && r.status !== 'approved' && <ActionButton action={deleteFinance} fields={{ id: String(r._id) }} className="btn-ghost px-2 py-1 text-red-600" confirm="Delete this record?"><Trash2 className="size-3.5" /></ActionButton>}
              </div></td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/finance" />
      </Card>
    </>
  )
}
