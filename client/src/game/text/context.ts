import { createContext, use } from 'react'
import type { TextTable } from './useTextTable.ts'

export const TableContext = createContext<TextTable | null>(null)

export function useTable(): TextTable {
  const table = use(TableContext)
  if (!table) throw new Error('A text table piece is outside its table')
  return table
}
