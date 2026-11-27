'use client'

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { RenderFields } from '@payloadcms/ui'
import { useBlockComponentContext } from '@payloadcms/richtext-lexical/client'
import { $getNodeByKey, $getRoot } from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable'

type DropPosition = { key: string; before: boolean; top: number; left: number; width: number }

/** Connect the native collapsible handle to Lexical's public node ordering API. */
export function ArticleBlockEditor() {
  const { BlockCollapsible, formSchema, nodeKey } = useBlockComponentContext()
  const [editor] = useLexicalComposerContext()
  const editable = useLexicalEditable()
  const [drop, setDrop] = useState<DropPosition | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cancelRef.current?.(), [])

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (!editable || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    cancelRef.current?.()
    const startY = event.clientY
    let target: DropPosition | null = null
    const move = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== event.pointerId || Math.abs(next.clientY - startY) < 5) return
      const candidates = editor.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .flatMap((node) => {
            const element = editor.getElementByKey(node.getKey())
            return element ? [{ key: node.getKey(), box: element.getBoundingClientRect() }] : []
          }),
      )
      const candidate = candidates.reduce<(typeof candidates)[number] | undefined>(
        (nearest, item) => {
          const distance = (box: DOMRect) =>
            Math.min(Math.abs(next.clientY - box.top), Math.abs(next.clientY - box.bottom))
          return !nearest || distance(item.box) < distance(nearest.box) ? item : nearest
        },
        undefined,
      )
      target =
        candidate && candidate.key !== nodeKey
          ? {
              key: candidate.key,
              before: next.clientY < candidate.box.top + candidate.box.height / 2,
              top:
                next.clientY < candidate.box.top + candidate.box.height / 2
                  ? candidate.box.top
                  : candidate.box.bottom,
              left: candidate.box.left,
              width: candidate.box.width,
            }
          : null
      setDrop(target)
    }
    const finish = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== event.pointerId) return
      if (target && editor.isEditable()) {
        const position = target
        editor.update(() => {
          const source = $getNodeByKey(nodeKey)
          const destination = $getNodeByKey(position.key)
          if (!source || !destination || source === destination) return
          if (position.before) destination.insertBefore(source)
          else destination.insertAfter(source)
        })
      }
      cancel()
    }
    const cancel = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('keydown', escape)
      setDrop(null)
      cancelRef.current = null
    }
    const escape = (next: globalThis.KeyboardEvent) => {
      if (next.key === 'Escape') cancel()
    }
    cancelRef.current = cancel
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('keydown', escape)
  }

  const moveWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!editable || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (event.key === 'ArrowUp') node?.getPreviousSibling()?.insertBefore(node)
      else node?.getNextSibling()?.insertAfter(node)
    })
  }

  return (
    <>
      <BlockCollapsible
        collapsibleProps={{
          dragHandleProps: {
            id: nodeKey,
            attributes: {
              role: 'button',
              tabIndex: editable ? 0 : -1,
            },
            listeners: {
              onPointerDown: startDrag,
              onKeyDown: moveWithKeyboard,
              onClick: (event: MouseEvent<HTMLElement>) => event.stopPropagation(),
            },
          },
        }}
      >
        <RenderFields
          fields={formSchema}
          forceRender
          parentIndexPath=""
          parentPath=""
          parentSchemaPath=""
          permissions={true}
          readOnly={!editable}
        />
      </BlockCollapsible>
      {drop && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 9999,
            top: drop.top,
            left: drop.left,
            width: drop.width,
            height: 2,
            background: 'var(--color-border-selected)',
          }}
        />
      )}
    </>
  )
}
