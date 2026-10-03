/**
 * Envía los casos de demostración a un despliegue (llena Supabase para el tablero).
 * Uso: npx tsx scripts/seed-remote.ts https://<tu-app>.vercel.app
 * Los case_id son fijos (prefijo 5eed0000-), así que repetirlo no duplica (upsert),
 * pero las fechas se recalculan relativas a "ahora".
 */
import { generateSeedCases } from '../src/surveillance/seed.ts';
import { toSyncCase } from '../src/db/sync.ts';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const cases = generateSeedCases().map(toSyncCase);
const res = await fetch(`${base}/api/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cases }),
});
const body = await res.json().catch(() => ({}));
console.log(res.status, JSON.stringify({ ...body, accepted: Array.isArray(body.accepted) ? body.accepted.length : body.accepted }));
process.exit(res.ok ? 0 : 1);
