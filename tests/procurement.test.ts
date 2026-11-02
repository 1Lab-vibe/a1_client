import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import {
  command,
  emptyFilters,
  resultSchemas,
  VERSION,
  validateLines,
} from '../src/procurement/contract'
import {
  decode,
  LiveProcurementClient,
  ProcurementError,
  safeUrl,
} from '../src/procurement/client'
import { csvCell, MockProcurementClient } from '../src/procurement/mock'
import { demoText, facets, products } from '../src/procurement/fixtures'
import { demoWorkbook } from '../src/procurement/xlsx'
import { setSession } from '../src/session'

const company = 'test-company'
const mock = () => new MockProcurementClient(company, 'test-user')
const search = (query = '', cursor: string | null = null) =>
  command(company, 'catalog.search', {
    query,
    filters: emptyFilters(),
    sort: { field: 'comparable_unit_price', direction: 'asc' },
    page: { limit: 2, cursor },
  })
const options = {
  allow_analogs_when_no_exact: true,
  market_reference_enabled: true,
  max_absolute_price_deviation_percent: null,
  sort: 'comparable_unit_price_asc' as const,
}
async function parsed(client: MockProcurementClient, text = demoText) {
  const accepted = await client.command(
    command(company, 'request.parse', { text }),
  )
  const original = Date.now
  Date.now = () => original() + 5000
  try {
    return (
      await client.command(
        command(company, 'job.get', { job_id: accepted.job_id }),
      )
    ).parsed_request!
  } finally {
    Date.now = original
  }
}
test('all fixture products and facets conform to runtime contract', () => {
  resultSchemas['catalog.facets'].parse(facets)
  for (const product of products)
    resultSchemas['catalog.get'].parse({
      kind: 'catalog.get',
      product,
      offers: [product.offer],
      attributes: product.attributes,
      source_refs: [product.offer.source_ref],
      issues: product.issues,
    })
})
test('exact article preserves leading zeros; unknown and property searches', async () => {
  const client = mock()
  assert.equal(
    (await client.command(search('000125'))).items[0].article,
    '000125',
  )
  assert.equal((await client.command(search('AC-AG1252'))).page.total, 2)
  assert.equal((await client.command(search('невозможный'))).page.total, 0)
  assert.ok((await client.command(search('УШМ 125 мм'))).items.length)
})
test('server-side pagination sorts comparable prices, unknown price is last', async () => {
  const client = mock()
  const items = []
  let cursor: string | null = null
  do {
    const result = await client.command(search('', cursor))
    items.push(...result.items)
    cursor = result.page.next_cursor
  } while (cursor)
  assert.equal(items.length, products.length)
  assert.equal(items.at(-1)!.offer.price, null)
  assert.deepEqual(
    items
      .slice(0, -1)
      .map((p) => Number(p.offer.comparable_unit_price!.amount)),
    [4200, 6000, 7100, 7800, 8200, 9800],
  )
})
test('explicit attribute filter and zero stock are preserved', async () => {
  const cmd = search()
  cmd.payload.filters.attributes = [
    { key: 'battery_count', operator: 'eq', value: 0 },
  ]
  assert.equal((await mock().command(cmd)).items[0].article, '000125')
  assert.equal(products[0].offer.stock.quantity, '0')
})
test('parse does not invent quantity or units and retains source position', async () => {
  const draft = await parsed(mock(), '000125\n\nУШМ;2;шт')
  assert.equal(draft.lines[0].quantity, null)
  assert.equal(draft.lines[0].unit, null)
  assert.equal(draft.lines[1].position, 3)
  assert.equal(validateLines(draft.lines)!.length, 2)
})
test('mixed analysis retains all four outcomes, partial total, alternatives and insufficient reference', async () => {
  const client = mock()
  const draft = await parsed(client)
  const accepted = await client.command(
    command(company, 'analysis.start', { ...draft, options }),
  )
  const original = Date.now
  Date.now = () => original() + 5000
  try {
    const job = await client.command(
      command(company, 'job.get', { job_id: accepted.job_id }),
    )
    const result = await client.command(
      command(company, 'analysis.result', {
        analysis_id: job.analysis_id!,
        page: { limit: 25, cursor: null },
      }),
    )
    assert.deepEqual(
      result.rows.map((r) => r.status),
      ['exact_found', 'analog_found', 'needs_review', 'not_found'],
    )
    assert.equal(result.summary.priced_total!.amount, '19800.00')
    assert.equal(result.summary.unpriced_lines, 2)
    assert.equal(result.rows[0].alternatives.length, 1)
    assert.equal(result.rows[1].market_reference.mean_price, null)
    assert.equal(result.rows[1].market_reference.status, 'insufficient_sources')
    const filtered = await client.command(
      command(company, 'analysis.result', {
        analysis_id: job.analysis_id!,
        page: { limit: 25, cursor: null },
        status_filter: 'not_found',
      }),
    )
    assert.equal(filtered.rows.length, 1)
    assert.equal(filtered.summary.total_lines, 4)
  } finally {
    Date.now = original
  }
})
test('exact match without price stays exact, conflicting and nameless products require review', async () => {
  const client = mock()
  const draft = await parsed(client, 'DEMO-NOPRICE;1;шт\n000083;1;шт')
  const accepted = await client.command(
    command(company, 'analysis.start', { ...draft, options }),
  )
  const job = await client.command(
    command(company, 'job.get', { job_id: accepted.job_id }),
  )
  const result = await client.command(
    command(company, 'analysis.result', {
      analysis_id: job.analysis_id!,
      page: { limit: 25, cursor: null },
    }),
  )
  assert.equal(result.rows[0].status, 'exact_found')
  assert.equal(result.rows[0].selected!.line_total, null)
  assert.equal(result.summary.needs_review, 1)
})
test('idempotency same command reuses job, changed payload conflicts, failed job is not success', async () => {
  const client = mock()
  const draft = await parsed(client)
  const cmd = command(company, 'analysis.start', {
    ...draft,
    title: 'DEMO-FAIL',
    options,
  })
  const a = await client.command(cmd)
  const b = await client.command(cmd)
  assert.equal(a.job_id, b.job_id)
  await assert.rejects(
    client.command({ ...cmd, payload: { ...cmd.payload, title: 'Changed' } }),
    (e: ProcurementError) => e.info.code === 'IDEMPOTENCY_CONFLICT',
  )
  const job = await client.command(
    command(company, 'job.get', { job_id: a.job_id }),
  )
  assert.equal(job.status, 'failed')
  assert.ok(job.error)
})
test('revisions create new analyses, persisted history isolated by company and user', async () => {
  const map = new Map<string, string>()
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
  const client = new MockProcurementClient(company, 'owner', storage)
  const draft = await parsed(client)
  const a = await client.command(
    command(company, 'analysis.start', { ...draft, options }),
  )
  const b = await client.command(
    command(company, 'analysis.start', { ...draft, revision: 2, options }),
  )
  assert.notEqual(a.job_id, b.job_id)
  const restored = new MockProcurementClient(company, 'owner', storage)
  assert.equal(
    (
      await restored.command(
        command(company, 'analysis.history', {
          page: { limit: 25, cursor: null },
        }),
      )
    ).items.length,
    2,
  )
  await assert.rejects(
    new MockProcurementClient(company, 'other', storage).command(
      command(company, 'job.get', { job_id: a.job_id }),
    ),
  )
  await assert.rejects(
    client.command(command('other-company', 'job.get', { job_id: a.job_id })),
    (e: ProcurementError) => e.status === 403,
  )
})
test('HTTP 200 ok:false, bad JSON envelope, wrong version/id/kind fail closed', () => {
  const cmd = search()
  assert.throws(
    () =>
      decode(
        cmd,
        {
          contract_version: VERSION,
          request_id: cmd.request_id,
          ok: false,
          error: { code: 'TEST', message: 'Error', retryable: false },
        },
        200,
      ),
    ProcurementError,
  )
  for (const raw of [
    null,
    {},
    { contract_version: 'other', ok: true },
    {
      contract_version: VERSION,
      request_id: cmd.request_id,
      ok: true,
      data: { kind: 'catalog.search' },
    },
  ])
    assert.throws(() => decode(cmd, raw, 200), ProcurementError)
})
test('live requires authentication; cancellation prevents delivery', async () => {
  await assert.rejects(
    new LiveProcurementClient(company).command(search()),
    (e: ProcurementError) => e.info.code === 'UNAUTHORIZED',
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    mock().command(search(), controller.signal),
    (e: Error) => e.name === 'AbortError',
  )
})
test('connected transport sends only same-origin bearer session, preserves retry key and Retry-After', async () => {
  setSession(company, 'synthetic-session', 'test-user')
  const original = globalThis.fetch
  const cmd = command(company, 'request.parse', { text: 'Test' })
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/procurement/command')
    assert.equal(
      (init!.headers as Record<string, string>).Authorization,
      'Bearer synthetic-session',
    )
    assert.equal(
      (init!.headers as Record<string, string>)['Idempotency-Key'],
      cmd.request_id,
    )
    return new Response(
      JSON.stringify({
        contract_version: VERSION,
        request_id: cmd.request_id,
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'Подождите', retryable: true },
      }),
      { status: 429, headers: { 'Retry-After': '12' } },
    )
  }
  try {
    await assert.rejects(
      new LiveProcurementClient(company).command(cmd),
      (e: ProcurementError) => e.status === 429 && e.retryAfterMs === 12000,
    )
  } finally {
    globalThis.fetch = original
  }
})
test('demo 401/403/503 differ from empty results', async () => {
  for (const status of [401, 403, 503])
    await assert.rejects(
      mock().command(search(`DEMO-${status}`)),
      (e: ProcurementError) => e.status === status,
    )
})

