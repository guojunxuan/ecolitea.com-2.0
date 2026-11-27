'use client'

import React, { createContext, useContext } from 'react'
import en from './dictionaries/en.json'
import type { FrontendDictionary } from './types'

const DictionaryContext = createContext<FrontendDictionary>(en)

export function DictionaryProvider({
  dictionary,
  children,
}: {
  dictionary: FrontendDictionary
  children: React.ReactNode
}) {
  return <DictionaryContext.Provider value={dictionary}>{children}</DictionaryContext.Provider>
}

export const useDictionary = () => useContext(DictionaryContext)
