import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Prefer the non-pooled URL for Better Auth and health checks; it avoids
// transaction-pooler edge cases while retaining pooled fallbacks for deploys.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL

// Keep module evaluation build-safe while bounding serverless connections.
export const pool = new Pool({
  connectionString: connectionString ?? 'postgresql://missing-neon-configuration',
  max: 5,
  connectionTimeoutMillis: 2500,
  idleTimeoutMillis: 10000,
  ssl: connectionString ? { rejectUnauthorized: false } : undefined,
})
export const db = drizzle(pool, { schema })

export function getDb() {
  return db
}
