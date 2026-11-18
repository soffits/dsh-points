/**
 * The offer as a DSH dialog: the item and what it is, a small receipt (price,
 * the person's points, what is left after buying or still to earn), and Not
 * now / Buy. Short of points or waiting for approval, it says so and offers
 * only OK. Escape and the mask are Not now.
 */
import { createElement as h, useSyncExternalStore } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { pickText } from './offer.js'

export const STYLE = `
.dp-receipt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0 0}
.dp-cell{display:flex;flex-direction:column;gap:2px;min-width:0;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-interactive-bg-hover))}
.dp-label{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dp-value{color:var(--dsw-alias-label-primary);font-size:20px;line-height:28px;font-weight:600;font-variant-numeric:tabular-nums}
.dp-value[data-tone=short]{color:var(--dsw-alias-state-warn-label,var(--dsw-alias-state-warn-primary))}
.dp-note{margin:12px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dp-error{margin:12px 0 0;color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.dp-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;width:100%}
.dp-footer>*{white-space:nowrap}
@media (width<=640px),(pointer:coarse){.dp-footer>*{flex:1 1 0;min-height:44px}}
`

/**
 * @param {{ offers: ReturnType<import('./offer.js').createOffers>, t: Function, useLanguage: () => string }} deps
 */
export function createDialog({ offers, t, useLanguage }) {
  function Cell({ label, value, tone }) {
    return h('div', { className: 'dp-cell' },
      h('span', { className: 'dp-label' }, label),
      h('span', { className: 'dp-value', 'data-tone': tone }, value))
  }

  return function OfferDialog() {
    const dialog = useSyncExternalStore(offers.subscribe, offers.get)
    const language = useLanguage()
    if (dialog === null || dialog.phase === 'loading') return null
    const number = new Intl.NumberFormat(language)
    const { view, phase, error } = dialog
    const title = view ? pickText(view.name, language) || view.item : t('title')
    const about = view ? pickText(view.about, language) : ''
    const canBuy = view !== null && view.affordable && !view.pending
    const buying = phase === 'buying'

    const receipt = view && h('div', { className: 'dp-receipt' },
      h(Cell, { label: t('price'), value: number.format(view.cost) }),
      h(Cell, { label: t('balance'), value: number.format(view.balance) }),
      view.affordable
        ? h(Cell, { label: t('after'), value: number.format(view.balance - view.cost) })
        : h(Cell, { label: t('toEarn'), value: number.format(view.gap), tone: 'short' }))
    const note = view?.pending ? t('pending') : view && !view.affordable ? t('short') : null

    const footer = h('div', { className: 'dp-footer' }, canBuy
      ? [h(Button, { key: 'no', variant: 'outline', disabled: buying, onClick: dialog.decline }, t('notNow')),
         h(Button, { key: 'yes', variant: 'primary', disabled: buying, 'data-modal-autofocus': true, onClick: dialog.buy },
           buying ? t('buying') : t('buy', { cost: number.format(view.cost) }))]
      : h(Button, { variant: 'primary', 'data-modal-autofocus': true, onClick: dialog.decline }, t('ok')))

    return h(Modal, { open: true, onClose: () => { if (!buying) dialog.decline() }, title, description: about || undefined, closeLabel: t('close'), footer, shortcutModal: 'points-offer' },
      receipt,
      note && h('p', { className: 'dp-note' }, note),
      phase === 'failed' && h('p', { className: 'dp-error', role: 'alert' }, t('loadFailed', { message: error })),
      phase !== 'failed' && error && h('p', { className: 'dp-error', role: 'alert' }, t('failed', { message: error })))
  }
}
