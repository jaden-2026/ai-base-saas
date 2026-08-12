import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve('.env')
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:admin@127.0.0.1:5432/skillport_ai',
  adminUrl: process.env.POSTGRES_ADMIN_URL ?? 'postgresql://postgres:admin@127.0.0.1:5432/postgres',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', redisPrefix: process.env.REDIS_PREFIX ?? 'skillport:',
  port: Number(process.env.PORT ?? 3001), appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  secret: process.env.APP_SECRET ?? 'skillport-local-development-secret-change-me',
  seedOwnerEmail: process.env.SEED_OWNER_EMAIL ?? '', seedOwnerPassword: process.env.SEED_OWNER_PASSWORD ?? '',
  stripeKey: process.env.STRIPE_SECRET_KEY ?? '', stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  wechatPayAppId: process.env.WECHAT_PAY_APP_ID ?? '', wechatPayMerchantId: process.env.WECHAT_PAY_MERCHANT_ID ?? '', wechatPayMerchantSerialNo: process.env.WECHAT_PAY_MERCHANT_SERIAL_NO ?? '',
  wechatPayPrivateKey: process.env.WECHAT_PAY_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '', wechatPayApiV3Key: process.env.WECHAT_PAY_API_V3_KEY ?? '',
  wechatPayPublicKeyId: process.env.WECHAT_PAY_PUBLIC_KEY_ID ?? '', wechatPayPublicKey: process.env.WECHAT_PAY_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? '',
  wechatPayNotifyUrl: process.env.WECHAT_PAY_NOTIFY_URL ?? '',
  uploadDir: resolve('uploads'), production: process.env.NODE_ENV === 'production',
}