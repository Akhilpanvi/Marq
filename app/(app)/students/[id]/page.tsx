import { notFound } from 'next/navigation'
import { avatarSrc } from '@/lib/avatar'
import { Activity, BookOpen, Briefcase, CalendarCheck, ClipboardCheck, MessagesSquare, Pencil, Trash2, UserRound } from 'lucide-react'
import { can, requirePage, studentScope } from '@/lib/auth'
import { OID } from '@/lib/form'
import { journey } from '@/lib/journey'
import { batchOptions, mentorOptions } from '@/lib/options'
import { placementStatus, statusTone, OFFERED } from '@/lib/placement'
import { day, pct } from '@/lib/format'
import { CodingStat, Student, User } from '@/models'
import { PLATFORMS, PLATFORM_KEYS } from '@/lib/coding-points'
import { fmt } from '@/lib/format'
import { Avatar, Badge, Card, Empty, KV, PageHeader, Score, Table } from '@/components/ui'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { StudentFields, STATUS_LABEL } from '@/components/student-fields'
import { ScoreTiles } from '@/components/score-tiles'
import { Bars, Lines } from '@/components/charts'
import { EvaluationFields } from '@/components/evaluation-fields'
import { EvaluationList } from '@/components/evaluation-list'
import { PrintButton } from '@/components/print'
import { deleteStudent, saveStudent } from '@/app/actions/students'
import { saveEvaluation } from '@/app/actions/mentorship'
import { sendLink } from '@/app/actions/users'

const ATT_TONE = { present: 'green', late: 'amber', absent: 'red', excused: 'zinc' } as const

