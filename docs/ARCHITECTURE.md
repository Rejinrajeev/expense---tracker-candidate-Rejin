# Architecture

SpendWise is a MERN application in three layers: an Express/MongoDB API, a React
front end, and a **shared domain layer** that both of them import.

## The idea that shapes the repo

> **Business rules live in `shared/`, once. The server and the client both
> import them, so neither can drift from the other.**

A validation rule is not written twice. `shared/validation.js` is called by the
React form for instant feedback *and* by the Express controller before anything
reaches MongoDB. A request made with `curl` is held to exactly the same rules as
one made through the UI, and a reviewer cannot bypass a limit by skipping the
front end.

That layer is pure functions with no database, no DOM and no Express, which is
the reason it is the part covered by unit tests.

## Layout

```
shared/        ← rules and maths. No DOM, no Mongoose, no Express.
server/        ← HTTP and persistence.      imports shared/
client/        ← rendering and interaction. imports shared/
tests/         ← unit tests for shared/
```

### shared/

| File | Responsibility |
| --- | --- |
| `validation.js` | Field rules, their messages, normalisation, duplicate detection |
| `insights.js` | Chart aggregation, totals, budget maths and thresholds |
| `filters.js` | Filtering, sorting, reconciling stale filters |
| `merge.js` | Deciding which rows of a backup to insert |
| `serializer.js` | CSV export, JSON backup, import parsing |
| `categories.js` | The category catalogue, including the schema's enum |
| `utils.js` | Currency, dates, month keys, money rounding |

### server/ — MVC on the back end

- **Models** (`models/*.model.js`) are Mongoose schemas. Their constraints
  mirror `shared/validation.js` as a backstop that applies even to writes made
  outside the API.
- **Controllers** (`controllers/*.controller.js`) validate with the shared rules,
  talk to the models and shape the response. They hold no rules of their own —
  the import logic, for example, was moved into `shared/merge.js` precisely so it
  could be tested without a database.
- **Routes** (`routes/index.js`) are a flat, readable list of the API surface.
- **Middleware** (`middleware/error-handler.js`) is the single place a thrown
  error becomes JSON, including reshaping a Mongoose `ValidationError` into the
  same `{ field: message }` the shared validators produce.

### client/ — the same separation, React-shaped

- **`api/client.js`** is the only module that calls `fetch`. It throws `ApiError`
  carrying the server's message and its per-field errors.
- **`hooks/useTransactions.js`** is the controller: it owns the transaction list
  and the budget, and is the only thing that performs API writes. Components
  receive data plus the actions they may take.
- **`components/*.jsx`** are views. They render and capture events; they do not
  fetch.
- **`App.jsx`** owns only what is genuinely view state — filters, sort order,
  which row is being edited, which dialog is open.

## How a change travels through the app

```
  user submits the form
        │
        ▼
  TransactionForm ──── shared/validation.js ───▶ inline field errors
        │                                        (nothing sent if invalid)
        ▼
  useTransactions.addTransaction()
        │
        ▼
  api/client.js  ──── POST /api/transactions ───▶  Express
        │                                            │
        │                              shared/validation.js runs AGAIN
        │                                            │
        │                                            ▼
        │                                   Mongoose → MongoDB
        │                                            │
        ◀──────────────── 201 + the created row ─────┘
        │
        ▼
  refresh()  ──── GET /api/transactions ───▶  fresh list + totals
        │
        ▼
  React re-renders: SummaryCards, BudgetCard, TransactionList, Insights
```

A write is followed by a reload rather than a local patch. That keeps one source
of truth (the database) and means a second browser tab shows the same data after
any action, at the cost of one extra request.

## Decisions worth explaining

**Dates are stored as `YYYY-MM-DD` strings, not `Date` objects.** The month
keying and chart aggregation in `shared/insights.js` work on these strings, and a
`Date` would introduce timezone drift: a transaction entered at 11pm could land
in the wrong month depending on the server's offset. The schema enforces the
format with a regex.

**`_id` is renamed to `id` in `toJSON`.** The shared code and the React
components work with `id`, so the Mongoose transform does the translation once at
the boundary instead of everywhere downstream. The same transform converts
`createdAt` to milliseconds, because the sort tie-breaker in
`shared/filters.js` subtracts them — an ISO string would subtract to `NaN`.

**The budget is a single document with a fixed key.** `getBudgetDoc()` upserts
it, so no endpoint has to special-case "no budget row exists yet".

**The theme is the one thing still in Local Storage.** It is a per-browser
display preference, not account data, so it does not belong in MongoDB.

**`refresh()` returns the fresh data.** Callers need the new values immediately;
reading the `transactions` state right after `refresh()` would still give the
pre-refresh array, because React has not re-rendered yet. That would silently
break the before/after comparison the budget threshold alert depends on.

## Tests

```bash
npm test
```

No dependencies to install and no database needed. The suite covers `shared/`:
validation rules, filtering and sorting, totals, budget thresholds, chart
aggregation, CSV/JSON serialisation and the backup import plan.

Not covered by automated tests: the Express route handlers, the Mongoose schemas
and the React components. Those would need `supertest` plus an in-memory MongoDB,
and a DOM testing library — dependencies this project does not carry. They are
verified by hand.
