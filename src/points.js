/**
 * The `points` Host service: what other plugins call at the moment of an
 * action that costs points, and what the plugin's own routes use for the
 * dialog. A plugin passes the extra it sells with each call; it is registered
 * in the person's shop the first time it is asked about for them, and again
 * when its definition changes (the ledger keeps a price or wording the person
 * changed). Every answer comes from the ledger when asked; nothing here keeps
 * a balance or a ticket.
 */

const KEY = /^[A-Za-z0-9_-]{1,40}:[A-Za-z0-9_.-]{1,80}$/
const SOURCE = /^[A-Za-z0-9_.:@/-]{1,200}$/
const TERMS = { uses: '--uses', validFor: '--valid-for', until: '--until' }

const invalid = message => Object.assign(new Error(message), { code: 'invalid', status: 400 })

/** Text a person reads: a string or a `{ tag: text }` map, passed to the ledger as JSON. */
function wordsArg(value) {
  if (typeof value === 'string') return value
  if (value !== null && typeof value === 'object' && Object.values(value).every(text => typeof text === 'string')) return JSON.stringify(value)
  throw invalid('an item\'s name and about are text or a { language: text } map')
}

/** An item a plugin sells, as the ledger's `shop register` arguments. */
function registerArgs(item) {
  if (!KEY.test(item?.key ?? '')) throw invalid(`an item key is <plugin>:<name>, not ${JSON.stringify(item?.key)}`)
  if (!Number.isInteger(item.cost) || item.cost < 0) throw invalid(`${item.key}: cost is a whole number of points`)
  const args = ['--name', wordsArg(item.name), '--cost', String(item.cost)]
  if (item.about !== undefined) args.push('--about', wordsArg(item.about))
  for (const [term, flag] of Object.entries(TERMS)) if (item[term] !== undefined && item[term] !== null) args.push(flag, String(item[term]))
  return args
}

export const validKey = key => typeof key === 'string' && KEY.test(key)
export const validSource = source => typeof source === 'string' && SOURCE.test(source)

/** What the dialog shows: the item, its price, the person's balance and whether a ticket is held or waiting. */
function view(answer) {
  const quote = answer.quote ?? {}
  return {
    plays: true,
    item: answer.item,
    valid: answer.valid === true,
    pending: answer.pending === true,
    name: quote.name ?? answer.item,
    about: quote.about ?? '',
    cost: quote.cost,
    balance: quote.balance,
    gap: quote.gap,
    affordable: quote.affordable === true,
  }
}

/**
 * @param {{ ledger: { enabled: boolean, ask: (args: string[]) => Promise<object> }, logger: { warn: Function } }} options
 */
export function createPoints({ ledger, logger }) {
  /** person -> key -> the arguments last registered, so a changed definition registers again. */
  const registered = new Map()

  async function register(person, item) {
    const args = registerArgs(item)
    const signature = JSON.stringify(args)
    const mine = registered.get(person) ?? new Map()
    if (mine.get(item.key) === signature) return true
    const answer = await ledger.ask(['shop', person, 'register', item.key, ...args])
    if (answer.recorded === false) return false
    mine.set(item.key, signature)
    registered.set(person, mine)
    return true
  }

  /**
   * The ledger's `check` for `key`, registering `item` first when given; null for a person who doesn't play.
   * @param {string} person @param {string} key @param {object} [item]
   */
  async function check(person, key, item) {
    if (!ledger.enabled || typeof person !== 'string' || person === '') return null
    if (!validKey(key)) throw invalid(`unknown item ${JSON.stringify(key)}`)
    if (item !== undefined && !(await register(person, item))) return null
    const answer = await ledger.ask(['check', person, key])
    return answer.recorded === false ? null : answer
  }

  return Object.freeze({
    /** Whether a ledger is configured at all. */
    get enabled() { return ledger.enabled },

    /**
     * At the moment of an action: the ticket the person holds for `item`, or null when nothing is owed (they don't
     * play, nobody is signed in, or the ledger fails, which never blocks the action). Without a ticket it throws
     * a `points` error (status 402) whose `points` is `{ item: key, source }`: the page offers the item with the
     * client's `offer` and repeats the action after a yes.
     *
     * `item` is the extra the calling plugin sells, `{ key: '<plugin>:<name>', name, about?, cost, uses?,
     * validFor?, until? }` with `name` and `about` as text or a `{ language: text }` map; the cost is a default
     * the person may change in their shop. `source` names this purchase (`<plugin>:<id>`): one per source.
     */
    async ticketFor(person, item, { source }) {
      registerArgs(item)
      if (!validSource(source)) throw invalid(`a purchase source is <plugin>:<id>, not ${JSON.stringify(source)}`)
      const key = item.key
      let answer
      try {
        answer = await check(person, key, item)
      } catch (error) {
        if (error.code === 'invalid') throw error
        logger.warn('points: %s', error.message)
        return null
      }
      if (answer === null) return null
      if (answer.valid) return { ticket: answer.ticket.id }
      throw Object.assign(new Error(`${key} needs a ticket`), { code: 'points', status: 402, points: { item: key, source } })
    },

    /** Record that the action went through: once per `source`, so a retry counts once. Failures are logged. */
    async use(person, ticket, source) {
      if (ticket === null || ticket === undefined) return
      await ledger.ask(['use', person, ticket.ticket ?? ticket, '--source', source]).catch(error => logger.warn('points: %s', error.message))
    },

    /** What the dialog shows for `key`, or `{ plays: false }`. */
    async quote(person, key) {
      const answer = await check(person, key)
      return answer === null ? { plays: false } : view(answer)
    },

    /** Buy `key` for the person, once per `source`; answers the dialog's view after it. */
    async buy(person, key, source) {
      if (!validSource(source)) throw invalid('a purchase needs its source')
      const before = await check(person, key)
      if (before === null) return { plays: false }
      if (!before.valid) {
        if (before.pending) throw Object.assign(new Error('a ticket for this is waiting for approval'), { code: 'pending', status: 409 })
        if (!before.quote?.affordable) throw Object.assign(new Error('not enough points'), { code: 'short', status: 409 })
        await ledger.ask(['buy', person, key, '--source', source])
      }
      return view(await ledger.ask(['check', person, key]))
    },
  })
}