test('server wire formats normalize without inventing progress or source dates', () => {
  const data = resultSchemas['catalog.facets'].parse({
    ...facets,
    categories: [
      { id: 'root', label: 'Инструменты', parent_id: null },
      { id: 'child', label: 'УШМ', parent_id: 'root' },
    ],
    sources: [{ id: 'source', name: 'Прайс' }],
    capabilities: {
      ...facets.capabilities,
      unavailable_reasons: ['Поиск не настроен'],
    },
  })
  assert.deepEqual(
    data.categories[1].path.map((item) => item.id),
    ['root', 'child'],
  )
  assert.equal(data.sources[0].label, 'Прайс')
  assert.equal(
    data.capabilities.unavailable_reasons.market_reference,
    'Поиск не настроен',
  )
  const job = resultSchemas['job.get'].parse({
    kind: 'job.status',
    job_id: 'job',
    job_type: 'parse',
    status: 'completed',
    stage: null,
    progress: null,
    error: null,
    partial_result_available: false,
    poll_after_ms: 3000,
    parsed_request: {
      draft_id: 'draft',
      revision: 1,
      title: 'Заявка',
      warnings: ['Проверьте строки'],
      lines: [
        {
          line_id: 'line',
          position: 1,
          original_text: 'Артикул — 2 шт',
          article: 'Артикул',
          brand: null,
          quantity: '2',
          unit: 'шт',
          required_attributes: [],
          comment: '',
          parse_issues: ['Проверьте единицу'],
          source_ref: { file_name: 'Заявка.xlsx', sheet: 'Лист1', row: 2 },
        },
      ],
    },
  })
  assert.equal(job.progress.total_lines, null)
  assert.equal(job.parsed_request?.lines[0].source_ref?.observed_at, null)
  assert.equal(job.parsed_request?.warnings[0].message, 'Проверьте строки')
  assert.equal(
    resultSchemas['request.parse'].parse({
      kind: 'job.accepted',
      job_id: 'job',
      job_type: 'parse',
      status: 'completed',
      poll_after_ms: 3000,
    }).status,
    'completed',
  )
  const product = products[0]
  assert.equal(
    resultSchemas['catalog.get'].parse({
      kind: 'catalog.get',
      ...product,
      offers: [product.offer],
      source_refs: [product.offer.source_ref],
    }).product.product_id,
    product.product_id,
  )
})

