// 사용법: node scripts/check_i18n_keys.mjs [파일경로...]
// $t('key' ...) / t('key' ...) 로 참조하는 키가 각 로케일에 있는지 검사한다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const LOCALE_DIR = 'src/i18n/locales'
const locales = Object.fromEntries(
  readdirSync(LOCALE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace('.json', ''), JSON.parse(readFileSync(join(LOCALE_DIR, f), 'utf8'))])
)

const lookup = (obj, key) => key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj)

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.vue') || full.endsWith('.js') ? [full] : []
  })

const targets = process.argv.slice(2)
const files = targets.length ? targets : walk('src')

const missing = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // $t( 또는 t( 만 매치. $emit('close') 같은 다른 함수는 제외한다.
  for (const m of src.matchAll(/(?<![\w$])\$?t\(\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/gi)) {
    const key = m[1]
    const absent = Object.entries(locales)
      .filter(([, dict]) => typeof lookup(dict, key) !== 'string')
      .map(([name]) => name)
    if (absent.length) missing.push({ file: relative('.', file), key, absent })
  }
}

const seen = new Set()
for (const row of missing) {
  const id = `${row.file}|${row.key}`
  if (seen.has(id)) continue
  seen.add(id)
  console.log(`${row.file}  ${row.key}  → 누락: ${row.absent.join(', ')}`)
}
console.log(`\n참조 키 누락 ${seen.size}건`)
