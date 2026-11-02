import { getSession } from '../session'
import {
  VERSION,
  errorSchema,
  resultSchemas,
  payloadSchemas,
  type Action,
  type ApiError,
  type Command,
  type ProcurementClient,
  type Result,
  type Upload,
} from './contract'

export class ProcurementError extends Error {
  constructor(
    public info: ApiError,
    public status = 0,
    public retryAfterMs = 0,
  ) {
    super(info.message)
  }
}
export function failure(
  code: string,
  message: string,
  status = 0,
  retryable = false,
): ProcurementError {
  return new ProcurementError({ code, message, retryable }, status)
}
export function decode<A extends Action>(
  cmd: Command<A>,
  raw: unknown,
  status: number,
): Result<A> {
  const obj = raw as Record<string, unknown> | null
  if (
    !obj ||
    obj.contract_version !== VERSION ||
    obj.request_id !== cmd.request_id ||
    typeof obj.ok !== 'boolean'
  )
    throw failure('INVALID_RESPONSE', 'Несовместимый ответ сервера')
  if (!obj.ok) {
    const parsed = errorSchema.safeParse(obj.error)
    if (!parsed.success)
      throw failure('INVALID_RESPONSE', 'Некорректная ошибка сервера')
    throw new ProcurementError(parsed.data, status)
  }
  if (status < 200 || status >= 300)
    throw failure(
      'HTTP_ERROR',
      `Ошибка сервера (${status})`,
      status,
      status >= 500,
    )
  const parsed = resultSchemas[cmd.action].safeParse(obj.data)
  if (!parsed.success)
    throw failure('INVALID_RESPONSE', 'Ответ не соответствует procurement.v1')
  return parsed.data as Result<A>
}
export function checkCommand<A extends Action>(
  cmd: Command<A>,
  company: string,
) {
  if (cmd.company_id !== company)
    throw failure('FORBIDDEN', 'Нет доступа к компании', 403)
  if (
    cmd.contract_version !== VERSION ||
    !payloadSchemas[cmd.action].safeParse(cmd.payload).success
  )
    throw failure('VALIDATION_ERROR', 'Проверьте поля команды', 422)
}
const messages: Record<number, string> = {
  401: 'Сессия истекла. Войдите снова.',
  403: 'Нет доступа к компании',
  // A bare HTTP 404 means the API route is missing. Missing jobs have a
  // procurement.v1 error envelope and keep the server's specific message.
  404: 'Сервис снабжения временно недоступен. Попробуйте позже.',
  409: 'Конфликт запроса или устаревшая ревизия',
  413: 'Файл слишком большой',
  415: 'Неподдерживаемый формат файла',
  422: 'Проверьте поля заявки',
  429: 'Слишком много запросов. Дождитесь повторной попытки.',
  502: 'Сервер временно недоступен',
  503: 'Сервер временно недоступен',
  504: 'Время ожидания истекло. Состояние задания неизвестно.',
}
export class LiveProcurementClient implements ProcurementClient {
  readonly mode = 'live' as const
  private retryUntil = 0
  private rateError: ProcurementError | null = null
  constructor(private company: string) {}
  private async send(
    path: string,
    body: BodyInit,
    requestId?: string,
    signal?: AbortSignal,
  ) {
    if (Date.now() < this.retryUntil && this.rateError)
      throw new ProcurementError(
        this.rateError.info,
        429,
        this.retryUntil - Date.now(),
      )
    const session = getSession()
    if (!session?.token) throw failure('UNAUTHORIZED', messages[401], 401)
    if (session.company_id !== this.company)
      throw failure('FORBIDDEN', messages[403], 403)
    const timeout = new AbortController()
    const abort = () => timeout.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timer = setTimeout(abort, 30000)
    try {
      const response = await fetch(`/api/procurement/${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        signal: timeout.signal,
        headers: {
          Authorization: `Bearer ${session.token}`,
          ...(typeof body === 'string'
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(requestId ? { 'Idempotency-Key': requestId } : {}),
        },
        body,
      })
      let raw: unknown
      try {
        raw = await response.json()
      } catch {
        throw failure(
          'INVALID_RESPONSE',
          messages[response.status] ?? 'Сервер вернул не JSON',
          response.status,
        )
      }
      const retry = response.headers.get('Retry-After')
      const retryMs = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Math.max(0, Date.parse(retry) - Date.now())
        : 0
      if (
        !response.ok &&
        !(raw && typeof raw === 'object' && 'contract_version' in raw)
      )
        throw new ProcurementError(
          {
            code: `HTTP_${response.status}`,
            message: messages[response.status] ?? 'Ошибка сервера',
            retryable: response.status === 429 || response.status >= 500,
          },
          response.status,
          retryMs,
        )
      return { raw, response, retryMs }
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (err instanceof ProcurementError) {
        if (err.status === 429) {
          this.retryUntil = Date.now() + Math.max(2000, err.retryAfterMs)
          this.rateError = err
        }
        throw err
      }
      throw failure(
        'NETWORK_ERROR',
        'Связь прервана. Повторите ту же команду или проверьте задание.',
        0,
        true,
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
  async command<A extends Action>(
    cmd: Command<A>,
    signal?: AbortSignal,
  ): Promise<Result<A>> {
    checkCommand(cmd, this.company)
    const { raw, response, retryMs } = await this.send(
      'command',
      JSON.stringify(cmd, (key, value) => {
        if (key === 'stock_known' && value === null) return undefined
        if (key === 'max_absolute_price_deviation_percent' && value !== null)
          return Number(value)
        return value
      }),
      /^(request.parse|analysis.start|analysis.export)$/.test(cmd.action)
        ? cmd.request_id
        : undefined,
      signal,
    )
    try {
      return decode(cmd, raw, response.status)
    } catch (e) {
      if (e instanceof ProcurementError) {
        e.retryAfterMs = retryMs
        if (e.status === 429) {
          this.retryUntil = Date.now() + Math.max(2000, retryMs)
          this.rateError = e
        }
      }
      throw e
    }
  }
  async upload(file: File, signal?: AbortSignal): Promise<Upload> {
    const body = new FormData()
    body.append('file', file)
    body.append('company_id', this.company)
    const { raw, response } = await this.send('files', body, undefined, signal)
    const result = raw as { ok?: boolean; data?: Upload }
    if (
      response.status !== 201 ||
      !result.ok ||
      !result.data?.file_id ||
      result.data.status !== 'uploaded'
    )
      throw failure('INVALID_RESPONSE', 'Сервер не подтвердил загрузку файла')
    return result.data
  }
}
export function safeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol)
      ? parsed.href
      : undefined
  } catch {
    return undefined
  }
}
