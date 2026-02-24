import { useState, useRef, useEffect } from 'react'
import styles from './ColumnVisibilityPopover.module.css'

interface ColumnVisibilityPopoverProps {
  columns: string[]
  getLabel: (key: string) => string
  isVisible: (key: string) => boolean
  onToggle: (key: string) => void
  title?: string
}

export function ColumnVisibilityPopover({
  columns,
  getLabel,
  isVisible,
  onToggle,
  title = 'Колонки',
}: ColumnVisibilityPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        title="Настройка колонок"
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.popoverTitle}>{title}</div>
          <div className={styles.list}>
            {columns.map((key) => (
              <label key={key} className={styles.item}>
                <input
                  type="checkbox"
                  checked={isVisible(key)}
                  onChange={() => onToggle(key)}
                />
                <span>{getLabel(key)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
