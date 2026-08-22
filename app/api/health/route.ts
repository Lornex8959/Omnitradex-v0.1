import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    await getDb().execute(sql`select 1`)
    return Response.json({ ok: true, service: 'omnitradex-pro', database: 'connected' })
  } catch {
    return Response.json({ ok: false, service: 'omnitradex-pro', database: 'unavailable' }, { status: 503 })
  }
}
