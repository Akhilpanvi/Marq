import 'server-only'
import type { Types } from 'mongoose'
import { Notification, User } from '@/models'

type Note = { title: string; body?: string; link?: string }

export async function notifyUsers(users: (Types.ObjectId | string)[], n: Note) {
  if (users.length) await Notification.insertMany(users.map(user => ({ user, ...n })))
}

/** Notify the portal accounts belonging to these students. */
export async function notifyStudents(students: (Types.ObjectId | string)[], n: Note) {
  const users = await User.find({ student: { $in: students }, status: { $ne: 'inactive' } }).distinct('_id')
  await notifyUsers(users, n)
}
