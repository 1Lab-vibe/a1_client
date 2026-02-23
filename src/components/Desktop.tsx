import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import type { ViewId } from '../types'
import type { NavSection } from '../types'
import { loadSectionsOrder, saveSectionsOrder, toViewId } from '../config/sections'
import styles from './Desktop.module.css'

interface DesktopProps {
  currentViewId: ViewId
  onSelectView: (id: ViewId) => void
}

export function Desktop({ currentViewId, onSelectView }: DesktopProps) {
  const { email, logout } = useAuth()
  const [sections, setSections] = useState<NavSection[]>(loadSectionsOrder)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['crm', 'ops', 'settings']))
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    setDragId(sectionId)
    e.dataTransfer.setData('text/plain', sectionId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragId === null) return
    const idx = sections.findIndex((s) => s.id === dragId)
    if (idx !== index) setDropIndex(index)
  }

  const handleDragLeave = () => setDropIndex(null)

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDropIndex(null)
    setDragId(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const from = sections.findIndex((s) => s.id === id)
    if (from === -1 || from === index) return
    const next = [...sections]
    const [removed] = next.splice(from, 1)
    next.splice(index, 0, removed)
    setSections(next)
    saveSectionsOrder(next)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDropIndex(null)
  }

  const isSelected = (viewId: ViewId) => currentViewId === viewId

  return (
    <aside className={styles.desktop}>
      <div className={styles.brand}>A1</div>
      <nav className={styles.navScroll}>
        {sections.map((section, index) => {
          const hasChildren = section.children && section.children.length > 0
          const isExpanded = expanded.has(section.id)
          const isMainSelected = !hasChildren && isSelected(section.id)
          return (
            <div key={section.id} className={styles.sectionWrap}>
              {dropIndex === index && <div className={styles.dropLine} aria-hidden />}
              <div
                className={`${styles.section} ${isMainSelected ? styles.active : ''} ${dragId === section.id ? styles.dragging : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, section.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className={styles.sectionBtn}
                    onClick={() => toggleExpand(section.id)}
                    title={section.label}
                  >
                    <span className={styles.sectionIcon}>{section.icon}</span>
                    <span className={styles.sectionLabel}>{section.label}</span>
                    <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.sectionBtn}
                    onClick={() => onSelectView(section.id)}
                    title={section.label}
                  >
                    <span className={styles.sectionIcon}>{section.icon}</span>
                    <span className={styles.sectionLabel}>{section.label}</span>
                  </button>
                )}
              </div>
              {hasChildren && isExpanded && (
                <div className={styles.children}>
                  {section.children!.map((child) => {
                    const viewId = toViewId(section.id, child.id)
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className={`${styles.childItem} ${isSelected(viewId) ? styles.active : ''}`}
                        onClick={() => onSelectView(viewId)}
                        title={child.label}
                      >
                        {child.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className={styles.footer}>
        {email && <span className={styles.email} title={email}>{email}</span>}
        <button type="button" className={styles.logoutBtn} onClick={logout} title="Выйти">
          Выйти
        </button>
      </div>
    </aside>
  )
}
