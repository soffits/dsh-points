/**
 * The offer: one dialog at a time, asked for with `offer({ item, source })`.
 * It quotes the item from the Host (the ledger answers each time), shows the
 * price and the person's balance, and on Buy buys it there; the promise
 * resolves true when the action may go on (bought, already held, or nothing
 * owed) and false when the person says not now. Offers asked for while one is
 * open wait their turn.
 */

const KEY = /^[A-Za-z0-9_-]{1,40}:[A-Za-z0-9_.-]{1,80}$/

/** Pick a text for `language` from a string or a `{ tag: text }` map: exact tag, primary subtag, English, any. */
export function pickText(value, language = 'en') {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return ''
  const tags = Object.keys(value)
  const want = String(language).toLowerCase()
  const primary = want.split('-')[0]
  const found = tags.find(tag => tag.toLowerCase() === want)
    ?? tags.find(tag => tag.toLowerCase().split('-')[0] === primary)
    ?? tags.find(tag => tag.toLowerCase() === 'en')
    ?? tags[0]
  return typeof value[found] === 'string' ? value[found] : ''
}

/**
 * @param {{ fetchJson: (path: string, init?: object) => Promise<object>, newSource: () => string }} io
 *   fetchJson resolves with the JSON body or rejects with an Error carrying the server's message
 */
export function createOffers({ fetchJson, newSource }) {
  let current = null
  let queue = Promise.resolve()
  const listeners = new Set()
  const set = (next) => {
    current = next
    for (const listener of listeners) listener()
  }

  function show(request) {
    return new Promise((resolve) => {
      const finish = (answer) => {
        set(null)
        resolve(answer)
      }
      const dialog = { request, view: null, phase: 'loading', error: null }
      const update = change => set({ ...current, ...change })
      set({
        ...dialog,
        decline: () => finish(false),
        async buy() {
          if (current?.phase !== 'ready') return
          update({ phase: 'buying', error: null })
          try {
            const view = await fetchJson('api/points/buy', { method: 'POST', body: JSON.stringify(request) })
            if (view.plays === false || view.valid) finish(true)
            else update({ phase: 'ready', view })
          } catch (error) {
            // Spent or held elsewhere meanwhile: the ledger's answer now says how, in the dialog's own words.
            const view = error.code === 'short' || error.code === 'pending'
              ? await fetchJson(`api/points/quote?item=${encodeURIComponent(request.item)}`).catch(() => null)
              : null
            if (view !== null && (view.plays === false || view.valid)) finish(true)
            else update(view === null ? { phase: 'ready', error: error.message } : { phase: 'ready', view })
          }
        },
      })
      fetchJson(`api/points/quote?item=${encodeURIComponent(request.item)}`).then((view) => {
        if (view.plays === false || view.valid) finish(true)
        else update({ phase: 'ready', view })
      }, error => update({ phase: 'failed', error: error.message }))
    })
  }

  return {
    /**
     * Offer `item` (a shop key, `<plugin>:<name>`) at the moment of an action. `source` names the purchase
     * (`<plugin>:<id>`) so a repeated press buys once; without one, each offer is its own purchase.
     * @returns {Promise<boolean>} true when the action may go on
     */
    offer({ item, source } = {}) {
      if (typeof item !== 'string' || !KEY.test(item)) return Promise.reject(new TypeError(`offer needs an item key <plugin>:<name>, not ${JSON.stringify(item)}`))
      const request = { item, source: typeof source === 'string' && source !== '' ? source : newSource() }
      const turn = queue.then(() => show(request))
      queue = turn.catch(() => {})
      return turn
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    get: () => current,
  }
}
