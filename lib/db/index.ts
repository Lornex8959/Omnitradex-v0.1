import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL

// Keep module evaluation build-safe. Runtime requests still fail clearly if Neon is not configured.
export const pool = new Pool({
  connectionString: connectionString ?? 'postgresql://missing-neon-configuration',
  max: 5,
})
export const db = drizzle(pool, { schema })

export function getDb() {
  return db
}
