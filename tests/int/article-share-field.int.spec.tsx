import React, { createContext, useContext } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TextFieldClientProps } from 'payload'
import { ArticleShareURLField } from '@/Settings/components/ArticleShareURLField'

const state = vi.hoisted(() => ({
  path: 'blog.share.platforms.0.shareURL',
  name: 'LinkedIn',
  value: '',
  setValue: vi.fn(),
  disabled: false,
  initializing: false,
  fieldCalls: 0,
  getFields: vi.fn(),
  rowID: 'share-row',
}))
vi.mock('@payloadcms/ui', () => {
  const FieldContext = createContext<{ value: string; setValue: (value: string) => void } | null>(
    null,
  )
  return {
    FieldContext,
    useForm: () => ({ getFields: state.getFields }),
    useField: () => {
      state.fieldCalls++
      return {
        path: state.path,
        value: state.value,
        setValue: state.setValue,
        disabled: state.disabled,
        formInitializing: state.initializing,
      }
    },
    useFormFields: (
      selector: (context: [Record<string, { value?: string; rows?: { id: string }[] }>]) => unknown,
    ) =>
      selector([
        {
          [`${state.path.slice(0, state.path.lastIndexOf('.'))}.name`]: { value: state.name },
          'blog.share.platforms': {
            rows: Array.from({ length: 2 }, (_, index) => ({
              id: Number(state.path.split('.').at(-2)) === index ? state.rowID : 'other-row',
            })),
          },
        },
      ]),
    TextField: ({ field }: { field: { label: string } }) => {
      const controlled = useContext(FieldContext)
      return (
        <input
          aria-label={field.label}
          value={controlled?.value}
          onChange={(e) => controlled?.setValue(e.target.value)}
        />
      )
    },
  }
})
const props = {
  path: 'blog.share.platforms.0.shareURL',
  field: { name: 'shareURL', type: 'text', label: 'Share URL', required: true },
} satisfies TextFieldClientProps
const starter = 'https://www.linkedin.com/share?url={url}&title={title}'
afterEach(() => {
  cleanup()
  state.path = props.path
  state.name = 'LinkedIn'
  state.value = ''
  state.disabled = false
  state.initializing = false
  state.setValue.mockReset()
  state.fieldCalls = 0
  state.getFields = vi.fn()
})
describe('ArticleShareURLField', () => {
  it('generates empty values then updates the previous generated URL as the name changes', () => {
    const { rerender } = render(<ArticleShareURLField {...props} />)
    expect(state.setValue).toHaveBeenLastCalledWith(starter)
    state.value = starter
    state.name = 'Email'
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).toHaveBeenLastCalledWith('mailto:?subject={title}&body={url}')
  })
  it('preserves loaded and newly typed manual URLs after renaming', () => {
    state.value = 'https://www.linkedin.com/sharing/share-offsite/?url={url}'
    const { rerender } = render(<ArticleShareURLField {...props} />)
    state.name = 'Email'
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Share URL'), {
      target: { value: 'https://manual.test' },
    })
    expect(state.setValue).toHaveBeenLastCalledWith('https://manual.test')
    state.value = 'https://manual.test'
    state.setValue.mockClear()
    state.name = 'Twitter'
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('stops following names after a generated URL is manually edited and regenerates a cleared value', () => {
    const { rerender } = render(<ArticleShareURLField {...props} />)
    state.value = 'https://custom.test?url={url}'
    state.name = 'Email'
    state.setValue.mockClear()
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
    state.value = ''
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).toHaveBeenLastCalledWith('mailto:?subject={title}&body={url}')
  })
  it('preserves a manual URL even when it matches an intermediate name template', () => {
    const { rerender } = render(<ArticleShareURLField {...props} />)
    state.value = 'mailto:?subject={title}&body={url}'
    state.name = 'Email'
    state.setValue.mockClear()
    rerender(<ArticleShareURLField {...props} />)
    state.name = 'Twitter'
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('preserves a manual URL through row reordering and subsequent name changes', () => {
    const { rerender } = render(<ArticleShareURLField {...props} />)
    expect(state.setValue).toHaveBeenLastCalledWith(starter)
    state.value = 'mailto:?subject={title}&body={url}'
    state.name = 'Email'
    state.setValue.mockClear()
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
    // Payload retains the row component identity while its form path changes.
    state.path = 'blog.share.platforms.1.shareURL'
    rerender(<ArticleShareURLField {...props} />)
    state.name = 'Twitter'
    rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('preserves a manual URL when reordering remounts the field within the same form', () => {
    const { unmount, rerender } = render(<ArticleShareURLField {...props} />)
    expect(state.setValue).toHaveBeenLastCalledWith(starter)
    state.value = 'mailto:?subject={title}&body={url}'
    state.name = 'Email'
    state.setValue.mockClear()
    rerender(<ArticleShareURLField {...props} />)
    unmount()
    state.path = 'blog.share.platforms.1.shareURL'
    const moved = render(<ArticleShareURLField {...props} path={state.path} />)
    state.name = 'Twitter'
    moved.rerender(<ArticleShareURLField {...props} path={state.path} />)
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('isolates generated history between form sessions', () => {
    const first = render(<ArticleShareURLField {...props} />)
    first.unmount()
    state.getFields = vi.fn()
    state.name = 'Email'
    state.value = 'mailto:?subject={title}&body={url}'
    state.setValue.mockClear()
    const second = render(<ArticleShareURLField {...props} />)
    state.name = 'Twitter'
    second.rerender(<ArticleShareURLField {...props} />)
    expect(state.setValue).toHaveBeenLastCalledWith(
      'https://www.twitter.com/share?url={url}&title={title}',
    )
  })
  it('does not update disabled fields', () => {
    state.disabled = true
    render(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
  })
  it('waits for form initialization and honors read only fields', () => {
    state.initializing = true
    const { rerender } = render(<ArticleShareURLField {...props} />)
    expect(state.setValue).not.toHaveBeenCalled()
    state.initializing = false
    rerender(<ArticleShareURLField {...props} readOnly />)
    expect(state.setValue).not.toHaveBeenCalled()
  })
})