export default async function Student360({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage('students.view')
  const { id } = await params
  if (!OID.test(id)) notFound()
  const s = await Student.findOne({ $and: [{ _id: id }, await studentScope(me)] }).lean()
  if (!s) notFound()
  const [j, account, mentor, batches, mentors] = await Promise.all([
    journey(s._id, s.batch),
    User.findOne({ student: s._id }).select('status lastLoginAt activatedAt invitedAt').lean(),
    s.mentor ? User.findById(s.mentor).select('name email').lean() : null,
    can(me, 'students.edit') ? batchOptions() : [],
    can(me, 'students.edit') ? mentorOptions() : [],
  ])
  const coding = await CodingStat.find({ student: s._id }).lean()
  const placed = placementStatus(j.apps)
  const offers = j.apps.filter(a => OFFERED.includes(a.status))
  const show = (p: Parameters<typeof can>[1]) => can(me, p)

  return (
    <>
      <PageHeader back={{ href: '/students', label: me.scope === 'assigned' ? 'My Students' : 'Students' }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={s.name} src={avatarSrc(s)} size="size-12" />
            <span>
              {s.name}
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-normal">
                <span className="font-mono text-xs text-muted">{s.regNo}</span>
                <Badge tone={s.status === 'active' ? 'green' : 'zinc'}>{STATUS_LABEL[s.status ?? 'active']}</Badge>
                <Badge tone={placed.tone}>{placed.label}</Badge>
                {j.p.flags.high && <Badge tone="green">High performer</Badge>}
                {j.p.flags.improving && <Badge tone="blue">Improving</Badge>}
                {j.p.flags.declining && <Badge tone="red">Declining</Badge>}
                {j.p.flags.attention && <Badge tone="amber">Needs attention</Badge>}
              </span>
            </span>
          </span>
        }>
        <PrintButton />
        {show('students.edit') && (
          <Modal label={<><Pencil className="size-4" />Edit</>} title="Edit student" className="btn-outline" wide>
            <ActionForm action={saveStudent} submit="Save changes" reset={false}><StudentFields s={s} batches={batches} mentors={mentors} /></ActionForm>
          </Modal>
        )}
        {show('mentorship.create') && (
          <Modal label={<><MessagesSquare className="size-4" />Add evaluation</>} title={`Evaluate ${s.name}`} wide>
            <ActionForm action={saveEvaluation} submit="Save evaluation"><EvaluationFields student={String(s._id)} /></ActionForm>
          </Modal>
        )}
        {show('students.delete') && <ActionButton action={deleteStudent} fields={{ id: String(s._id) }} className="btn-ghost text-red-600" confirm={`Delete ${s.name}? This cannot be undone.`}><Trash2 className="size-4" /></ActionButton>}
      </PageHeader>

      <div className="space-y-6">
        <ScoreTiles p={j.p} />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Assessment trend" icon={Activity} className="lg:col-span-2">
            <Lines data={j.trend} x="date" series={[{ key: 'pct', label: 'Score %' }]} domain={[0, 100]} />
            <div className="mt-3 flex flex-wrap gap-6 text-xs text-muted">
              <span>Weekly change: <b className="text-fg">{delta(j.weekly)}</b></span>
              <span>Monthly change: <b className="text-fg">{delta(j.monthly)}</b></span>
              <span>Trend: <b className="text-fg">{j.p.trend == null ? 'needs 3+ results' : `${j.p.trend > 0 ? '+' : ''}${j.p.trend.toFixed(1)} pts / assessment`}</b></span>
            </div>
          </Card>
          <Card title="Profile" icon={UserRound}>
            <KV items={[
              ['University email', s.email], ['Placement mail ID', s.personalEmail], ['Mobile', s.phone],
              ['Department', s.department], ['Specialization', s.specialization], ['Year · Section', [s.year, s.section].filter(Boolean).join(' · ')],
              ['Batch', j.batch?.name], ['Programme', j.program?.name], ['Mentor', mentor?.name],
              ['Portal account', account ? `${account.status}${account.lastLoginAt ? ` · last seen ${day(account.lastLoginAt)}` : ''}` : 'Not created'],
            ]} />
            {account && account.status !== 'inactive' && show('users.edit') && (
              <div className="mt-4"><ActionForm action={sendLink} reset={false} className="space-y-3"><input type="hidden" name="id" value={String(account._id)} /><button className="btn-outline">{account.status === 'invited' ? 'Resend activation link' : 'Send password reset link'}</button></ActionForm></div>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Training" icon={BookOpen}>
            <KV items={[['Programme', j.program?.name], ['Batch', j.batch?.name], ['Sessions completed', j.batch ? `${j.training.completed} of ${j.training.total}` : undefined], ['Attendance', pct(j.p.dims.attendance)]]} />
          </Card>
          <Card title="Monthly attendance" icon={CalendarCheck} className="lg:col-span-2">
            <Bars data={j.attendanceMonths} x="month" stacked height={200}
              series={[{ key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'excused', label: 'Excused' }, { key: 'late', label: 'Late' }]} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Assessment history" icon={ClipboardCheck} pad={false}>
            <Table head={['Assessment', 'Category', 'Date', 'Score']} empty={<Empty>No assessment results yet.</Empty>}>
              {[...j.results].reverse().map(r => (
                <tr key={String(r.assessment)}>
                  <td className="td font-medium">{r.name}</td>
                  <td className="td text-muted">{r.category}</td>
                  <td className="td text-muted">{day(r.date)}</td>
                  <td className="td">{r.marks == null ? <Badge>Absent</Badge> : <span><Score value={(r.marks / r.max) * 100} /> <span className="text-xs text-muted">{r.marks}/{r.max}</span></span>}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Attendance history" icon={CalendarCheck} pad={false}>
            <div className="max-h-96 overflow-y-auto">
              <Table head={['Session', 'Date', 'Status']} empty={<Empty>No attendance recorded yet.</Empty>}>
                {j.attendance.slice(0, 60).map(a => (
                  <tr key={String(a._id)}>
                    <td className="td">{(a.session as unknown as { title?: string })?.title ?? '—'}</td>
                    <td className="td text-muted">{day(a.date)}</td>
                    <td className="td"><Badge tone={ATT_TONE[a.status]}>{a.status}</Badge>{a.history.length > 0 && <span className="ml-1 text-[11px] text-muted">corrected</span>}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </Card>
        </div>

        <Card title={`Coding profiles · ${fmt(coding.reduce((t, c) => t + (c.points ?? 0), 0))} points`} icon={Activity}>
          {coding.length ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {PLATFORM_KEYS.map(p => { const c = coding.find(x => x.platform === p); return c ? (
                <div key={p} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex justify-between"><span className="font-medium">{PLATFORMS[p].label}</span><a href={PLATFORMS[p].url(c.handle ?? '')} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">{c.handle}</a></div>
                  {c.status === 'not_found' ? <p className="mt-1 text-xs text-muted">Username not found</p> : <p className="mt-1 text-muted">Rating <b className="text-fg">{fmt(c.rating)}</b> (best {fmt(c.maxRating)}) · {c.contests ?? 0} contests{c.solved != null && p !== 'codeforces' ? ` · ${c.solved} solved` : ''}</p>}
                </div>) : null })}
            </div>
          ) : <Empty>The student hasn&apos;t linked coding profiles yet.</Empty>}
          {(() => { const g = coding.find(x => x.platform === 'github'); return g ? <p className="mt-3 text-sm text-muted">GitHub <a href={`https://github.com/${g.handle}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{g.handle}</a>{g.status === 'ok' ? ` · ${g.github?.repos ?? 0} repos · ★ ${g.github?.stars ?? 0}${g.github?.contributions != null ? ` · ${g.github.contributions} contributions this year` : ''}` : g.status === 'not_found' ? ' · username not found' : ''}</p> : null })()}
        </Card>

        <Card title="Mentor evaluations" icon={MessagesSquare}>
          <EvaluationList items={j.evaluations} mentorName={j.mentorName} />
        </Card>

        {show('applications.view') && (
          <div className="grid gap-6">
            <Card title={`Applications · ${j.apps.length}`} icon={Briefcase} pad={false} action={<span className="text-xs text-muted">{offers.length} offer{offers.length === 1 ? '' : 's'}</span>}>
              <Table head={['Company', 'Role', 'Status', 'Updated']} empty={<Empty>No applications yet.</Empty>}>
                {j.apps.map(a => (
                  <tr key={String(a._id)}>
                    <td className="td font-medium">{a.company}</td>
                    <td className="td">{a.role}</td>
                    <td className="td"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                    <td className="td text-muted">{day(a.updatedAt)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        )}

        <Card title="Journey timeline" icon={Activity}>
          {j.timeline.length ? (
            <ol className="relative space-y-4 border-l border-line pl-5">
              {j.timeline.slice(0, 80).map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-accent" />
                  <div className="text-xs text-muted">{day(t.at)} · {t.kind}</div>
                  <div className="text-sm">{t.text}</div>
                </li>
              ))}
            </ol>
          ) : <Empty>The journey starts with the first assessment, evaluation or application.</Empty>}
        </Card>
      </div>
    </>
  )
}

function delta(b: { avg: number }[]) {
  if (b.length < 2) return '—'
  const d = b.at(-1)!.avg - b.at(-2)!.avg
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts`
}
