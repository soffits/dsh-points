# Ledger protocol

The plugin keeps no points of its own. A ledger command keeps the shop, the tickets, the balances and who plays, and the plugin runs it with one verb at a time: the configured program and its fixed arguments, then the verb, its arguments and `--json`. The command prints one JSON document as the last line of stdout (anything before it is ignored), writes free text to stderr, and exits 0 on success; on failure, the last line of stderr is the message the plugin logs or shows.

`<person>` is the stable id the sign-in gives the person (an OpenID subject, say). A ledger that knows people by another id maps it itself. For a person who doesn't play, every verb answers `{"recorded": false}` and the plugin then asks nothing of them.

## shop register

```
<command> shop <person> register <item> --name <text> --cost <points> [--about <text>] [--uses N] [--valid-for <span>] [--until HH:MM] --json
```

Adds a plugin's item to the person's shop or updates its terms. `<item>` is `<plugin>:<name>`. `--name` and `--about` are plain text or a JSON `{ "<language tag>": "<text>" }` map. `--cost`, `--name` and `--about` are defaults: once the person changed one, or retired the item, that stays theirs. `--uses 0` means any number of uses while the ticket lasts; `--valid-for` (`90m`, `12h`, `7d`) and `--until` (a local time) bound how long a ticket lasts once first used.

## check

```
<command> check <person> <item> --json
```

```json
{ "item": "media:new_series", "valid": false, "ticket": null, "pending": false,
  "quote": { "name": { "en": "Start a new series" }, "about": "", "cost": 30, "balance": 77, "gap": 0, "affordable": true } }
```

`valid` with `ticket.id` when the person holds a usable ticket; `pending` when one waits for someone's approval; `quote` the price and balance now (`affordable` false over a spending cap too).

## buy

```
<command> buy <person> <item> --source <source> --json
```

Spends the points on a ticket. `--source` makes it once per source: the same call again returns the ticket already bought.

## use

```
<command> use <person> <ticket id> --source <source> --json
```

Records that a ticket was used, once per source.

`test/fixtures/ledger.mjs` is a small ledger over a JSON file that answers all four verbs, a starting point for writing one.
