import mongoose, { Schema, type InferSchemaType, type Model, type Types } from 'mongoose'

const { ObjectId, Mixed } = Schema.Types
type Doc<S extends Schema> = InferSchemaType<S> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date }
function model<S extends Schema>(name: string, schema: S) {
  return (mongoose.models[name] as Model<Doc<S>>) || mongoose.model<Doc<S>>(name, schema)
}
const ts = { timestamps: true }

/* ───────────── Identity & access ───────────── */

const roleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: String,
    perms: { type: [String], default: [] },
    scope: { type: String, enum: ['all', 'assigned'], default: 'all' },
    portal: { type: String, enum: ['student', null], default: null },
    system: { type: Boolean, default: false }, // built-in: can't be deleted or renamed
  },
  ts,
)
export const Role = model('Role', roleSchema)

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    empId: { type: String, trim: true, uppercase: true, index: { unique: true, sparse: true } },
    phone: String,
    department: String,
    designation: String,
    type: { type: String, enum: ['administrative', 'faculty', 'mentor', 'trainer', 'student'], default: 'administrative' },
    role: { type: ObjectId, ref: 'Role', required: true, index: true },
    status: { type: String, enum: ['invited', 'active', 'inactive'], default: 'invited', index: true },
    student: { type: ObjectId, ref: 'Student', index: { unique: true, sparse: true } },
    passwordHash: { type: String, select: false },
    sessionVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    activatedAt: Date,
    // one-time activation / reset link; only the sha256 is stored
    tokenHash: { type: String, select: false, index: { sparse: true } },
    tokenPurpose: { type: String, enum: ['activate', 'reset'], select: false },
    tokenExpires: { type: Date, select: false },
    invitedAt: Date,
    createdBy: { type: ObjectId, ref: 'User' },
  },
  ts,
)
export const User = model('User', userSchema)

/* ───────────── Students & training ───────────── */

const studentSchema = new Schema(
  {
    regNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    personalEmail: { type: String, trim: true, lowercase: true },
    phone: String,
    department: { type: String, index: true },
    specialization: String,
    year: String,
    section: String,
    photo: { data: { type: Buffer, select: false }, type: { type: String } },
    batch: { type: ObjectId, ref: 'Batch', index: true },
    mentor: { type: ObjectId, ref: 'User', index: true },
    status: { type: String, enum: ['active', 'on_hold', 'withdrawn', 'completed'], default: 'active', index: true },
    // student-maintained
    handles: { leetcode: String, codechef: String, codeforces: String },
    professional: { headline: String, linkedin: String, github: String, portfolio: String, resume: String, skills: [String] },
    onLeaderboard: { type: Boolean, default: true },
  },
  ts,
)
studentSchema.index({ name: 'text', regNo: 'text', email: 'text' })
export const Student = model('Student', studentSchema)

const programSchema = new Schema(
  { name: { type: String, required: true, trim: true }, description: String, startDate: Date, endDate: Date, status: { type: String, enum: ['planned', 'running', 'completed'], default: 'running' } },
  ts,
)
export const Program = model('Program', programSchema)

const batchSchema = new Schema(
  { name: { type: String, required: true, trim: true }, program: { type: ObjectId, ref: 'Program', required: true, index: true }, trainers: [{ type: ObjectId, ref: 'User' }], startDate: Date, endDate: Date },
  ts,
)
batchSchema.index({ program: 1, name: 1 }, { unique: true })
export const Batch = model('Batch', batchSchema)

const sessionSchema = new Schema(
  {
    batch: { type: ObjectId, ref: 'Batch', required: true, index: true },
    title: { type: String, required: true, trim: true },
    topics: [String],
    trainer: { type: ObjectId, ref: 'User', index: true },
    date: { type: Date, required: true, index: true },
    start: String, // HH:MM IST
    end: String,
    mode: { type: String, enum: ['Offline', 'Online'], default: 'Offline' },
    venue: String,
    materials: [{ title: String, url: String }],
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled', index: true },
    feedback: [{ student: { type: ObjectId, ref: 'Student' }, rating: { type: Number, min: 1, max: 5 }, comment: String, at: { type: Date, default: Date.now } }],
  },
  ts,
)
export const TrainingSession = model('TrainingSession', sessionSchema)

