async (page) => {
  const result = await page.evaluate(async () => {
    const harness = await import('/tests/procurement-browser-harness.tsx')
    return await harness.verifyStaleResponses()
  })
  console.log(result)
}
