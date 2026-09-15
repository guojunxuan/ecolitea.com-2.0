import Link from 'next/link'
import React from 'react'

import type { HeaderLinkData } from './types'

export const NavigationLink: React.FC<{
  children?: React.ReactNode
  className?: string
  link: HeaderLinkData
}> = ({ children, className, link }) => (
  <Link
    className={className}
    href={link.href}
    {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
  >
    {children ?? link.label}
  </Link>
)
