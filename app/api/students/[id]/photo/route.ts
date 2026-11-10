import { currentUser, studentScope } from '@/lib/auth'
import { OID } from '@/lib/form'
import { Student } from '@/models'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser()
  const { id } = await params
  if (!me || !OID.test(id)) return new Response('Not found', { status: 404 })
  if (!me.student && !me.perms.length) return new Response('Forbidden', { status: 403 })
  const s = await Student.findOne({ $and: [{ _id: id }, await studentScope(me)] }).select('+photo.data photo.type').lean()
  if (!s?.photo?.data) return new Response('Not found', { status: 404 })
  const raw = s.photo.data as unknown as Buffer | { buffer: Uint8Array } // lean() yields a BSON Binary
  const bytes = new Uint8Array(Buffer.isBuffer(raw) ? raw : raw.buffer) as BodyInit
  return new Response(bytes, { headers: { 'content-type': s.photo.type ?? 'image/jpeg', 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } })
}
