'use server'
import { revalidatePath } from 'next/cache'
import type { Types } from 'mongoose'
import { assertStudentAccess, audit, can, currentUser, guard, type Me } from '@/lib/auth'
import { attempt, date, Invalid, link, list, need, num, oid, oneOf, str, type State } from '@/lib/form'
import { appKey, DRIVE_OPTIONS } from '@/lib/placement'
import { getStatuses } from '@/lib/settings'
import { notifyStudents } from '@/lib/notify'
import { Application, Company, Job, Student } from '@/models'

const JOB_TYPES = ['Full-time', 'Internship', 'Internship + Full-time', 'Contract'] as const

/* ───────────── Companies & jobs (placement staff) ───────────── */

export async function saveCompany(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'companies.edit' : 'companies.create')
    const doc = { name: need(fd, 'name', 'Company name', 120), logo: link(fd, 'logo'), website: link(fd, 'website'), description: str(fd, 'description', 2000), industry: str(fd, 'industry', 80), location: str(fd, 'location', 120) }
    if (id) await Company.updateOne({ _id: id }, { $set: doc })
    else await Company.create(doc)
    await audit(me, 'companies', id ? 'company.update' : 'company.create', id ?? doc.name, undefined, doc)
    revalidatePath('/companies')
    return { ok: 'Company saved.' }
  })
}

export async function deleteCompany(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('companies.delete')
    const c = await Company.findById(oid(fd, 'id')).lean()
    if (!c) throw new Invalid('Company not found.')
    if (await Job.exists({ company: c._id })) throw new Invalid('This company has job opportunities. Close or delete them first.')
    await Company.deleteOne({ _id: c._id })
    await audit(me, 'companies', 'company.delete', c._id, c)
    revalidatePath('/companies')
    return { ok: 'Company deleted.' }
  })
}

export async function saveJob(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'jobs.edit' : 'jobs.create')
    const company = await Company.findById(oid(fd, 'company')).select('name').lean()
    if (!company) throw new Invalid('Choose a company.')
    const doc = {
      company: company._id, role: need(fd, 'role', 'Job role', 120), description: str(fd, 'description', 5000),
      ctc: num(fd, 'ctc', { min: 0, max: 500, label: 'Salary package (LPA)' }), ctcText: str(fd, 'ctcText', 120), location: str(fd, 'location', 160),
      eligibility: str(fd, 'eligibility', 2000), skills: list(fd, 'skills'), deadline: date(fd, 'deadline'), link: link(fd, 'link'),
      process: str(fd, 'process', 2000), type: oneOf(fd, 'type', JOB_TYPES, 'Full-time'), status: oneOf(fd, 'status', ['draft', 'open', 'closed'] as const, 'open'),
    }
    const before = id ? await Job.findById(id).lean() : null
    if (id) await Job.updateOne({ _id: id }, { $set: doc })
    const job = id ? null : await Job.create(doc)
    await audit(me, 'jobs', id ? 'job.update' : 'job.create', id ?? job!._id, before, doc)
    if (doc.status === 'open' && before?.status !== 'open') {
      const students = await Student.find({ status: 'active' }).distinct('_id')
      await notifyStudents(students, { title: `New opportunity: ${company.name} — ${doc.role}`, body: [doc.ctcText || (doc.ctc ? `${doc.ctc} LPA` : ''), doc.deadline ? `Apply by ${doc.deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}` : ''].filter(Boolean).join(' · '), link: '/me/jobs' })
    }
    revalidatePath('/jobs')
    return { ok: 'Opportunity saved.' }
  })
}

export async function deleteJob(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('jobs.delete')
    const j = await Job.findById(oid(fd, 'id')).lean()
    if (!j) throw new Invalid('Opportunity not found.')
    if (await Application.exists({ job: j._id })) throw new Invalid('Students have applied to this opportunity. Close it instead.')
    await Job.deleteOne({ _id: j._id })
    await audit(me, 'jobs', 'job.delete', j._id, j)
    revalidatePath('/jobs')
    return { ok: 'Opportunity deleted.' }
  })
}

/* ───────────── Applications (students and placement staff) ───────────── */

/** Resolves who the application is for: a student always acts on themselves; staff need permission and scope. */
async function actor(fd: FormData, perm: 'applications.create' | 'applications.edit') {
  const me = await currentUser()
  if (!me) throw new Invalid('Your session has expired. Sign in again.')
  if (me.student) return { me, student: me.student as Types.ObjectId | string }
  if (!can(me, perm)) throw new Invalid('You do not have permission to do that.')
  const student = oid(fd, 'student')
  if (!student) throw new Invalid('Choose a student.')
  await assertStudentAccess(me, student)
  return { me, student }
}

const entry = (me: Me, from: string | null, to: string, remarks?: string) => ({ from, to, by: me._id, byName: me.name, at: new Date(), remarks })

