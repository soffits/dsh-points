import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createLedger } from '../src/ledger.js'
import { createPoints } from '../src/points.js'
import { createRoutes } from '../src/routes.js'

const SERIES = Object.freeze({ key: 'media:new_series', name: { en: 'Start a new series', fr: 'Commencer une série' }, about: 'Going on with one stays free', cost: 30 })
const NIGHT = Object.freeze({ key: 'media:binge_night', name: 'Binge night', cost: 40, uses: 0, until: '06:00' })

/** A ledger over a state file (test/fixtures/ledger.mjs): `players` maps a person to their balance. */
function fixture(t, players, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-points-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'ledger.json')
  writeFileSync(file, JSON.stringify({ players, shop: {}, tickets: [], calls: [], ...extra }))
  const command = [process.execPath, fileURLToPath(new URL('./fixtures/ledger.mjs', import.meta.url)), file]
  const warnings = []
  const points = createPoints({ ledger: createLedger({ command }), logger: { warn: (...args) => warnings.push(args) } })
  return {
    points,
    warnings,
    state: () => JSON.parse(readFileSync(file, 'utf8')),
    set: (change) => writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), ...change })),
  }
}

const verbs = state => state.calls.map(call => call[0])

test('without a ledger command nothing costs points', async () => {
  const points = createPoints({ ledger: createLedger({ command: [] }), logger: { warn() {} } })
  assert.equal(points.enabled, false)
  assert.equal(await points.ticketFor('ann', SERIES, { source: 'media:series:1' }), null)
  assert.deepEqual(await points.quote('ann', SERIES.key), { plays: false })
})

test('an action without a ticket asks for one; after buying, the ticket lets it through and its use is recorded', async (t) => {
  const { points, state } = fixture(t, { ann: 45 })
  await assert.rejects(points.ticketFor('ann', SERIES, { source: 'media:series:1' }), (error) => {
    assert.equal(error.code, 'points')
    assert.equal(error.status, 402)
    assert.deepEqual(error.points, { item: SERIES.key, source: 'media:series:1' })
    return true
  })
  assert.deepEqual(state().shop[SERIES.key].name, SERIES.name, 'registered with its language map')

  const view = await points.quote('ann', SERIES.key)
  assert.deepEqual(view, { plays: true, item: SERIES.key, valid: false, pending: false, name: SERIES.name, about: SERIES.about,
    cost: 30, balance: 45, gap: 0, affordable: true })

  const bought = await points.buy('ann', SERIES.key, 'media:series:1')
  assert.equal(bought.valid, true)
  assert.equal(bought.balance, 15)
  assert.equal((await points.buy('ann', SERIES.key, 'media:series:1')).balance, 15, 'a second press buys nothing more')

  const ticket = await points.ticketFor('ann', SERIES, { source: 'media:series:1' })
  assert.deepEqual(ticket, { ticket: 't1' })
  await points.use('ann', ticket, 'media:series:1')
  assert.equal(state().tickets[0].used, 'media:series:1')
  assert.equal(verbs(state()).filter(verb => verb === 'shop').length, 1, 'registered once per person while its definition stays')
})

test('a changed definition registers again; a price the person set stays theirs', async (t) => {
  const { points, state, set } = fixture(t, { ann: 100 })
  await points.ticketFor('ann', NIGHT, { source: 'media:binge:2026-11-17' }).catch(() => {})
  set({ shop: { [NIGHT.key]: { ...state().shop[NIGHT.key], cost: 25 } } })
  await points.ticketFor('ann', { ...NIGHT, until: '05:00' }, { source: 'media:binge:2026-11-17' }).catch(() => {})
  assert.equal(verbs(state()).filter(verb => verb === 'shop').length, 2)
  assert.equal(state().shop[NIGHT.key].until, '05:00')
  assert.equal((await points.quote('ann', NIGHT.key)).cost, 25)
})

