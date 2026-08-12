import pg from 'pg'
import { Redis } from 'ioredis'
import { config } from './config.js'

pg.types.setTypeParser(20, Number)
export const db = new pg.Pool({ connectionString: config.databaseUrl, max: 12, idleTimeoutMillis: 30_000 })
export const redis = new Redis(config.redisUrl, { keyPrefix: config.redisPrefix, lazyConnect: true, maxRetriesPerRequest: 2 })
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) { return db.query<T>(text, values) }
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>) { const client = await db.connect(); try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() } }