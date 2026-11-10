'use server'
import { revalidatePath } from 'next/cache'
import { audit, requireStudent } from '@/lib/auth'
import { attempt, EMAIL, Invalid, num, oid, str, type State } from '@/lib/form'
import { Attendance, Student, TrainingSession } from '@/models'

/** Students can only rate sessions they attended (present/late), once; a resubmission replaces their rating. */
export async function sessionFeedback(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    const session = oid(fd, 'session')
    const rating = num(fd, 'rating', { min: 1, max: 5, label: 'Rating' })
    if (!session || !rating) throw new Invalid('Choose a rating from 1 to 5.')
    if (!(await Attendance.exists({ session, student: me.student, status: { $in: ['present', 'late'] } }))) throw new Invalid('You can only rate sessions you attended.')
    await TrainingSession.updateOne({ _id: session }, { $pull: { feedback: { student: me.student } } })
    await TrainingSession.updateOne({ _id: session }, { $push: { feedback: { student: me.student, rating, comment: str(fd, 'comment', 500), at: new Date() } } })
    revalidatePath('/me/training')
    return { ok: 'Thanks for the feedback.' }
  })
}

/** Students may update their own contact details and photo; academic fields stay with administrators. */
export async function updateMyProfile(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    const personalEmail = str(fd, 'personalEmail', 120).toLowerCase()
    if (personalEmail && !EMAIL.test(personalEmail)) throw new Invalid('Enter a valid personal email.')
    const phone = str(fd, 'phone', 20)
    if (phone && !/^[+\d][\d\s-]{6,18}$/.test(phone)) throw new Invalid('Enter a valid mobile number.')
    const set: Record<string, unknown> = { personalEmail: personalEmail || undefined, phone }
    const photo = fd.get('photo')
    if (photo instanceof File && photo.size) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) throw new Invalid('Profile picture must be JPEG, PNG or WebP.')
      if (photo.size > 300 * 1024) throw new Invalid('Profile picture must be under 300 KB.')
      set.photo = { data: Buffer.from(await photo.arrayBuffer()), type: photo.type }
    }
    await Student.updateOne({ _id: me.student }, { $set: set })
    await audit(me, 'students', 'student.selfUpdate', me.student, undefined, { personalEmail, phone, photo: !!set.photo })
    revalidatePath('/me/profile')
    return { ok: 'Profile updated.' }
  })
}
