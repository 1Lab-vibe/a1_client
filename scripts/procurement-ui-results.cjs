async (page) => {
  const result = page.getByRole('heading', { name: 'Результат подбора' })
  await result.waitFor()
  await page.getByText('4. НЕИЗВЕСТНЫЙ', { exact: true }).waitFor()
  if ((await page.locator('main tbody tr').count()) !== 4)
    throw new Error('Lost analysis rows')
  if (
    !(await page.locator('main').innerText())
      .replace(/\s/g, '')
      .includes('19800,00')
  )
    throw new Error('Incorrect partial total')
  await page
    .getByRole('combobox', { name: 'Показать' })
    .selectOption('not_found')
  await page.getByText('4. НЕИЗВЕСТНЫЙ', { exact: true }).waitFor()
  if ((await page.locator('main tbody tr').count()) !== 1)
    throw new Error('Result filter failed')
  await page.getByRole('combobox', { name: 'Показать' }).selectOption('')
  await page.getByText('1. AC-AG1252', { exact: true }).waitFor()
  await page.reload()
  await page.getByText('4. НЕИЗВЕСТНЫЙ', { exact: true }).waitFor()
  await page.screenshot({
    path: 'output/playwright/procurement-results.png',
    fullPage: true,
  })
  for (const format of ['CSV', 'XLSX']) {
    await page
      .getByRole('button', { name: `Экспорт ${format}`, exact: true })
      .click()
    const link = page.getByRole('link', {
      name: `Скачать Демонстрация.${format.toLowerCase()}`,
      exact: true,
    })
    await link.waitFor({ timeout: 15000 })
    const download = page.waitForEvent('download')
    await link.click()
    await (
      await download
    ).saveAs(`output/playwright/procurement-demo.${format.toLowerCase()}`)
  }
  await page.getByRole('button', { name: 'История', exact: true }).click()
  await page.getByRole('button', { name: 'Открыть', exact: true }).waitFor()
  if ((await page.locator('main tbody tr').count()) !== 1)
    throw new Error('Double submit created duplicate jobs')
  await page.getByRole('combobox').first().selectOption('demo-company-b')
  await page.getByRole('button', { name: 'История', exact: true }).click()
  await page.getByText('Заявок пока нет.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Новая заявка', exact: true }).click()
  await page
    .getByText('Проверьте распознанные строки · 0', { exact: true })
    .waitFor()
  await page.getByRole('combobox').first().selectOption('demo-company-a')
  await page.getByRole('button', { name: 'Каталог', exact: true }).click()
  for (const query of ['DEMO-503', 'DEMO-401']) {
    await page
      .getByRole('textbox', { name: 'Артикул, название или характеристики' })
      .fill(query)
    await page.getByRole('button', { name: 'Найти', exact: true }).click()
    await page.getByRole('alert').waitFor()
    if (await page.locator('main tbody tr').count())
      throw new Error('Error must clear previous data')
  }
  await page
    .getByRole('textbox', { name: 'Артикул, название или характеристики' })
    .fill('000125')
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  await page.getByRole('button', { name: 'Карточка', exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: 'output/playwright/procurement-mobile.png',
    fullPage: true,
  })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  )
  if (overflow) throw new Error('Mobile page has horizontal overflow')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page
    .getByRole('combobox', { name: 'Режим', exact: true })
    .selectOption('live')
  await page.getByRole('alert').waitFor()
  if (await page.locator('main tbody tr').count())
    throw new Error('Live mode must not fall back to mock')
  console.log(
    'PASS: 4 statuses, totals, filter, reload, CSV/XLSX export, double submit, company isolation, 401/503, mobile, live unavailable',
  )
}
