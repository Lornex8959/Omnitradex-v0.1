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
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : 'none'
      const name = cause instanceof Error ? cause.name : 'unknown'
      const message = cause instanceof Error ? cause.message : 'unknown database error'
      const category = /timeout|timed out/i.test(message) ? 'timeout' : /ssl|certificate|tls/i.test(message) ? 'ssl' : /auth|password|role/i.test(message) ? 'authentication' : /enotfound|dns|getaddrinfo/i.test(message) ? 'dns' : /refused/i.test(message) ? 'connection-refused' : 'query-failure'
      const configured = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'STORAGE1_DATABASE_URL_UNPOOLED', 'STORAGE1_DATABASE_URL'].filter((key) => Boolean(process.env[key])).join(',') || 'none'
      console.warn(`[v0] Neon health diagnostic category=${category} code=${code} name=${name} configured=${configured} durationMs=${Date.now() - startedAt} message=${message}`)
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
