'use client'

import {
  DialogBody,
  DialogCancel,
  DialogConfirm,
  DialogFooter,
  DialogHeader,
  DialogModal,
  TextInput,
  UploadInput,
  useConfig,
  useModal,
} from '@payloadcms/ui'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'

import { socialPlatformsSlug } from '@/collections/SocialPlatforms'

import './socialPlatformCreateModal.scss'

type CreatedSocialPlatform = {
  id: number | string
  icon?: null | number | string
  platform: string
  [key: string]: unknown
}

type SocialPlatformCreateModalProps = {
  modalSlug: string
  onCreated: (document: CreatedSocialPlatform) => void
  open?: boolean
}

type PayloadErrorResponse = {
  errors?: Array<{ message?: string }>
  message?: string
}

const getResponseError = (response: PayloadErrorResponse): string =>
  response.errors?.find((error) => error.message)?.message ||
  response.message ||
  'Unable to create the social platform.'

export const SocialPlatformCreateModal = ({
  modalSlug,
  onCreated,
  open = false,
}: SocialPlatformCreateModalProps) => {
  const {
    config: {
      routes: { api },
      serverURL,
    },
  } = useConfig()
  const { closeModal, openModal } = useModal()
  const [platform, setPlatform] = useState('')
  const [icon, setIcon] = useState<null | number | string>(null)
  const [error, setError] = useState<string | null>(null)
  const reopenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearReopenTimer = () => {
    if (reopenTimer.current) {
      clearTimeout(reopenTimer.current)
      reopenTimer.current = null
    }
  }

  const scheduleReopen = () => {
    clearReopenTimer()
    reopenTimer.current = setTimeout(() => {
      reopenTimer.current = null
      openModal(modalSlug)
    }, 0)
  }

  const resetForm = () => {
    setPlatform('')
    setIcon(null)
    setError(null)
  }

  useEffect(() => {
    if (open) openModal(modalSlug)
  }, [modalSlug, open, openModal])

  useEffect(
    () => () => {
      if (reopenTimer.current) clearTimeout(reopenTimer.current)
    },
    [],
  )

  const handleCancel = () => {
    clearReopenTimer()
    resetForm()
    closeModal(modalSlug)
  }

  const handleSave = async () => {
    const normalizedPlatform = platform.trim()
    if (!normalizedPlatform) {
      setError('Platform is required.')
      scheduleReopen()
      return
    }

    if (!icon) {
      setError('Icon is required.')
      scheduleReopen()
      return
    }

    setError(null)
    let createdDocument: CreatedSocialPlatform

    try {
      const endpoint = `${serverURL || ''}${api}/${socialPlatformsSlug}`
      const response = await fetch(endpoint, {
        body: JSON.stringify({ platform: normalizedPlatform, icon }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const result = (await response.json()) as PayloadErrorResponse & {
        doc?: CreatedSocialPlatform
      }

      if (!response.ok || !result.doc) {
        setError(getResponseError(result))
        // DialogConfirm closes after its callback resolves. Re-open after that
        // close so a rejected Payload submission remains editable.
        scheduleReopen()
        return
      }

      createdDocument = result.doc
    } catch {
      setError('Unable to create the social platform.')
      scheduleReopen()
      return
    }

    clearReopenTimer()
    resetForm()
    onCreated(createdDocument)
  }

  return (
    <DialogModal className="social-platform-create-modal" closeOnEsc size="medium" slug={modalSlug}>
      <DialogHeader showClose title="Create Social Platform" />
      <DialogBody>
        <div className="social-platform-create-modal__fields">
          <TextInput
            label="Platform"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setPlatform(event.target.value)
              if (error) setError(null)
            }}
            path="platform"
            required
            showError={error === 'Platform is required.'}
            value={platform}
          />
          <UploadInput
            allowCreate
            filterOptions={{
              'brand-assets': { mimeType: { equals: 'image/svg+xml' } },
            }}
            hasMany={false}
            label="Icon"
            onChange={(value) => {
              setIcon(value ?? null)
              if (error) setError(null)
            }}
            path="icon"
            relationTo="brand-assets"
            required
            showError={error === 'Icon is required.'}
            value={icon ?? undefined}
          />
          {error ? (
            <p className="social-platform-create-modal__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <div className="social-platform-create-modal__actions">
          <DialogCancel label="Cancel" onClick={handleCancel} />
          <DialogConfirm label="Save" loadingLabel="Saving…" onClick={handleSave} />
        </div>
      </DialogFooter>
    </DialogModal>
  )
}
