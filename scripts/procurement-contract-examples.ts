import { writeFileSync } from 'node:fs'
import { command, emptyFilters, VERSION, type Action, type Payload } from '../src/procurement/contract'
import { MockProcurementClient } from '../src/procurement/mock'
import { demoText } from '../src/procurement/fixtures'
const company = 'e94295f8-cf1d-4826-83bc-4fda82443891'
const client = new MockProcurementClient(company, 'documentation-demo')
const examples: unknown[] = []
async function call<A extends Action>(action: A, payload: Payload<A>) {
  const request = command(company, action, payload)
  const data = await client.command(request)
  examples.push({ request, response: { status: data.kind === 'job.accepted' ? 202 : 200, body: { contract_version: VERSION, request_id: request.request_id, ok: true, data } } })
  return data
}
await call('catalog.facets', { query: '', filters: emptyFilters() })
await call('catalog.search', { query: '000125', filters: emptyFilters(), sort: { field: 'comparable_unit_price', direction: 'asc' }, page: { limit: 25, cursor: null } })
await call('catalog.get', { product_id: 'p2' })
const parsedJob = await call('request.parse', { text: demoText, title: 'Демонстрационный подбор' })
const originalNow = Date.now
Date.now = () => originalNow() + 5000
const parsed = await call('job.get', { job_id: parsedJob.job_id })
Date.now = originalNow
const accepted = await call('analysis.start', { ...parsed.parsed_request!, options: { allow_analogs_when_no_exact: true, market_reference_enabled: true, max_absolute_price_deviation_percent: null, sort: 'comparable_unit_price_asc' } })
await call('job.get', { job_id: accepted.job_id })
Date.now = () => originalNow() + 5000
const job = await call('job.get', { job_id: accepted.job_id })
await call('analysis.result', { analysis_id: job.analysis_id!, page: { limit: 25, cursor: null } })
await call('analysis.history', { page: { limit: 25, cursor: null } })
const exported = await call('analysis.export', { analysis_id: job.analysis_id!, result_revision: 2, format: 'xlsx' })
Date.now = () => originalNow() + 10000
await call('job.get', { job_id: exported.job_id })
Date.now = originalNow
const failedRequest = command(company, 'catalog.search', { query: 'DEMO-401', filters: emptyFilters(), sort: { field: 'comparable_unit_price', direction: 'asc' }, page: { limit: 25, cursor: null } })
examples.push({ request: failedRequest, response: { status: 401, body: { contract_version: VERSION, request_id: failedRequest.request_id, ok: false, error: { code: 'UNAUTHORIZED', message: 'Сессия истекла. Войдите снова.', retryable: false } } } })
examples.push({ upload: { method: 'POST', path: '/api/a1/procurement/files', multipart: ['file', 'company_id'], response: { status: 201, body: { ok: true, data: { file_id: 'file_demo_001', name: 'Демо.xlsx', size_bytes: 1024, status: 'uploaded' } } } } })
writeFileSync('docs/procurement-contract-examples.json', JSON.stringify({ note: 'Только демонстрационные значения. blob URL в mock заменяется серверной защищённой http(s) ссылкой в live. Idempotency-Key равен request_id для request.parse, analysis.start и analysis.export.', contract_version: VERSION, examples }, null, 2) + '\n', 'utf8')
client.dispose()
