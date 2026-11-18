/**
 * Web half of @soffits/dsh-points: provides `ctx.points` to other plugins'
 * Web halves and draws the offer dialog in the shell's overlay.
 *
 *   const yes = await ctx.points.offer({ item: 'media:new_series', source: 'media:series:42' })
 *
 * Words come from locale/<tag>.json (bundled by scripts/build.mjs); no text a
 * person reads is in code.
 */
import { useCallback, useSyncExternalStore } from 'react'
import locales from 'virtual:locales'
import { STYLE, createDialog } from './dialog.js'
import { createOffers } from './offer.js'

export const NS = 'dsh-points'
export const name = 'points'
export const inject = ['slots', 'locale']

/** JSON from one of the Host's routes; a failure rejects with the server's message and code. */
async function fetchJson(path, init = {}) {
  const response = await fetch(new URL(path, document.baseURI), { ...init, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw Object.assign(new Error(body?.error?.message ?? `HTTP ${response.status}`), { code: body?.error?.code })
  return body
}

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = []
    for (const [tag, file] of Object.entries(locales)) {
      try {
        disposers.push(ctx.locale.register(NS, tag, file.ui))
      } catch (error) {
        console.warn(`dsh-points: no ${tag} words`, error)
      }
    }
    return () => { for (const dispose of disposers) dispose() }
  }, 'points: words')

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = '@soffits/dsh-points'
    style.textContent = STYLE
    document.head.appendChild(style)
    return () => style.remove()
  }, 'points: styles')

  const t = ctx.locale.bind(NS)
  const useLanguage = () => {
    const subscribe = useCallback(listener => ctx.locale.subscribe(listener), [])
    return useSyncExternalStore(subscribe, () => ctx.locale.getSnapshot().active)
  }
  const offers = createOffers({ fetchJson, newSource: () => `points:${crypto.randomUUID()}` })
  const OfferDialog = createDialog({ offers, t, useLanguage })

  ctx.provide('points', Object.freeze({ offer: offers.offer }))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'points.offer', locale: NS }, OfferDialog))
}
