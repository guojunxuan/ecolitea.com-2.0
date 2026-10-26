'use client'

import React, { useEffect, useRef, useState } from 'react'
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
  const frame = useRef<HTMLIFrameElement>(null)
  const minimum = Number.isFinite(minHeight) ? Math.min(10000, Math.max(0, minHeight)) : 400
  const [measurement, setMeasurement] = useState({ srcDoc, minimum, height: minimum })
  const height =
    measurement.srcDoc === srcDoc && measurement.minimum === minimum ? measurement.height : minimum
  const [document, setDocument] = useState(srcDoc)
  useEffect(() => {
    const element = frame.current
    if (!element?.parentElement) return
    const inheritedTheme = element
      .closest('[data-website-theme]')
      ?.getAttribute('data-website-theme')
    const themedSource =
      inheritedTheme === 'default' || inheritedTheme === 'inverse'
        ? srcDoc.replace(
            /<html data-website-theme="(?:default|inverse)">/,
            `<html data-website-theme="${inheritedTheme}">`,
          )
        : srcDoc
    const computed = getComputedStyle(element.parentElement)
    const values = inheritedTokenNames
      .map((name) => {
        const value = computed.getPropertyValue(name).trim()
        return value ? `${name}:${value};` : ''
      })
      .join('')
    setDocument(
      themedSource.replace(
        '<style id="product-code-theme"></style>',
        `<style id="product-code-theme">:root{${escapeStyle(values)}}</style>`,
      ),
    )
  }, [srcDoc])
  useEffect(() => {
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
        srcDoc,
        minimum,
        height: Math.max(minimum, Math.min(10000, event.data.height)),
      })
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [minimum, srcDoc])
  return (
    <iframe
      className={styles.frame}
      ref={frame}
      sandbox="allow-scripts"
      title={title}
      srcDoc={document}
      style={{ height }}
    />
  )
}
