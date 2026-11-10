import { can, requirePage } from '@/lib/auth'
import { getScoring } from '@/lib/settings'
import { CATEGORIES, DIMENSIONS, type Dim } from '@/lib/scoring'
import { APP_STATUSES } from '@/lib/placement'
import { Setting } from '@/models'
import { Card, Field, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/form'
import { Formula } from '@/components/formula'
import { mailEnabled } from '@/lib/mail'
import { saveScoring, saveStatuses } from '@/app/actions/admin'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const me = await requirePage('settings.view')
  const [cfg, extra] = await Promise.all([getScoring(), Setting.findOne({ key: 'extraStatuses' }).lean()])
  const edit = can(me, 'settings.edit')
  const dims = Object.entries(DIMENSIONS) as [Dim, string][]
  return (
    <>
      <PageHeader title="Settings" description="Scoring formula, thresholds and application statuses." />
      <div className="space-y-6">
        <Card title="Scoring formula">
          <ActionForm action={saveScoring} submit={edit ? 'Save scoring' : undefined} reset={false}>
            <fieldset disabled={!edit} className="space-y-6">
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/60"><tr><th className="th">Dimension</th><th className="th">Overall weight</th><th className="th">Readiness weight</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {dims.map(([k, l]) => <tr key={k}><td className="td font-medium">{l}</td><td className="td"><input name={`o_${k}`} type="number" min={0} max={100} defaultValue={cfg.overall[k]} className="input w-24" /></td><td className="td"><input name={`r_${k}`} type="number" min={0} max={100} defaultValue={cfg.readiness[k]} className="input w-24" /></td></tr>)}
                  </tbody>
                </table>
              </div>
              <div>
                <span className="label">Which dimension each assessment category feeds</span>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CATEGORIES.map(c => (
                    <label key={c} className="text-sm"><span className="text-muted">{c}</span>
                      <select name={`c_${c}`} defaultValue={cfg.categoryDim[c] ?? ''} className="input mt-1">{dims.filter(([k]) => k !== 'attendance').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="High performer ≥"><input name="t_high" type="number" min={0} max={100} defaultValue={cfg.thresholds.high} className="input" /></Field>
                <Field label="Needs attention <"><input name="t_attention" type="number" min={0} max={100} defaultValue={cfg.thresholds.attention} className="input" /></Field>
                <Field label="Attendance warning < %"><input name="t_attendance" type="number" min={0} max={100} defaultValue={cfg.thresholds.attendance} className="input" /></Field>
                <Field label="Trend threshold (pts)"><input name="t_trend" type="number" min={0} max={50} step="0.5" defaultValue={cfg.thresholds.trend} className="input" /></Field>
              </div>
            </fieldset>
          </ActionForm>
        </Card>
        <Card title="Current formula"><Formula cfg={cfg} /></Card>
        <Card title="Application statuses">
          <p className="mb-3 text-sm text-muted">Built-in: {APP_STATUSES.join(' · ')}</p>
          <ActionForm action={saveStatuses} submit={edit ? 'Save statuses' : undefined} reset={false}>
            <Field label="Additional statuses (one per line)"><textarea name="extra" rows={4} disabled={!edit} defaultValue={((extra?.value as string[]) ?? []).join('\n')} className="input" placeholder={'Group Discussion Scheduled\nOffer On Hold'} /></Field>
          </ActionForm>
        </Card>
        <Card title="Email">
          <p className="text-sm">{mailEnabled() ? 'SMTP is configured: invitations and password resets are emailed.' : 'SMTP is not configured: administrators copy one-time activation/reset links from User Management and share them securely. Set SMTP_* environment variables to enable email.'}</p>
        </Card>
      </div>
    </>
  )
}
