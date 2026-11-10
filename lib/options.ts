import 'server-only'
import { Batch, Company, Program, Role, User } from '@/models'
import type { ACCOUNT_TYPES } from './rbac'

export type Opt = [string, string]

export async function batchOptions(): Promise<Opt[]> {
  const [batches, programs] = await Promise.all([Batch.find().select('name program').sort({ name: 1 }).lean(), Program.find().select('name').lean()])
  const p = new Map(programs.map(x => [String(x._id), x.name]))
  return batches.map(b => [String(b._id), programs.length > 1 ? `${b.name} · ${p.get(String(b.program)) ?? ''}` : b.name])
}

async function staffWithRole(keys: string[], types: (typeof ACCOUNT_TYPES)[number][]): Promise<Opt[]> {
  const roles = await Role.find({ key: { $in: keys } }).distinct('_id')
  const users = await User.find({ status: { $ne: 'inactive' }, $or: [{ role: { $in: roles } }, { type: { $in: types } }] }).select('name email').sort({ name: 1 }).lean()
  return users.map(u => [String(u._id), u.name])
}

export const mentorOptions = () => staffWithRole(['mentor'], ['mentor', 'faculty'])
export const trainerOptions = () => staffWithRole(['trainer'], ['trainer', 'faculty'])

export async function programOptions(): Promise<Opt[]> {
  return (await Program.find().select('name').sort({ createdAt: -1 }).lean()).map(p => [String(p._id), p.name])
}

export async function companyOptions(): Promise<Opt[]> {
  return (await Company.find().select('name').sort({ name: 1 }).lean()).map(c => [String(c._id), c.name])
}

export async function roleOptions(): Promise<Opt[]> {
  return (await Role.find().select('name').sort({ name: 1 }).lean()).map(r => [String(r._id), r.name])
}
