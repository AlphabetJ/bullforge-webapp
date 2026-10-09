# Bullforge Webapp - Personal Investment Portfolio Tracker

Bullforge Webapp is a self-hosted, lightweight personal investment portfolio tracking application. It features a responsive Vue.js frontend dashboard, a Next.js API backend integrated with a SQLite database, and an automated Python data pipeline that extracts and seeds historical transactions directly from your broker's CSV exports (e.g., Webull).

Real-time stock valuations are dynamically fetched on-the-fly using the Yahoo Finance API.

---

## Key Features

- 📊 **Dynamic Dashboard**: Visualize your asset allocation weight, total portfolio value, and cost basis.
- 💵 **Performance Tracking**: Compute realized gains/losses (Realized P/L), unrealized gains (Unrealized P/L), and dividend reinvestments (DRIP) dynamically.
- 🕒 **Monthly Breakdown**: Analyze your realized profits and commissions paid month-by-month.
- 🗃️ **Robust Database**: Stored locally in a lightweight SQLite database.
- ⚙️ **CSV Ingestion Pipeline**: Command-line tool to parse historical trade record CSVs, automatically formats fields, generates stable index-based IDs, and imports them with duplicate prevention.
- 🔒 **Privacy-First**: Your broker CSVs and databases are excluded from Git and stored locally. Market prices are requested from Yahoo Finance; asset logo requests are sent to AnyLogo.

---

## Directory Structure

```text
├── backend/                # Next.js API Server
│   ├── data/               # SQLite database directory (ignored by git)
│   ├── src/
│   │   ├── app/            # Next.js App Router (endpoints: /api/portfolio, /api/transactions)
│   │   └── lib/            # SQLite connection setup and promise wrappers
│   └── package.json
│
├── frontend/               # Vue.js Frontend (Vite)
│   ├── src/
│   │   ├── components/     # Visual dashboard cards, tables, charts, and transaction forms
│   │   ├── App.vue         # State management and UI tab layouts
│   │   └── style.css       # Shared light/dark theme tokens
│   └── package.json
│
├── raw_data/               # Directory for broker CSV exports (ignored by git)
│
└── scratch/                # Data pipelines and developer CLI tools
    └── calculate_portfolio.py  # Python SQLite importer & CSV parser
```

---

## Tech Stack

