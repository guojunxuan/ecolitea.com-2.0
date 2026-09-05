'use client'

import { RelationshipField } from '@payloadcms/ui'
import type { RelationshipFieldClientComponent } from 'payload'
import type { MouseEvent } from 'react'

import './socialPlatformRelationshipField.scss'

const menuGap = 4

const pinMenuBelow = (control: HTMLElement, attemptsRemaining = 3) => {
  requestAnimationFrame(() => {
    const portal = [...document.querySelectorAll<HTMLElement>('.rs__floating-menu-portal')].find(
      (candidate) => candidate.querySelector('.rs__menu'),
    )

    if (!portal) {
      if (attemptsRemaining > 1) pinMenuBelow(control, attemptsRemaining - 1)
      return
    }

    const controlRect = control.getBoundingClientRect()
    portal.classList.add('site-settings-social-platform-menu')
    portal.style.setProperty(
      '--site-settings-social-platform-menu-top',
      `${Math.round(controlRect.bottom + menuGap)}px`,
    )
  })
}

const handleRelationshipClick = (event: MouseEvent<HTMLDivElement>) => {
  const control = (event.target as Element).closest<HTMLElement>('.rs__control')
  if (control) pinMenuBelow(control)
}

export const SocialPlatformRelationshipField: RelationshipFieldClientComponent = (props) => {
  const field = {
    ...props.field,
    admin: {
      ...props.field.admin,
      allowCreate: false,
    },
  }

  return (
    <div
      className="site-settings-social-platform-relationship"
      onClickCapture={handleRelationshipClick}
    >
      <RelationshipField {...props} field={field} />
    </div>
  )
}
