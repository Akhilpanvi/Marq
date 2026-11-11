// Company drives from the "Y-26 Top Notch Marque Students Performance Analysis" form.
// Idempotent (matched by company + role). MONGODB_URI=… npx tsx scripts/seed-drives.ts
import mongoose from 'mongoose'
import { db } from '../lib/db'
import { AuditLog, Company, Job } from '../models'

type D = { company: string; website: string; industry: string; role: string; link: string; open: boolean; type: 'Full-time' | 'Internship'; location?: string }
const DRIVES: D[] = [
  { company: 'Amazon', website: 'https://www.amazon.jobs', industry: 'Technology', role: 'SDE', link: 'https://lnkd.in/gk9BVEHY', open: false, type: 'Full-time' },
  { company: 'Amazon', website: 'https://www.amazon.jobs', industry: 'Technology', role: 'Programmer Analyst Intern', link: 'https://www.amazon.jobs/en/jobs/10506542/programmer-analyst-intern-2027', open: true, type: 'Internship' },
  { company: 'Amazon', website: 'https://www.amazon.jobs', industry: 'Technology', role: 'Data Engineer Intern', link: 'https://www.amazon.jobs/en/jobs/10496769/data-engineer-intern-2027', open: true, type: 'Internship' },
  { company: 'Google', website: 'https://www.google.com/about/careers', industry: 'Technology', role: 'Associate Product Manager (University Graduate, 2027 start)', link: 'https://www.google.com/about/careers/applications/jobs/results/101007950268506822-associate-product-manager-university-graduate-2027-start', open: true, type: 'Full-time' },
  { company: 'Google', website: 'https://www.google.com/about/careers', industry: 'Technology', role: 'Student Researcher', link: 'https://www.google.com/about/careers/applications/jobs/results/125423735539671750-student-researcher-2027', open: true, type: 'Internship' },
  { company: 'HPE', website: 'https://careers.hpe.com', industry: 'Technology', role: 'College Intern', link: 'https://careers.hpe.com/us/en/job/1211843/College-Intern', open: true, type: 'Internship' },
  { company: 'Enterpret', website: 'https://www.enterpret.com', industry: 'Software', role: 'Software Engineering Intern', link: 'https://job-boards.greenhouse.io/enterpret/jobs/7847134003', open: true, type: 'Internship' },
  { company: 'Honeywell Aerospace', website: 'https://careers.honeywell.com', industry: 'Aerospace', role: 'Intern', link: 'https://icfcjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Aerospace/job/127572', open: true, type: 'Internship' },
  { company: 'Clarivate', website: 'https://careers.clarivate.com', industry: 'Information services', role: 'Futures Technology Engineer', link: 'https://careers.clarivate.com/job/JREQ136987/Futures-Technology-Engineer-Bengaluru', open: true, type: 'Full-time', location: 'Bengaluru' },
  { company: 'Microsoft', website: 'https://careers.microsoft.com', industry: 'Technology', role: 'Applied Sciences Intern', link: 'https://apply.careers.microsoft.com/careers/job/1970393556917519', open: true, type: 'Internship' },
  { company: 'Electronic Arts', website: 'https://jobs.ea.com', industry: 'Gaming', role: 'Software Engineer Intern', link: 'https://jobs.ea.com/en_US/careers/JobDetail/Software-Engineer-Intern/215949', open: true, type: 'Internship' },
  { company: 'Meta', website: 'https://www.metacareers.com', industry: 'Technology', role: 'Technical Program Manager Intern', link: 'https://www.metacareers.com/profile/job_details/1649069223327170/', open: true, type: 'Internship' },
]

await db()
let created = 0, updated = 0
for (const d of DRIVES) {
  const c = await Company.findOneAndUpdate({ name: d.company }, { $setOnInsert: { name: d.company, website: d.website, industry: d.industry } }, { upsert: true, returnDocument: 'after' })
  const r = await Job.updateOne({ company: c!._id, role: d.role }, { $set: { link: d.link, type: d.type, status: d.open ? 'open' : 'closed', ...(d.location ? { location: d.location } : {}) } }, { upsert: true })
  r.upsertedCount ? created++ : updated++
}
await AuditLog.create({ actorName: 'drives script', module: 'jobs', action: 'job.import', target: `${created} created, ${updated} updated`, after: { drives: DRIVES.length } })
console.log({ drives: DRIVES.length, companies: new Set(DRIVES.map(d => d.company)).size, created, updated })
await mongoose.disconnect()
