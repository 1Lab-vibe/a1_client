import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  ClipboardList,
  History as HistoryIcon,
  TableProperties,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  command,
  payloadSchemas,
  type Command,
  type Payload,
  type ProcurementClient,
} from './contract'
import { LiveProcurementClient, ProcurementError, safeUrl } from './client'
import { MockProcurementClient } from './mock'
import { Catalog } from './Catalog'
import { RequestEditor, emptyDraft, type Draft } from './RequestEditor'
import { History, Results } from './Results'
import { ErrorNotice, Issues, statusLabels, useQuery } from './ui'
import { useJob } from './useJob'
import s from './Procurement.module.css'

type Tab = 'catalog' | 'request' | 'result' | 'history'
const tabs = [
  { id: 'catalog', label: 'Каталог', icon: Boxes },
  { id: 'request', label: 'Новая заявка', icon: ClipboardList },
  { id: 'result', label: 'Результат', icon: TableProperties },
  { id: 'history', label: 'История', icon: HistoryIcon },
] as const
const stages = {
  parsing: 'Распознавание',
  normalization: 'Проверка строк',
  exact_search: 'Поиск точных совпадений',
  analog_search: 'Подбор аналогов',
  market_reference: 'Поиск интернет-ориентира',
  finalizing: 'Подготовка результата',
  export: 'Подготовка файла',
}
function routeJob(company: string, mode: string) {
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  return query.get('company') === company && query.get('mode') === mode
    ? query.get('job')
    : null
}
function readStored(key: string): unknown {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}
function saveStored(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Session storage can be disabled. */
  }
}
function restorePending(key: string, company: string): Command | null {
  const value = readStored(key) as Command | null
  if (
    !value ||
    value.company_id !== company ||
    !['request.parse', 'analysis.start', 'analysis.export'].includes(
      value.action,
    ) ||
    !payloadSchemas[value.action].safeParse(value.payload).success
  )
    return null
  return value
}
function restoreDraft(key: string): Draft {
  const value = readStored(key) as Draft | null
  // Drafts may contain unfinished quantities; validation happens on submission.
  if (
    !value ||
    !Array.isArray(value.lines) ||
    typeof value.title !== 'string' ||
    !value.options ||
    !Number.isInteger(value.revision)
  )
    return emptyDraft()
  return value
}
export function ProcurementView() {
  const { company_id, selectedCompany, email } = useAuth()
  const [mode, setMode] = useState<'mock' | 'live'>(() =>
    new URLSearchParams(window.location.hash.split('?')[1]).get('mode') ===
    'live'
      ? 'live'
      : 'mock',
  )
  if (!company_id) return <div className={s.wrap}>Выберите компанию</div>
  return (
    <div className={s.wrap}>
      <div className={s.sectionHead}>
        <div>
          <span className={s.eyebrow}>СНАБЖЕНИЕ</span>
          <h1>{selectedCompany?.name ?? 'Выбранная компания'}</h1>
          <p>Каталог, проверка заявки и объяснимый подбор предложений</p>
        </div>
        <label>
          Режим
          <select
            value={mode}
            onChange={(e) => {
              window.history.replaceState(null, '', '#/ops/supply')
              setMode(e.target.value as typeof mode)
            }}
          >
            <option value="mock">Демонстрация</option>
            <option value="live">А1 · подключение</option>
          </select>
        </label>
      </div>
      <div className={s.banner} role="status">
        {mode === 'mock'
          ? 'Демонстрационные данные — бэкенд не подключён'
          : import.meta.env.VITE_PROCUREMENT_GATEWAY_READY === 'true'
            ? 'А1 · подключение через сервер клиента'
            : 'Режим пока не подключён к А1'}
      </div>
      <Workspace
        key={`${company_id}:${email}:${mode}`}
        company={company_id}
        owner={email ?? ''}
        mode={mode}
      />
    </div>
  )
}
function Workspace({
  company,
  owner,
  mode,
}: {
  company: string
  owner: string
  mode: 'mock' | 'live'
}) {
  const client: ProcurementClient = useMemo(
    () =>
      mode === 'mock'
        ? new MockProcurementClient(company, owner, sessionStorage)
        : new LiveProcurementClient(
            company,
            import.meta.env.VITE_PROCUREMENT_GATEWAY_READY === 'true',
          ),
    [company, owner, mode],
  )
  const storageKey = `a1_procurement_editor_v1:${owner}:${company}:${mode}`
  const [tab, setTab] = useState<Tab>(() =>
    routeJob(company, mode) ? 'result' : 'catalog',
  )
  const [draft, setDraft] = useState(() => restoreDraft(storageKey))
  const [jobId, setJobId] = useState<string | null>(() =>
    routeJob(company, mode),
  )
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [parsedWarnings, setParsedWarnings] = useState<
    Parameters<typeof Issues>[0]['issues']
  >([])
  const [download, setDownload] = useState<{
    url: string
    filename: string
    expires_at: string
  } | null>(null)
  const pending = useRef<Command | null>(
    restorePending(`${storageKey}:pending`, company),
  )
  const lock = useRef(false)
  const lifetime = useRef(new AbortController())
  const processed = useRef<string | null>(
    readStored(`${storageKey}:parsed-job`) as string | null,
  )
  const facets = useQuery(client, company, 'catalog.facets', {
    query: '',
    filters: {
      category_ids: [],
      brands: [],
      source_ids: [],
      price: { min: null, max: null, currency: 'RUB' },
      stock_known: null,
      attributes: [],
    },
  })
  const polling = useJob(client, company, jobId)
  const resultJob = useRef<typeof polling.job>(null)
  if (polling.job?.job_type === 'analysis') resultJob.current = polling.job
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => {
      controller.abort()
      if (client instanceof MockProcurementClient) client.dispose()
    }
  }, [client])
  useEffect(() => {
    saveStored(storageKey, draft)
  }, [storageKey, draft])
  const openJob = (id: string) => {
    processed.current = null
    setJobId(id)
    const params = new URLSearchParams({ company, mode, job: id })
    window.history.replaceState(null, '', `#/ops/supply?${params}`)
  }
  useEffect(() => {
    const job = polling.job
    if (!job || job.status !== 'completed' || processed.current === job.job_id)
      return
    processed.current = job.job_id
    if (job.parsed_request) {
      const parsed = job.parsed_request
      setDraft((d) => ({
        ...d,
        draft_id: parsed.draft_id,
        revision: Math.max(d.revision, parsed.revision),
        lines: [...d.lines, ...parsed.lines],
        title: d.title || parsed.title,
      }))
      setParsedWarnings(parsed.warnings)
      setTab('request')
      saveStored(`${storageKey}:parsed-job`, job.job_id)
    }
    if (job.download) {
      const url =
        mode === 'mock' && job.download.url.startsWith('blob:')
          ? job.download.url
          : safeUrl(job.download.url)
      if (url && Date.parse(job.download.expires_at) > Date.now())
        setDownload({ ...job.download, url })
      else
        setError(
          new Error(
            'Ссылка недоступна или срок скачивания истёк. Повторите экспорт.',
          ),
        )
    }
  }, [polling.job, mode, storageKey])
  const active =
    busy ||
    (!!jobId &&
      !polling.error &&
      (!polling.job ||
        polling.job.job_id !== jobId ||
        ['queued', 'running'].includes(polling.job.status)))
  async function run<
    A extends 'request.parse' | 'analysis.start' | 'analysis.export',
  >(action: A, payload: Payload<A>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    setDownload(null)
    const prior = pending.current
    const cmd =
      prior?.action === action &&
      JSON.stringify(prior.payload) === JSON.stringify(payload)
        ? (prior as Command<A>)
        : command(company, action, payload)
    pending.current = cmd
    saveStored(`${storageKey}:pending`, cmd)
    try {
      const accepted = await client.command(cmd, lifetime.current.signal)
      if (lifetime.current.signal.aborted) return
      pending.current = null
      saveStored(`${storageKey}:pending`, null)
      openJob(accepted.job_id)
      if (action === 'analysis.start') {
        setAnalysisJobId(accepted.job_id)
        setTab('result')
        setDraft((d) => ({ ...d, revision: d.revision + 1 }))
      }
    } catch (e) {
      if (!lifetime.current.signal.aborted) setError(e)
    } finally {
      lock.current = false
      if (!lifetime.current.signal.aborted) setBusy(false)
    }
  }
  async function upload(file: File) {
    if (lock.current) return
    const limits = facets.data?.capabilities.upload
    if (!limits?.enabled) {
      setError(new Error('Загрузка пока недоступна'))
      return
    }
    if (
      !limits.extensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext.toLowerCase()),
      )
    ) {
      setError(new Error('Неподдерживаемый формат файла'))
      return
    }
    if (file.size > limits.max_size_bytes) {
      setError(
        new Error(
          `Файл слишком большой. Лимит: ${limits.max_size_bytes / 1024 / 1024} МБ`,
        ),
      )
      return
    }
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      const uploaded = await client.upload(file, lifetime.current.signal)
      if (lifetime.current.signal.aborted) return
      lock.current = false
      await run('request.parse', {
        file_ids: [uploaded.file_id],
        title: draft.title,
      })
    } catch (e) {
      if (!lifetime.current.signal.aborted) setError(e)
    } finally {
      lock.current = false
      if (!lifetime.current.signal.aborted) setBusy(false)
    }
  }
  const retryMutation = () => {
    const c = pending.current
    if (c)
      void run(
        c.action as 'analysis.start',
        c.payload as Payload<'analysis.start'>,
      )
  }
  const visibleJob =
    polling.job?.job_type === 'analysis' ? polling.job : resultJob.current
  const accessError = [error, polling.error, facets.error].find(
    (e) => e instanceof ProcurementError && [401, 403].includes(e.status),
  )
  return (
    <>
      <nav className={s.tabs} aria-label="Разделы снабжения">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            className={tab === id ? s.active : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={18} aria-hidden />
            {label}
            {id === 'request' && draft.lines.length > 0 && (
              <span>{draft.lines.length}</span>
            )}
          </button>
        ))}
      </nav>
      {pending.current && !busy && !error && (
        <div className={s.banner}>
          Предыдущая команда не подтверждена сервером.{' '}
          <button onClick={retryMutation}>Повторить сохранённую команду</button>
        </div>
      )}
      <ErrorNotice
        error={error}
        retry={
          pending.current &&
          !(error instanceof ProcurementError && !error.info.retryable)
            ? retryMutation
            : undefined
        }
      />
      <ErrorNotice error={polling.error} retry={polling.retry} />
      {busy && <p role="status">Отправляем запрос…</p>}
      {polling.job && (
        <div className={s.progress} role="status">
          <strong>{statusLabels[polling.job.status]}</strong>
          <span>
            {polling.job.stage ? stages[polling.job.stage] : 'Проверка задания'}
          </span>
          {polling.job.progress.total_lines !== null ? (
            <span>
              {polling.job.progress.processed_lines} из{' '}
              {polling.job.progress.total_lines} строк
            </span>
          ) : (
            <span>Объём обработки пока неизвестен</span>
          )}
          {polling.job.status === 'running' && (
            <progress aria-label="Обработка заявки" />
          )}
          {analysisJobId && polling.job.job_type !== 'analysis' && (
            <button
              onClick={() => {
                openJob(analysisJobId)
                setTab('result')
              }}
            >
              Вернуться к анализу
            </button>
          )}
        </div>
      )}
      {download && (
        <p className={s.banner}>
          <a href={download.url} download={download.filename}>
            Скачать {download.filename}
          </a>{' '}
          · ссылка действует до{' '}
          {new Date(download.expires_at).toLocaleTimeString('ru-RU')}
        </p>
      )}
      {!accessError && (
        <>
          {tab === 'catalog' && (
            <Catalog
              client={client}
              company={company}
              add={(line) => {
                setDraft((d) => ({
                  ...d,
                  lines: [
                    ...d.lines,
                    {
                      ...line,
                      position:
                        Math.max(0, ...d.lines.map((l) => l.position)) + 1,
                    },
                  ],
                }))
                setTab('request')
              }}
            />
          )}{' '}
          {tab === 'request' && (
            <>
              <ErrorNotice error={facets.error} retry={facets.reload} />
              <Issues issues={parsedWarnings} />
              <RequestEditor
                draft={draft}
                change={setDraft}
                facets={facets.data}
                busy={active}
                demo={mode === 'mock'}
                parse={(text) =>
                  void run('request.parse', { text, title: draft.title })
                }
                upload={(file) => void upload(file)}
                analyze={() => void run('analysis.start', draft)}
              />
            </>
          )}
          {tab === 'result' && (
            <Results
              key={visibleJob?.analysis_id ?? 'empty'}
              client={client}
              company={company}
              job={visibleJob}
              busy={active}
              canExport={!!facets.data?.capabilities.export}
              exportResult={(analysis_id, result_revision, format) =>
                void run('analysis.export', {
                  analysis_id,
                  result_revision,
                  format,
                })
              }
            />
          )}{' '}
          {tab === 'history' && (
            <History
              client={client}
              company={company}
              open={(id) => {
                resultJob.current = null
                setAnalysisJobId(id)
                openJob(id)
                setTab('result')
              }}
            />
          )}
        </>
      )}
    </>
  )
}
