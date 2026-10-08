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
- 🔒 **Privacy-First**: No external cloud tracking or database syncs. Your broker CSVs and databases are excluded from Git and kept entirely on your local machine.

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
│   │   └── style.css       # Premium custom styling (Glassmorphism & Dark Mode)
│   └── package.json
│
├── raw_data/               # Directory for broker CSV exports (ignored by git)
│
└── scratch/                # Data pipelines and developer CLI tools
    └── calculate_portfolio.py  # Python SQLite importer & CSV parser
```

---

## Tech Stack

- **Frontend**: Vue 3 (Composition API), Vite, Chart.js, HTML5/CSS3.
- **Backend**: Next.js (App Router), SQLite (`sqlite3` driver).
- **Data Ingestion**: Python 3.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Python 3](https://www.python.org/) (for running the CSV seeder)

---

### Installation & Run

#### Quick Start (Single Command - Recommended)
From the project root:
```bash
# 1. Install all dependencies (both backend & frontend)
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

The database adds a nullable `source` column automatically while preserving existing transaction rows. Before this update, a local backup was saved as `backend/data/portfolio.before-income-ui.db` (ignored by Git). Calculation checks can be run with `node --test backend/tests/*.test.mjs`.
