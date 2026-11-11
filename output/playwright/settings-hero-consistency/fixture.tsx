import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlogListingHero } from '@/heros/BlogListingHero'
import '@/app/(frontend)/globals.css'

const desktop = {
  id: 'desktop', alt: 'Desktop fixture', url: 'http://127.0.0.1:47711/desktop.png', mimeType: 'image/png',
  width: 1600, height: 900, focalX: 30, focalY: 50, createdAt: '', updatedAt: '',
}
const mobile = { ...desktop, id: 'mobile', alt: 'Mobile fixture', url: 'http://127.0.0.1:47711/mobile.png', width: 800, height: 1000, focalX: 70 }

export const renderFixture = (variant: string) => renderToStaticMarkup(
  <BlogListingHero
    heading="Stories from the field"
    description="Responsive Hero verification using the production component and shared Media renderer."
    headerTheme={variant === 'light' ? 'light' : 'dark'}
    image={variant === 'mobile-only' || variant === 'text-only' ? null : desktop}
    mobileMedia={variant === 'fallback' || variant === 'text-only' ? null : mobile}
  />,
)
