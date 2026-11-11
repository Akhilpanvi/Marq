import 'server-only'
import { cache } from 'react'
import { Setting } from '@/models'
import { db } from './db'
import { DEFAULT_SCORING, type ScoringConfig } from './scoring'
import { APP_STATUSES } from './placement'

async function get<T>(key: string, fallback: T): Promise<T> {
  await db()
  const s = await Setting.findOne({ key }).lean()
  return (s?.value as T) ?? fallback
}

export const getScoring = cache(async (): Promise<ScoringConfig> => {
  const v = await get<Partial<ScoringConfig>>('scoring', {})
  return { ...DEFAULT_SCORING, ...v, thresholds: { ...DEFAULT_SCORING.thresholds, ...v.thresholds } }
})

/** Built-in statuses plus any an administrator added in Settings. */
export const getStatuses = cache(async () => [...APP_STATUSES, ...(await get<string[]>('extraStatuses', []))])

export const putSetting = (key: string, value: unknown) => Setting.updateOne({ key }, { $set: { value } }, { upsert: true })
