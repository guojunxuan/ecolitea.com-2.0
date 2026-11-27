'use client'

import { Button, toast, useDocumentDrawer } from '@payloadcms/ui'

import { socialPlatformsSlug } from '@/collections/SocialPlatforms'

type CreatedSocialPlatform = {
  id: number | string
  platform?: string
}

type SocialPlatformCreateActionProps = {
  buttonStyle?: 'pill' | 'secondary'
  drawerSlug: string
  onCreated?: (document: CreatedSocialPlatform) => void
  successMessage?: string
}

export const SocialPlatformCreateAction = ({
  buttonStyle = 'secondary',
  drawerSlug,
  onCreated,
  successMessage,
}: SocialPlatformCreateActionProps) => {
  const [DocumentDrawer, , { closeDrawer, openDrawer }] = useDocumentDrawer({
    collectionSlug: socialPlatformsSlug,
    drawerSlug,
    overrideEntityVisibility: true,
  })

  return (
    <>
      <Button buttonStyle={buttonStyle} onClick={openDrawer} type="button">
        Create Social Platform
      </Button>
      <DocumentDrawer
        onSave={({ doc, operation }) => {
          if (operation !== 'create') return
          onCreated?.(doc)
          closeDrawer()
          if (successMessage) toast.success(successMessage)
        }}
        redirectAfterCreate={false}
      />
    </>
  )
}

export const SocialPlatformCreateActions = () => (
  <SocialPlatformCreateAction
    drawerSlug="site-settings-social-platform"
    successMessage="Social platform created."
  />
)
