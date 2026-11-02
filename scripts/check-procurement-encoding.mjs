import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const paths = [
  'src/App.tsx',
  ...readdirSync('src/procurement').map((f) => join('src/procurement', f)),
  ...readdirSync('docs')
    .filter((f) => f.startsWith('procurement-'))
    .map((f) => join('docs', f)),
  ...readdirSync('scripts')
    .filter((f) => f.includes('procurement'))
    .map((f) => join('scripts', f)),
  ...readdirSync('tests')
    .filter((f) => f.includes('procurement'))
    .map((f) => join('tests', f)),
]
for (const path of paths) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(
    readFileSync(path),
  )
  const bad =
    /\uFFFD|\u00D0[\u0080-\u00BF]|\u00D1[\u0080-\u00BF]|\u0420[\u0402\u0403\u0409\u040A\u040B\u040F]|\u0421[\u0452\u0453\u0459\u045A\u045B\u045F]/.test(
      text,
    )
  if (bad) throw new Error(`Possible mojibake: ${path}`)
}
console.log(
  `UTF-8 and mojibake check passed: ${paths.length} files. No migrations performed.`,
)