test('short of points or waiting for approval: the quote says so and buying refuses', async (t) => {
  const { points, state } = fixture(t, { ann: 10, bo: 99 }, { pending: { bo: [SERIES.key] } })
  await points.ticketFor('ann', SERIES, { source: 'media:series:1' }).catch(() => {})
  const short = await points.quote('ann', SERIES.key)
  assert.equal(short.affordable, false)
  assert.equal(short.gap, 20)
  await assert.rejects(points.buy('ann', SERIES.key, 'media:series:1'), error => error.code === 'short' && error.status === 409)
  await points.ticketFor('bo', SERIES, { source: 'media:series:1' }).catch(() => {})
  assert.equal((await points.quote('bo', SERIES.key)).pending, true)
  await assert.rejects(points.buy('bo', SERIES.key, 'media:series:1'), error => error.code === 'pending')
  assert.equal(verbs(state()).includes('buy'), false)
})

test('nobody signed in, or someone who does not play, owes nothing and is never registered', async (t) => {
  const { points, state } = fixture(t, { ann: 45 })
  assert.equal(await points.ticketFor('', SERIES, { source: 'media:series:1' }), null)
  assert.equal(await points.ticketFor('stranger', SERIES, { source: 'media:series:1' }), null)
  assert.deepEqual(await points.quote('stranger', SERIES.key), { plays: false })
  assert.deepEqual(await points.buy('stranger', SERIES.key, 'media:series:1'), { plays: false })
  assert.deepEqual(state().shop, {})
})

test('a failing ledger never blocks an action, and says why in the log', async (t) => {
  const { points, warnings } = fixture(t, { ann: 45 }, { fail: true })
  assert.equal(await points.ticketFor('ann', SERIES, { source: 'media:series:1' }), null)
  assert.match(warnings[0].join(' '), /ledger is broken/)
  await assert.rejects(points.quote('ann', SERIES.key), error => error.code === 'ledger' && /ledger is broken/.test(error.message))
})

test('items and sources are checked before anything runs', async (t) => {
  const { points, state } = fixture(t, { ann: 45 })
  await assert.rejects(points.ticketFor('ann', { ...SERIES, key: 'no-namespace' }, { source: 'media:x' }), error => error.code === 'invalid')
  await assert.rejects(points.ticketFor('ann', { ...SERIES, cost: -1 }, { source: 'media:x' }), error => error.code === 'invalid')
  await assert.rejects(points.ticketFor('ann', { ...SERIES, name: { en: 3 } }, { source: 'media:x' }), error => error.code === 'invalid')
  await assert.rejects(points.ticketFor('ann', SERIES, { source: 'has space' }), error => error.code === 'invalid')
  await assert.rejects(points.buy('ann', '--data', 'media:x'), error => error.code === 'invalid')
  assert.deepEqual(state().calls, [])
})

test('the routes act for the signed-in person only', async (t) => {
  const { points, state } = fixture(t, { 'sub-ann': 45 })
  await points.ticketFor('sub-ann', SERIES, { source: 'media:series:1' }).catch(() => {})
  let who = { id: 'sub-ann' }
  const [quote, buy] = createRoutes({ points: () => points, identity: () => ({ current: () => who }), logger: { warn() {} } })
  const get = async () => (await quote.fetch(new Request(`http://dsh.test/api/points/quote?item=${SERIES.key}`))).json()
  const post = body => buy.fetch(new Request('http://dsh.test/api/points/buy', { method: 'POST', body }))

  assert.equal((await get()).balance, 45)
  const answer = await post(JSON.stringify({ item: SERIES.key, source: 'media:series:1', person: 'someone-else' }))
  assert.equal(answer.status, 200)
  assert.equal((await answer.json()).balance, 15)
  assert.equal(state().tickets[0].person, 'sub-ann')
  assert.equal((await post('not json')).status, 400)
  const short = await post(JSON.stringify({ item: SERIES.key, source: 'media:series:2' }))
  assert.equal(short.status, 200, 'a ticket is already held, so nothing more is bought')

  who = null
  assert.deepEqual(await get(), { plays: false })
  const [unavailable] = createRoutes({ points: () => undefined, identity: () => undefined, logger: { warn() {} } })
  assert.equal((await unavailable.fetch(new Request('http://dsh.test/api/points/quote?item=a:b'))).status, 503)
})
