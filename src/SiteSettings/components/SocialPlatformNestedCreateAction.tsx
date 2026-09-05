'use client'

import {
  PopupList,
  useDocumentDrawer,
  useDocumentDrawerContext,
  useDocumentInfo,
  useTranslation,
} from '@payloadcms/ui'

import { socialPlatformsSlug } from '@/collections/SocialPlatforms'

import './socialPlatformNestedCreateAction.scss'

export const SocialPlatformNestedCreateAction = () => {
  const { drawerSlug: parentDrawerSlug } = useDocumentDrawerContext()
  const { isEditing } = useDocumentInfo()
  const { t } = useTranslation()
  const childDrawerSlug = `${parentDrawerSlug ?? 'social-platform-page'}-create-social-platform`
  const [DocumentDrawer, , { closeDrawer, openDrawer }] = useDocumentDrawer({
    collectionSlug: socialPlatformsSlug,
    drawerSlug: childDrawerSlug,
    overrideEntityVisibility: true,
  })

  if (!parentDrawerSlug || !isEditing) return null

  return (
    <>
      <span aria-hidden className="social-platform-nested-create-action__marker" />
      <PopupList.Button id="action-create-social-platform-child" onClick={openDrawer}>
        {t('general:createNew')}
      </PopupList.Button>
      <DocumentDrawer
        onSave={({ operation }) => {
          if (operation === 'create') closeDrawer()
        }}
        redirectAfterCreate={false}
      />
    </>
  )
}
