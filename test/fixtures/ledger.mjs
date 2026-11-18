#!/usr/bin/env node
/**
 * A ledger for tests (docs/ledger-protocol.md): `ledger.mjs <state.json> <verb...> --json`.
 * The state file holds `players` (person -> balance), the `shop`, `tickets`, `pending` (person -> item keys
 * waiting for approval), `fail` and every call in `calls`.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [file, ...argv] = process.argv.slice(2)
const state = JSON.parse(readFileSync(file, 'utf8'))
const args = argv.filter(arg => arg !== '--json')
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const words = value => (value?.startsWith('{') ? JSON.parse(value) : value)
state.calls.push(args)
const save = () => writeFileSync(file, JSON.stringify(state))
const answer = (value) => { save(); process.stdout.write(`some chatter first\n${JSON.stringify(value)}\n`) }
const fail = (message) => { save(); process.stderr.write(`error: ${message}\n`); process.exit(2) }

const [verb, person] = args
if (state.fail) fail('ledger is broken')
if (!(person in state.players)) answer({ recorded: false, reason: 'points game off' })
else if (verb === 'shop') {
  const key = args[3]
  state.shop[key] = { ...state.shop[key], name: words(option('--name')), about: words(option('--about')), uses: option('--uses'), until: option('--until') }
  state.shop[key].cost ??= Number(option('--cost'))
  answer({ changed: true, item: { key, ...state.shop[key] } })
} else {
  const key = args[2]
  const mine = state.tickets.filter(t => t.person === person)
  const item = state.shop[key]
  if (verb !== 'use' && item === undefined) fail(`no active shop item ${key}`)
  const quote = () => ({ item: key, name: item.name, about: item.about ?? '', cost: item.cost, balance: state.players[person],
    gap: Math.max(0, item.cost - state.players[person]), affordable: item.cost <= state.players[person] })
  if (verb === 'check') {
    const held = mine.find(t => t.item === key && !t.used)
    answer({ item: key, valid: Boolean(held), ticket: held ? { id: held.id } : null, pending: (state.pending?.[person] ?? []).includes(key), quote: quote() })
  } else if (verb === 'buy') {
    const earlier = mine.find(t => t.source === option('--source'))
    if (earlier) answer({ bought: false, ticket: earlier })
    else {
      if (item.cost > state.players[person]) fail('not enough points')
      state.players[person] -= item.cost
      const ticket = { id: `t${state.tickets.length + 1}`, person, item: key, source: option('--source'), used: false }
      state.tickets.push(ticket)
      answer({ bought: true, ticket })
    }
  } else if (verb === 'use') {
    const ticket = mine.find(t => t.id === key)
    if (state.shop[ticket.item].uses !== '0') ticket.used = option('--source')
    answer({ used: true, ticket })
  }
}
