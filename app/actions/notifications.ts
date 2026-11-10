'use server'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { attempt, Invalid, oid, type State } from '@/lib/form'
import { Notification } from '@/models'

export async function markRead(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await currentUser()
    if (!me) throw new Invalid('Sign in again.')
    const id = oid(fd, 'id')
    // always scoped to the signed-in user: an id from another user matches nothing
    await Notification.updateMany(id ? { _id: id, user: me._id } : { user: me._id, read: false }, { $set: { read: true } })
    revalidatePath('/', 'layout')
    return { ok: id ? 'Marked as read.' : 'All caught up.' }
  })
}
