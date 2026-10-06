import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BlogFilterPanel } from '@/components/BlogFilterPanel'

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

const props = {
  categories: [{ id: 'c1', title: 'Tea', slug: 'tea', count: 3 }],
  authors: [{ id: 'a1', name: 'Jane' }],
  value: { authorIds: [], sort: 'newest' as const },
  onApply: vi.fn(),
  onReset: vi.fn(),
}
describe('blog filter panel', () => {
  it('preserves unsaved edits across semantically identical applied values', () => {
    const { rerender } = render(<BlogFilterPanel {...props} />)
    const form = within(screen.getByRole('complementary'))
    fireEvent.click(form.getByLabelText('Jane'))
    rerender(<BlogFilterPanel {...props} value={{ authorIds: [], sort: 'newest' }} />)
    expect((form.getByLabelText('Jane') as HTMLInputElement).checked).toBe(true)
  })
  it('requires a custom bound and prevents reversed date ranges from submitting', () => {
    render(<BlogFilterPanel {...props} />)
    const desktop = screen.getByRole('complementary')
    const form = within(desktop)
    fireEvent.change(form.getByLabelText('Date range'), { target: { value: 'custom' } })
    const apply = form.getByRole('button', { name: 'Apply filters' }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    expect(form.getByText('Enter a start or end date.')).toBeTruthy()
    const from = form.getByLabelText('From') as HTMLInputElement
    expect(from.getAttribute('aria-describedby')).toBeTruthy()
    fireEvent.submit(desktop.querySelector('form')!)
    expect(props.onApply).not.toHaveBeenCalled()
    fireEvent.change(from, { target: { value: '2026-10-06' } })
    expect(apply.disabled).toBe(false)
    fireEvent.change(form.getByLabelText('To'), { target: { value: '2026-10-01' } })
    expect(apply.disabled).toBe(true)
    expect(form.getByText('End date must be on or after start date.')).toBeTruthy()
    fireEvent.submit(desktop.querySelector('form')!)
    expect(props.onApply).not.toHaveBeenCalled()
    fireEvent.change(form.getByLabelText('To'), { target: { value: '2026-10-07' } })
    fireEvent.click(apply)
    expect(props.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRange: 'custom',
        dateFrom: '2026-10-06',
        dateTo: '2026-10-07',
      }),
    )
  })
  it('opens a modal, focuses close, handles Escape and restores scroll and focus', () => {
    const { unmount } = render(<BlogFilterPanel {...props} />)
    const opener = screen.getByRole('button', { name: 'Filters' })
    document.body.style.overflow = 'auto'
    fireEvent.click(opener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close filters' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(document.activeElement).toBe(opener)
    expect(opener.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe('auto')
    fireEvent.click(opener)
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })
  it('submits a form from keyboard and preserves independent radio groups', () => {
    render(<BlogFilterPanel {...props} />)
    const desktop = screen.getByRole('complementary')
    const radios = within(desktop).getAllByRole('radio') as HTMLInputElement[]
    const mobileRadios = document.querySelector('dialog')!.querySelectorAll('input[type=radio]')
    expect(radios[0].name).not.toBe((mobileRadios[0] as HTMLInputElement).name)
    fireEvent.change(within(desktop).getByLabelText('Sort by'), { target: { value: 'title-asc' } })
    fireEvent.submit(desktop.querySelector('form')!)
    expect(props.onApply).toHaveBeenCalledWith(expect.objectContaining({ sort: 'title-asc' }))
  })
  it('keeps changes as drafts until submitting and resets them', () => {
    render(<BlogFilterPanel {...props} />)
    const form = within(screen.getByRole('complementary'))
    fireEvent.click(form.getByLabelText('Tea (3)'))
    fireEvent.click(form.getByLabelText('Jane'))
    expect(props.onApply).not.toHaveBeenCalled()
    fireEvent.click(form.getByRole('button', { name: 'Apply filters' }))
    expect(props.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'c1', authorIds: ['a1'] }),
    )
    fireEvent.click(form.getByRole('button', { name: 'Reset all' }))
    expect(props.onReset).toHaveBeenCalled()
    expect((form.getByLabelText('All categories') as HTMLInputElement).checked).toBe(true)
  })
  it('syncs applied values and supports custom date inputs', () => {
    const { rerender } = render(<BlogFilterPanel {...props} />)
    rerender(
      <BlogFilterPanel
        {...props}
        value={{ authorIds: ['a1'], sort: 'oldest', dateRange: 'custom', dateFrom: '2026-01-01' }}
      />,
    )
    const form = within(screen.getByRole('complementary'))
    expect((form.getByLabelText('Jane') as HTMLInputElement).checked).toBe(true)
    expect((form.getByLabelText('From') as HTMLInputElement).value).toBe('2026-01-01')
  })
})
