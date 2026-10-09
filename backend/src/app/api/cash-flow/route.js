import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { portfolioGrowth } from '@/lib/cash-flow';
import { readCurrentCash } from '@/lib/current-cash';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = JSON.parse(
      await readFile(path.join(process.cwd(), 'data/cash-flow.json'), 'utf8'),
    );
    const currentCash = await readCurrentCash();
    return Response.json({
      ...data,
      growth: portfolioGrowth(data.statements),
      currentCash,
    });
  } catch (error) {
    if (error.code === 'ENOENT')
      return Response.json(
        {
          error:
            'No PDF data imported. Run python3 scripts/import_cash_flow.py from the project folder.',
        },
        { status: 404 },
      );
    console.error('Cash flow read failed:', error);
    return Response.json(
      { error: 'Unable to read imported cash flow data.' },
      { status: 500 },
    );
  }
}
