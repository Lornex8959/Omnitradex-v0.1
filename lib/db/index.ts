import 'server-only'
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
  process.env.POSTGRES_PRISMA_URL ??
  process.env.STORAGE1_DATABASE_URL_UNPOOLED ??
  process.env.STORAGE1_POSTGRES_URL_NON_POOLING ??
  process.env.STORAGE1_DATABASE_URL ??
  process.env.STORAGE1_POSTGRES_URL ??
  process.env.STORAGE1_POSTGRES_PRISMA_URL

const discreteConfig =
  (process.env.PGHOST ?? process.env.POSTGRES_HOST) &&
  (process.env.PGUSER ?? process.env.POSTGRES_USER) &&
  (process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD) &&
  (process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE)
    ? {
        host: process.env.PGHOST ?? process.env.POSTGRES_HOST,
        user: process.env.PGUSER ?? process.env.POSTGRES_USER,
        password: process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD,
        database: process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE,
        port: Number(process.env.PGPORT ?? 5432),
      }
    : undefined

// Keep module evaluation build-safe while bounding serverless connections.
export const pool = new Pool({
  ...(connectionString ? { connectionString } : discreteConfig ?? { host: 'missing-neon-configuration' }),
  max: 5,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  ssl: connectionString || discreteConfig ? { rejectUnauthorized: true } : undefined,
})
export const db = drizzle(pool, { schema })

export function getDb() {
  return db
}
