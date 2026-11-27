'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { escapeStyle, inheritedTokenNames } from './tokens'

import styles from './Component.module.css'

export function CodeFrame({
  title,
  srcDoc,
  minHeight,
}: {
  title: string
  srcDoc: string
  minHeight: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const minimum = Number.isFinite(minHeight) ? Math.min(10000, Math.max(0, minHeight)) : 240
  const [preparedSource, setPreparedSource] = useState<{
    input: string
    value: string
    revision: number
  } | null>(null)
  const [measurement, setMeasurement] = useState<{ revision: number; height: number } | null>(null)
  const revision = preparedSource?.revision
  const ready = preparedSource?.input === srcDoc && measurement?.revision === revision
  const height = ready && measurement ? Math.max(minimum, measurement.height) : minimum
  useEffect(() => {
    const element = container.current
    if (!element) return
    const themeAncestor = element.closest('[data-website-theme]')
    const readTheme = (): 'default' | 'inverse' =>
      themeAncestor?.getAttribute('data-website-theme') === 'inverse' ? 'inverse' : 'default'
    const prepare = (inheritedTheme: 'default' | 'inverse') => {
      const themedSource = srcDoc.replace(
        /<html data-website-theme="(?:default|inverse)">/,
        `<html data-website-theme="${inheritedTheme}">`,
      )
      const computed = getComputedStyle(element)
      const values = inheritedTokenNames
        .map((name) => {
          const value = computed.getPropertyValue(name).trim()
          return value ? `${name}:${value};` : ''
        })
        .join('')
      // Opaque-origin srcdoc frames request these same-site font URLs with Origin:null.
      // Their scoped CORS headers allow loading without granting allow-same-origin.
      const sansURL = new URL('/fonts/product-code/InterVariable.woff2', window.location.origin)
        .href
      const monoURL = new URL(
        '/fonts/product-code/GeistMono-Variable.woff2',
        window.location.origin,
      ).href
      const fontCSS = `@font-face{font-family:ProductCodeInter;src:url(${JSON.stringify(sansURL)}) format('woff2');font-style:normal;font-weight:100 900;font-display:swap}@font-face{font-family:ProductCodeGeistMono;src:url(${JSON.stringify(monoURL)}) format('woff2');font-style:normal;font-weight:100 900;font-display:swap}:root{--font-inter:ProductCodeInter;--font-geist-mono:ProductCodeGeistMono;--website-font-sans:ProductCodeInter,system-ui,sans-serif;--website-font-mono:ProductCodeGeistMono,ui-monospace,monospace}`
      setMeasurement(null)
      setPreparedSource((previous) => ({
        input: srcDoc,
        revision: (previous?.revision ?? 0) + 1,
        value: themedSource.replace(
          '<style id="product-code-theme"></style>',
          `<style id="product-code-theme">:root{${escapeStyle(values)}}${escapeStyle(fontCSS)}</style>`,
        ),
      }))
    }
    let currentTheme = readTheme()
    prepare(currentTheme)
    if (!themeAncestor) return
    const observer = new MutationObserver(() => {
      const nextTheme = readTheme()
      if (nextTheme === currentTheme) return
      currentTheme = nextTheme
      prepare(nextTheme)
    })
    observer.observe(themeAncestor, { attributes: true, attributeFilter: ['data-website-theme'] })
    return () => observer.disconnect()
  }, [srcDoc])
  useLayoutEffect(() => {
    if (revision === undefined) return
    const receive = (event: MessageEvent) => {
      if (
        !frame.current?.contentWindow ||
        event.source !== frame.current.contentWindow ||
        event.data?.type !== 'productCode-height' ||
        typeof event.data.height !== 'number' ||
        !Number.isFinite(event.data.height)
      )
        return
      setMeasurement({
        revision,
        height: Math.max(0, Math.min(10000, event.data.height)),
      })
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [revision])
  return (
    <div
      ref={container}
      className={styles.viewport}
      data-ready={ready}
      style={{ minHeight: minimum }}
    >
      {preparedSource?.input === srcDoc && (
        <iframe
          key={preparedSource.revision}
          className={styles.frame}
          ref={frame}
          sandbox="allow-scripts"
          title={title}
          srcDoc={preparedSource.value}
          style={{ height }}
        />
      )}
    </div>
  )
}
