'use client'

import { RelationshipField, useField } from '@payloadcms/ui'
import type { RelationshipFieldClientComponent } from 'payload'

import { SocialPlatformCreateAction } from './SocialPlatformCreateActions'

const getDrawerSlug = (path: string): string =>
  `site-settings-social-platform-${path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`

export const SocialPlatformRelationshipField: RelationshipFieldClientComponent = (props) => {
  const { path, setValue, value } = useField<null | number | string>({
    potentiallyStalePath: props.path,
  })
  const field = {
    ...props.field,
    admin: {
      ...props.field.admin,
      allowCreate: false,
    },
  }

  return (
    <>
      <RelationshipField {...props} field={field} />
      <SocialPlatformCreateAction
        buttonStyle="pill"
        drawerSlug={getDrawerSlug(path)}
        onCreated={(document) => setValue(document.id, value === document.id)}
      />
    </>
  )
}
