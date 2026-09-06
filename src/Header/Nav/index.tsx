'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { adaptHeaderNavigation } from './adaptNavigation'
import { DesktopNav } from './DesktopNav'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  return <DesktopNav {...adaptHeaderNavigation(data)} />
}
