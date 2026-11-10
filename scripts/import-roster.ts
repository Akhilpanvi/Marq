// One-off roster import for a trusted machine: same rules as Students → Bulk import (match by regNo; never duplicates).
// MONGODB_URI=… npx tsx scripts/import-roster.ts <file.csv>
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { db } from '../lib/db'
import { parseCsv } from '../lib/csv'
import { EMAIL, REGNO } from '../lib/form'
import { AuditLog, Student } from '../models'

const rows = parseCsv(readFileSync(process.argv[2], 'utf8'))
const errors: string[] = []
const docs = rows.map((r, i) => {
  const d = { regNo: (r['Registration Number'] ?? '').toUpperCase(), name: r['Full Name'], email: (r['University Email'] ?? '').toLowerCase(), department: r['Department'], specialization: r['Specialization'], status: 'active' }
  if (!REGNO.test(d.regNo) || !d.name || !EMAIL.test(d.email)) errors.push(`row ${i + 2}`)
  return d
})
if (errors.length) throw new Error(`Invalid rows: ${errors.join(', ')}`)
await db()
const before = await Student.countDocuments()
const res = await Student.bulkWrite(docs.map(d => ({ updateOne: { filter: { regNo: d.regNo }, update: { $set: d }, upsert: true } })), { ordered: false })
await AuditLog.create({ actorName: 'roster script', module: 'students', action: 'student.import', target: `${res.upsertedCount} created, ${res.modifiedCount} updated`, after: { total: docs.length, created: res.upsertedCount, updated: res.modifiedCount } })
console.log({ before, total: docs.length, created: res.upsertedCount, updated: res.modifiedCount, after: await Student.countDocuments() })
await mongoose.disconnect()
