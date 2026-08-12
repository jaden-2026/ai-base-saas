import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { db, redis } from './db.js'
import { createTestCaptcha, loginBody } from './test-auth.js'

const base = process.env.TEST_API_BASE ?? 'http://127.0.0.1:3001'

async function request<T>(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(base + path, { ...init, headers })
  const payload = await response.json().catch(() => ({})) as { data?: T; message?: string }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${payload.message ?? JSON.stringify(payload)}`)
  return payload.data as T
}

let token = ''
let apiKeyId = ''
try {
  const health = await request<{ status: string; postgres: string; redis: string }>('/api/health')
  if (health.status !== 'ok' || health.postgres !== 'ok') throw new Error('Health check failed')

  const challenge = await createTestCaptcha('ABCD')
  const invalid = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.seedOwnerEmail, password: config.seedOwnerPassword, ...challenge, captchaCode: 'WRONG' }),
  })
  if (invalid.status !== 400) throw new Error('Invalid CAPTCHA was accepted')

  token = (await request<{ token: string }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify(await loginBody(config.seedOwnerEmail, config.seedOwnerPassword)),
  })).token
  const identity = await request<{ tenant: { id: string; slug: string }; user: { permissions: string[] } }>('/api/me', {}, token)
  if (identity.tenant.slug !== 'skillport-platform' || !identity.user.permissions.includes('*')) throw new Error('Seeded administrator identity failed')

  const providers = await request<Array<{ id: string }>>('/api/providers', {}, token)
  await request<Array<{ id: string }>>('/api/models?availability=all', {}, token)
  await request<Array<{ id: string }>>('/api/categories?resourceType=model', {}, token)
  await request<Array<{ id: string }>>('/api/tenants?scope=all', {}, token)
  await request<Array<{ id: string }>>(`/api/members?tenantId=${identity.tenant.id}`, {}, token)
  await request<Array<{ id: string }>>(`/api/roles?tenantId=${identity.tenant.id}`, {}, token)
  await request<Array<{ id: string }>>('/api/dictionaries', {}, token)
  const billing = await request<{ plans: Array<{ id: string }>; subscription?: { id: string } }>('/api/billing', {}, token)
  const orders = await request<{ items: Array<{ id: string }> }>('/api/payment-orders?scope=all&page=1&pageSize=20', {}, token)
  if (!providers.length || !billing.plans.length || !billing.subscription || !Array.isArray(orders.items)) throw new Error('Retained page APIs did not return initialized data')

  const suffix = randomUUID().slice(0, 8)
  const createdKey = await request<{ id: string; key: string }>('/api/api-keys', {
    method: 'POST', body: JSON.stringify({ name: `scope-test-${suffix}`, scopes: ['models:read'], expiresAt: null }),
  }, token)
  apiKeyId = createdKey.id
  if (!createdKey.key.startsWith('sk_live_')) throw new Error('API Key creation failed')

  const channel = await request<{ id: string }>('/api/settings/channel-notifications/member/web', {
    method: 'PUT', body: JSON.stringify({ name: `web-${suffix}`, publicConfig: { allowedOrigins: 'http://localhost:5173' }, secretConfig: {}, callbackUrl: '' }),
  }, token)
  const channels = await request<Array<{ id: string }>>('/api/settings/channel-notifications?scope=member', {}, token)
  if (!channels.some(item => item.id === channel.id)) throw new Error('Channel notification settings were not persisted')
  await request('/api/settings/channel-notifications/member/web', { method: 'DELETE' }, token)

  await request(`/api/api-keys/${apiKeyId}?tenantId=${identity.tenant.id}`, { method: 'DELETE' }, token)
  apiKeyId = ''
  await request('/api/auth/logout', { method: 'POST', body: '{}' }, token)
  token = ''
  console.log(JSON.stringify({ authentication: 'passed', modelProviders: 'passed', modelList: 'passed', apiKeys: 'passed', tenantsAndMembers: 'passed', dictionaries: 'passed', subscriptionsAndPlans: 'passed', paymentOrders: 'passed', systemSettings: 'passed' }, null, 2))
} finally {
  if (apiKeyId) await db.query(`UPDATE app.api_keys SET revoked_at=now() WHERE id=$1`, [apiKeyId]).catch(() => undefined)
  if (token) await request('/api/settings/channel-notifications/member/web', { method: 'DELETE' }, token).catch(() => undefined)
  await db.end()
  redis.disconnect()
}