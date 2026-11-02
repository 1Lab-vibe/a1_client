import { createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useQuery } from '../src/procurement/ui'
import type {
  Command,
  ProcurementClient,
  Result,
} from '../src/procurement/contract'
import { emptyFilters } from '../src/procurement/contract'

export async function verifyStaleResponses() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const pending: {
    cmd: Command
    signal?: AbortSignal
    resolve: (value: Result<'catalog.search'>) => void
  }[] = []
  const client = {
    mode: 'mock',
    command: (cmd: Command, signal?: AbortSignal) =>
      new Promise((resolve) => pending.push({ cmd, signal, resolve })),
    upload: () => Promise.reject(),
  } as ProcurementClient
  let change: (value: string) => void = () => {}
  function Probe() {
    const [query, setQuery] = useState('old')
    change = setQuery
    const state = useQuery(client, 'test', 'catalog.search', {
      query,
      filters: emptyFilters(),
      sort: { field: 'comparable_unit_price', direction: 'asc' },
      page: { limit: 25, cursor: null },
    })
    return createElement(
      'output',
      null,
      state.data?.interpreted_query.summary ?? 'pending',
    )
  }
  const root = createRoot(host)
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 100; i++) {
      if (check()) return
      await new Promise((r) => setTimeout(r, 10))
    }
    throw new Error('Harness timed out')
  }
  const reply = (summary: string): Result<'catalog.search'> => ({
    kind: 'catalog.search',
    items: [],
    page: { total: 0, limit: 25, next_cursor: null },
    interpreted_query: { summary },
    warnings: [],
  })
  try {
    root.render(createElement(Probe))
    await until(() => pending.length === 1)
    change('new')
    await until(() => pending.length === 2)
    if (!pending[0].signal?.aborted)
      throw new Error('Old query was not aborted')
    pending[1].resolve(reply('new'))
    await until(() => host.textContent === 'new')
    pending[0].resolve(reply('old'))
    await new Promise((r) => setTimeout(r, 30))
    if (host.textContent !== 'new')
      throw new Error('Stale response overwrote new results')
    change('unmount')
    await until(() => pending.length === 3)
    root.unmount()
    if (!pending[2].signal?.aborted)
      throw new Error('Unmount did not abort pending request')
    return 'PASS: stale response ignored, old request aborted, unmount cancels request'
  } finally {
    if (host.childNodes.length) root.unmount()
    host.remove()
  }
}
