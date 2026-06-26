/** Общие типы для режимов-действий (Финансы, Продажи и т.д.), запускаемых через runAction. */

export type FieldType = 'text' | 'number' | 'textarea' | 'date' | 'select' | 'db-select' | 'checkbox'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  default?: string
  /** для select */
  options?: { value: string; label: string }[]
  /** для db-select: источник списка */
  source?: 'clients' | 'deals' | 'leads'
  /** какое поле записи показывать / использовать как значение */
  optionLabel?: string
  optionValue?: string
}

export interface ActionMode {
  id: string
  label: string
  description: string
  /** для группировки карточек в UI (например, write/report) */
  group?: string
  action_key: string
  workflow_id: string
  operation?: string
  /** требует подтверждения перед запуском (реальный платёж / отправка) */
  confirm?: boolean
  fields: FieldDef[]
  /**
   * Собрать текст-запрос из значений формы. Запрос уходит в пайплайн через ms_in_take,
   * результат приходит в окно COO и в Telegram. labels — отображаемые названия выбранных
   * из БД записей (по db-select полям), чтобы в тексте были имена, а не id.
   */
  buildMessage?: (v: Record<string, string>, labels?: Record<string, string>) => string
}
