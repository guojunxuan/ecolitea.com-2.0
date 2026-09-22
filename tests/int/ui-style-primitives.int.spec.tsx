import fs from 'node:fs'
import path from 'node:path'

import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button, buttonVariants } from '@/components/ui/button'
import buttonStyles from '@/components/ui/button.module.css'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import selectStyles from '@/components/ui/select.module.css'
import { Textarea } from '@/components/ui/textarea'

afterEach(cleanup)

const expectModuleClass = (element: Element) => {
  const className = element.getAttribute('class')

  expect(className).toBeTruthy()
  expect(className).not.toMatch(/\b(?:bg-primary|border-input|rounded-md|text-sm)\b/)
}

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('UI style primitives', () => {
  it('renders every Button variant and size with its public slot and CSS Module classes', () => {
    const { getByRole } = render(
      <>
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button size="clear">Clear</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button aria-label="Icon" size="icon" />
      </>,
    )

    const buttons = [
      ['Default', buttonStyles.default],
      ['Outline', buttonStyles.outline],
      ['Destructive', buttonStyles.destructive],
      ['Secondary', buttonStyles.secondary],
      ['Ghost', buttonStyles.ghost],
      ['Link', buttonStyles.link],
      ['Clear', buttonStyles.clear],
      ['Small', buttonStyles.sizeSmall],
      ['Large', buttonStyles.sizeLarge],
      ['Icon', buttonStyles.sizeIcon],
    ] as const

    for (const [name, variantClass] of buttons) {
      const button = getByRole('button', { name })

      expect(button.getAttribute('data-slot')).toBe('button')
      expect(variantClass).toBeTruthy()
      expect(button.classList).toContain(variantClass)
      expectModuleClass(button)
    }

    expect(buttonVariants({ variant: 'secondary' })).toContain(buttonStyles.secondary)
    expect(buttonVariants({ variant: 'ghost' })).toContain(buttonStyles.ghost)
    expect(buttonVariants({ variant: 'link' })).toContain(buttonStyles.link)
    expect(buttonVariants({ size: 'clear' })).toContain(buttonStyles.clear)
  })

  it('preserves Button disabled state and caller classes', () => {
    const { getByRole } = render(
      <Button className="consumer-class" disabled>
        Disabled
      </Button>,
    )
    const button = getByRole('button', { name: 'Disabled' })

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.classList).toContain('consumer-class')
    expectModuleClass(button)
  })

  it('keeps Button component defaults in the components layer so caller utilities override them', () => {
    const buttonSource = readSource('src/components/ui/button.module.css')
    const copyButtonSource = readSource('src/blocks/Code/CopyButton.tsx')

    expect(buttonSource).toMatch(/@layer components\s*{\s*\.button\s*{/)
    expect(copyButtonSource).toContain('className="flex gap-1"')
  })

  it('keeps Pagination edge padding in the components layer so Button icon padding wins', () => {
    const buttonSource = readSource('src/components/ui/button.module.css')
    const paginationSource = readSource('src/components/ui/pagination.module.css')

    expect(buttonSource).toMatch(
      /\.sizeDefault:has\(> svg\)\s*{\s*padding-inline: var\(--website-space-3\);/,
    )
    expect(paginationSource).toMatch(
      /@layer components\s*{\s*\.previous\s*{\s*gap: var\(--website-space-1\);\s*padding-left: 0\.625rem;\s*}\s*\.next\s*{\s*gap: var\(--website-space-1\);\s*padding-right: 0\.625rem;/,
    )
  })

  it('renders Card slots with CSS Module classes', () => {
    const { getByText } = render(
      <Card>
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>Card content</CardContent>
        <CardFooter>Card footer</CardFooter>
      </Card>,
    )

    for (const slot of [
      'card',
      'card-header',
      'card-title',
      'card-description',
      'card-content',
      'card-footer',
    ]) {
      const element = document.querySelector(`[data-slot="${slot}"]`)
      expect(element).not.toBeNull()
      expectModuleClass(element!)
    }
    expect(getByText('Card title').tagName).toBe('H3')
  })

  it('renders form controls with semantic slots, states, and CSS Module classes', () => {
    const { getByLabelText, getByRole, getByText } = render(
      <>
        <Label htmlFor="name">Name</Label>
        <Input aria-invalid id="name" placeholder="Your name" />
        <Textarea aria-label="Biography" disabled />
        <Checkbox aria-invalid checked disabled onCheckedChange={() => undefined} />
        <Select disabled>
          <SelectTrigger aria-label="Tea" aria-invalid>
            <SelectValue placeholder="Choose tea" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="green">Green</SelectItem>
          </SelectContent>
        </Select>
      </>,
    )

    const input = getByLabelText('Name')
    expect(input.getAttribute('data-slot')).toBe('input')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expectModuleClass(input)

    const textarea = getByRole('textbox', { name: 'Biography' })
    expect(textarea.getAttribute('data-slot')).toBe('textarea')
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true)
    expectModuleClass(textarea)

    const checkbox = getByRole('checkbox')
    expect(checkbox.getAttribute('data-slot')).toBe('checkbox')
    expect(checkbox.getAttribute('data-state')).toBe('checked')
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    expect((checkbox as HTMLButtonElement).disabled).toBe(true)
    expectModuleClass(checkbox)

    const select = getByRole('combobox', { name: 'Tea' })
    expect(select.getAttribute('data-slot')).toBe('select-trigger')
    expect(select.getAttribute('aria-expanded')).toBe('false')
    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect((select as HTMLButtonElement).disabled).toBe(true)
    expectModuleClass(select)

    const label = getByText('Name')
    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('for')).toBe('name')
    expectModuleClass(label)
  })

  it('renders open Select portal content with selected and disabled option states', () => {
    const { getByRole } = render(
      <Select defaultValue="green" open>
        <SelectTrigger aria-label="Open tea choices">
          <SelectValue placeholder="Choose tea" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="green">Green</SelectItem>
          <SelectItem disabled value="black">
            Black
          </SelectItem>
        </SelectContent>
      </Select>,
    )

    const content = document.querySelector('[data-slot="select-content"]')
    expect(content).not.toBeNull()
    expect(content?.getAttribute('data-state')).toBe('open')
    expect(content?.getAttribute('data-side')).toBeTruthy()
    expect(content?.classList).toContain(selectStyles.content)
    expect(content?.classList).toContain(selectStyles.popper)

    const selectedOption = getByRole('option', { name: 'Green' })
    expect(selectedOption.getAttribute('data-slot')).toBe('select-item')
    expect(selectedOption.getAttribute('data-state')).toBe('checked')
    expect(selectedOption.getAttribute('aria-selected')).toBe('false')
    expectModuleClass(selectedOption)

    const disabledOption = getByRole('option', { name: 'Black' })
    expect(disabledOption.hasAttribute('data-disabled')).toBe(true)
    expect(disabledOption.getAttribute('aria-disabled')).toBe('true')
    expectModuleClass(disabledOption)
  })

  it('renders Pagination navigation and active state with CSS Module classes', () => {
    const { getByLabelText, getByRole, getByText } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink isActive>2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    )

    const navigation = getByRole('navigation', { name: 'pagination' })
    expectModuleClass(navigation)
    expectModuleClass(navigation.querySelector('ul')!)

    const active = getByRole('button', { name: '2' })
    expect(active.getAttribute('aria-current')).toBe('page')
    expectModuleClass(active)

    const previous = getByLabelText('Go to previous page')
    expect((previous as HTMLButtonElement).disabled).toBe(true)
    expectModuleClass(previous)
    expectModuleClass(getByLabelText('Go to next page'))

    const ellipsis = getByText('More pages').parentElement
    expect(ellipsis?.getAttribute('aria-hidden')).toBe('true')
    expectModuleClass(ellipsis!)
  })
})
