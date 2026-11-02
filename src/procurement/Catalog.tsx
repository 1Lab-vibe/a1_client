import { useEffect, useRef, useState } from 'react'
import { Search, Plus, SlidersHorizontal } from 'lucide-react'
import {
  emptyFilters,
  type Filters,
  type Line,
  type ProcurementClient,
  type Product,
  type Result,
} from './contract'
import {
  dateText,
  ErrorNotice,
  Issues,
  moneyText,
  Pager,
  useQuery,
  valueText,
} from './ui'
import s from './Procurement.module.css'

export function Catalog({
  client,
  company,
  add,
}: {
  client: ProcurementClient
  company: string
  add: (line: Line) => void
}) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [cursor, setCursor] = useState<string | null>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const facetQuery = useQuery(client, company, 'catalog.facets', {
    query,
    filters,
  })
  const search = useQuery(
    client,
    company,
    'catalog.search',
    {
      query,
      filters,
      sort: { field: 'comparable_unit_price', direction: 'asc' },
      page: { limit: 5, cursor },
    },
    !!facetQuery.data?.capabilities.catalog_search,
  )
  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setCursor(null)
  }
  const addProduct = (p: Product) =>
    add({
      line_id: crypto.randomUUID(),
      position: 1,
      original_text: p.name ?? p.article,
      article: p.article,
      brand: p.brand,
      quantity: null,
      unit: p.offer.unit,
      required_attributes: p.attributes
        .filter((a) => a.status === 'known' && a.value !== null)
        .map((a) => ({ key: a.key, operator: 'eq', value: a.value! })),
      source_ref: p.offer.source_ref,
      comment: '',
    })
  return (
    <section aria-label="Каталог товаров">
      <div className={s.sectionHead}>
        <div>
          <h2>Каталог предложений</h2>
          <p>
            Точный артикул или нужные характеристики. Поиск не создаёт заявку.
          </p>
        </div>
        <span className={s.badge}>Цена: по возрастанию</span>
      </div>
      <form
        className={s.search}
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(input.trim())
          setCursor(null)
          search.reload()
        }}
      >
        <label className={s.srOnly} htmlFor="catalog-query">
          Артикул, название или характеристики
        </label>
        <Search size={20} aria-hidden />
        <input
          id="catalog-query"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Артикул, название или характеристики"
        />
        <button
          className={s.primary}
          disabled={!facetQuery.data?.capabilities.catalog_search}
        >
          Найти
        </button>
      </form>
      <div className={s.examples}>
        <span>Например:</span>
        {['AC-AG1252', '000125', 'УШМ 125 мм'].map((example) => (
          <button key={example} onClick={() => setInput(example)}>
            {example}
          </button>
        ))}
      </div>
      <details className={s.filters}>
        <summary>
          <SlidersHorizontal size={16} aria-hidden /> Фильтры
        </summary>
        <div className={s.formGrid}>
          <label>
            Категория
            <select
              value={filters.category_ids[0] ?? ''}
              onChange={(e) =>
                update({
                  category_ids: e.target.value ? [e.target.value] : [],
                  attributes: [],
                })
              }
            >
              <option value="">Все категории</option>
              {facetQuery.data?.categories.map((c) => (
                <option
                  key={c.path[c.path.length - 1].id}
                  value={c.path[c.path.length - 1].id}
                >
                  {c.path.map((p) => p.label).join(' → ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Бренд
            <select
              value={filters.brands[0] ?? ''}
              onChange={(e) =>
                update({ brands: e.target.value ? [e.target.value] : [] })
              }
            >
              <option value="">Все бренды</option>
              {facetQuery.data?.brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Источник прайса
            <select
              value={filters.source_ids[0] ?? ''}
              onChange={(e) =>
                update({ source_ids: e.target.value ? [e.target.value] : [] })
              }
            >
              <option value="">Все источники</option>
              {facetQuery.data?.sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сведения об остатке
            <select
              value={
                filters.stock_known === null ? '' : String(filters.stock_known)
              }
              onChange={(e) =>
                update({
                  stock_known:
                    e.target.value === '' ? null : e.target.value === 'true',
                })
              }
            >
              <option value="">Любые</option>
              <option value="true">Остаток указан (включая 0)</option>
              <option value="false">Неизвестен</option>
            </select>
          </label>
          {(['min', 'max'] as const).map((key) => (
            <label key={key}>
              {key === 'min' ? 'Цена от, ₽' : 'Цена до, ₽'}
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.price[key] ?? ''}
                onChange={(e) =>
                  update({
                    price: {
                      ...filters.price,
                      [key]:
                        e.target.value && Number(e.target.value) >= 0
                          ? e.target.value
                          : null,
                    },
                  })
                }
              />
            </label>
          ))}
          {facetQuery.data?.attributes.map((a) => (
            <AttributeFilter
              key={a.key}
              schema={a}
              filter={filters.attributes.find((f) => f.key === a.key)}
              change={(filter) =>
                update({
                  attributes: [
                    ...filters.attributes.filter((f) => f.key !== a.key),
                    ...(filter ? [filter] : []),
                  ],
                })
              }
            />
          ))}
        </div>
        <button
          onClick={() => {
            setFilters(emptyFilters())
            setCursor(null)
          }}
        >
          Сбросить фильтры
        </button>
      </details>
      <ErrorNotice
        error={facetQuery.error || search.error}
        retry={() => {
          facetQuery.reload()
          search.reload()
        }}
      />
      {(facetQuery.loading || search.loading) && (
        <p className={s.empty} role="status">
          Ищем предложения…
        </p>
      )}
      {search.data && (
        <>
          <div className={s.toolbar}>
            <p>{search.data.interpreted_query.summary}</p>
            <span>{search.data.page.total ?? '—'} предложений</span>
          </div>
          <Issues issues={search.data.warnings} />
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Товар / артикул</th>
                  <th>Характеристики и комплектация</th>
                  <th>Источник / цена</th>
                  <th>Сведения об остатке</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {search.data.items.map((p) => (
                  <tr key={`${p.product_id}-${p.offer.offer_id}`}>
                    <td>
                      <strong>{p.name ?? 'В прайсе нет названия'}</strong>
                      <code>{p.article}</code>
                      <small>
                        {p.brand ?? 'Бренд неизвестен'} ·{' '}
                        {p.category_paths
                          .map((path) => path.map((c) => c.label).join(' → '))
                          .join('; ')}
                      </small>
                      <Issues issues={p.issues} />
                    </td>
                    <td>
                      {p.attributes.map((a) => (
                        <small key={a.key}>
                          {a.label}: {valueText(a)}
                        </small>
                      ))}
                    </td>
                    <td>
                      <strong>{moneyText(p.offer.price)}</strong>
                      <small>
                        {p.offer.price_role} ·{' '}
                        {p.offer.unit ?? 'Единица неизвестна'} ·{' '}
                        {p.offer.vat_basis ?? 'НДС неизвестен'}
                      </small>
                      <small>{p.offer.source_name}</small>
                      <small>
                        Прайс: {dateText(p.offer.source_ref.observed_at)}
                      </small>
                      {p.offer.comparison_status !== 'comparable' && (
                        <p className={s.warning}>
                          После сопоставимых: цена или база сравнения неизвестна
                        </p>
                      )}
                      <Issues issues={p.offer.issues} />
                    </td>
                    <td>
                      {p.offer.stock.quantity === null
                        ? 'Остаток неизвестен'
                        : `${p.offer.stock.quantity} ${p.offer.stock.unit ?? ''}`}
                      <small>
                        По данным на {dateText(p.offer.stock.as_of)}
                      </small>
                    </td>
                    <td>
                      <div className={s.stack}>
                        <button onClick={() => setProductId(p.product_id)}>
                          Карточка
                        </button>
                        <button onClick={() => addProduct(p)}>
                          <Plus size={14} aria-hidden /> В заявку
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!search.data.items.length && (
              <p className={s.empty}>
                По этому запросу ничего не найдено. Измените запрос или фильтры.
              </p>
            )}
          </div>
          <Pager
            next={search.data.page.next_cursor}
            back={cursor ? () => setCursor(null) : undefined}
            onNext={setCursor}
          />
        </>
      )}
      {productId && (
        <ProductCard
          client={client}
          company={company}
          id={productId}
          close={() => setProductId(null)}
          add={addProduct}
        />
      )}
    </section>
  )
}
function AttributeFilter({
  schema,
  filter,
  change,
}: {
  schema: Result<'catalog.facets'>['attributes'][number]
  filter?: Filters['attributes'][number]
  change: (filter: Filters['attributes'][number] | null) => void
}) {
  const [chosenOperator, setOperator] = useState(schema.operators[0])
  const operator = filter?.operator ?? chosenOperator
  const scalar = (text: string) =>
    schema.type === 'number'
      ? Number(text)
      : schema.type === 'boolean'
        ? text === 'true'
        : text
  const setValue = (text: string, op = operator) =>
    change(
      text === ''
        ? null
        : {
            key: schema.key,
            operator: op,
            value:
              op === 'in'
                ? text.split(',').map((value) => scalar(value.trim()))
                : scalar(text),
          },
    )
  const value = Array.isArray(filter?.value)
    ? filter.value.join(',')
    : String(filter?.value ?? '')
  return (
    <div className={s.stack}>
      <label>
        Условие: {schema.label}
        <select
          value={operator}
          onChange={(e) => {
            const op = e.target.value as typeof operator
            setOperator(op)
            if (filter) setValue(value, op)
          }}
        >
          {schema.operators.map((op) => (
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
      </label>
      <label>
        {schema.label}
        {schema.unit && `, ${schema.unit}`}
        {operator !== 'in' && (schema.type === 'boolean' || schema.values) ? (
          <select value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Любое</option>
            {(schema.values ?? [true, false]).map((v) => (
              <option key={String(v)} value={String(v)}>
                {typeof v === 'boolean' ? (v ? 'Да' : 'Нет') : String(v)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={
              schema.type === 'number' && operator !== 'in' ? 'number' : 'text'
            }
            value={value}
            placeholder={operator === 'in' ? 'Значения через запятую' : 'Любое'}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </label>
    </div>
  )
}
function ProductCard({
  client,
  company,
  id,
  close,
  add,
}: {
  client: ProcurementClient
  company: string
  id: string
  close: () => void
  add: (p: Product) => void
}) {
  const query = useQuery(client, company, 'catalog.get', { product_id: id })
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog className={s.dialog} ref={ref} onCancel={close}>
      <div className={s.sectionHead}>
        <h2>Карточка товара</h2>
        <button onClick={close} aria-label="Закрыть карточку">
          Закрыть
        </button>
      </div>
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading && <p>Загрузка…</p>}
      {query.data && (
        <>
          <h3>{query.data.product.name ?? 'В прайсе нет названия'}</h3>
          <code>{query.data.product.article}</code>
          <p>
            {query.data.product.brand ?? 'Бренд неизвестен'} ·{' '}
            {query.data.product.category_paths
              .map((path) => path.map((c) => c.label).join(' → '))
              .join('; ')}
          </p>
          <dl className={s.attributes}>
            {query.data.attributes.map((a) => (
              <div key={a.key}>
                <dt>{a.label}</dt>
                <dd>{valueText(a)}</dd>
              </div>
            ))}
          </dl>
          <Issues issues={query.data.issues} />
          <h3>Все предложения</h3>
          {query.data.offers.map((o) => (
            <article className={s.panel} key={o.offer_id}>
              <strong>
                {o.source_name}: {moneyText(o.price)}
              </strong>
              <p>
                {o.price_role} · {o.unit ?? 'Единица неизвестна'} · В упаковке:{' '}
                {o.pack_quantity ?? 'неизвестно'} ·{' '}
                {o.vat_basis ?? 'НДС неизвестен'}
              </p>
              <p>Сопоставимая цена: {moneyText(o.comparable_unit_price)}</p>
              <p>
                Остаток: {o.stock.quantity ?? 'неизвестен'} {o.stock.unit} на{' '}
                {dateText(o.stock.as_of)}
              </p>
              <p>
                {o.source_ref.file_name} → {o.source_ref.sheet} → строка{' '}
                {o.source_ref.row}
              </p>
              <p>Дата источника: {dateText(o.source_ref.observed_at)}</p>
              <Issues issues={o.issues} />
            </article>
          ))}
          <button
            className={s.primary}
            onClick={() => {
              add(query.data!.product)
              close()
            }}
          >
            Добавить в заявку
          </button>
        </>
      )}
    </dialog>
  )
}
