'use client'

import { ArrayField } from '@payloadcms/ui'
import type { ArrayFieldClientComponent } from 'payload'
import React, { type MouseEvent } from 'react'

import './socialLinksArrayField.scss'

const markActionPortal = (event: MouseEvent<HTMLDivElement>) => {
  if (!(event.target as Element).closest('.array-actions__button')) return

  requestAnimationFrame(() => {
    const popup = [...document.querySelectorAll<HTMLElement>('.popup__content')].find((candidate) =>
      candidate.querySelector('.array-actions__action'),
    )
    popup?.classList.add('site-settings-social-links-actions')
  })
}

export const SocialLinksArrayField: ArrayFieldClientComponent = (props) => (
  <div className="site-settings-social-links" onClickCapture={markActionPortal}>
    <ArrayField {...props} />
  </div>
)
