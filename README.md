# dsh-points

Spend earned points inside the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI. When an action in any plugin costs points (starting something new, an extra that's normally off), a dialog shows the price, your balance and what's left after, and buys it when you say yes. Saying no costs nothing.

The plugin keeps no points itself. It talks to a ledger you already run, a command that keeps the shop, the tickets and the balances ([ledger protocol](docs/ledger-protocol.md)), and reads every number from it when asked.

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add @soffits/dsh-points@latest
```

Restart `dsh web` afterwards. It adds one Host row, `points`. Each person spends their own points, so it needs a sign-in plugin that provides `requestIdentity`, such as [dsh-oidc](https://github.com/soffits/dsh-oidc); nobody signed in is never asked to pay.

## Configuration

Point the row at your ledger in your profile's `cordis.patch.yml`:

```yaml
- id: points
  config:
    command: [my-ledger, --data, ~/points]
```

| Option | Default | What it does |
| --- | --- | --- |
| `command` | `[]` | The ledger: a program and its fixed arguments. The plugin adds the verb (`check`, `buy`, ...). Empty means nothing costs points. |
| `env` | `{}` | Extra environment variables for the ledger command. |
| `timeoutSeconds` | `20` | How long one ledger call may take before it counts as failed. |

If the ledger fails, actions go through as if free and the DSH log says why: points never stop anyone using a plugin.

## Selling an extra from your plugin

Two calls: one on the server when the action happens, one in the page when it is refused.

On the Host, ask for a ticket at the moment of the action. Pass the item each time; it is added to the person's shop the first time, with your price as a default they can change.

```js
const NEW_SERIES = { key: 'media:new_series', name: { en: 'Start a new series', fr: 'Commencer une série' }, cost: 30 }

const points = ctx.get('points')            // undefined without this plugin: everything is free
const ticket = await points?.ticketFor(person, NEW_SERIES, { source: `media:series:${id}` })
// ...do the action...
await points?.use(person, ticket, `media:series:${id}`)
```

`ticketFor` resolves with the ticket, or `null` when nothing is owed (the person doesn't play, nobody is signed in, the ledger failed). Without a ticket it throws an error with `code: 'points'`, `status: 402` and `points: { item, source }`; send that to the page. `person` is the signed-in id from `requestIdentity`. `source` names this purchase, so a retry never buys twice.

Item fields: `key` (`<plugin>:<name>`), `name` and `about` (text or a `{ language: text }` map), `cost`, and optionally `uses` (`0` for any number while the ticket lasts), `validFor` (`90m`, `12h`, `7d`) and `until` (a local time such as `06:00`).

In the Web UI, offer it and repeat the action on a yes:

```js
ctx.inject(['points'], (scope) => { points = scope.points })

const answer = await doTheAction()
if (answer.error?.code === 'points' && await points?.offer(answer.error.points)) await doTheAction()
```

`offer({ item, source })` shows the dialog and resolves `true` once the item is bought (or was already held, or nothing is owed) and `false` on Not now. Add `@soffits/dsh-points` to your package's `dsh.client.inject` so it loads first.

## The dialog

DSH's own dialog, in the viewer's language (English and French; more languages are a file in `locale/`). It shows the item and what it is, the price, the person's points and what's left after buying. When they're short it says how many more they need and offers only OK; a ticket waiting for someone's approval says so. Escape is Not now.

## Development

```sh
npm install
npm run check   # syntax, and that client.js is built from src/client/
npm test        # offline: a fake ledger in test/fixtures/
npm run build   # rebuild client.js after changing src/client/ or locale/
```

Design notes are in [docs/decisions.md](docs/decisions.md).

## License

MIT
