# Portfolio frontend

Vue 3 with Vite. The UI includes the dashboard, profit history, transactions and sell simulator. CSS variables in `src/style.css` define the light and dark themes. Asset logos use AnyLogo, with a text fallback when a logo cannot be loaded.

Run `npm run dev` from the repository root to start both services. Running `npm run dev` in this directory starts only Vite on port 5173; `/api` requests are proxied to the backend on port 3000.

- `src/App.vue`: navigation and page composition.
- `src/composables/usePortfolio.js`: API requests and portfolio loading state.
- `src/components/TransactionHistory.vue`: activity filters and ledger.
- `src/utils/format.js`: shared currency, share and date formatters.

Run `npm run build` here to generate `dist/`. Formatting commands are available from the repository root.
