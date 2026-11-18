import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createOffers, pickText } from '../src/client/offer.js'

/** A Host that answers the dialog's routes from `views` (item -> view) and records each call. */
function host(views, { buyError } = {}) {
  const calls = []
  const fetchJson = async (path, init) => {
    calls.push(init?.body ? [path, JSON.parse(init.body)] : [path])
    if (path.startsWith('api/points/quote')) return views[new URLSearchParams(path.split('?')[1]).get('item')]
    if (buyError) {
      const error = Object.assign(new Error(buyError.message), { code: buyError.code })
      buyError = undefined
      throw error
    }
    const { item } = JSON.parse(init.body)
    views[item] = { ...views[item], valid: true }
    return views[item]
  }
  return { calls, fetchJson }
}

const VIEW = Object.freeze({ plays: true, item: 'media:new_series', valid: false, pending: false, name: { en: 'Start a new series' }, cost: 30, balance: 77, gap: 0, affordable: true })
const settled = () => new Promise(resolve => setTimeout(resolve, 0))
let sources = 0
const newSource = () => `points:${++sources}`

test('nothing owed or a ticket held: the offer says yes without a dialog', async () => {
  const { fetchJson } = host({ 'a:free': { plays: false }, 'a:held': { ...VIEW, item: 'a:held', valid: true } })
  const offers = createOffers({ fetchJson, newSource })
  let shown = 0
  offers.subscribe(() => { if (offers.get()?.phase === 'ready') shown += 1 })
  assert.equal(await offers.offer({ item: 'a:free' }), true)
  assert.equal(await offers.offer({ item: 'a:held' }), true)
  assert.equal(shown, 0)
})

test('Not now answers false and buys nothing; Buy buys once under the given source and answers true', async () => {
  const { fetchJson, calls } = host({ [VIEW.item]: { ...VIEW } })
  const offers = createOffers({ fetchJson, newSource })
  const first = offers.offer({ item: VIEW.item, source: 'media:series:42' })
  await settled()
  assert.equal(offers.get().phase, 'ready')
  assert.equal(offers.get().view.balance, 77)
  offers.get().decline()
  assert.equal(await first, false)
  assert.equal(offers.get(), null)

  const second = offers.offer({ item: VIEW.item, source: 'media:series:42' })
  await settled()
  const dialog = offers.get()
  const pressed = dialog.buy()
  assert.equal(offers.get().phase, 'buying')
  dialog.buy()
  await pressed
  assert.equal(await second, true)
  assert.deepEqual(calls.filter(call => call[0] === 'api/points/buy'), [['api/points/buy', { item: VIEW.item, source: 'media:series:42' }]])
})

test('spent elsewhere meanwhile: the dialog shows the ledger\'s answer now instead of an error', async () => {
  const views = { [VIEW.item]: { ...VIEW } }
  const { fetchJson } = host(views, { buyError: { code: 'short', message: 'not enough points' } })
  const offers = createOffers({ fetchJson, newSource })
  const answer = offers.offer({ item: VIEW.item })
  await settled()
  views[VIEW.item] = { ...VIEW, balance: 10, gap: 20, affordable: false }
  await offers.get().buy()
  assert.deepEqual([offers.get().phase, offers.get().view.gap, offers.get().error], ['ready', 20, null])
  offers.get().decline()
  assert.equal(await answer, false)
})

test('offers wait their turn, and each gets its own source when none is given', async () => {
  const { fetchJson, calls } = host({ 'a:one': { ...VIEW, item: 'a:one' }, 'a:two': { ...VIEW, item: 'a:two' } })
  const offers = createOffers({ fetchJson, newSource })
  const one = offers.offer({ item: 'a:one' })
  const two = offers.offer({ item: 'a:two' })
  await settled()
  assert.equal(offers.get().request.item, 'a:one')
  await offers.get().buy()
  assert.equal(await one, true)
  await settled()
  assert.equal(offers.get().request.item, 'a:two')
  await offers.get().buy()
  assert.equal(await two, true)
  const bought = calls.filter(call => call[0] === 'api/points/buy').map(call => call[1].source)
  assert.equal(new Set(bought).size, 2)
  await assert.rejects(offers.offer({ item: 'no-namespace' }), TypeError)
})

test('a quote that fails shows why and answers false on OK', async () => {
  const offers = createOffers({ fetchJson: async () => { throw new Error('offline') }, newSource })
  const answer = offers.offer({ item: VIEW.item })
  await settled()
  assert.deepEqual([offers.get().phase, offers.get().error], ['failed', 'offline'])
  offers.get().decline()
  assert.equal(await answer, false)
})

test('texts are picked by exact tag, primary subtag, then English', () => {
  const name = { en: 'Binge night', fr: 'Nuit de marathon', 'zh-Hant': '通宵' }
  assert.equal(pickText(name, 'fr-CA'), 'Nuit de marathon')
  assert.equal(pickText(name, 'zh-TW'), '通宵')
  assert.equal(pickText(name, 'de'), 'Binge night')
  assert.equal(pickText('plain', 'fr'), 'plain')
})

test('every language file has every word the dialog uses, and nothing more', () => {
  const dir = new URL('../locale/', import.meta.url)
  const files = readdirSync(dir).filter(name => name.endsWith('.json'))
  assert.ok(files.length >= 2)
  const source = readFileSync(new URL('../src/client/dialog.js', import.meta.url), 'utf8')
  const used = new Set([...source.matchAll(/\bt\('([A-Za-z]+)'/g)].map(match => match[1]))
  for (const name of files) {
    const { meta, ui } = JSON.parse(readFileSync(new URL(name, dir), 'utf8'))
    assert.ok(meta.title && meta.description, `${name}: meta`)
    assert.deepEqual(new Set(Object.keys(ui)), used, `${name}: words`)
  }
})
