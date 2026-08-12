import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { config } from './config.js'
import { seed } from './seed.js'
import { hashPassword } from './security.js'

if (!config.seedOwnerEmail || !config.seedOwnerEmail.includes('@')) throw new Error('SEED_OWNER_EMAIL must be a valid email address')
if (config.seedOwnerPassword.length < 8 || config.seedOwnerPassword.length > 128) throw new Error('SEED_OWNER_PASSWORD must contain 8-128 characters')

const admin=new pg.Client({connectionString:config.adminUrl}); await admin.connect()
const exists=(await admin.query(`SELECT 1 FROM pg_database WHERE datname='skillport_ai'`)).rowCount
if(!exists){await admin.query('CREATE DATABASE skillport_ai');console.log('Created isolated database skillport_ai')}else console.log('Database skillport_ai already exists; no other database was modified')
await admin.end(); const db=new pg.Pool({connectionString:config.databaseUrl}); const client=await db.connect()
try{await client.query(await readFile('db/schema.sql','utf8'));await client.query('BEGIN');await seed(client,config.seedOwnerEmail,await hashPassword(config.seedOwnerPassword));await client.query('COMMIT');console.log('Schema and idempotent seed completed')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await db.end()}