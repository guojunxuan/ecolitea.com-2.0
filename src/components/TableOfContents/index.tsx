'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/utilities/ui'
import type { TOCItem } from '@/utilities/blogs/extractTOC'
import { MobileMenu } from './MobileMenu'
import { TocList } from './TocList'
import styles from './index.module.css'

/** Server-rendered article and sharing children remain outside the client module graph. */
export const TableOfContents = ({
  items,
  children,
  sidebar,
}: {
  items: TOCItem[]
  children?: ReactNode
  sidebar?: ReactNode
}) => {
  const desktopListRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState({ items, id: items[0]?.id })
  const activeId = active.items === items ? active.id : items[0]?.id
  useEffect(() => {
    if (!items.length) return
    const headings = items.flatMap(({ id }) => {
      const heading = document.getElementById(id)
      return heading ? [heading] : []
    })
    const updateActive = () => {
      // Re-read positions at each intersection change so scrolling back through a long section
      // restores the last heading above the activation line, even when none currently intersect.
      const current = [...headings]
        .reverse()
        .find((heading) => heading.getBoundingClientRect().top <= window.innerHeight * 0.3)
      const nextId = current?.id ?? items[0].id
      setActive((previous) =>
        previous.items === items && previous.id === nextId ? previous : { items, id: nextId },
      )
    }
    let observer: IntersectionObserver | undefined
    const observeViewport = () => {
      observer?.disconnect()
      if (typeof IntersectionObserver !== 'undefined') {
        // Explicit pixels keep the activation region tied to viewport height at every width.
        observer = new IntersectionObserver(updateActive, {
          rootMargin: `0px 0px -${Math.round(window.innerHeight * 0.7)}px 0px`,
        })
        for (const heading of headings) observer.observe(heading)
      }
      updateActive()
    }
    observeViewport()
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        updateActive()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', observeViewport)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', observeViewport)
      observer?.disconnect()
    }
  }, [items])

  useEffect(() => {
    const list = desktopListRef.current
    if (!list || !activeId) return
    const currentLink = Array.from(list.querySelectorAll('a')).find(
      (link) => link.getAttribute('href') === `#${activeId}`,
    )
    if (!currentLink) return
    const listRect = list.getBoundingClientRect()
    const linkRect = currentLink.getBoundingClientRect()
    const inset = 12
    if (linkRect.top < listRect.top + inset) {
      list.scrollTop += linkRect.top - listRect.top - inset
    } else if (linkRect.bottom > listRect.bottom - inset) {
      list.scrollTop += linkRect.bottom - listRect.bottom + inset
    }
  }, [activeId])

  return (
    <>
      {(items.length > 0 || sidebar) && (
        <aside
          className={cn(styles.wrapper, !items.length && styles.shareOnly)}
          data-slot="blog-article-tools"
          {...(items.length ? { id: 'table-of-contents', tabIndex: -1 } : {})}
        >
          {items.length > 0 && <MobileMenu items={items} activeId={activeId} />}
          {items.length > 0 && (
            <nav aria-label="Table of contents" className={styles.desktop}>
              <p className={styles.label}>On this page</p>
              <div className={styles.desktopScroll} ref={desktopListRef}>
                <TocList items={items} activeId={activeId} />
              </div>
            </nav>
          )}
          {sidebar && <div className={styles.desktop}>{sidebar}</div>}
        </aside>
      )}
      {children}
    </>
  )
}
