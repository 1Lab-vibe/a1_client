import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { validateLines, type Line, type Payload, type Result } from './contract'
import { Issues } from './ui'
import s from './Procurement.module.css'

export type Draft = {
  title: string
  notes?: string
  lines: Line[]
  revision: number
  draft_id?: string
  options: Payload<'analysis.start'>['options']
}
export const emptyDraft = (): Draft => ({
  title: 'Закупка инструмента',
  lines: [],
  revision: 1,
  options: {
    allow_analogs_when_no_exact: true,
    market_reference_enabled: true,
    max_absolute_price_deviation_percent: null,
    sort: 'comparable_unit_price_asc',
  },
})
export function RequestEditor({
  draft,
  change,
  facets,
  busy,
  parse,
  upload,
  analyze,
}: {
  draft: Draft
  change: (draft: Draft) => void
  facets: Result<'catalog.facets'> | null
  busy: boolean
  parse: (text: string) => void
  upload: (file: File) => void
  analyze: () => void
}) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [clearedLines, setClearedLines] = useState<Line[] | null>(null)
  const importedFiles = [
    ...new Set(
      draft.lines.flatMap((line) =>
        line.source_ref ? [line.source_ref.file_name] : [],
      ),
    ),
  ]
  const removeLines = (remove: (line: Line) => boolean) => {
    setClearedLines(draft.lines.filter(remove))
    setSubmitted(false)
    change({ ...draft, lines: draft.lines.filter((line) => !remove(line)) })
  }
  const errors = validateLines(draft.lines) ?? []
  const updateLine = (id: string, patch: Partial<Line>) =>
    change({
      ...draft,
      lines: draft.lines.map((line) =>
        line.line_id === id ? { ...line, ...patch } : line,
      ),
    })
  const lineError = (id: string, field: string) =>
    submitted
      ? errors.find((e) => e.line_id === id && e.field === field)?.reason
      : undefined
  return (
    <section aria-label="Редактор заявки">
      <div className={s.sectionHead}>
        <div>
          <h2>Новая заявка</h2>
          <p>
            Сначала проверьте строки. Подбор запускается только после вашего
            подтверждения.
          </p>
        </div>
        <span className={s.badge}>Ревизия {draft.revision}</span>
      </div>
      <fieldset disabled={busy} className={s.fieldset}>
        <div className={s.toolbar} aria-label="Управление списком заявки">
          <strong>Позиций в заявке: {draft.lines.length}</strong>
          <button
            disabled={!draft.lines.length}
            onClick={() => removeLines(() => true)}
          >
            Очистить список
          </button>
          {clearedLines && (
            <button
              onClick={() => {
                const existing = new Set(
                  draft.lines.map((line) => line.line_id),
                )
                const restored = [
                  ...draft.lines,
                  ...clearedLines.filter((line) => !existing.has(line.line_id)),
                ]
                  .sort((a, b) => a.position - b.position)
                  .map((line, i) => ({ ...line, position: i + 1 }))
                change({ ...draft, lines: restored })
                setClearedLines(null)
              }}
            >
              Отменить удаление
            </button>
          )}
        </div>
        <label>
          Название заявки
          <input
            value={draft.title}
            onChange={(e) => change({ ...draft, title: e.target.value })}
          />
        </label>
        <div className={s.inputGrid}>
          <article className={s.panel}>
            <h3>Вставить список</h3>
            <p>
              Вставьте строки или столбцы из Excel. Порядок названия,
              количества и единицы определяется автоматически.
            </p>
            <label className={s.srOnly} htmlFor="request-text">
              Список товаров
            </label>
            <textarea
              id="request-text"
              rows={5}
              placeholder="УШМ 125 мм — 2 шт"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className={s.toolbar}>
              <button
                disabled={!text.trim() || !facets?.capabilities.request_parse}
                onClick={() => parse(text)}
              >
                Распознать список
              </button>
            </div>
          </article>
          <article className={s.panel}>
            <h3>
              <Upload size={18} aria-hidden /> Загрузить Excel / CSV
            </h3>
            <p>Загрузите файл со списком товаров, количеством и единицами.</p>
            <label>
              Файл заявки
              <input
                type="file"
                accept={facets?.capabilities.upload.extensions.join(',')}
                disabled={!facets?.capabilities.upload.enabled}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload(file)
                  e.target.value = ''
                }}
              />
            </label>
            <small>
              {facets
                ? `До ${facets.capabilities.upload.max_size_bytes / 1024 / 1024} МБ, файлов за раз: ${facets.capabilities.upload.max_files}`
                : 'Загрузка недоступна: лимиты сервера ещё не получены'}
            </small>
            {importedFiles.length > 0 && (
              <div aria-label="Загруженные файлы заявки">
                <p>Загруженные позиции:</p>
                {importedFiles.map((name) => (
                  <div className={s.toolbar} key={name}>
                    <span>{name}</span>
                    <button
                      onClick={() =>
                        removeLines(
                          (line) => line.source_ref?.file_name === name,
                        )
                      }
                      aria-label={`Удалить позиции файла ${name}`}
                    >
                      Удалить из заявки
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
        <label>
          Условия и примечания к заявке
          <textarea
            aria-label="Условия и примечания к заявке"
            value={draft.notes ?? ''}
            onChange={(e) => change({ ...draft, notes: e.target.value })}
            placeholder="Адрес доставки, сроки и другие условия"
            rows={3}
          />
        </label>
        <div className={s.sectionHead}>
          <h3>Проверьте распознанные строки · {draft.lines.length}</h3>
          <button
            onClick={() =>
              change({
                ...draft,
                lines: [
                  ...draft.lines,
                  {
                    line_id: crypto.randomUUID(),
                    position:
                      Math.max(0, ...draft.lines.map((l) => l.position)) + 1,
                    original_text: '',
                    article: null,
                    brand: null,
                    quantity: null,
                    unit: null,
                    required_attributes: [],
                    source_ref: null,
                    comment: '',
                  },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden /> Добавить строку
          </button>
        </div>
        {!draft.lines.length && (
          <div className={s.empty}>
            Вставьте список, загрузите файл или добавьте товары из каталога.
          </div>
        )}
        <div className={s.tableWrap}>
          {draft.lines.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Строка / источник</th>
                  <th>Описание и требования</th>
                  <th>Артикул / бренд</th>
                  <th>Количество / единица</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line) => (
                  <tr key={line.line_id}>
                    <td>
                      № {line.position}
                      <small>
                        {line.source_ref
                          ? `${line.source_ref.file_name} → ${line.source_ref.sheet} → ${line.source_ref.row}`
                          : 'Ручной ввод / текст'}
                      </small>
                      <Issues issues={line.parse_issues ?? []} />
                    </td>
                    <td>
                      <label>
                        Описание {line.position}
                        <input
                          aria-invalid={
                            !!lineError(line.line_id, 'original_text')
                          }
                          value={line.original_text}
                          onChange={(e) =>
                            updateLine(line.line_id, {
                              original_text: e.target.value,
                            })
                          }
                        />
                      </label>
                      <small className={s.warning}>
                        {lineError(line.line_id, 'original_text')}
                      </small>
                      <details>
                        <summary>
                          Обязательные характеристики и комментарий
                        </summary>
                        {line.required_attributes.map((a, i) => (
                          <div className={s.toolbar} key={`${a.key}-${i}`}>
                            <span>
                              {facets?.attributes.find((f) => f.key === a.key)
                                ?.label ?? a.key}
                            </span>
                            <select
                              aria-label={`Условие ${line.position}-${i}`}
                              value={a.operator}
                              onChange={(e) =>
                                updateLine(line.line_id, {
                                  required_attributes:
                                    line.required_attributes.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            operator: e.target
                                              .value as typeof a.operator,
                                          }
                                        : v,
                                    ),
                                })
                              }
                            >
                              {(
                                facets?.attributes.find((f) => f.key === a.key)
                                  ?.operators ?? ['eq']
                              ).map((op) => (
                                <option key={op} value={op}>
                                  {
                                    {
                                      eq: 'Равно',
                                      in: 'Из списка',
                                      gte: 'Не меньше',
                                      lte: 'Не больше',
                                    }[op]
                                  }
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label={`Значение ${line.position}-${i}`}
                              value={String(a.value)}
                              onChange={(e) => {
                                const type = facets?.attributes.find(
                                  (f) => f.key === a.key,
                                )?.type
                                const value =
                                  type === 'number'
                                    ? Number(e.target.value)
                                    : type === 'boolean'
                                      ? e.target.value === 'true'
                                      : e.target.value
                                updateLine(line.line_id, {
                                  required_attributes:
                                    line.required_attributes.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            value:
                                              a.operator === 'in'
                                                ? e.target.value.split(',')
                                                : value,
                                          }
                                        : v,
                                    ),
                                })
                              }}
                            />
                            <button
                              aria-label={`Удалить характеристику ${line.position}-${i}`}
                              onClick={() =>
                                updateLine(line.line_id, {
                                  required_attributes:
                                    line.required_attributes.filter(
                                      (_, n) => n !== i,
                                    ),
                                })
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <select
                          aria-label={`Добавить характеристику ${line.position}`}
                          value=""
                          onChange={(e) => {
                            const a = facets?.attributes.find(
                              (a) => a.key === e.target.value,
                            )
                            if (a)
                              updateLine(line.line_id, {
                                required_attributes: [
                                  ...line.required_attributes,
                                  { key: a.key, operator: 'eq', value: '' },
                                ],
                              })
                          }}
                        >
                          <option value="">Добавить характеристику</option>
                          {facets?.attributes
                            .filter(
                              (a) =>
                                !line.required_attributes.some(
                                  (v) => v.key === a.key,
                                ),
                            )
                            .map((a) => (
                              <option key={a.key} value={a.key}>
                                {a.label} {a.unit}
                              </option>
                            ))}
                        </select>
                        <label>
                          Комментарий {line.position}
                          <textarea
                            value={line.comment}
                            onChange={(e) =>
                              updateLine(line.line_id, {
                                comment: e.target.value,
                              })
                            }
                          />
                        </label>
                      </details>
                    </td>
                    <td>
                      <label>
                        Артикул {line.position}
                        <input
                          value={line.article ?? ''}
                          onChange={(e) =>
                            updateLine(line.line_id, {
                              article: e.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        Бренд {line.position}
                        <input
                          value={line.brand ?? ''}
                          onChange={(e) =>
                            updateLine(line.line_id, {
                              brand: e.target.value || null,
                            })
                          }
                        />
                      </label>
                    </td>
                    <td>
                      <label>
                        Количество {line.position}
                        <input
                          inputMode="decimal"
                          aria-invalid={!!lineError(line.line_id, 'quantity')}
                          value={line.quantity ?? ''}
                          onChange={(e) =>
                            updateLine(line.line_id, {
                              quantity:
                                e.target.value.replace(',', '.') || null,
                            })
                          }
                        />
                      </label>
                      <small className={s.warning}>
                        {lineError(line.line_id, 'quantity')}
                      </small>
                      <label>
                        Единица {line.position}
                        <input
                          aria-invalid={!!lineError(line.line_id, 'unit')}
                          value={line.unit ?? ''}
                          placeholder="Подтвердите"
                          onChange={(e) =>
                            updateLine(line.line_id, {
                              unit: e.target.value || null,
                            })
                          }
                        />
                      </label>
                      <small className={s.warning}>
                        {lineError(line.line_id, 'unit')}
                      </small>
                    </td>
                    <td>
                      <button
                        aria-label={`Удалить строку ${line.position}`}
                        onClick={() =>
                          change({
                            ...draft,
                            lines: draft.lines.filter(
                              (l) => l.line_id !== line.line_id,
                            ),
                          })
                        }
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <article className={s.panel}>
          <h3>Настройки подбора</h3>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={draft.options.allow_analogs_when_no_exact}
              onChange={(e) =>
                change({
                  ...draft,
                  options: {
                    ...draft.options,
                    allow_analogs_when_no_exact: e.target.checked,
                  },
                })
              }
            />
            Искать аналоги, если точного товара нет
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={draft.options.market_reference_enabled}
              disabled={!facets?.capabilities.market_reference}
              onChange={(e) =>
                change({
                  ...draft,
                  options: {
                    ...draft.options,
                    market_reference_enabled: e.target.checked,
                  },
                })
              }
            />
            Сравнить со средней ценой оригинала в интернете
          </label>
          {!facets?.capabilities.market_reference && (
            <p className={s.warning}>
              {facets?.capabilities.unavailable_reasons.market_reference ??
                'Поиск интернет-цены не подключён'}
            </p>
          )}
          <label>
            Допустимое отклонение цены аналога, %
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="Не задано"
              value={draft.options.max_absolute_price_deviation_percent ?? ''}
              onChange={(e) =>
                change({
                  ...draft,
                  options: {
                    ...draft.options,
                    max_absolute_price_deviation_percent:
                      e.target.value || null,
                  },
                })
              }
            />
          </label>
          <small>Цена: по возрастанию. Без приоритетов поставщиков.</small>
        </article>
        {submitted && errors.length > 0 && (
          <p className={s.error} role="alert">
            Исправьте выделенные поля. Неизвестные количество и единица не
            заменяются автоматически.
          </p>
        )}
        <button
          className={s.primary}
          disabled={
            !draft.lines.length ||
            !draft.title.trim() ||
            !facets?.capabilities.analysis
          }
          onClick={() => {
            setSubmitted(true)
            if (!errors.length) analyze()
          }}
        >
          Проанализировать заявку
        </button>
      </fieldset>
    </section>
  )
}
