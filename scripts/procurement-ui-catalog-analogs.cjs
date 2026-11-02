async (page) => {
  let polls = 0
  await page.route('**/api/procurement/command', async (route) => {
    const cmd = route.request().postDataJSON()
    const response = await page.evaluate(async command => (await import('/tests/procurement-http-fixture.ts')).handle(command), cmd)
    if (cmd.action === 'catalog.search' && cmd.payload.query.includes('36610-230')) {
      const item = await page.evaluate(async () => (await import('/src/procurement/fixtures.ts')).products[0]).catch(() => null)
      if (!item) throw new Error('Fixture product missing')
      response.body.data = polls++ < 2
        ? { kind: 'catalog.search', reference_status: 'pending', items: [], page: { limit: 5, total: 0, next_cursor: null }, interpreted_query: { summary: 'Определяем исходный товар и категорию по интернет-источникам…' }, warnings: [] }
        : { kind: 'catalog.search', search_mode: 'analogs', items: [{ ...item, match_type: 'analog', compatibility: 'needs_review', match_explanation: 'Нужно подтвердить толщину диска', differences: [{ attribute: 'Диаметр', requested: '230', offered: '230', acceptable: true }] }], reference: { name: 'ЗУБР Диск алмазный 230 мм', category: 'Алмазные диски', source_url: 'https://example.test/product' }, page: { limit: 5, total: 1, next_cursor: null }, interpreted_query: { summary: 'Точного товара нет. Кандидаты в аналоги: Алмазные диски' }, warnings: [] }
    }
    return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) })
  })
  await page.getByRole('textbox', { name: 'Артикул, название или характеристики' }).fill('ЗУБР 36610-230')
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  await page.getByText('Определяем исходный товар и категорию по интернет-источникам…', { exact: true }).waitFor()
  if (await page.getByText('Совпадений нет.', { exact: false }).count()) throw new Error('Pending lookup shown as empty result')
  await page.getByText('Кандидат в аналоги · требует проверки', { exact: true }).waitFor({ timeout: 15000 })
  await page.getByRole('link', { name: 'Источник описания исходного товара' }).waitFor()
  await page.getByText('Сравнение характеристик', { exact: true }).click()
  await page.getByText('Диаметр: 230 → 230', { exact: true }).waitFor()
  console.log('PASS: unknown SKU lookup polls automatically; analog label, properties and cited source visible')
}
