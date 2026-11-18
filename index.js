/**
 * DeepSeek Harness Host plugin: spending points.
 *
 * Provides the `points` service (src/points.js) other Host plugins call at
 * the moment of an action that costs points, and the two Fetch routes the
 * Web UI's dialog uses (src/routes.js). Every number comes from the ledger
 * command (docs/ledger-protocol.md) when it is asked; nothing is copied.
 */
import z from '@deepseek-ai/schemastery'
import { createLedger } from './src/ledger.js'
import { createPoints } from './src/points.js'
import { createRoutes } from './src/routes.js'

export const name = 'dsh-points'
export const inject = ['connection']

export const Config = z.object({
  command: z.array(z.string()).default([])
    .description('The points ledger: a program and its fixed arguments speaking the ledger protocol (docs/ledger-protocol.md); the plugin adds the verb. Empty means nothing costs points.'),
  env: z.dict(z.string()).default({})
    .description('Extra environment variables for the ledger command.'),
  timeoutSeconds: z.natural().min(1).max(120).default(20)
    .description('How long one ledger call may take before it counts as failed.'),
})

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {z.infer<typeof Config>} config
 */
export function apply(ctx, config) {
  const logger = ctx.logger('points')
  const points = createPoints({ ledger: createLedger(config), logger })
  ctx.provide?.('points', points)

  ctx.effect(() => {
    const routes = createRoutes({ points: () => points, identity: () => ctx.get('requestIdentity'), logger })
      .map(route => ctx.connection.fetch.register(route))
    return async () => { await Promise.all(routes.map(dispose => dispose())) }
  }, 'points.routes()')
}
