import { useEffect, useRef, useState } from 'react'
import { safeUrl } from './client'
import type { AnalysisRow, Candidate, Job, ProcurementClient } from './contract'
import {
  dateText,
  ErrorNotice,
  Issues,
  moneyText,
  Pager,
  statusLabels,
  useQuery,
} from './ui'
import s from './Procurement.module.css'
import { WebOffers } from './WebOffers'

const marketLabels = {
  available: 'Доступен',
  insufficient_sources: 'Недостаточно независимых источников',
  needs_identification: 'Нужно уточнить оригинал',
  not_requested: 'Не запрашивался',
  unavailable: 'Интернет-ориентир недоступен',
}
function CandidateInfo({ candidate }: { candidate: Candidate }) {
  return (
    <article className={s.panel}>
      <strong>
        {candidate.name ?? 'В прайсе нет названия'} · {candidate.article}
      </strong>
      <p>{candidate.explanation}</p>
      <p>
        {candidate.compatibility === 'confirmed'
          ? 'Совместимость подтверждена ответом'
          : 'Совместимость требует проверки'}
      </p>
      <p>
        {candidate.offer.source_name} · {moneyText(candidate.offer.price)} ·{' '}
        {candidate.offer.price_role} ·{' '}
        {candidate.offer.unit ?? 'Единица неизвестна'} ·{' '}
        {candidate.offer.vat_basis ?? 'НДС неизвестен'}
      </p>
      <p>
        {candidate.offer.source_ref.file_name} →{' '}
        {candidate.offer.source_ref.sheet} → строка{' '}
        {candidate.offer.source_ref.row} ·{' '}
        {dateText(candidate.offer.source_ref.observed_at)}
      </p>
      {candidate.differences.map((d, i) => (
        <p key={i}>
          {d.attribute}: нужно {d.requested ?? 'неизвестно'}, предложение{' '}
          {d.offered ?? 'неизвестно'} —{' '}
          {d.acceptable === null
            ? 'требует проверки'
            : d.acceptable
              ? 'допустимо'
              : 'не подходит'}
        </p>
      ))}
      <Issues issues={candidate.offer.issues} />
    </article>
  )
}
function RowDetails({ row }: { row: AnalysisRow }) {
  return (
    <details>
      <summary>Пояснение, альтернативы и источники</summary>
      <p>{row.explanation}</p>
      <Issues issues={row.issues} />
      {row.intelligence && <WebOffers offers={row.web_offers ?? []} references={row.market_references ?? []} enabled={row.intelligence.web_enabled} />}
      {row.selected && <CandidateInfo candidate={row.selected} />}
      <h4>Альтернативы</h4>
      {row.alternatives.length ? (
        row.alternatives.map((c) => (
          <CandidateInfo
            key={`${c.product_id}-${c.offer.offer_id}`}
            candidate={c}
          />
        ))
      ) : (
        <p>Нет дополнительных предложений</p>
      )}
      <h4>
        Ориентир исходного товара:{' '}
        {row.market_reference.original_product_name ?? 'Не определён'}
      </h4>
      <p>
        {marketLabels[row.market_reference.status]} ·{' '}
        {row.market_reference.independent_source_count} независимых источников ·{' '}
        {dateText(row.market_reference.checked_at)}
      </p>
      {row.market_reference.sources.map((source, i) => (
        <p key={i}>
          {safeUrl(source.url) ? (
            <a
              href={safeUrl(source.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.seller}
            </a>
          ) : (
            source.seller
          )}{' '}
          · {moneyText(source.price)} · {dateText(source.observed_at)} ·{' '}
          {source.included
            ? 'Включён'
            : (source.exclusion_reason ?? 'Исключён')}
        </p>
      ))}
    </details>
  )
}
export function Results({
  client,
  company,
  job,
  exportResult,
  busy,
  canExport,
}: {
  client: ProcurementClient
  company: string
  job: Job | null
  exportResult: (id: string, revision: number, format: 'csv' | 'xlsx') => void
  busy: boolean
  canExport: boolean
}) {
  const [cursor, setCursor] = useState<string | null>(null)
  const [filter, setFilter] = useState<AnalysisRow['status'] | ''>('')
  const revision = useRef<number | null>(null)
  const result = useQuery(
    client,
    company,
    'analysis.result',
    {
      analysis_id: job?.analysis_id ?? '',
      page: { limit: 25, cursor },
      ...(filter ? { status_filter: filter } : {}),
    },
    !!job?.analysis_id &&
      job.status !== 'failed' &&
      (job.status === 'completed' || job.partial_result_available),
  )
  const reload = useRef(result.reload)
  reload.current = result.reload
  useEffect(() => {
    reload.current()
  }, [job])
  useEffect(() => {
    if (result.data) {
      if (
        revision.current !== null &&
        revision.current !== result.data.result_revision
      )
        setCursor(null)
      revision.current = result.data.result_revision
    }
  }, [result.data])
  if (!job)
    return (
      <div className={s.empty}>
        Запустите анализ или откройте задание из истории.
      </div>
    )
  return (
    <section>
      <div className={s.sectionHead}>
        <div>
          <h2>Результат подбора</h2>
          <p>Каждая исходная строка остаётся в результате.</p>
        </div>
        <div className={s.toolbar}>
          {(['xlsx', 'csv'] as const).map((format) => (
            <button
              key={format}
              disabled={!canExport || busy || !result.data?.complete}
              onClick={() =>
                result.data &&
                exportResult(
                  result.data.analysis_id,
                  result.data.result_revision,
                  format,
                )
              }
            >
              Экспорт {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ErrorNotice error={result.error} retry={result.reload} />
      {result.loading && <p role="status">Загружаем результат…</p>}
      {result.data && (
        <>
          <div className={s.metrics}>
            <article>
              <span>Всего строк</span>
              <strong>{result.data.summary.total_lines}</strong>
            </article>
            <article>
              <span>Точно / аналоги</span>
              <strong>
                {result.data.summary.exact_found} /{' '}
                {result.data.summary.analog_found}
              </strong>
            </article>
            <article>
              <span>Уточнить / не найдено</span>
              <strong>
                {result.data.summary.needs_review} /{' '}
                {result.data.summary.not_found}
              </strong>
            </article>
            <article>
              <span>Сумма рассчитанных строк</span>
              <strong>{moneyText(result.data.summary.priced_total)}</strong>
              <small>
                Без оценки: {result.data.summary.unpriced_lines} строк
              </small>
            </article>
          </div>
          {!result.data.complete && (
            <p className={s.warning}>
              Промежуточный результат — обработка продолжается.
            </p>
          )}
          <label className={s.inlineLabel}>
            Показать
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as typeof filter)
                setCursor(null)
              }}
            >
              <option value="">Все статусы</option>
              {(
                [
                  'exact_found',
                  'analog_found',
                  'needs_review',
                  'not_found',
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Исходная позиция</th>
                  <th>Подбор / источник</th>
                  <th>Цена за единицу / сумма</th>
                  <th>Интернет-ориентир / отклонение</th>
                  <th>Статус и пояснение</th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.line_id}>
                    <td>
                      <strong>
                        {row.position}. {row.original_text}
                      </strong>
                      <small>
                        {row.quantity ?? 'Количество неизвестно'}{' '}
                        {row.unit ?? 'Единица неизвестна'}
                      </small>
                    </td>
                    <td>
                      {row.selected?.name ??
                        row.selected?.article ??
                        'Не подобрано'}
                      <code>{row.selected?.article}</code>
                      <small>{row.selected?.offer.source_name}</small>
                    </td>
                    <td>
                      {moneyText(
                        row.selected?.offer.comparable_unit_price ?? null,
                      )}
                      <small>
                        Сумма: {moneyText(row.selected?.line_total ?? null)}
                      </small>
                    </td>
                    <td>
                      {moneyText(row.market_reference.mean_price)}
                      <small>
                        {row.selected?.price_deviation_percent === null ||
                        !row.selected
                          ? 'Отклонение неизвестно'
                          : `${row.selected.price_deviation_percent}%`}
                      </small>
                      <small>{marketLabels[row.market_reference.status]}</small>
                    </td>
                    <td>
                      <span className={s.badge} data-status={row.status}>
                        {statusLabels[row.status]}
                      </span>
                      <RowDetails row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result.data.rows.length && (
              <p className={s.empty}>В этой группе пока нет строк.</p>
            )}
          </div>
          <Pager
            next={result.data.page.next_cursor}
            back={cursor ? () => setCursor(null) : undefined}
            onNext={setCursor}
          />
        </>
      )}
    </section>
  )
}
export function History({
  client,
  company,
  open,
}: {
  client: ProcurementClient
  company: string
  open: (id: string) => void
}) {
  const [cursor, setCursor] = useState<string | null>(null)
  const history = useQuery(client, company, 'analysis.history', {
    page: { limit: 25, cursor },
  })
  return (
    <section>
      <div className={s.sectionHead}>
        <div>
          <h2>История заявок</h2>
          <p>Задания выбранной компании. Предыдущие ревизии сохраняются.</p>
        </div>
        <button onClick={history.reload}>Обновить</button>
      </div>
      <ErrorNotice error={history.error} retry={history.reload} />
      {history.loading && <p role="status">Загружаем историю…</p>}
      {history.data && (
        <>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Строк / точно / аналоги / уточнить / не найдено</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((item) => (
                  <tr key={item.job_id}>
                    <td>{item.title}</td>
                    <td>{dateText(item.created_at)}</td>
                    <td>{statusLabels[item.status]}</td>
                    <td>
                      {item.summary
                        ? `${item.summary.total_lines} / ${item.summary.exact_found} / ${item.summary.analog_found} / ${item.summary.needs_review} / ${item.summary.not_found}`
                        : 'Итоги пока неизвестны'}
                    </td>
                    <td>
                      <button onClick={() => open(item.job_id)}>Открыть</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!history.data.items.length && (
              <p className={s.empty}>Заявок пока нет.</p>
            )}
          </div>
          <Pager
            next={history.data.page.next_cursor}
            back={cursor ? () => setCursor(null) : undefined}
            onNext={setCursor}
          />
        </>
      )}
    </section>
  )
}
