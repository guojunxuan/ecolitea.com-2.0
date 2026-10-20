'use client'

import {
  Banner,
  Button,
  FieldDescription,
  FieldLabel,
  Link,
  Pill,
  ShimmerEffect,
  useConfig,
  useDocumentInfo,
} from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'
import type { DocumentReference } from '../references'
import styles from './UsedInPanel.module.css'

type References = { current: DocumentReference[]; historicalCount: number }

function labelText(label: unknown): string | undefined {
  if (typeof label === 'string' && label.trim()) return label
  if (label && typeof label === 'object') {
    const localized = label as Record<string, unknown>
    return (
      labelText(localized.en) ??
      Object.values(localized).find(
        (value): value is string => typeof value === 'string' && Boolean(value.trim()),
      )
    )
  }
  return undefined
}

export function UsedInPanel() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  if (id === undefined || id === null || id === '') return null
  return <UsedInReferences key={`${config.routes.api}:${id}`} id={id} />
}

function UsedInReferences({ id }: { id: string | number }) {
  const { config } = useConfig()
  const api = config.routes.api
  const [result, setResult] = useState<References>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${api}/documents/${encodeURIComponent(id)}/references`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Reference inspection failed')
        const data: References = await response.json()
        if (!controller.signal.aborted) setResult(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [api, id, attempt])

  const owners = new Set<string>()
  const current = (result?.current ?? []).filter((reference) => {
    const key = JSON.stringify([
      reference.ownerType,
      reference.ownerSlug,
      reference.ownerDocumentID,
    ])
    if (owners.has(key)) return false
    owners.add(key)
    return true
  })
  return (
    <section className={styles.panel} aria-label="Used in">
      <hr className={styles.divider} />
      <div className={styles.heading}>
        <div>
          <FieldLabel path="usedIn" label="Used in" />
        </div>
        {current.length > 0 && (
          <Pill size="small" rounded>
            {current.length}
          </Pill>
        )}
      </div>
      {failed ? (
        <Banner type="danger">
          <span role="alert">Couldn&apos;t load where this is used.</span>
          <Button
            buttonStyle="ghost"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </Banner>
      ) : !result ? (
        <div role="status" aria-label="Loading usage" className={styles.loading}>
          <ShimmerEffect height="1.25rem" />
          <ShimmerEffect height="1.25rem" width="70%" />
        </div>
      ) : (
        <>
          {current.length > 0 && (
            <ul className={styles.list}>
              {(expanded ? current : current.slice(0, 5)).map((reference) => (
                <li key={reference.editURL} className={styles.row}>
                  <Pill size="small">
                    {reference.ownerType === 'global'
                      ? 'Global'
                      : (labelText(
                          config.collections.find(({ slug }) => slug === reference.ownerSlug)
                            ?.labels?.singular,
                        ) ?? reference.ownerSlug)}
                  </Pill>
                  <Link href={reference.editURL}>{reference.title}</Link>
                </li>
              ))}
            </ul>
          )}
          {!expanded && current.length > 5 && (
            <Button buttonStyle="ghost" onClick={() => setExpanded(true)}>
              Show all {current.length}
            </Button>
          )}
          <FieldDescription
            path="usedIn"
            description={
              current.length
                ? 'Remove it from these places before deleting.'
                : 'Not used anywhere. It can be deleted.'
            }
          />
          {result.historicalCount > 0 && (
            <FieldDescription
              path="usedInHistory"
              description={`Also in ${result.historicalCount} older versions — these don't block deletion.`}
            />
          )}
        </>
      )}
    </section>
  )
}
