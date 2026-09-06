import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

import type { CaseStudy, Category, Page, Post } from '@/payload-types'

type LinkRelation =
  | {
      relationTo: 'pages'
      value: Page | string | number
    }
  | {
      relationTo: 'posts'
      value: Post | string | number
    }
  | {
      relationTo: 'case-studies'
      value: CaseStudy | string | number
    }
  | {
      relationTo: 'categories'
      value: Category | string | number
    }

export type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  label?: string | null
  newTab?: boolean | null
  reference?: LinkRelation | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

type ResolvableLink = Pick<CMSLinkType, 'reference' | 'type' | 'url'>

export const resolveLinkHref = ({ reference, type, url }: ResolvableLink): string | null => {
  if (type !== 'reference') return url || null
  if (!reference || typeof reference.value !== 'object') return null

  const slug = reference.value.slug

  if (!slug) return null

  switch (reference.relationTo) {
    case 'pages':
      return `/${slug}`
    case 'posts':
      return `/posts/${slug}`
    case 'case-studies':
      return `/case-studies/${slug}`
    case 'categories':
      return `/posts?category=${encodeURIComponent(slug)}`
  }
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
