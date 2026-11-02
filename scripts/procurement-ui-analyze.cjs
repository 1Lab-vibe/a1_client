async (page) => {
  const quantity = page.getByRole('textbox', {
    name: 'Количество 1',
    exact: true,
  })
  await quantity.fill('')
  await page
    .getByRole('button', { name: 'Проанализировать заявку', exact: true })
    .click()
  if ((await quantity.getAttribute('aria-invalid')) !== 'true')
    throw new Error('Missing quantity must be marked invalid')
  await quantity.fill('2')
  await page
    .getByRole('button', { name: 'Проанализировать заявку', exact: true })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await page.getByRole('heading', { name: 'Результат подбора' }).waitFor()
}
