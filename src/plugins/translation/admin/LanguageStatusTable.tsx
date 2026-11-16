'use client'

import Link from 'next/link'
import { FieldPathContext, SelectInput, useField, useFormFields } from '@payloadcms/ui'
import { localeCatalog } from '@/i18n/catalog'
import styles from './translationStatus.module.css'
import type { getTranslationStatus } from './TranslationStatus'

type Summary = Awaited<ReturnType<typeof getTranslationStatus>>
const problemHref = (locale: string, status: string) =>
  `/admin/collections/translations?where[locale][equals]=${encodeURIComponent(locale)}&where[status][equals]=${status}`
const relativeTime = (value: string, now: number) => {
  const minutes = Math.round((new Date(value).getTime() - now) / 60000)
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.abs(minutes) < 60 ? minutes : Math.round(minutes / 60),
    Math.abs(minutes) < 60 ? 'minute' : 'hour',
  )
}

function NativeStatus({ path, code }: { path: string; code: string }) {
  const { value, setValue, disabled, showError } = useField<string>({ path })
  const label = `Status for ${code}`
  return (
    <SelectInput
      name="status"
      path={path}
      label={label}
      Label={<span className={styles.visuallyHidden}>{label}</span>}
      value={value}
      required
      isClearable={false}
      isSortable={false}
      readOnly={disabled}
      showError={showError}
      options={['off', 'translating', 'live'].map((value) => ({ label: value, value }))}
      onChange={(option) => setValue(Array.isArray(option) ? null : option?.value)}
    />
  )
}

/** Status controls bind directly to native languages.N.status form fields. */
export function LanguageStatusTable({ summary }: { summary: Summary }) {
  const fields = useFormFields(([state]) => state)
  const languages = Object.entries(fields)
    .flatMap(([path, field]) => {
      const match = /^languages\.(\d+)\.code$/.exec(path)
      if (!match || typeof field.value !== 'string' || !field.value) return []
      return [{ index: Number(match[1]), code: field.value }]
    })
    .sort((a, b) => a.index - b.index)
  if (!languages.length) return <p>No target languages configured.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          minWidth: 'max-content',
          textAlign: 'left',
          borderCollapse: 'separate',
          borderSpacing: 'var(--spacer-2)',
          whiteSpace: 'nowrap',
        }}
      >
        <thead>
          <tr>
            <th>Language</th>
            <th>Status</th>
            <th>Completion</th>
            <th>Issues</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {languages.map(({ index, code }) => {
            const row = summary.counts.find((row) => row.code === code)
            return (
              <tr key={index}>
                <th>{localeCatalog.find((entry) => entry.code === code)?.label ?? code}</th>
                <td style={{ minWidth: '10rem' }}>
                  <FieldPathContext value={`languages.${index}.status`}>
                    <NativeStatus path={`languages.${index}.status`} code={code} />
                  </FieldPathContext>
                </td>
                <td>
                  {row?.ready ?? 0} / {summary.total}
                </td>
                <td>
                  {!row?.failed && !row?.waiting ? (
                    '—'
                  ) : (
                    <>
                      <Link href={problemHref(code, 'failed')}>{row.failed} failed</Link> ·{' '}
                      <Link href={problemHref(code, 'waiting_quota')}>
                        {row.waiting} waiting quota
                      </Link>
                    </>
                  )}
                </td>
                <td>
                  {row?.updated ? (
                    <time dateTime={row.updated}>
                      {relativeTime(row.updated, summary.currentTime)}
                    </time>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
