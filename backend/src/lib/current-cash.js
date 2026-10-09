import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { allQuery } from '@/lib/db';
import { cashBalance } from '@/lib/cash-ledger';

export async function readCurrentCash() {
  try {
    const cash = JSON.parse(
      await readFile(
        path.join(process.cwd(), 'data/cash-flow-settings.json'),
        'utf8',
      ),
    );
    if (
      !Number.isFinite(cash.cashUsd) ||
      cash.cashUsd < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cash.asOf)
    )
      throw new Error('Invalid cash settings.');
    const postings = await allQuery(
      'SELECT cash_delta_cents FROM transactions WHERE cash_delta_cents IS NOT NULL',
    );
    return cashBalance(cash, postings);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
