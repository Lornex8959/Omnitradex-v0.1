import { jsonb, pgTable, bigserial, bigint, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core'

export const marketSnapshots = pgTable('market_snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  symbol: text('symbol').notNull(),
  interval: text('interval').notNull(),
  payload: jsonb('payload').notNull(),
  source: text('source').notNull(),
  sourceTimestamp: timestamp('source_timestamp', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export const paperOrders = pgTable('paper_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  orderType: text('order_type').notNull(),
  quantity: numeric('quantity', { precision: 30, scale: 12 }).notNull(),
  limitPrice: numeric('limit_price', { precision: 30, scale: 12 }),
  status: text('status').notNull(),
  assumptions: jsonb('assumptions').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  orderId: uuid('order_id'),
  thesis: text('thesis').notNull(),
  outcome: text('outcome'),
  rMultiple: numeric('r_multiple', { precision: 12, scale: 6 }),
  feedback: text('feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const auditEvents = pgTable('audit_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: text('user_id'),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export type MarketSnapshot = typeof marketSnapshots.$inferSelect
export type PaperOrder = typeof paperOrders.$inferSelect
export type JournalEntry = typeof journalEntries.$inferSelect
