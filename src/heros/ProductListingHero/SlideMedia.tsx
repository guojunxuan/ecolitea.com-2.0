'use client'
import { useSyncExternalStore } from 'react'
import { Media } from '@/components/Media'
import type { ProductHeroSlide } from '@/utilities/products/getProductListingHero'
import styles from './index.module.css'

const query = '(width < 48rem)'
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const snapshot = () => window.matchMedia(query).matches
const serverSnapshot = () => null

export const SlideMedia = ({
  slide,
  priority,
  allowVideo,
  paused,
}: {
  slide: ProductHeroSlide
  priority: boolean
  allowVideo: boolean
  paused: boolean
}) => {
  const mobile = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const desktop = slide.media
  const alternate = slide.mobileMedia ?? desktop
  const bothImages =
    desktop?.mimeType?.startsWith('image/') && alternate?.mimeType?.startsWith('image/')
  const renderMedia = (
    resource: typeof desktop,
    options?: { className: string; videoSourceMedia: string },
  ) => {
    if (!resource || (resource.mimeType === 'video/mp4' && !allowVideo)) return null
    return (
      <Media
        key={resource.id}
        fill
        className={options?.className}
        videoSourceMedia={options?.videoSourceMedia}
        // Hidden SSR images must not preload the other breakpoint's asset.
        priority={options ? false : priority}
        loading={options ? 'lazy' : undefined}
        size="100vw"
        resource={resource}
        mobileResource={bothImages ? slide.mobileMedia : null}
        paused={paused}
        imgClassName={styles.media}
        videoClassName={styles.media}
        presentation={{
          image: { fit: 'cover', quality: 85 },
          video: { playback: 'ambient', fit: 'cover' },
        }}
      />
    )
  }
  // SSR/hydration use CSS for visibility and native source media queries for
  // video downloads. Only the matching video source can load, even without JS.
  // After hydration the external-store snapshot leaves just one Media mounted.
  if (!bothImages && mobile === null && alternate?.id !== desktop?.id) {
    return (
      <>
        {renderMedia(desktop, {
          className: styles.desktopMedia,
          videoSourceMedia: '(width >= 48rem)',
        })}
        {renderMedia(alternate, {
          className: styles.mobileMedia,
          videoSourceMedia: query,
        })}
      </>
    )
  }
  // Picture source selection prevents fetching the desktop crop on mobile before hydration.
  return renderMedia(bothImages || mobile === null ? desktop : mobile ? alternate : desktop)
}
