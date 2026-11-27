import { cookies } from 'next/headers'
import type { ServerProps } from 'payload'
import type { ReactNode } from 'react'
import { AnonymousThemeSync } from './brand/AnonymousThemeSync'
import './theme.css'

type Props = Pick<ServerProps, 'payload' | 'user'> & { children: ReactNode }

export async function ThemeStyles({ children, payload, user }: Props) {
  if (user || payload.config.admin.theme !== 'all') return children

  const preference = (await cookies()).get(`${payload.config.cookiePrefix || 'payload'}-theme`)?.value
  return (
    <>
      {preference !== 'light' && preference !== 'dark' && <AnonymousThemeSync />}
      {children}
    </>
  )
}
