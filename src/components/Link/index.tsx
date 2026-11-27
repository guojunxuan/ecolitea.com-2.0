import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import Link from '@/components/LocaleLink'
import React from 'react'

import { resolveLinkHref, type CMSLinkDestination } from '@/utilities/resolveLinkHref'

export { resolveLinkHref } from '@/utilities/resolveLinkHref'

export type CMSLinkType = CMSLinkDestination & {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  size?: ButtonProps['size'] | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href = resolveLinkHref({ reference, type, url })

  if (!href) return null

  const size = appearance === 'link' ? 'clear' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link className={cn(className)} href={href} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