const correction = { from: String, to: String, by: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, reason: String }
const attendanceSchema = new Schema(
  {
    session: { type: ObjectId, ref: 'TrainingSession', required: true },
    student: { type: ObjectId, ref: 'Student', required: true, index: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
    date: { type: Date, required: true, index: true }, // copied from the session for monthly reports
    markedBy: { type: ObjectId, ref: 'User' },
    history: [correction],
  },
  ts,
)
attendanceSchema.index({ session: 1, student: 1 }, { unique: true })
export const Attendance = model('Attendance', attendanceSchema)

/* ───────────── Assessments & mentorship ───────────── */

const assessmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    maxMarks: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true, index: true },
    durationMin: Number,
    trainer: { type: ObjectId, ref: 'User' },
    batches: [{ type: ObjectId, ref: 'Batch' }],
    remarks: String,
    status: { type: String, enum: ['scheduled', 'completed'], default: 'scheduled' },
  },
  ts,
)
export const Assessment = model('Assessment', assessmentSchema)

const resultSchema = new Schema(
  {
    assessment: { type: ObjectId, ref: 'Assessment', required: true },
    student: { type: ObjectId, ref: 'Student', required: true, index: true },
    marks: { type: Number, min: 0, default: null }, // null = absent
    remarks: String,
    enteredBy: { type: ObjectId, ref: 'User' },
    history: [{ from: Number, to: Number, by: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
  },
  ts,
)
resultSchema.index({ assessment: 1, student: 1 }, { unique: true })
export const AssessmentResult = model('AssessmentResult', resultSchema)

const rating = { type: Number, min: 1, max: 5 }
const evaluationSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'Student', required: true, index: true },
    mentor: { type: ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, default: Date.now },
    ratings: { technical: rating, coding: rating, communication: rating, aptitude: rating, attitude: rating },
    strengths: String,
    weaknesses: String,
    recommendations: String,
    remarks: String,
    followUp: { date: Date, note: String, done: { type: Boolean, default: false } },
  },
  ts,
)
export const Evaluation = model('Evaluation', evaluationSchema)

/* ───────────── Coding platforms ───────────── */

const codingStatSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'Student', required: true },
    platform: { type: String, enum: ['leetcode', 'codechef', 'codeforces'], required: true },
    handle: String,
    status: { type: String, enum: ['ok', 'not_found', 'error'], default: 'ok' },
    error: String,
    rating: Number,
    maxRating: Number,
    contests: Number,
    lastChange: Number,
    solved: Number,
    easy: Number,
    medium: Number,
    hard: Number,
    history: [{ _id: false, name: String, rating: Number, at: Date }],
    points: { type: Number, default: 0 },
    fetchedAt: Date,
  },
  ts,
)
codingStatSchema.index({ student: 1, platform: 1 }, { unique: true })
export const CodingStat = model('CodingStat', codingStatSchema)

// one row per student per IST day: coding points and cohort rank, for rank history
const snapshotSchema = new Schema({ student: { type: ObjectId, ref: 'Student', required: true }, day: { type: String, required: true }, points: Number, rank: Number })
snapshotSchema.index({ student: 1, day: 1 }, { unique: true })
snapshotSchema.index({ day: 1 })
export const ScoreSnapshot = model('ScoreSnapshot', snapshotSchema)

const targetSchema = new Schema(
  { batch: { type: ObjectId, ref: 'Batch', required: true, index: true }, name: { type: String, required: true }, due: { type: Date, required: true }, points: { type: Number, required: true, min: 0 } },
  ts,
)
export const Target = model('Target', targetSchema)

/* ───────────── Placements ───────────── */

const companySchema = new Schema(
  { name: { type: String, required: true, trim: true, unique: true }, logo: String, website: String, description: String, industry: String, location: String },
  ts,
)
export const Company = model('Company', companySchema)

