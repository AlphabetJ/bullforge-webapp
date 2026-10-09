import { readCurrentCash } from '@/lib/current-cash';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json({ currentCash: await readCurrentCash() });
  } catch (error) {
    console.error('Current cash read failed:', error);
    return Response.json(
      { error: 'Unable to read current cash balance.' },
      { status: 500 },
    );
  }
}
