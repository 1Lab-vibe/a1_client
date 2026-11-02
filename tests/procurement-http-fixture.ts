// Browser tests only. Production imports neither this module nor the mock client.
import { MockProcurementClient } from '../src/procurement/mock'
import { ProcurementError } from '../src/procurement/client'
import type { Command } from '../src/procurement/contract'

const clients = new Map<string, MockProcurementClient>()
export const downloads = new Map<
  string,
  { bytes: number[]; filename: string }
>()
function client(company: string) {
  if (!clients.has(company))
    clients.set(
      company,
      new MockProcurementClient(company, 'http-test', sessionStorage),
    )
  return clients.get(company)!
}
export async function upload(company: string) {
  return client(company).upload(new File(['test'], 'Тест.csv'))
}
export async function handle(cmd: Command) {
  // Convert the actual server wire format to the fixture model and back.
  const payload = cmd.payload as Record<string, any>
  if (payload.filters) payload.filters.stock_known ??= null
  if (payload.options?.max_absolute_price_deviation_percent != null)
    payload.options.max_absolute_price_deviation_percent = String(
      payload.options.max_absolute_price_deviation_percent,
    )
  try {
    const data: any = await client(cmd.company_id).command(cmd)
    if (cmd.action === 'catalog.facets') {
      data.categories = [
        ...new Map(
          data.categories.flatMap((node: any) =>
            node.path.map((entry: any, i: number) => [
              entry.id,
              { ...entry, parent_id: i ? node.path[i - 1].id : null },
            ]),
          ),
        ).values(),
      ]
      data.sources = data.sources.map(({ id, label }: any) => ({
        id,
        name: label,
      }))
      data.capabilities.unavailable_reasons = []
    }
    if (cmd.action === 'catalog.get')
      (Object.assign(data, data.product), delete data.product)
    if (cmd.action === 'job.get') {
      if (!data.progress?.total_lines) data.progress = null
      if (data.parsed_request) {
        data.parsed_request.warnings = data.parsed_request.warnings.map(
          (issue: any) => issue.message,
        )
        for (const line of data.parsed_request.lines) {
          line.parse_issues = line.parse_issues?.map(
            (issue: any) => issue.message,
          )
          if (line.source_ref) delete line.source_ref.observed_at
        }
      }
      if (data.download?.url.startsWith('blob:')) {
        const bytes = [
          ...new Uint8Array(
            await (await fetch(data.download.url)).arrayBuffer(),
          ),
        ]
        downloads.set(data.job_id, { bytes, filename: data.download.filename })
        data.download.url = `${location.origin}/api/procurement/download/${data.job_id}`
      }
    }
    return {
      status: 200,
      download: downloads.get(data.job_id),
      body: {
        contract_version: cmd.contract_version,
        request_id: cmd.request_id,
        ok: true,
        data,
      },
    }
  } catch (error) {
    if (!(error instanceof ProcurementError)) throw error
    return {
      status: error.status || 500,
      body: {
        contract_version: cmd.contract_version,
        request_id: cmd.request_id,
        ok: false,
        error: error.info,
      },
    }
  }
}
