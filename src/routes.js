/**
 * The dialog's two exact Fetch routes under DSH's `/api`, where DSH admits the
 * browser first and a `requestIdentity` provider says who is asking. The
 * person is always the one signed in; the page never names them.
 *
 *   GET  /api/points/quote?item=<key>        what the dialog shows: price, balance, gap, a held or waiting ticket
 *   POST /api/points/buy  { item, source }    buy it for them, once per source; answers the same view
 *
 * Nobody signed in, or a person who doesn't play, answers `{ plays: false }`.
 */
export const PATH = '/api/points'

const HEADERS = Object.freeze({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' })
const STATUS = Object.freeze({ invalid: 400, pending: 409, short: 409, ledger: 503 })

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8' } })

/** The signed-in person's stable id from the sign-in plugin, or '' for nobody. */
export function personOf(identity) {
  const current = typeof identity?.current === 'function' ? identity.current() : null
  return typeof current?.id === 'string' ? current.id : ''
}

/**
 * @param {{ points: () => object | undefined, identity: () => object | undefined, logger: { warn: Function } }} options
 */
export function createRoutes({ points, identity, logger }) {
  const handle = fn => async (request) => {
    const service = points()
    if (service === undefined) return json(503, { error: { code: 'unavailable', message: 'points are starting' } })
    try {
      return json(200, await fn(request, service, personOf(identity())))
    } catch (error) {
      if (error.code === 'ledger') logger.warn('points: %s', error.message)
      return json(error.status ?? STATUS[error.code] ?? 500, { error: { code: error.code ?? 'error', message: error.message } })
    }
  }

  return [
    {
      path: `${PATH}/quote`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: handle((request, service, person) => service.quote(person, new URL(request.url).searchParams.get('item') ?? '')),
    },
    {
      path: `${PATH}/buy`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: handle(async (request, service, person) => {
        let input
        try {
          input = await request.json()
        } catch {
          throw Object.assign(new Error('request body is not JSON'), { code: 'invalid' })
        }
        return service.buy(person, input?.item, input?.source)
      }),
    },
  ]
}