const jobSchema = new Schema(
  {
    company: { type: ObjectId, ref: 'Company', required: true, index: true },
    role: { type: String, required: true, trim: true },
    description: String,
    ctc: Number, // LPA
    ctcText: String,
    location: String,
    eligibility: String,
    skills: [String],
    deadline: Date,
    link: String,
    process: String,
    type: { type: String, enum: ['Full-time', 'Internship', 'Internship + Full-time', 'Contract'], default: 'Full-time' },
    status: { type: String, enum: ['draft', 'open', 'closed'], default: 'open', index: true },
  },
  ts,
)
export const Job = model('Job', jobSchema)

const applicationSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'Student', required: true, index: true },
    job: { type: ObjectId, ref: 'Job', index: true },
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    key: { type: String, required: true }, // normalised company|role, blocks duplicates per student
    link: String,
    appliedOn: Date,
    source: { type: String, default: 'MARQ' },
    status: { type: String, required: true, index: true },
    remarks: String,
    docs: [{ title: String, url: String }],
    history: [{ from: String, to: String, by: { type: ObjectId, ref: 'User' }, byName: String, at: { type: Date, default: Date.now }, remarks: String }],
  },
  ts,
)
applicationSchema.index({ student: 1, key: 1 }, { unique: true })
export const Application = model('Application', applicationSchema)

const interviewSchema = new Schema(
  {
    application: { type: ObjectId, ref: 'Application', required: true, index: true },
    student: { type: ObjectId, ref: 'Student', required: true, index: true },
    company: String,
    role: String,
    round: { type: String, required: true },
    at: { type: Date, required: true, index: true },
    mode: { type: String, enum: ['Online', 'Onsite', 'Telephonic'], default: 'Online' },
    link: String,
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'no-show'], default: 'scheduled' },
    result: { type: String, enum: ['pending', 'cleared', 'rejected', 'on-hold'], default: 'pending' },
    feedback: String,
    remarks: String,
    reminded: { type: Boolean, default: false },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  ts,
)
export const Interview = model('Interview', interviewSchema)

/* ───────────── Communication, money, audit ───────────── */

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: { type: String, enum: ['Training', 'Assessment', 'Placement', 'Opportunity', 'Interview', 'General'], default: 'General' },
    roles: [String], // role keys; empty = everyone
    batches: [{ type: ObjectId, ref: 'Batch' }],
    createdBy: { type: ObjectId, ref: 'User' },
  },
  ts,
)
export const Announcement = model('Announcement', announcementSchema)

const notificationSchema = new Schema(
  { user: { type: ObjectId, ref: 'User', required: true }, title: String, body: String, link: String, read: { type: Boolean, default: false } },
  ts,
)
notificationSchema.index({ user: 1, read: 1, createdAt: -1 })
export const Notification = model('Notification', notificationSchema)

const financeSchema = new Schema(
  {
    date: { type: Date, required: true, index: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    vendor: String,
    reference: String,
    program: { type: ObjectId, ref: 'Program' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    approvedBy: { type: ObjectId, ref: 'User' },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  ts,
)
export const FinancialRecord = model('FinancialRecord', financeSchema)

const settingSchema = new Schema({ key: { type: String, required: true, unique: true }, value: Mixed }, ts)
export const Setting = model('Setting', settingSchema)

const auditSchema = new Schema({
  actor: { type: ObjectId, ref: 'User', index: true },
  actorName: String,
  action: { type: String, required: true },
  module: { type: String, required: true, index: true },
  target: String,
  before: Mixed,
  after: Mixed,
  ip: String,
  at: { type: Date, default: Date.now, index: true },
})
// Append-only: the app never edits or deletes audit entries.
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne'] as const)
  auditSchema.pre(op, () => {
    throw new Error('Audit logs are append-only')
  })
export const AuditLog = model('AuditLog', auditSchema)

const rateSchema = new Schema({ key: { type: String, required: true, unique: true }, count: { type: Number, default: 0 }, expiresAt: { type: Date, expires: 0 } })
export const RateLimit = model('RateLimit', rateSchema)
