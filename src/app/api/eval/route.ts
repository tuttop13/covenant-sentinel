import { evaluateAll } from '@/lib/eval/evaluate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/eval — deterministic ground-truth scorecard over each scenario's last saved run. */
export async function GET() {
  return Response.json({ scenarios: evaluateAll() });
}
