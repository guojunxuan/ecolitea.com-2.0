'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProductMediaBannerBlock } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { ProductMedia } from '../shared/ProductMedia'
import { useMediaQuery } from '../shared/useMediaQuery'
import styles from './Component.module.css'

type Props = Pick<
  ProductMediaBannerBlock,
  'media' | 'mobileMedia' | 'playback' | 'aspectRatio' | 'title'
>

export function BannerMedia({
  media,
  mobileMedia,
  playback = 'ambient',
  aspectRatio,
  title,
}: Props) {
  const mobile = useMediaQuery('(width < 48rem)')
  const mobileResource = mobileMedia || media
  const mobileVideo =
    typeof mobileResource === 'object' && mobileResource?.mimeType?.startsWith('video/')
  const imageArtDirection =
    typeof media === 'object' &&
    media?.mimeType?.startsWith('image/') &&
    typeof mobileResource === 'object' &&
    mobileResource?.mimeType?.startsWith('image/')
  const resource = mobile && mobileMedia && !imageArtDirection ? mobileMedia : media
  const resourceKey = typeof resource === 'object' ? resource?.id : resource
  const isVideo = typeof resource === 'object' && resource?.mimeType?.startsWith('video/')
  const previewRatio = aspectRatio === 'full-screen' ? aspectRatio : isVideo ? '21:9' : aspectRatio
  const mobilePreviewRatio =
    aspectRatio === 'full-screen' ? undefined : mobileVideo ? '16:9' : '4:5'
  const isPlayer = playback === 'player' && isVideo
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const dismiss = () => {
    dialog.current?.querySelectorAll('video').forEach((video) => video.pause())
    if (dialog.current?.open) dialog.current.close()
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    if (!element.open) element.showModal()
    element.querySelector<HTMLButtonElement>('button')?.focus()
    const videos = Array.from(element.querySelectorAll('video'))
    videos.forEach((video) => {
      video.muted = false
      video.controls = true
      video.loop = false
      void video.play()?.catch(() => undefined)
    })
    return () => videos.forEach((video) => video.pause())
  }, [open, resource])
  return (
    <>
      <div
        className={styles.preview}
        data-player={isPlayer || undefined}
        data-mobile-video={mobileVideo || undefined}
      >
        <ProductMedia
          key={resourceKey}
          resource={resource}
          playback="ambient"
          active={!open}
          aspectRatio={previewRatio}
          mobileAspectRatio={mobilePreviewRatio}
          mobileResource={imageArtDirection ? mobileResource : undefined}
          className={styles.media}
        />
      </div>
      {isPlayer && (
        <div className={styles.watch}>
          <Button ref={trigger} type="button" variant="outline" onClick={() => setOpen(true)}>
            Watch Now
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="m5 2 9 6-9 6Z" />
            </svg>
          </Button>
        </div>
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label={title || 'Product video'}
        onCancel={(event) => {
          event.preventDefault()
          dismiss()
        }}
        onClose={() => {
          setOpen(false)
          trigger.current?.focus()
        }}
      >
        {open && (
          <>
            <Button type="button" variant="outline" className={styles.close} onClick={dismiss}>
              Close video
            </Button>
            <ProductMedia key={resourceKey} resource={resource} playback="player" loop={false} />
          </>
        )}
      </dialog>
    </>
  )
}
