'use client'

import { Button, useModal } from '@payloadcms/ui'

import { SocialPlatformCreateModal } from './SocialPlatformCreateModal'

const modalSlug = 'site-settings-create-social-platform'

export const SocialPlatformCreateActions = () => {
  const { openModal } = useModal()

  return (
    <>
      <Button buttonStyle="secondary" onClick={() => openModal(modalSlug)} type="button">
        Create Social Platform
      </Button>
      <SocialPlatformCreateModal modalSlug={modalSlug} onCreated={() => undefined} />
    </>
  )
}
