'use client'
import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useLocaleContext } from '@/i18n/LocaleProvider'
import { localePath, stripLocale } from '@/i18n/paths'

/** One client boundary applies the route language to native site links, including
 * links rendered by server Blocks and normalized Header/Footer models. */
export default function LocaleLink({ href, children, ...props }: ComponentProps<typeof Link>) {
  const { locale, legalPaths, englishLabel } = useLocaleContext()
  const path = typeof href === 'string' ? href : href.pathname ?? ''
  const legal = locale !== 'en' && legalPaths.includes(stripLocale(path).split(/[?#]/)[0])
  const translated = legal ? stripLocale(path) : localePath(path, locale)
  return <Link {...props} href={typeof href === 'string' ? translated : { ...href, pathname: translated }}>{children}{legal && ` ${englishLabel}`}</Link>
}
