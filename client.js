/* @soffits/dsh-points 0.1.1: built by scripts/build.mjs from src/client/ and locale/. Do not edit. */
window.__ModuleLoader__.load({
  id: "@soffits/dsh-points",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");

// locales:locales
var locales_default = { "en": { "meta": { "title": "Points", "description": "Spend earned points where you are: when something costs points, a dialog shows the price and your balance and buys it on a yes." }, "ui": { "title": "Spend points", "price": "Price", "balance": "Your points", "after": "Left after", "toEarn": "Still to earn", "buy": "Buy for {cost}", "buying": "Buying\u2026", "notNow": "Not now", "ok": "OK", "close": "Close", "pending": "A ticket for this is waiting for approval.", "short": "Not enough points yet. Finishing things earns more.", "failed": "That didn\u2019t go through: {message}", "loadFailed": "Couldn\u2019t check your points: {message}" } }, "fr": { "meta": { "title": "Points", "description": "D\xE9pensez vos points l\xE0 o\xF9 vous \xEAtes : quand quelque chose co\xFBte des points, une fen\xEAtre montre le prix et votre solde, et l\u2019ach\xE8te si vous dites oui." }, "ui": { "title": "D\xE9penser des points", "price": "Prix", "balance": "Vos points", "after": "Apr\xE8s l\u2019achat", "toEarn": "Encore \xE0 gagner", "buy": "Acheter pour {cost}", "buying": "Achat\u2026", "notNow": "Pas maintenant", "ok": "OK", "close": "Fermer", "pending": "Un ticket pour ceci attend une validation.", "short": "Pas encore assez de points. Chaque chose termin\xE9e en rapporte.", "failed": "L\u2019achat n\u2019a pas abouti : {message}", "loadFailed": "Impossible de v\xE9rifier vos points : {message}" } }, "zh": { "meta": { "title": "\u79EF\u5206", "description": "\u5728\u7528\u5230\u7684\u5730\u65B9\u82B1\u79EF\u5206\uFF1A\u9700\u8981\u79EF\u5206\u7684\u65F6\u5019\uFF0C\u5F39\u7A97\u663E\u793A\u4EF7\u683C\u548C\u4F59\u989D\uFF0C\u70B9\u5151\u6362\u5C31\u4E70\u597D\u3002" }, "ui": { "title": "\u82B1\u79EF\u5206", "price": "\u4EF7\u683C", "balance": "\u4F60\u7684\u79EF\u5206", "after": "\u5151\u6362\u540E\u5269", "toEarn": "\u8FD8\u5DEE", "buy": "\u7528 {cost} \u5206\u5151\u6362", "buying": "\u5151\u6362\u4E2D\u2026", "notNow": "\u5148\u4E0D\u4E86", "ok": "\u597D", "close": "\u5173\u95ED", "pending": "\u8FD9\u4E2A\u7684\u5151\u6362\u5238\u8FD8\u5728\u7B49\u6279\u51C6\u3002", "short": "\u79EF\u5206\u8FD8\u4E0D\u591F\uFF0C\u505A\u5B8C\u7684\u4E8B\u90FD\u4F1A\u6512\u5206\u3002", "failed": "\u6CA1\u6709\u6210\u529F\uFF1A{message}", "loadFailed": "\u67E5\u4E0D\u5230\u79EF\u5206\uFF1A{message}" } } };

// src/client/dialog.js
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/offer.js
var KEY = /^[A-Za-z0-9_-]{1,40}:[A-Za-z0-9_.-]{1,80}$/;
function pickText(value, language = "en") {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return "";
  const tags = Object.keys(value);
  const want = String(language).toLowerCase();
  const primary = want.split("-")[0];
  const found = tags.find((tag) => tag.toLowerCase() === want) ?? tags.find((tag) => tag.toLowerCase().split("-")[0] === primary) ?? tags.find((tag) => tag.toLowerCase() === "en") ?? tags[0];
  return typeof value[found] === "string" ? value[found] : "";
}
function createOffers({ fetchJson: fetchJson2, newSource }) {
  let current = null;
  let queue = Promise.resolve();
  const listeners = /* @__PURE__ */ new Set();
  const set = (next) => {
    current = next;
    for (const listener of listeners) listener();
  };
  function show(request) {
    return new Promise((resolve) => {
      const finish = (answer) => {
        set(null);
        resolve(answer);
      };
      const dialog = { request, view: null, phase: "loading", error: null };
      const update = (change) => set({ ...current, ...change });
      set({
        ...dialog,
        decline: () => finish(false),
        async buy() {
          if (current?.phase !== "ready") return;
          update({ phase: "buying", error: null });
          try {
            const view = await fetchJson2("api/points/buy", { method: "POST", body: JSON.stringify(request) });
            if (view.plays === false || view.valid) finish(true);
            else update({ phase: "ready", view });
          } catch (error) {
            const view = error.code === "short" || error.code === "pending" ? await fetchJson2(`api/points/quote?item=${encodeURIComponent(request.item)}`).catch(() => null) : null;
            if (view !== null && (view.plays === false || view.valid)) finish(true);
            else update(view === null ? { phase: "ready", error: error.message } : { phase: "ready", view });
          }
        }
      });
      fetchJson2(`api/points/quote?item=${encodeURIComponent(request.item)}`).then((view) => {
        if (view.plays === false || view.valid) finish(true);
        else update({ phase: "ready", view });
      }, (error) => update({ phase: "failed", error: error.message }));
    });
  }
  return {
    /**
     * Offer `item` (a shop key, `<plugin>:<name>`) at the moment of an action. `source` names the purchase
     * (`<plugin>:<id>`) so a repeated press buys once; without one, each offer is its own purchase.
     * @returns {Promise<boolean>} true when the action may go on
     */
    offer({ item, source } = {}) {
      if (typeof item !== "string" || !KEY.test(item)) return Promise.reject(new TypeError(`offer needs an item key <plugin>:<name>, not ${JSON.stringify(item)}`));
      const request = { item, source: typeof source === "string" && source !== "" ? source : newSource() };
      const turn = queue.then(() => show(request));
      queue = turn.catch(() => {
      });
      return turn;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => current
  };
}

// src/client/dialog.js
var STYLE = `
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
`;
function createDialog({ offers, t, useLanguage }) {
  function Cell({ label, value, tone }) {
    return (0, import_react.createElement)(
      "div",
      { className: "dp-cell" },
      (0, import_react.createElement)("span", { className: "dp-label" }, label),
      (0, import_react.createElement)("span", { className: "dp-value", "data-tone": tone }, value)
    );
  }
  return function OfferDialog() {
    const dialog = (0, import_react.useSyncExternalStore)(offers.subscribe, offers.get);
    const language = useLanguage();
    if (dialog === null || dialog.phase === "loading") return null;
    const number = new Intl.NumberFormat(language);
    const { view, phase, error } = dialog;
    const title = view ? pickText(view.name, language) || view.item : t("title");
    const about = view ? pickText(view.about, language) : "";
    const canBuy = view !== null && view.affordable && !view.pending;
    const buying = phase === "buying";
    const receipt = view && (0, import_react.createElement)(
      "div",
      { className: "dp-receipt" },
      (0, import_react.createElement)(Cell, { label: t("price"), value: number.format(view.cost) }),
      (0, import_react.createElement)(Cell, { label: t("balance"), value: number.format(view.balance) }),
      view.affordable ? (0, import_react.createElement)(Cell, { label: t("after"), value: number.format(view.balance - view.cost) }) : (0, import_react.createElement)(Cell, { label: t("toEarn"), value: number.format(view.gap), tone: "short" })
    );
    const note = view?.pending ? t("pending") : view && !view.affordable ? t("short") : null;
    const footer = (0, import_react.createElement)("div", { className: "dp-footer" }, canBuy ? [
      (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { key: "no", variant: "outline", disabled: buying, onClick: dialog.decline }, t("notNow")),
      (0, import_react.createElement)(
        import_dsh_client_ui_primitives.Button,
        { key: "yes", variant: "primary", disabled: buying, "data-modal-autofocus": true, onClick: dialog.buy },
        buying ? t("buying") : t("buy", { cost: number.format(view.cost) })
      )
    ] : (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { variant: "primary", "data-modal-autofocus": true, onClick: dialog.decline }, t("ok")));
    return (0, import_react.createElement)(
      import_dsh_client_ui_primitives.Modal,
      { open: true, onClose: () => {
        if (!buying) dialog.decline();
      }, title, description: about || void 0, closeLabel: t("close"), footer, shortcutModal: "points-offer" },
      receipt,
      note && (0, import_react.createElement)("p", { className: "dp-note" }, note),
      phase === "failed" && (0, import_react.createElement)("p", { className: "dp-error", role: "alert" }, t("loadFailed", { message: error })),
      phase !== "failed" && error && (0, import_react.createElement)("p", { className: "dp-error", role: "alert" }, t("failed", { message: error }))
    );
  };
}

// src/client/index.js
var NS = "dsh-points";
var name = "points";
var inject = ["slots", "locale"];
async function fetchJson(path, init = {}) {
  const response = await fetch(new URL(path, document.baseURI), { ...init, headers: { "content-type": "application/json" }, credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(body?.error?.message ?? `HTTP ${response.status}`), { code: body?.error?.code });
  return body;
}
function apply(ctx) {
  ctx.effect(() => {
    const disposers = [];
    for (const [tag, file] of Object.entries(locales_default)) {
      try {
        disposers.push(ctx.locale.register(NS, tag, file.ui));
      } catch (error) {
        console.warn(`dsh-points: no ${tag} words`, error);
      }
    }
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "points: words");
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "@soffits/dsh-points";
    style.textContent = STYLE;
    document.head.appendChild(style);
    return () => style.remove();
  }, "points: styles");
  const t = ctx.locale.bind(NS);
  const useLanguage = () => {
    const subscribe = (0, import_react2.useCallback)((listener) => ctx.locale.subscribe(listener), []);
    return (0, import_react2.useSyncExternalStore)(subscribe, () => ctx.locale.getSnapshot().active);
  };
  const offers = createOffers({ fetchJson, newSource: () => `points:${crypto.randomUUID()}` });
  const OfferDialog = createDialog({ offers, t, useLanguage });
  ctx.provide("points", Object.freeze({ offer: offers.offer }));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "points.offer", locale: NS }, OfferDialog));
}

    return module.exports
  },
})
