/**
 * Builds client.js, the Web client in DSH's module-loader format, from
 * src/client/ and every locale/<tag>.json (a client bundle can't read package
 * files at runtime, so the words are bundled; a new language is a new file).
 * client.js is committed so a linked checkout runs as it is; `--check` fails
 * when it is stale.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const locales = {
  name: 'locales',
  setup(b) {
    b.onResolve({ filter: /^virtual:locales$/ }, () => ({ path: 'locales', namespace: 'locales' }))
    b.onLoad({ filter: /.*/, namespace: 'locales' }, () => {
      const dir = resolve(root, 'locale')
      const files = readdirSync(dir).filter(name => name.endsWith('.json')).sort()
      const table = Object.fromEntries(files.map(name => [name.slice(0, -5), JSON.parse(readFileSync(resolve(dir, name), 'utf8'))]))
      return { contents: `export default ${JSON.stringify(table)}`, loader: 'js', watchFiles: files.map(name => resolve(dir, name)) }
    })
  },
}

const result = await build({
  entryPoints: [resolve(root, 'src/client/index.js')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
  plugins: [locales],
  legalComments: 'none',
  logLevel: 'warning',
})

// DSH runs client scripts as classic scripts in one global scope: everything stays inside the factory.
const body = result.outputFiles[0].text
const out = `/* ${pkg.name} ${pkg.version}: built by scripts/build.mjs from src/client/ and locale/. Do not edit. */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
${body}
    return module.exports
  },
})
`
const target = resolve(root, 'client.js')
if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(target, 'utf8') } catch {}
  if (current !== out) {
    console.error('client.js is stale: run npm run build')
    process.exit(1)
  }
} else {
  writeFileSync(target, out)
}