test('live sends optional stock filter and numeric deviation in server format', async () => {
  setSession(company, 'synthetic-session', 'test-user')
  const original = globalThis.fetch
  const bodies: Array<Record<string, any>> = []
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)))
    return new Response('{}', { status: 503 })
  }
  try {
    const client = new LiveProcurementClient(company)
    await assert.rejects(client.command(search()))
    const { lines } = await parsed(mock())
    await assert.rejects(
      client.command(
        command(company, 'analysis.start', {
          revision: 1,
          title: 'Проверка',
          lines,
          options: { ...options, max_absolute_price_deviation_percent: '12.5' },
        }),
      ),
    )
    assert.ok(!('stock_known' in bodies[0].payload.filters))
    assert.equal(
      bodies[1].payload.options.max_absolute_price_deviation_percent,
      12.5,
    )
  } finally {
    globalThis.fetch = original
  }
})
test('upload checks format and size; file reference remains company scoped', async () => {
  const client = mock()
  await assert.rejects(
    client.upload(new File(['bad'], 'file.exe')),
    (e: ProcurementError) => e.status === 415,
  )
  await assert.rejects(
    client.upload(new File([new Uint8Array(6 * 1024 * 1024)], 'large.csv')),
    (e: ProcurementError) => e.status === 413,
  )
  const file = await client.upload(new File(['000125;2;шт'], 'demo.csv'))
  await assert.rejects(
    mock().command(
      command(company, 'request.parse', { file_ids: [file.file_id] }),
    ),
  )
  assert.ok(
    await client.command(
      command(company, 'request.parse', { file_ids: [file.file_id] }),
    ),
  )
})
test('CSV formula escaping and OOXML literal cells preserve zeros, Cyrillic and all rows', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"')
  assert.equal(csvCell('000125'), '"000125"')
  const files = unzipSync(
    demoWorkbook([
      ['Артикул', 'Описание'],
      ['000125', '=1+1'],
      ['000083', 'Нет названия'],
    ]),
  )
  const xml = strFromU8(files['xl/worksheets/sheet1.xml'])
  assert.ok(xml.includes('000125'))
  assert.ok(xml.includes('Нет названия'))
  assert.ok(!xml.includes('<f>'))
  assert.equal((xml.match(/<row /g) ?? []).length, 3)
  assert.equal(safeUrl('javascript:alert(1)'), undefined)
  assert.ok(safeUrl('https://example.com'))
})
