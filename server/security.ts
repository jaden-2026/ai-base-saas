import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { config } from './config.js'
const scrypt = promisify(scryptCallback)
export async function hashPassword(password: string) { const salt = randomBytes(16); const key = await scrypt(password, salt, 64) as Buffer; return `scrypt$${salt.toString('hex')}$${key.toString('hex')}` }
export async function verifyPassword(password: string, stored: string) { const [, saltHex, hashHex] = stored.split('$'); if (!saltHex || !hashHex) return false; const key = await scrypt(password, Buffer.from(saltHex,'hex'), 64) as Buffer; return timingSafeEqual(key, Buffer.from(hashHex,'hex')) }
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const encryptionKey = createHash('sha256').update(config.secret).digest()
export function encrypt(value: string) { const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey,iv); const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64url')).join('.') }
export function decrypt(value: string) { const [i,t,b]=value.split('.').map(x=>Buffer.from(x,'base64url')); const decipher=createDecipheriv('aes-256-gcm',encryptionKey,i); decipher.setAuthTag(t); return Buffer.concat([decipher.update(b),decipher.final()]).toString() }
export function createApiKey() { const raw=`sk_live_${randomBytes(24).toString('base64url')}`; return { raw, prefix: `${raw.slice(0,14)}…${raw.slice(-4)}`, hash: sha256(raw) } }
export const createSessionToken = () => `sp_${randomBytes(32).toString('base64url')}`