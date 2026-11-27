'use client'

import { ArrayField } from '@payloadcms/ui'
import type { ArrayFieldClientProps } from 'payload'
import React from 'react'

import './socialLinksArrayField.scss'

// Copy, paste and duplicate are hidden for Social Links rows in CSS while one of this field's row
// menus is open. The menu is portaled and Payload re-renders its className, so the field never
// mutates Payload-managed DOM.
export const SocialLinksArrayField: React.FC<ArrayFieldClientProps> = (props) => (
  <div className="site-settings-social-links">
    <ArrayField {...props} />
  </div>
)
