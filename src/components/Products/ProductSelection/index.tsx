'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ProductDetail } from '@/utilities/products/models'
import { resolveOptionSelection, selectionForImage } from '@/utilities/products/options'
import { optionKey } from '@/utilities/products/keys'

type SelectionState = {
  selection: Record<string, string>
  activeImageIndex: number
  changed: string[]
  revision: number
}
type SelectionContext = SelectionState & {
  product: ProductDetail
  specifications: ProductDetail['specifications']
  selectValue: (key: string, value: string) => void
  selectImage: (index: number) => void
}
const Context = createContext<SelectionContext | null>(null)

export function selectionFromURL(product: ProductDetail, search: string) {
  const selection = { ...product.defaultSelection }
  const params = new URLSearchParams(search)
  for (const [key, value] of params) {
    const group = product.options.find((group) => group.key === optionKey(key))
    const match = group?.values.find((candidate) => candidate.key === optionKey(value))
    if (group && match) selection[group.key] = match.key
  }
  return selection
}

export function ProductSelectionProvider({
  product,
  children,
}: {
  product: ProductDetail
  children: React.ReactNode
}) {
  const [state, setState] = useState<SelectionState>(() => ({
    selection: product.defaultSelection,
    activeImageIndex:
      resolveOptionSelection(product, product.defaultSelection).activeImageIndex ?? 0,
    changed: [],
    revision: 0,
  }))
  useEffect(() => {
    const sync = () => {
      const selection = selectionFromURL(product, window.location.search)
      setState({
        selection,
        activeImageIndex: resolveOptionSelection(product, selection).activeImageIndex ?? 0,
        changed: [],
        revision: 0,
      })
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [product])
  const specifications = useMemo(
    () => resolveOptionSelection(product, state.selection).specifications,
    [product, state.selection],
  )
  const update = (selection: Record<string, string>, image: number | null) => {
    const resolved = resolveOptionSelection(product, selection).specifications
    const changed = resolved
      .filter(
        (row) =>
          specifications.find((previous) => previous.label === row.label)?.value !== row.value,
      )
      .map((row) => row.label)
    setState((previous) => ({
      selection,
      activeImageIndex: image ?? previous.activeImageIndex,
      changed,
      revision: previous.revision + 1,
    }))
    const url = new URL(window.location.href)
    for (const key of [...url.searchParams.keys()])
      if (product.options.some((group) => group.key === optionKey(key)))
        url.searchParams.delete(key)
    for (const group of product.options)
      if (selection[group.key]) url.searchParams.set(group.key, selection[group.key])
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  return (
    <Context.Provider
      value={{
        ...state,
        product,
        specifications,
        selectValue: (key, value) => {
          if (
            !product.options
              .find((group) => group.key === key)
              ?.values.some((candidate) => candidate.key === value)
          )
            return
          const selection = { ...state.selection, [key]: value }
          update(selection, resolveOptionSelection(product, selection, key).activeImageIndex)
        },
        selectImage: (index) => {
          if (!Number.isInteger(index) || index < 0 || index >= product.gallery.length) return
          update({ ...state.selection, ...selectionForImage(product, index) }, index)
        },
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useProductSelection() {
  const context = useContext(Context)
  if (!context) throw new Error('Product selection requires ProductSelectionProvider')
  return context
}
