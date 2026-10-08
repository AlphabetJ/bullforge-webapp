# Portfolio API

Next.js App Router handlers with a local SQLite database at `data/portfolio.db`.

- `GET /api/portfolio`: holdings, income history and portfolio summary.
- `GET /api/transactions`: transaction history.
- `POST /api/transactions`: record a buy or sale.
- `DELETE /api/transactions`: clear records. `?reset=true` replaces them with demo data.

`src/lib/portfolio.js` owns average-cost accounting and the legacy tracking boundary. Both portfolio valuation and sale validation use it. `src/lib/market-prices.js` handles Yahoo quotes, request deduplication, timeouts and a bounded 60-second cache. `src/lib/db.js` manages the SQLite connection and schema migration.

Run both services with `npm run dev` from the repository root, or just the API with `npm run dev` here. The API listens on port 3000. `npm run dev:clean` clears the Next.js build cache before starting.

Run `npm test` from the repository root for calculation and price-cache tests. They use in-memory transactions and mocked quotes, leaving the local database untouched.
