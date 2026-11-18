# Decisions

## Where spending lives

- One plugin shows, confirms and performs every spend at the moment of an action. A plugin that sells an extra only says which action is one and asks; it keeps no price, balance, dialog or ledger connection of its own, so the ledger command is configured once and every offer looks and behaves the same.
- The rules (prices, caps, approvals, once per source) are the ledger's. This plugin passes the person's yes to the ledger's `buy` and shows what the ledger answers; it never decides affordability itself, and a buy the ledger refuses is shown as the ledger's current answer.
- Browsing the shop and buying ahead stay with whatever view of the ledger a person already uses (a dashboard card, a chat command). Those buy through the same ledger verbs, so there is no second rule set. A shop page of this plugin's own is in the queue, for setups with no such view.

## Plugin shape

- Client: `ctx.provide('points', { offer })` in the Web half, the way @soffits/dsh-ui-actions and @soffits/dsh-ui-kit share their pieces; consumers take it with `ctx.inject(['points'], ...)` and work without it.
- Host: a `points` service other Host plugins read with `ctx.get('points')` at the moment of the action, like `requestIdentity`, so a reload of either plugin never leaves a stale reference.
- A consumer passes its whole item with each `ticketFor` call instead of defining items once: nothing to redo after either plugin reloads, and a changed definition (a new night window) registers again on the next ask.
- The check runs on the Host at the action and answers 402 with `{ item, source }`; the page offers it and repeats the action. Checking only in the page would let any other caller skip it.
- A failing ledger never blocks the action: `ticketFor` logs and lets it through. The dialog's own routes do show the failure, since the person asked.
- The person is always the signed-in one (`requestIdentity`); the dialog's routes take no person from the page.

## The dialog

- DSH's own `Modal` and `Button` from `@deepseek-ai/dsh-client-ui-primitives`, rendered in the `shell.overlay` slot so it shows over any page. Escape and the mask are Not now; the Buy button is focused first.
- The quote is fetched when the dialog opens and shown only once it answers (a fraction of a second), so no empty dialog flashes; the item and price come from the ledger, never from the caller. No live subscription while it is open: it lives seconds and the buy itself re-checks.
- One offer at a time; offers asked for while one is open wait their turn.
- A purchase carries the caller's `source` so a double press buys once; without one, each offer makes its own.

## Prior art

- Momo (MIT, a task app for procrastination and ADHD, coins spent on a wishlist): the price sits on the Buy button, and an item out of reach says how many more are needed instead of showing an error. Taken as is.
- Habitica (GPL-3, ideas only): custom rewards bought with gold in one click. Not taken: there the person came to the shop to spend; here the offer interrupts an action, so it asks first, and saying no costs nothing.
- Both say what is left after buying or still to earn, never a warning tone for being short; the dialog does the same.
