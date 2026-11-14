import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Entrance } from '@/collections/Products/blocks/shared/Entrance'

type Observation = {
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

let observations: Observation[]
let reduced: boolean
let motionListeners: Set<() => void>

beforeEach(() => {
  observations = []
  reduced = false
  motionListeners = new Set()
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced
    },
    addEventListener: (_event: string, listener: () => void) => motionListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => motionListeners.delete(listener),
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observations.push({ callback, options, observe: this.observe, disconnect: this.disconnect })
      }
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function intersect(observation: Observation, target: Element, isIntersecting = true) {
  act(() => {
    observation.callback(
      [
        {
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 0.001 : 0,
        } as IntersectionObserverEntry,
      ],
      observation as unknown as IntersectionObserver,
    )
  })
}

function changeMotion(value: boolean) {
  act(() => {
    reduced = value
    motionListeners.forEach((listener) => listener())
  })
}

describe('Product Section and Block entrances', () => {
  it('server-renders a visible native header before the existing block group', () => {
    const html = renderToStaticMarkup(
      <section>
        <Entrance as="header" className="sectionHeader site-container">
          <h2 id="section-title">A closer look</h2>
          <p>Introduction</p>
        </Entrance>
        <div className="sectionBlocks">Blocks</div>
      </section>,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const header = document.querySelector('section > header')
    expect(header?.classList.contains('sectionHeader')).toBe(true)
    expect(header?.querySelector(':scope > h2')?.id).toBe('section-title')
    expect(header?.nextElementSibling?.className).toBe('sectionBlocks')
    expect(header?.getAttribute('data-product-entrance')).toBe('header')
    expect(header?.hasAttribute('data-entrance-state')).toBe(false)
    expect(document.querySelector('[hidden], [inert], [aria-hidden="true"]')).toBeNull()
    expect(html).not.toContain('opacity:0')
  })

  it('keeps content visible and unanimated before it intersects the viewport', () => {
    const { container } = render(
      <Entrance blockType="productMediaText">Text is available</Entrance>,
    )
    const element = container.firstElementChild!
    expect(element.textContent).toBe('Text is available')
    expect(element.hasAttribute('hidden')).toBe(false)
    intersect(observations[0], element, false)
    expect(element.hasAttribute('data-entrance-state')).toBe(false)
    expect(element.hasAttribute('data-entered')).toBe(false)
  })

  it('starts on the first positive intersection even when only a tiny part of a tall Block is visible', () => {
    const { container } = render(<Entrance blockType="productMediaBanner">Tall media</Entrance>)
    const element = container.firstElementChild!
    expect(observations[0].options?.threshold).toBe(0)
    intersect(observations[0], element)
    expect(element.getAttribute('data-entered')).toBe('true')
    expect(element.getAttribute('data-entrance-state')).toBe('playing')
    expect(observations[0].disconnect).toHaveBeenCalledTimes(1)
  })

  it('finishes the animation and never replays when the Block re-enters', () => {
    const { container } = render(<Entrance blockType="productMediaText">A Block</Entrance>)
    const element = container.firstElementChild!
    intersect(observations[0], element)
    fireEvent.animationEnd(element)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
    expect(element.getAttribute('data-entered')).toBe('true')
    intersect(observations[0], element, false)
    intersect(observations[0], element)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
  })

  it('completes a cancelled animation without leaving the target transparent', () => {
    const { container } = render(<Entrance blockType="productCode">Code content</Entrance>)
    const element = container.firstElementChild!
    intersect(observations[0], element)
    fireEvent(element, new Event('animationcancel', { bubbles: true }))
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
    expect(element.hasAttribute('hidden')).toBe(false)
  })

  it('does not finish its own entrance when a descendant animation ends', () => {
    const { container } = render(
      <Entrance>
        <span>Animated content</span>
      </Entrance>,
    )
    const element = container.firstElementChild!
    intersect(observations[0], element)
    fireEvent.animationEnd(element.firstElementChild!)
    expect(element.getAttribute('data-entrance-state')).toBe('playing')
    fireEvent.animationEnd(element)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
  })

  it('completes without observing when reduced motion is already enabled', () => {
    reduced = true
    const { container } = render(<Entrance blockType="productMediaText">Readable content</Entrance>)
    const element = container.firstElementChild!
    expect(observations).toHaveLength(0)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
    expect(element.textContent).toBe('Readable content')
  })

  it('immediately stops active motion when the preference changes and does not replay it', () => {
    const { container } = render(<Entrance blockType="productMediaText">Readable content</Entrance>)
    const element = container.firstElementChild!
    intersect(observations[0], element)
    changeMotion(true)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
    changeMotion(false)
    intersect(observations[0], element)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
  })

  it('also completes an unseen target when reduced motion is enabled before a jump', () => {
    const { container } = render(<Entrance blockType="productMediaTabs">Later content</Entrance>)
    const element = container.firstElementChild!
    changeMotion(true)
    intersect(observations[0], element)
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
    expect(observations[0].disconnect).toHaveBeenCalled()
  })

  it('leaves content complete and visible when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<Entrance>Fallback content</Entrance>)
    const element = container.firstElementChild!
    expect(element.getAttribute('data-entrance-state')).toBe('complete')
    expect(element.textContent).toBe('Fallback content')
  })

  it('stages a Section header before its Blocks and restarts the sequence in the next Section', () => {
    const { container } = render(
      <>
        <section>
          <Entrance as="header">Section introduction</Entrance>
          <div>
            <Entrance blockType="productMediaBanner">One</Entrance>
            <Entrance blockType="productMediaText">Two</Entrance>
            <Entrance blockType="productMediaTabs">Three</Entrance>
            <Entrance blockType="productCode">Four</Entrance>
          </div>
        </section>
        <section>
          <Entrance blockType="productMediaText">Next section</Entrance>
        </section>
      </>,
    )
    const sequence = Array.from(container.querySelectorAll<HTMLElement>('[data-product-entrance]'))
    expect(
      sequence.map((element) => element.style.getPropertyValue('--product-entrance-order')),
    ).toEqual(['0', '1', '2', '3', '3', '0'])
  })

  it('removes observer and preference listeners on unmount', () => {
    const { unmount } = render(<Entrance>A Block</Entrance>)
    expect(motionListeners.size).toBe(1)
    unmount()
    expect(observations[0].disconnect).toHaveBeenCalledTimes(1)
    expect(motionListeners.size).toBe(0)
  })
})
