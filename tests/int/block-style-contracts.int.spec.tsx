import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
// Archive's server-only dependencies are not part of these client contracts.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => <svg aria-hidden="true" /> }))

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { ContentBlock } from '@/blocks/Content/Component'
import { BannerBlock } from '@/blocks/Banner/Component'
import { FormBlock, type FormBlockType } from '@/blocks/Form/Component'
import { Width } from '@/blocks/Form/Width'
import { CodeBlock } from '@/blocks/Code/Component'

// The glob lets missing migration modules fail assertions rather than module resolution.
const modules = import.meta.glob('/src/blocks/**/*.module.css', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, string>>
const style = (path: string, name: string) => {
  const className = modules[`/src/blocks/${path}.module.css`]?.[name]
  expect(className, `${path} exports ${name}`).toBeTruthy()
  return className
}
const richText = (text: string) =>
  ({
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            { type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' },
          ],
        },
      ],
    },
  }) as never

const form = (overrides: Partial<FormBlockType['form']> = {}): FormBlockType['form'] =>
  ({
    id: 'contact-form',
    title: 'Contact',
    submitButtonLabel: 'Send',
    confirmationType: 'message',
    confirmationMessage: richText('Thank you'),
    fields: [
      { blockType: 'text', name: 'name', label: 'Name', required: true, width: 50 },
      { blockType: 'email', name: 'email', label: 'Email', required: true },
      { blockType: 'number', name: 'quantity', label: 'Quantity' },
      { blockType: 'textarea', name: 'notes', label: 'Notes' },
      { blockType: 'checkbox', name: 'consent', label: 'Consent', required: true },
      {
        blockType: 'select',
        name: 'tea',
        label: 'Tea',
        defaultValue: 'green',
        options: [{ label: 'Green', value: 'green' }],
      },
      { blockType: 'country', name: 'country', label: 'Country' },
      { blockType: 'state', name: 'state', label: 'State' },
      { blockType: 'message', message: richText('Tell us about your tea') },
    ],
    ...overrides,
  }) as FormBlockType['form']

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Block CSS module contracts', () => {
  it('adds exactly one standard section wrapper per supported Block', () => {
    const { container } = render(
      <RenderBlocks
        blocks={[
          { blockType: 'content', columns: [] },
          { blockType: 'mediaBlock', media: 'missing' },
        ]}
      />,
    )
    expect(container.children).toHaveLength(2)
    for (const wrapper of container.children) {
      expect(wrapper.classList).toContain(style('RenderBlocks', 'section'))
      expect(wrapper.children).toHaveLength(1)
      expect(wrapper.firstElementChild?.classList).not.toContain(style('RenderBlocks', 'section'))
    }
  })

  it.each(['full', 'half', 'oneThird', 'twoThirds'] as const)(
    'maps the %s column without dynamic utility classes',
    (size) => {
      render(<ContentBlock blockType="content" columns={[{ size, richText: richText(size) }]} />)
      const column = screen.getByText(size).closest('.payload-richtext')?.parentElement
      expect(column?.classList).toContain(style('Content/Component', size))
      expect(column?.classList).toContain(style('Content/Component', 'column'))
    },
  )

  it('preserves the medium half-width fallback for an unspecified column size', () => {
    render(<ContentBlock blockType="content" columns={[{ richText: richText('Fallback') }]} />)
    expect(
      screen.getByText('Fallback').closest('.payload-richtext')?.parentElement?.classList,
    ).toContain(style('Content/Component', 'partial'))
  })

  it.each(['info', 'warning', 'error', 'success'] as const)(
    'maps Banner %s status and keeps nested RichText plain',
    (status) => {
      render(
        <BannerBlock
          id={`banner-${status}`}
          blockType="banner"
          style={status}
          content={richText('Notice')}
        />,
      )
      const content = screen.getByText('Notice').closest('.payload-richtext')!
      expect(content.classList).toContain('payload-richtext--plain')
      expect(content.parentElement?.classList).toContain(style('Banner/Component', status))
    },
  )

  it('keeps unknown Banner styles unstyled beyond the base surface', () => {
    render(
      <BannerBlock
        id="banner-unknown"
        blockType="banner"
        style={'unknown' as never}
        content={richText('Notice')}
      />,
    )
    const banner = screen.getByText('Notice').closest('.payload-richtext')?.parentElement
    expect(banner?.className).toBe(style('Banner/Component', 'surface'))
  })

  it('retains code token markup, line numbers, scrolling, and copy behavior', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = render(
      <CodeBlock blockType="code" language="js" code="const tea = true" />,
    )
    expect(container.querySelector('pre')?.classList).toContain(style('Code/Component', 'code'))
    expect(container.querySelector('.token.keyword')?.textContent).toBe('const')
    expect(screen.getByText('1', { selector: 'span' }).classList).toContain(
      style('Code/Component', 'lineNumber'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await screen.findByRole('button', { name: 'Copied!' })
    expect(writeText).toHaveBeenCalledWith('const tea = true')
  })

  it('preserves MediaBlock border and radius in the image-owned module', () => {
    expect(style('MediaBlock/Component', 'image')).toBeTruthy()
    if (!style('MediaBlock/Component', 'image')) return
    const css = readFileSync('src/blocks/MediaBlock/Component.module.css', 'utf8')
    expect(css).toMatch(/border:\s*1px solid var\(--website-color-border\)/)
    expect(css).toMatch(/border-radius:\s*var\(--website-radius-content\)/)
  })
})

