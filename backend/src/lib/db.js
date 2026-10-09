import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'portfolio.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Reuse connection across Next.js dev reloads
let db;
if (process.env.NODE_ENV === 'production') {
  db = new sqlite3.Database(DB_PATH);
} else {
  if (!global.sqliteDb) {
    global.sqliteDb = new sqlite3.Database(DB_PATH);
  }
  db = global.sqliteDb;
}

// Initialize tables
const databaseReady = new Promise((resolve, reject) => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      shares REAL NOT NULL,
      price REAL NOT NULL,
      fees REAL NOT NULL DEFAULT 0.0,
      date TEXT NOT NULL
    )
  `,
    (error) => {
      if (error) return reject(error);
      db.all('PRAGMA table_info(transactions)', (schemaError, columns) => {
        if (schemaError) return reject(schemaError);
        const migrations = [
          ['source', 'ALTER TABLE transactions ADD COLUMN source TEXT'],
          [
            'cash_delta_cents',
            'ALTER TABLE transactions ADD COLUMN cash_delta_cents INTEGER',
          ],
        ].filter(([name]) => !columns.some((column) => column.name === name));
        function migrateNext() {
          const migration = migrations.shift();
          if (!migration) return resolve();
          db.run(migration[1], (error) =>
            error ? reject(error) : migrateNext(),
          );
        }
        migrateNext();
      });
    },
  );
});

// Promise-based query wrappers
export async function runQuery(sql, params = []) {
  await databaseReady;
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

export async function allQuery(sql, params = []) {
  await databaseReady;
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
