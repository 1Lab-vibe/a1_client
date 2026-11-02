import {
  VERSION,
  validateLines,
  type Action,
  type AnalysisRow,
  type Candidate,
  type Command,
  type Job,
  type Line,
  type Payload,
  type ProcurementClient,
  type Result,
  type Upload,
} from './contract'
import { checkCommand, decode, failure, ProcurementError } from './client'
import { demoText, facets, observed, products } from './fixtures'

type StoredJob = {
  command: Command
  created: number
  status: Job
  rows?: AnalysisRow[]
  title: string
}
type Store = {
  jobs: Record<string, StoredJob>
  requests: Record<string, { body: string; job_id: string }>
  files: Record<string, Upload>
}
const emptyStore = (): Store => ({ jobs: {}, requests: {}, files: {} })
export const csvCell = (value: unknown) =>
  `"${String(value ?? '')
    .replace(/^[\s]*[=+@-]/, (match) => `'${match}`)
    .replace(/"/g, '""')}"`
function slicePage<T>(
  items: T[],
  page: { cursor: string | null; limit: number },
) {
  const offset = Number(page.cursor ?? 0)
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw failure('INVALID_CURSOR', 'Недействительная страница', 422)
  return {
    items: items.slice(offset, offset + page.limit),
    page: {
      limit: page.limit,
      total: items.length,
      next_cursor:
        offset + page.limit < items.length ? String(offset + page.limit) : null,
    },
  }
}
function parseText(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((text, index) => ({ text, index }))
    .filter(({ text }) => text.trim())
    .map(({ text, index }) => {
      const [description, quantity, unit] = text.split(';').map((x) => x.trim())
      return {
        line_id: crypto.randomUUID(),
        position: index + 1,
        original_text: description,
        article: products.some((p) => p.article === description)
          ? description
          : null,
        brand: null,
        quantity: quantity && /^\d+(\.\d+)?$/.test(quantity) ? quantity : null,
        unit: unit || null,
        required_attributes: [],
        source_ref: null,
        comment: '',
        parse_issues:
          quantity && unit
            ? []
            : [
                {
                  code: 'CONFIRM',
                  message: 'Подтвердите количество и единицу',
                  severity: 'warning',
                },
              ],
      }
    })
}
function analyze(
  lines: Line[],
  options: Payload<'analysis.start'>['options'],
): AnalysisRow[] {
  return lines.map((line) => {
    const found = products.find(
      (p) => p.article === (line.article || line.original_text),
    )
    const analog =
      !found &&
      line.original_text === 'DEMO-ANALOG' &&
      options.allow_analogs_when_no_exact
    const product = found ?? (analog ? products[1] : null)
    const needsReview =
      !!product &&
      (!product.name ||
        product.issues.length > 0 ||
        line.unit !== product.offer.unit ||
        (!!line.brand && line.brand !== product.brand) ||
        line.required_attributes.some((filter) => {
          const attribute = product.attributes.find((a) => a.key === filter.key)
          if (!attribute || attribute.status !== 'known') return true
          if (filter.operator === 'eq') return attribute.value !== filter.value
          if (filter.operator === 'in')
            return (
              !Array.isArray(filter.value) ||
              !filter.value.includes(
                attribute.value as string | number | boolean,
              )
            )
          return filter.operator === 'gte'
            ? Number(attribute.value) < Number(filter.value)
            : Number(attribute.value) > Number(filter.value)
        }))
    const selected: Candidate | null = product
      ? {
          product_id: product.product_id,
          name: product.name,
          article: product.article,
          offer: product.offer,
          match_type: analog ? 'analog' : 'exact',
          compatibility: needsReview ? 'needs_review' : 'confirmed',
          explanation: analog
            ? 'Тестовый аналог: поставка без АКБ, отличие явно согласовано в демонстрационном сценарии.'
            : needsReview
              ? 'Проверьте характеристики, бренд, комплектацию и единицу.'
              : 'Совпадение тестового артикула и подтверждённых требований.',
          differences: analog
            ? [
                {
                  attribute: 'Число АКБ',
                  requested: '2',
                  offered: '0',
                  acceptable: true,
                },
              ]
            : [],
          line_total:
            product.offer.comparable_unit_price && !needsReview
              ? {
                  amount: (
                    Number(product.offer.comparable_unit_price.amount) *
                    Number(line.quantity)
                  ).toFixed(2),
                  currency: 'RUB',
                }
              : null,
          price_deviation_percent: null,
        }
      : null
    return {
      line_id: line.line_id,
      position: line.position,
      original_text: line.original_text,
      quantity: line.quantity,
      unit: line.unit,
      status: !product
        ? 'not_found'
        : needsReview
          ? 'needs_review'
          : analog
            ? 'analog_found'
            : 'exact_found',
      selected,
      alternatives: selected
        ? products
            .filter(
              (p) =>
                p.product_id === selected.product_id &&
                p.offer.offer_id !== selected.offer.offer_id,
            )
            .map((p) => ({
              ...selected,
              offer: p.offer,
              line_total:
                !needsReview && p.offer.comparable_unit_price
                  ? {
                      amount: (
                        Number(p.offer.comparable_unit_price.amount) *
                        Number(line.quantity)
                      ).toFixed(2),
                      currency: 'RUB',
                    }
                  : null,
            }))
        : [],
      market_reference: {
        status: analog
          ? 'insufficient_sources'
          : options.market_reference_enabled
            ? 'unavailable'
            : 'not_requested',
        original_product_name: line.original_text,
        mean_price: null,
        unit: line.unit,
        independent_source_count: analog ? 1 : 0,
        checked_at: analog ? observed : null,
        sources: analog
          ? [
              {
                seller: 'Тестовый источник (пример)',
                url: 'https://example.com/',
                price: { amount: '8000.00', currency: 'RUB' },
                observed_at: observed,
                included: false,
                exclusion_reason:
                  'Одного тестового источника недостаточно для среднего',
              },
            ]
          : [],
      },
      issues: product ? [...product.issues, ...product.offer.issues] : [],
      explanation:
        selected?.explanation ??
        'В демонстрационном наборе товар не найден. Строка сохранена.',
    }
  })
}
function summarize(rows: AnalysisRow[]): Result<'analysis.result'>['summary'] {
  const counts = {
    exact_found: 0,
    analog_found: 0,
    needs_review: 0,
    not_found: 0,
  }
  rows.forEach((row) => counts[row.status]++)
  const priced = rows.filter((row) => row.selected?.line_total)
  return {
    total_lines: rows.length,
    ...counts,
    priced_lines: priced.length,
    unpriced_lines: rows.length - priced.length,
    priced_total: priced.length
      ? {
          amount: priced
            .reduce(
              (sum, row) => sum + Number(row.selected!.line_total!.amount),
              0,
            )
            .toFixed(2),
          currency: 'RUB',
        }
      : null,
  }
}
export class MockProcurementClient implements ProcurementClient {
  readonly mode = 'mock' as const
  private store: Store
  private storageKey: string
  private urls = new Map<string, string>()
  constructor(
    private company: string,
    owner: string,
    private storage?: Pick<Storage, 'getItem' | 'setItem'>,
  ) {
    this.storageKey = `a1_procurement_demo_v1:${owner}:${company}`
    try {
      this.store =
        JSON.parse(storage?.getItem(this.storageKey) || 'null') ?? emptyStore()
    } catch {
      this.store = emptyStore()
    }
  }
  dispose() {
    this.urls.forEach((url) => URL.revokeObjectURL(url))
    this.urls.clear()
  }
  private save() {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(this.store))
    } catch {
      /* Demo remains usable without storage. */
    }
  }
  async upload(file: File, signal?: AbortSignal): Promise<Upload> {
    signal?.throwIfAborted()
    if (
      !facets.capabilities.upload.extensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      )
    )
      throw failure('UNSUPPORTED_FILE', 'Неподдерживаемый формат файла', 415)
    if (file.size > facets.capabilities.upload.max_size_bytes)
      throw failure('FILE_TOO_LARGE', 'Файл больше 5 МБ', 413)
    const data: Upload = {
      file_id: `file_demo_${crypto.randomUUID()}`,
      name: file.name,
      size_bytes: file.size,
      status: 'uploaded',
    }
    this.store.files[data.file_id] = data
    this.save()
    return data
  }
  async command<A extends Action>(
    cmd: Command<A>,
    signal?: AbortSignal,
  ): Promise<Result<A>> {
    signal?.throwIfAborted()
    checkCommand(cmd, this.company)
    const data = await this.execute(cmd)
    signal?.throwIfAborted()
    return decode(
      cmd,
      { contract_version: VERSION, request_id: cmd.request_id, ok: true, data },
      200,
    )
  }
  private async execute(cmd: Command): Promise<unknown> {
    switch (cmd.action) {
      case 'catalog.facets': {
        const p = cmd.payload as Payload<'catalog.facets'>
        return {
          ...facets,
          attributes: facets.attributes.filter((a) =>
            !p.filters.category_ids.length ||
            p.filters.category_ids.includes('wrench')
              ? !['disc_diameter_mm', 'power_w'].includes(a.key) ||
                !p.filters.category_ids.length
              : !a.key.includes('torque'),
          ),
        }
      }
      case 'catalog.search': {
        const p = cmd.payload as Payload<'catalog.search'>
        const faults: Record<string, [number, string]> = {
          'DEMO-401': [401, 'Сессия истекла. Войдите снова.'],
          'DEMO-503': [503, 'Сервер временно недоступен'],
          'DEMO-403': [403, 'Нет доступа к компании'],
        }
        if (faults[p.query])
          throw failure(
            `DEMO_${faults[p.query][0]}`,
            faults[p.query][1],
            faults[p.query][0],
          )
        const f = p.filters
        const words = p.query
          .toLocaleLowerCase()
          .split(/[\s,]+/)
          .filter(Boolean)
        const filtered = products
          .filter((product) => {
            const hay =
              `${product.article} ${product.name ?? ''} ${product.brand} ${product.attributes
                .filter((a) => a.status === 'known')
                .map((a) => `${a.label} ${a.value} ${a.unit ?? ''}`)
                .join(' ')}`.toLocaleLowerCase()
            const price = product.offer.comparable_unit_price
            return (
              words.every((word) => hay.includes(word)) &&
              (!f.brands.length || f.brands.includes(product.brand!)) &&
              (!f.source_ids.length ||
                f.source_ids.includes(product.offer.source_id)) &&
              (!f.category_ids.length ||
                product.category_paths.some((path) =>
                  path.some((c) => f.category_ids.includes(c.id)),
                )) &&
              (f.stock_known === null ||
                (product.offer.stock.quantity !== null) === f.stock_known) &&
              (f.price.min === null ||
                (price && Number(price.amount) >= Number(f.price.min))) &&
              (f.price.max === null ||
                (price && Number(price.amount) <= Number(f.price.max))) &&
              f.attributes.every((filter) => {
                const a = product.attributes.find((a) => a.key === filter.key)
                if (!a || a.status !== 'known') return false
                return filter.operator === 'eq'
                  ? a.value === filter.value
                  : filter.operator === 'in'
                    ? Array.isArray(filter.value) &&
                      filter.value.includes(
                        a.value as string | number | boolean,
                      )
                    : filter.operator === 'gte'
                      ? Number(a.value) >= Number(filter.value)
                      : Number(a.value) <= Number(filter.value)
              })
            )
          })
          .sort(
            (a, b) =>
              (a.offer.comparable_unit_price
                ? Number(a.offer.comparable_unit_price.amount)
                : Infinity) -
              (b.offer.comparable_unit_price
                ? Number(b.offer.comparable_unit_price.amount)
                : Infinity),
          )
        return {
          kind: 'catalog.search',
          ...slicePage(filtered, p.page),
          interpreted_query: {
            summary: p.query
              ? `Тестовый поиск: ${p.query}`
              : 'Все тестовые предложения; сопоставимые цены по возрастанию',
          },
          warnings: [],
        }
      }
      case 'catalog.get': {
        const product = products.find(
          (p) =>
            p.product_id === (cmd.payload as Payload<'catalog.get'>).product_id,
        )
        if (!product) throw failure('NOT_FOUND', 'Товар не найден', 404)
        const offers = products
          .filter((p) => p.product_id === product.product_id)
          .map((p) => p.offer)
        return {
          kind: 'catalog.get',
          product,
          offers,
          attributes: product.attributes,
          source_refs: offers.map((o) => o.source_ref),
          issues: product.issues,
        }
      }
      case 'request.parse':
      case 'analysis.start':
      case 'analysis.export':
        return this.accept(cmd)
      case 'job.get':
        return this.job((cmd.payload as Payload<'job.get'>).job_id)
      case 'analysis.result': {
        const p = cmd.payload as Payload<'analysis.result'>
        const job = this.findAnalysis(p.analysis_id)
        const complete = Date.now() - job.created >= 2500
        const rows = complete ? job.rows! : job.rows!.slice(0, 1)
        const filtered = p.status_filter
          ? rows.filter((r) => r.status === p.status_filter)
          : rows
        const paged = slicePage(filtered, p.page)
        return {
          kind: 'analysis.result',
          analysis_id: p.analysis_id,
          summary: summarize(job.rows!),
          rows: paged.items,
          page: paged.page,
          complete,
          result_revision: complete ? 2 : 1,
        }
      }
      case 'analysis.history': {
        const items = Object.values(this.store.jobs)
          .filter((job) => job.status.job_type === 'analysis')
          .sort((a, b) => b.created - a.created)
          .map((job) => ({
            job_id: job.status.job_id,
            analysis_id: job.status.analysis_id,
            title: job.title,
            created_at: new Date(job.created).toISOString(),
            status:
              job.status.status === 'failed'
                ? 'failed'
                : Date.now() - job.created >= 2500
                  ? 'completed'
                  : 'running',
            summary: job.rows ? summarize(job.rows) : null,
          }))
        return {
          kind: 'analysis.history',
          ...slicePage(
            items,
            (cmd.payload as Payload<'analysis.history'>).page,
          ),
        }
      }
    }
  }
  private findAnalysis(id: string) {
    const job = Object.values(this.store.jobs).find(
      (j) => j.status.analysis_id === id && j.status.job_type === 'analysis',
    )
    if (!job || !job.rows || job.status.status === 'failed')
      throw failure('NOT_FOUND', 'Задание недоступно или не найдено', 404)
    return job
  }
  private accept(cmd: Command) {
    const existing = this.store.requests[cmd.request_id]
    const body = JSON.stringify(cmd)
    if (existing && existing.body !== body)
      throw failure(
        'IDEMPOTENCY_CONFLICT',
        'Этот ключ уже использован с другим содержимым',
        409,
      )
    if (existing)
      return {
        kind: 'job.accepted',
        job_id: existing.job_id,
        job_type: this.store.jobs[existing.job_id].status.job_type,
        status: 'queued',
        poll_after_ms: 2000,
      }
    const job_id = `job_demo_${crypto.randomUUID()}`
    const type =
      cmd.action === 'request.parse'
        ? 'parse'
        : cmd.action === 'analysis.start'
          ? 'analysis'
          : 'export'
    const status: Job = {
      kind: 'job.status',
      job_id,
      job_type: type,
      status: 'queued',
      stage:
        type === 'parse'
          ? 'parsing'
          : type === 'analysis'
            ? 'exact_search'
            : 'export',
      progress: { processed_lines: 0, total_lines: null },
      partial_result_available: false,
      poll_after_ms: 2000,
      error: null,
    }
    const job: StoredJob = {
      command: cmd,
      status,
      created: Date.now(),
      title: 'Демонстрационная заявка',
    }
    if (type === 'parse') {
      const p = cmd.payload as Payload<'request.parse'>
      if (p.file_ids?.some((id) => !this.store.files[id]))
        throw failure('NOT_FOUND', 'Файл недоступен', 404)
      const lines = parseText(p.text ?? demoText)
      if (p.file_ids?.length)
        lines.forEach((line) => {
          line.source_ref = {
            file_name: this.store.files[p.file_ids![0]].name,
            sheet: 'Демо — имитация',
            row: line.position,
            observed_at: null,
          }
        })
      status.parsed_request = {
        notes: '',
        draft_id: `draft_${job_id}`,
        revision: 1,
        title: p.title || job.title,
        lines,
        warnings: p.file_ids?.length
          ? [
              {
                code: 'SIMULATED_UPLOAD',
                severity: 'info',
                message:
                  'Файл не читался: это имитация загрузки с тестовыми строками',
              },
            ]
          : [],
      }
    }
    if (type === 'analysis') {
      const p = cmd.payload as Payload<'analysis.start'>
      const details = validateLines(p.lines)
      if (details?.length)
        throw new ProcurementError(
          {
            code: 'VALIDATION_ERROR',
            message: 'Исправьте строки заявки',
            retryable: false,
            details,
          },
          422,
        )
      if (new Set(p.lines.map((line) => line.line_id)).size !== p.lines.length)
        throw failure(
          'VALIDATION_ERROR',
          'Повторяющиеся идентификаторы строк',
          422,
        )
      status.analysis_id = `analysis_${job_id}`
      job.title = p.title
      job.rows = analyze(p.lines, p.options)
      status.progress.total_lines = p.lines.length
      if (p.title === 'DEMO-FAIL') {
        status.status = 'failed'
        status.error = {
          code: 'DEMO_FAILURE',
          message: 'Тестовая ошибка обработки заявки',
          retryable: false,
        }
      }
    }
    if (type === 'export') {
      const p = cmd.payload as Payload<'analysis.export'>
      const analysis = this.findAnalysis(p.analysis_id)
      if (p.result_revision !== 2 || Date.now() - analysis.created < 2500)
        throw failure(
          'STALE_REVISION',
          'Результат обновился. Откройте свежую ревизию.',
          409,
        )
    }
    this.store.jobs[job_id] = job
    this.store.requests[cmd.request_id] = { body, job_id }
    this.save()
    return {
      kind: 'job.accepted',
      job_id,
      job_type: type,
      status: 'queued',
      poll_after_ms: 2000,
    }
  }
  private async job(id: string): Promise<Job> {
    const job = this.store.jobs[id]
    if (!job)
      throw failure('NOT_FOUND', 'Задание недоступно или не найдено', 404)
    const done = Date.now() - job.created >= 2500
    if (job.status.status !== 'failed') {
      job.status.status = done ? 'completed' : 'running'
      job.status.partial_result_available =
        !done && job.status.job_type === 'analysis'
      job.status.progress.processed_lines = done
        ? (job.status.progress.total_lines ?? 0)
        : 0
      if (done && job.status.job_type === 'export')
        job.status.download = await this.download(job)
    }
    this.save()
    return {
      ...job.status,
      parsed_request: done ? job.status.parsed_request : undefined,
    }
  }
  private async download(
    job: StoredJob,
  ): Promise<NonNullable<Job['download']>> {
    const p = job.command.payload as Payload<'analysis.export'>
    let url = this.urls.get(job.status.job_id)
    const content_type =
      p.format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    if (!url) {
      const rows = this.findAnalysis(p.analysis_id).rows!
      const data = [
        [
          'ДЕМОНСТРАЦИЯ',
          'Позиция',
          'Количество',
          'Единица',
          'Статус',
          'Артикул',
          'Сумма RUB',
          'Пояснение',
        ],
        ...rows.map((r) => [
          'Тестовые данные',
          r.original_text,
          r.quantity ?? '',
          r.unit ?? '',
          r.status,
          r.selected?.article ?? '',
          r.selected?.line_total?.amount ?? '',
          r.explanation,
        ]),
      ]
      let blob: Blob
      if (p.format === 'csv')
        blob = new Blob(
          [
            '\uFEFF' +
              data.map((row) => row.map(csvCell).join(';')).join('\r\n'),
          ],
          { type: content_type },
        )
      else {
        const { demoWorkbook } = await import('./xlsx')
        blob = new Blob([demoWorkbook(data)], { type: content_type })
      }
      url = URL.createObjectURL(blob)
      this.urls.set(job.status.job_id, url)
    }
    return {
      url,
      expires_at: new Date(Date.now() + 300000).toISOString(),
      filename: `Демонстрация.${p.format}`,
      content_type,
    }
  }
}
