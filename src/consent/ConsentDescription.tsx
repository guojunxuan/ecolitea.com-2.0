'use client'
import React, { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDictionary } from '@/i18n/DictionaryProvider'

export function ConsentDescription({
  text,
  descriptionClassName,
  containerClassName,
  buttonClassName,
}: {
  text: string
  descriptionClassName: string
  containerClassName?: string
  buttonClassName: string
}) {
  const { consent: copy } = useDictionary()
  const description = useRef<HTMLParagraphElement>(null)
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    const element = description.current!
    const measure = () => {
      if (!expanded) setClipped(element.scrollHeight > element.clientHeight + 1)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [expanded])

  return (
    <div className={containerClassName}>
      <p
        ref={description}
        id={id}
        className={`website-type-body-sm ${descriptionClassName}`}
        data-expanded={expanded}
      >
        {text}
      </p>
      {clipped && (
        <Button
          type="button"
          variant="link"
          size="clear"
          className={buttonClassName}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? copy.readLess : copy.readMore}
        </Button>
      )}
    </div>
  )
}
