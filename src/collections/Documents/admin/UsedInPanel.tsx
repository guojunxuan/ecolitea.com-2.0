'use client'

import { useConfig, useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import type { DocumentReference } from '../references'

type References = { current: DocumentReference[]; historicalCount: number }

export function UsedInPanel() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  const api = config.routes.api
  if (!id) return null
  return <UsedInReferences key={`${api}:${id}`} id={id} api={api} />
}

function UsedInReferences({ id, api }: { id: string | number; api: string }) {
  const [result, setResult] = useState<References>()
  const [failed, setFailed] = useState(false)
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
  }, [api, id])
  return (
    <section className="documents-used-in" aria-label="Used in">
      <h3>Used in</h3>
      {failed ? (
        <p role="alert">Unable to load document references.</p>
      ) : !result ? (
        <p>Loading references…</p>
      ) : (
        <>
          {result.current.length ? (
            <ul>
              {result.current.map((reference, index) => (
                <li key={`${reference.editURL}:${reference.path}:${index}`}>
                  <a href={reference.editURL}>
                    {reference.title} ({reference.path})
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No current references.</p>
          )}
          <p>
            {result.historicalCount} historical references. Historical references do not prevent
            deletion.
          </p>
        </>
      )}
    </section>
  )
}
