import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HEALTH_TIMEOUT_MS = 2500

export async function GET() {
  const startedAt = Date.now()
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('database health timeout')), HEALTH_TIMEOUT_MS),
      ),
    ])
    return Response.json(
      {
        ok: true,
        service: 'omnitradex-pro',
        database: 'healthy',
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const message = error instanceof Error ? error.message : 'unknown database error'
      console.warn(`[v0] Neon health check failed after ${Date.now() - startedAt}ms: ${message}`)
    }
    return Response.json(
      {
        ok: false,
        service: 'omnitradex-pro',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