describe('Form behavior across the style migration', () => {
  it('preserves every field renderer, labels, required text, native types, and widths', () => {
    const { container } = render(<FormBlock enableIntro={false} form={form()} />)
    const name = screen.getByRole('textbox', { name: /Name/ })
    expect(name.id).toBe('name')
    expect(name.parentElement?.classList).toContain(style('Form/Width/index', 'width'))
    expect((name.parentElement as HTMLElement).style.getPropertyValue('--form-field-width')).toBe(
      '50%',
    )
    expect(screen.getByRole('textbox', { name: /Email/ }).getAttribute('type')).toBe('text')
    expect(screen.getByRole('spinbutton', { name: 'Quantity' }).getAttribute('name')).toBe(
      'quantity',
    )
    expect(screen.getByRole('textbox', { name: 'Notes' }).getAttribute('rows')).toBe('3')
    expect(screen.getByRole('checkbox', { name: /Consent/ }).getAttribute('aria-checked')).toBe(
      'false',
    )
    expect(screen.getAllByRole('combobox')).toHaveLength(3)
    for (const id of ['tea', 'country', 'state'])
      expect(container.querySelector(`label[for="${id}"]`)).not.toBeNull()
    expect(screen.getByText('Tell us about your tea')).toBeTruthy()
    const requiredText = screen.getAllByText('(required)', { selector: 'span' })
    expect(requiredText).toHaveLength(3)
    for (const [path, visuallyHiddenText] of [
      ['Form/Text/index', requiredText[0]],
      ['Form/Email/index', requiredText[1]],
      ['Form/Checkbox/index', requiredText[2]],
    ] as const) {
      expect(visuallyHiddenText.parentElement?.classList).toContain(style(path, 'required'))
      expect(visuallyHiddenText.parentElement?.classList).not.toContain('required')
    }
    for (const path of ['Form/Text/index', 'Form/Email/index', 'Form/Checkbox/index']) {
      const css = readFileSync(`src/blocks/${path}.module.css`, 'utf8')
      expect(css).toMatch(/clip:\s*rect\(0, 0, 0, 0\)/)
    }
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('form')).toBe('contact-form')
  })

  it.each([undefined, 0, 33, '75', '0'])(
    'preserves the configured width %s and its fallback',
    (width) => {
      const { container } = render(<Width width={width}>Field</Width>)
      expect(container.firstElementChild?.classList).toContain(style('Form/Width/index', 'width'))
      expect(
        (container.firstElementChild as HTMLElement).style.getPropertyValue('--form-field-width'),
      ).toBe(width ? `${width}%` : '')
    },
  )

  it('keeps required validation and does not submit invalid fields', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<FormBlock enableIntro={false} form={form()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findAllByText('This field is required')).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalled()
    for (const error of screen.getAllByText('This field is required'))
      expect(error.classList).toContain(style('Form/Error/index', 'error'))
  })

  it('posts registered values, preserves delayed loading and enabled submit, then shows confirmation', async () => {
    vi.useFakeTimers()
    let resolve!: (response: Response) => void
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(
      <FormBlock
        enableIntro
        introContent={richText('Contact us')}
        form={form({
          fields: [{ blockType: 'text', name: 'name', label: 'Name', required: true }],
        })}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Jason' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/form-submissions$/)
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body as string)).toMatchObject({
      form: 'contact-form',
      submissionData: expect.arrayContaining([{ field: 'name', value: 'Jason' }]),
    })
    expect(screen.queryByText('Loading, please wait...')).toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Loading, please wait...')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false)
    await act(async () => {
      resolve(new Response(JSON.stringify({ doc: { id: 'submission' } }), { status: 201 }))
    })
    expect(screen.getByText('Thank you')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(screen.queryByText('Contact us')).toBeNull()
    expect(screen.queryByText('Loading, please wait...')).toBeNull()
  })

  it('preserves server errors and allows another submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: 'Try later' }], status: '429' }), {
          status: 429,
        }),
      ),
    )
    render(<FormBlock enableIntro={false} form={form({ fields: [] })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('429: Try later')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('preserves redirect confirmation wiring', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 201 })))
    render(
      <FormBlock
        enableIntro={false}
        form={form({
          fields: [],
          confirmationType: 'redirect',
          redirect: { type: 'custom', url: '/thanks' },
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/thanks'))
  })
})
