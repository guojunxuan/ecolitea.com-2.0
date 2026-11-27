import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from '@payloadcms/richtext-lexical/lexical'

const state = vi.hoisted(() => ({ editor: null as any, nodeKey: '', editable: true }))
vi.mock('@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [state.editor],
}))
vi.mock('@payloadcms/richtext-lexical/lexical/react/useLexicalEditable', () => ({
  useLexicalEditable: () => state.editable,
}))
vi.mock('@payloadcms/ui', () => ({ RenderFields: () => <div>Native fields</div> }))
vi.mock('@payloadcms/richtext-lexical/client', () => ({
  useBlockComponentContext: () => ({
    nodeKey: state.nodeKey,
    formSchema: [],
    BlockCollapsible: ({ collapsibleProps, children }: any) => (
      <div>
        <div
          aria-label="Drag to reorder"
          {...collapsibleProps.dragHandleProps.attributes}
          {...collapsibleProps.dragHandleProps.listeners}
        >
          Handle
        </div>
        {children}
      </div>
    ),
  }),
}))
import { ArticleBlockEditor } from '@/blocks/ArticleBlockEditor'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function setup() {
  state.editable = true
  state.editor = createEditor({
    namespace: 'inline-drag-test',
    onError: (e: Error) => {
      throw e
    },
  })
  let keys: string[] = []
  state.editor.update(
    () => {
      const nodes = ['first', 'target', 'last'].map((text) =>
        $createParagraphNode().append($createTextNode(text)),
      )
      keys = nodes.map((node) => node.getKey())
      state.nodeKey = keys[1]
      $getRoot().append(...nodes)
    },
    { discrete: true },
  )
  vi.spyOn(state.editor, 'getElementByKey').mockImplementation((key: unknown) => {
    const index = keys.indexOf(key as string)
    return {
      getBoundingClientRect: () => ({
        top: index * 100,
        bottom: index * 100 + 80,
        height: 80,
        left: 0,
        width: 600,
      }),
    }
  })
  return () =>
    state.editor.getEditorState().read(() =>
      $getRoot()
        .getChildren()
        .map((n: any) => n.getTextContent()),
    )
}
it('reorders from the inline handle with keyboard and preserves all content', async () => {
  const order = setup()
  const { rerender } = render(<ArticleBlockEditor />)
  const handle = screen.getByRole('button', { name: 'Drag to reorder' })
  await act(async () => {
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
  })
  expect(order()).toEqual(['target', 'first', 'last'])
  await act(async () => {
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
  })
  expect(order()).toEqual(['first', 'target', 'last'])
  state.editable = false
  rerender(<ArticleBlockEditor />)
  await act(async () => {
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
  })
  expect(order()).toEqual(['first', 'target', 'last'])
})
it('moves on pointer release and cancels with Escape', async () => {
  const order = setup()
  render(<ArticleBlockEditor />)
  const handle = screen.getByRole('button', { name: 'Drag to reorder' })
  const pointer = (target: Element | Document, type: string, y: number) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { button: 0, pointerId: 1, clientY: y })
    fireEvent(target, event)
  }
  await act(async () => {
    pointer(handle, 'pointerdown', 140)
    pointer(document, 'pointermove', 285)
    pointer(document, 'pointerup', 285)
  })
  expect(order()).toEqual(['first', 'last', 'target'])
  await act(async () => {
    pointer(handle, 'pointerdown', 240)
    pointer(document, 'pointermove', 1)
    fireEvent.keyDown(document, { key: 'Escape' })
    pointer(document, 'pointerup', 1)
  })
  expect(order()).toEqual(['first', 'last', 'target'])
})