- **Frontend**: Vue 3 (Composition API), Vite, SVG charts, HTML5/CSS3.
- **Backend**: Next.js (App Router), SQLite (`sqlite3` driver).
- **Data Ingestion**: Python 3.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22.12 or higher recommended)
- [Python 3](https://www.python.org/) (for running the CSV seeder)

---

### Installation & Run

#### Quick Start (Single Command - Recommended)
From the project root:
```bash
# 1. Install root tools, then backend and frontend dependencies
npm install
npm run install:all

# 2. Start both Backend & Frontend simultaneously
npm run dev
```
- **Backend API**: `http://localhost:3000`
- **Frontend Dashboard**: `http://localhost:5173`

*(To clear cached builds and start clean, use `npm run dev:clean`)*

---

#### Alternative: Running Separately
If you prefer running in separate terminals:

1. **Backend (Next.js)**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
2. **Frontend (Vue.js)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Data Ingestion (Importing your CSVs)

To import your broker transaction logs (e.g. Webull transaction reports):

1. Export your trade statements as CSV files.
2. Put the CSV files inside the `raw_data/` directory at the project root:
   ```text
   raw_data/
   ├── Webull-2025-11.csv
   ├── Webull-2025-12.csv
   └── Webull-2026-06.csv
   ```
3. Run the Python importer script:
   ```bash
   python scratch/calculate_portfolio.py
   ```

The script will:
- Connect to the SQLite database `backend/data/portfolio.db`.
- Parse the "TRADE RECORDS" section from all CSV files.
- Automatically check for existing transaction duplicates in the database based on date, symbol, type, shares, and price.
- Skip duplicate entries and import new transactions seamlessly.

### Portfolio metric definitions

- **Holdings market value** is the current value of open positions, excluding unrecorded cash. Missing quotes use average cost and are visibly marked as estimates.
- **Open-position cost** is remaining average cost basis, including recorded purchase fees. Allocation defaults to market value; the chart can switch to cost basis.
- **Realized sale P/L** includes every recorded sale in the tracked period, including ETF/fund and fractional-unit sales. Net sale proceeds (after sell fees) minus the sold units' average cost basis gives each sale's P/L. Each event is rounded to cents before aggregation so summaries match the ledger.
- **Reinvested dividends** are recorded separately as income and also create cost basis for the new units. A later sale realizes only the change from that basis. Reinvestments are never subtracted from sale P/L.
- **Recorded realized income** combines sale P/L and recorded reinvested dividends. It does not include unrecorded cash dividends or unrecorded withholding taxes.
- Imported legacy JEPQ purchases with `csv_` IDs, fewer than one unit and zero fees are **estimated** dividend reinvestments. The original entries are preserved. New transactions explicitly record `source: TRADE` or `DIVIDEND_REINVESTMENT`, selected using the DRIP checkbox on the buy form; ordinary fractional purchases are not inferred as dividends.
- The existing tracking boundary starts at the NVDA purchase of 9 shares on 2025-11-07 when present. The actual start date is displayed in the UI. Transactions before the boundary remain in the activity ledger but do not contribute to portfolio metrics.

The database adds a nullable `source` column automatically while preserving existing transaction rows. Calculation and market-price checks can be run with `npm test` from the repository root.

### Code maintenance

- `npm run format`: format frontend, backend and tests with Prettier.
- `npm run format:check`: check formatting without editing files.
- `npm test`: run backend calculation and price-cache tests with in-memory data.
- `npm run build`: build the backend and frontend.

Portfolio accounting is in `backend/src/lib/portfolio.js`; request handlers handle database access and market-price fetching. Frontend API state is in `frontend/src/composables/usePortfolio.js`. The CSV importer resolves paths relative to the project, so it works independently of the shell's current directory.

### Cash Flow: import PDF statements on demand

The Cash Flow page reads `backend/data/cash-flow.json`. It never executes Python
when launching or refreshing the app. From the project root, run explicitly:

```sh
python3 -m pip install -r scripts/requirements.txt
python3 scripts/import_cash_flow.py
```

Then select **Cash Flow → Reload imported data**. The importer reads only
`raw_data/PDF-Webull-*.PDF`, checks monthly cash reconciliation and extracted trade
totals, and atomically replaces the saved snapshot. It does not change the portfolio
SQLite database or manual trades. PDF sources and the snapshot stay Git-ignored.
Annual summaries and tax certificates are excluded to prevent duplicate income.

Tracked trades begin at the application's configured tracking boundary, in
chronological ICT order.
Cash balances, funding and income use full calendar-month statements (November
includes 1–6 November) and the whole brokerage account, including older assets.
The page focuses on current holdings plus user-reported USD cash and monthly account
value (stocks and cash). Historical values come from NET ACCOUNT VALUE in each
statement. Monthly value growth subtracts deposits less withdrawals; it includes
FX effects and fees and is not a time-weighted return. Historical USD amounts are
THB values translated at each statement's USD/THB rate.

Current cash is stored separately in Git-ignored
`backend/data/cash-flow-settings.json` (`cashUsd`, `asOf`, `source`) so PDF reimports
do not overwrite it. Current THB equivalents default to the latest statement FX
rate, clearly dated, and users can change that rate on the page. This is not live FX.
The USD view has a button to show supplementary THB amounts. Current values are
separate from the historical chart, since current-month funding is not yet covered
by the statements.

The monthly value chart uses selectable bars with details on hover, focus or click.
Cash Flow also shows dated deposits, withdrawals and both FX directions, with
actual paid/received currency amounts and executed rates. Filters select type and
year. These amounts do not use the current-value display FX rate. The explicit
PDF importer verifies detailed funding and FX totals against each monthly cash
summary before replacing the snapshot. Test extraction rules with:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
```
