'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import type { ProductSpecificationGroup } from '@/utilities/products/models'

import { ProductSpecifications } from '../ProductSpecifications'
import styles from './index.module.css'

const tabs = [
  { key: 'overview', label: 'Overview', panelId: 'product-tab-overview' },
  { key: 'specifications', label: 'Specifications', panelId: 'product-tab-specifications' },
] as const

// Runs before paint on the client; falls back to useEffect during server rendering.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function ProductTabs({
  specifications,
  overview,
}: {
  specifications: ProductSpecificationGroup[]
  overview: string[]
}) {
  const availableTabs = specifications.length ? tabs : tabs.slice(0, 1)
  const [selected, setSelected] = useState<(typeof tabs)[number]['key']>('overview')
  const active = availableTabs.some(({ key }) => key === selected) ? selected : availableTabs[0].key
  const activeIndex = availableTabs.findIndex(({ key }) => key === active)
  const list = useRef<HTMLDivElement>(null)
  const tabId = useId()
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  const [animate, setAnimate] = useState(false)

  // One shared underline slides between tabs; until it is measured, the selected
  // tab keeps its own border so server-rendered markup is never missing a marker.
  useIsomorphicLayoutEffect(() => {
    const node = list.current
    if (!node) return
    const measure = () => {
      const tab = node.querySelectorAll<HTMLElement>('[role="tab"]')[activeIndex]
      if (tab) setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    // Enable the slide only after the first measured paint, so it never animates in on load.
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [activeIndex])

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = availableTabs.length - 1
    let next: number
    switch (event.key) {
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1
        break
      case 'ArrowRight':
        next = index === last ? 0 : index + 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    event.preventDefault()
    setSelected(availableTabs[next].key)
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <>
      <div
        className={styles.tabList}
        ref={list}
        role="tablist"
        aria-label="Product information"
        data-indicator={indicator ? '' : undefined}
        data-animate={animate ? '' : undefined}
        style={
          indicator
            ? ({
                '--tab-indicator-left': `${indicator.left}px`,
                '--tab-indicator-width': `${indicator.width}px`,
              } as CSSProperties)
            : undefined
        }
      >
        {availableTabs.map(({ key, label, panelId }, index) => (
          <button
            key={key}
            id={`${tabId}-${key}`}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={active === key}
            aria-controls={panelId}
            tabIndex={active === key ? 0 : -1}
            onClick={() => setSelected(key)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
        <span className={styles.indicator} aria-hidden="true" />
      </div>
      <div className={styles.panels}>
        {availableTabs.map(({ key, panelId }, index) => (
          <div
            key={key}
            id={panelId}
            role="tabpanel"
            className={styles.panel}
            data-position={
              index === activeIndex ? 'current' : index < activeIndex ? 'before' : 'after'
            }
            aria-labelledby={`${tabId}-${key}`}
            aria-hidden={active !== key || undefined}
            inert={active !== key}
            tabIndex={active === key ? 0 : -1}
          >
            {key === 'specifications' ? (
              <ProductSpecifications groups={specifications} />
            ) : (
              <ProductOverview paragraphs={overview} />
            )}
          </div>
        ))}
      </div>
    </>
  )
}

const overviewLineLimit = 5

function ProductOverview({ paragraphs }: { paragraphs: string[] }) {
  const content = useRef<HTMLDivElement>(null)
  const id = useId()
  const [overflows, setOverflows] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const node = content.current
    if (!node) return
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight)
      setOverflows(node.scrollHeight > lineHeight * overviewLineLimit + 0.5)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [paragraphs])

  return (
    <div className={styles.overview}>
      <div ref={content} id={id} className={styles.copy} data-collapsed={!expanded || undefined}>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {overflows && (
        <Button
          type="button"
          variant="link"
          size="clear"
          className={styles.toggle}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={id}
        >
          {expanded ? 'Read less' : 'Read more'}
          <ChevronDown aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
