import { useState, useCallback, useEffect } from 'react'

const STORAGE_PREFIX = 'a1_visible_columns_'

function loadStored(section: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + section)
    if (!raw) return null
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return null
    return new Set(arr.map(String))
  } catch {
    return null
  }
}

function saveStored(section: string, visible: string[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + section, JSON.stringify(visible))
  } catch {
    // ignore
  }
}

/**
 * Видимость колонок для списка/канбана. Сохраняется в localStorage по ключу section.
 * @param section — ключ раздела (leads, deals, clients, invoices)
 * @param availableColumns — все доступные колонки (из данных)
 * @returns visibleColumns — отфильтрованный массив для отображения, toggle, isVisible, setVisible
 */
export function useColumnVisibility(
  section: string,
  availableColumns: string[]
): {
  visibleColumns: string[]
  toggle: (key: string) => void
  isVisible: (key: string) => boolean
  setVisible: (keys: Set<string>) => void
} {
  const [stored, setStored] = useState<Set<string> | null>(() => loadStored(section))

  useEffect(() => {
    setStored(loadStored(section))
  }, [section])

  const visibleSet = stored === null
    ? new Set(availableColumns)
    : new Set(availableColumns.filter((k) => stored.has(k)))

  if (visibleSet.size === 0 && availableColumns.length > 0) {
    availableColumns.forEach((k) => visibleSet.add(k))
  }

  const visibleColumns = availableColumns.filter((k) => visibleSet.has(k))

  const setVisible = useCallback(
    (keys: Set<string>) => {
      const next = new Set(keys)
      setStored(next)
      saveStored(section, Array.from(next))
    },
    [section]
  )

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(visibleSet)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setStored(next)
      saveStored(section, Array.from(next))
    },
    [section, visibleSet]
  )

  const isVisible = useCallback(
    (key: string) => visibleSet.has(key),
    [visibleSet]
  )

  return { visibleColumns, toggle, isVisible, setVisible }
}
