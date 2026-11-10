import Link from 'next/link'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { OID } from '@/lib/form'
import { Application, Company, Job } from '@/models'
import { Card, Empty, Field, PageHeader, Table } from '@/components/ui'
import { Filters, sp, escapeRe } from '@/components/list'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { deleteCompany, saveCompany } from '@/app/actions/placement'

export const metadata = { title: 'Companies' }

function CompanyFields({ c }: { c?: Record<string, unknown> }) {
  const v = (k: string) => (c?.[k] == null ? '' : String(c[k]))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={v('_id')} />}
      <Field label="Company name *"><input name="name" required defaultValue={v('name')} className="input" /></Field>
      <Field label="Industry"><input name="industry" defaultValue={v('industry')} className="input" /></Field>
      <Field label="Website"><input name="website" type="url" defaultValue={v('website')} className="input" /></Field>
      <Field label="Logo URL" hint="Link to the company's logo image."><input name="logo" type="url" defaultValue={v('logo')} className="input" /></Field>
      <Field label="Location" className="sm:col-span-2"><input name="location" defaultValue={v('location')} className="input" /></Field>
      <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={3} defaultValue={v('description')} className="input" /></Field>
    </div>
  )
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('companies.view')
  const params = await searchParams
  const q = sp(params, 'q'), edit = sp(params, 'edit')
  const companies = await Company.find(q ? { name: new RegExp(escapeRe(q), 'i') } : {}).sort({ name: 1 }).lean()
  const [jobs, apps] = await Promise.all([
    Job.aggregate<{ _id: unknown; n: number; open: number }>([{ $group: { _id: '$company', n: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } } } }]),
    Application.aggregate<{ _id: string; n: number; offers: number }>([{ $group: { _id: { $toLower: '$company' }, n: { $sum: 1 }, offers: { $sum: { $cond: [{ $in: ['$status', ['Offered', 'Accepted', 'Declined']] }, 1, 0] } } } }]),
  ])
  const jb = new Map(jobs.map(j => [String(j._id), j]))
  const ap = new Map(apps.map(a => [a._id, a]))
  const editing = OID.test(edit) && can(me, 'companies.edit') ? companies.find(c => String(c._id) === edit) : null

  return (
    <>
      <PageHeader title="Companies" description="Recruiters participating in the Marquee programme.">
        {can(me, 'companies.create') && <Modal label={<><Plus className="size-4" />Add company</>} title="Add company" wide><ActionForm action={saveCompany} submit="Add company"><CompanyFields /></ActionForm></Modal>}
      </PageHeader>
      {editing && <Card title={`Edit ${editing.name}`} className="mb-6" action={<Link href="/companies" className="btn-ghost">Close</Link>}><ActionForm action={saveCompany} submit="Save" reset={false}><CompanyFields c={editing} /></ActionForm></Card>}
      <Card pad={false}>
        <Filters params={params} placeholder="Search companies" />
        <Table head={['Company', 'Industry', 'Location', 'Opportunities', 'Applications', 'Offers', '']} empty={<Empty>No companies yet.</Empty>}>
          {companies.map(c => {
            const j = jb.get(String(c._id)), a = ap.get(c.name.toLowerCase())
            return (
              <tr key={String(c._id)}>
                <td className="td"><div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.logo ? <img src={c.logo} alt="" className="size-8 rounded-md bg-white object-contain p-0.5 ring-1 ring-line" referrerPolicy="no-referrer" /> : <span className="grid size-8 place-items-center rounded-md bg-subtle text-xs font-semibold">{c.name[0]}</span>}
                  <div><div className="font-medium">{c.name}</div>{c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-accent"><ExternalLink className="size-3" />website</a>}</div>
                </div></td>
                <td className="td text-muted">{c.industry || '—'}</td>
                <td className="td text-muted">{c.location || '—'}</td>
                <td className="td tabular-nums"><Link href={`/jobs?company=${c._id}`} className="hover:underline">{j?.n ?? 0}</Link>{j?.open ? <span className="text-xs text-muted"> ({j.open} open)</span> : null}</td>
                <td className="td tabular-nums">{a?.n ?? 0}</td>
                <td className="td tabular-nums">{a?.offers ?? 0}</td>
                <td className="td"><div className="flex justify-end gap-1">
                  {can(me, 'companies.edit') && <Link href={`/companies?edit=${c._id}`} className="btn-ghost px-2 py-1 text-xs">Edit</Link>}
                  {can(me, 'companies.delete') && <ActionButton action={deleteCompany} fields={{ id: String(c._id) }} className="btn-ghost px-2 py-1 text-red-600" confirm={`Delete ${c.name}?`}><Trash2 className="size-3.5" /></ActionButton>}
                </div></td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </>
  )
}