export async function applyToJob(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const { me, student } = await actor(fd, 'applications.create')
    const job = await Job.findById(oid(fd, 'job')).populate<{ company: { name: string } }>('company', 'name').lean()
    if (!job || job.status !== 'open') throw new Invalid('This opportunity is not open.')
    if (job.deadline && job.deadline < new Date()) throw new Invalid('The application deadline has passed.')
    const key = appKey(job.company.name, job.role)
    if (await Application.exists({ student, $or: [{ job: job._id }, { key }] })) throw new Invalid('You have already applied to this opportunity.')
    const a = await Application.create({ student, job: job._id, company: job.company.name, role: job.role, key, link: job.link, appliedOn: new Date(), source: 'MARQ', status: 'Applied', history: [entry(me, null, 'Applied')] })
    await audit(me, 'applications', 'application.create', a._id, undefined, { job: job._id })
    revalidatePath('/me/jobs')
    revalidatePath('/me/applications')
    return { ok: `Applied to ${job.company.name} — ${job.role}. Remember to complete the company's own application link if there is one.` }
  })
}

export async function saveApplication(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const statuses = await getStatuses()
    const id = oid(fd, 'id')
    const { me, student } = await actor(fd, id ? 'applications.edit' : 'applications.create')
    const company = need(fd, 'company', 'Company name', 120), role = need(fd, 'role', 'Job role', 120)
    const docs = [1, 2, 3].map(i => ({ title: str(fd, `docTitle${i}`, 120), url: link(fd, `docUrl${i}`) })).filter(d => d.url)
    const set = { company, role, key: appKey(company, role), link: link(fd, 'link'), appliedOn: date(fd, 'appliedOn'), source: str(fd, 'source', 60) || 'Self', remarks: str(fd, 'remarks', 2000), docs }
    if (id) {
      const before = await Application.findOne({ _id: id, student }).lean()
      if (!before) throw new Invalid('Application not found.')
      if (before.job) Object.assign(set, { company: before.company, role: before.role, key: before.key }) // linked to a published job: keep its identity
      await Application.updateOne({ _id: id }, { $set: set })
      await audit(me, 'applications', 'application.update', id, before, set)
    } else {
      const status = oneOf(fd, 'status', statuses, 'Applied')
      const a = await Application.create({ ...set, student, status, history: [entry(me, null, status, set.remarks)] })
      await audit(me, 'applications', 'application.create', a._id, undefined, { company, role })
    }
    revalidatePath('/me/applications')
    revalidatePath('/applications')
    return { ok: 'Application saved.' }
  })
}

/** Status changes append to history; earlier entries are never rewritten. */
export async function setApplicationStatus(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const statuses = await getStatuses()
    const { me, student } = await actor(fd, 'applications.edit')
    const id = oid(fd, 'id')
    const status = oneOf(fd, 'status', statuses)
    const remarks = str(fd, 'remarks', 1000)
    const before = await Application.findOne({ _id: id, student }).lean()
    if (!before) throw new Invalid('Application not found.')
    if (before.status === status && !remarks) throw new Invalid('Choose a different status or add a remark.')
    await Application.updateOne({ _id: before._id }, { $set: { status }, $push: { history: entry(me, before.status, status, remarks) } })
    await audit(me, 'applications', 'application.status', before._id, { status: before.status }, { status, remarks })
    if (!me.student) await notifyStudents([before.student], { title: `${before.company}: ${status}`, body: remarks, link: '/me/applications' })
    revalidatePath('/me/applications')
    revalidatePath('/applications')
    return { ok: `Status updated to ${status}.` }
  })
}



/** Student answers "Status of the candidate for this drive" for a published opportunity (open or closed). */
export async function setDriveStatus(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await currentUser()
    if (!me?.student) throw new Invalid('Only students report their own drive status.')
    const job = await Job.findById(oid(fd, 'job')).populate<{ company: { name: string } }>('company', 'name').lean()
    if (!job || job.status === 'draft') throw new Invalid('Opportunity not found.')
    const status = oneOf(fd, 'status', DRIVE_OPTIONS.map(([, s]) => s))
    const remarks = str(fd, 'remarks', 500)
    const key = appKey(job.company.name, job.role)
    const existing = await Application.findOne({ student: me.student, $or: [{ job: job._id }, { key }] }).lean()
    if (!existing) {
      await Application.create({ student: me.student, job: job._id, company: job.company.name, role: job.role, key, link: job.link, appliedOn: status === 'Not Applied' ? undefined : new Date(), source: 'MARQ', status, remarks, history: [entry(me, null, status, remarks)] })
    } else if (existing.status !== status || remarks) {
      await Application.updateOne({ _id: existing._id }, { $set: { status, ...(existing.job ? {} : { job: job._id }) }, $push: { history: entry(me, existing.status, status, remarks) } })
    } else return { ok: 'No change.' }
    await audit(me, 'applications', 'drive.status', job._id, { status: existing?.status ?? null }, { status })
    revalidatePath('/me/jobs')
    revalidatePath('/me/applications')
    return { ok: `Saved: ${DRIVE_OPTIONS.find(([, s]) => s === status)![0]}.` }
  })
}
