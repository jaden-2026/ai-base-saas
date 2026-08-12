import { createPrivateKey, createPublicKey } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import QRCode from 'qrcode'
import { z } from 'zod'
import { config } from './config.js'
import { query, transaction } from './db.js'
import { decrypt, encrypt } from './security.js'
import { createWechatNativeOrder, decryptWechatPayResource, verifyWechatPaySignature, type WechatPayCredentials } from './wechat-pay.js'

type Session = { userId: string; tenantId: string; permissions: string[] }
type RequestWithSession = FastifyRequest & { session?: Session; rawBody?: string }
type PaymentPlan = { id: string; code: string; name: string; description: string; price_cny: number; billing_period: string }
type CredentialRow = { tenant_id: string; app_id: string; merchant_id: string; merchant_serial_no: string; encrypted_private_key: string; encrypted_api_v3_key: string; wechat_pay_public_key_id: string; encrypted_wechat_pay_public_key: string; notify_url: string | null }
type CredentialCandidate = { tenantId: string; global: boolean; credentials: WechatPayCredentials }
type PaymentOrder = { id: string; tenant_id: string; plan_id: string; provider_ref: string | null; amount: number; currency: string; status: string; billing_period: string }
type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>

const ok = (data: unknown) => ({ data })
const cents = (amount: unknown) => Math.round(Number(amount) * 100)
const orderNo = (id: string) => `SP${id.replace(/-/g, '').slice(0, 30)}`
const periodSql = (period: string) => period === 'year' ? `now()+interval '1 year'` : `now()+interval '1 month'`
const developmentNotifyUrl = () => !config.production ? `http://127.0.0.1:${config.port}/api/billing/webhooks/wechat` : ''
const audit = (request: RequestWithSession, action: string, resourceId: string, details: Record<string, unknown> = {}) => query(`INSERT INTO app.audit_logs(tenant_id,user_id,action,resource_type,resource_id,ip,details) VALUES($1,$2,$3,'payment_provider',$4,$5,$6)`, [request.session?.tenantId, request.session?.userId, action, resourceId, request.ip, JSON.stringify(details)])

const credentialsFromRow = (row: CredentialRow, source: 'tenant_override' | 'platform'): WechatPayCredentials => ({ appId: row.app_id, merchantId: row.merchant_id, merchantSerialNo: row.merchant_serial_no, privateKey: decrypt(row.encrypted_private_key), apiV3Key: decrypt(row.encrypted_api_v3_key), wechatPayPublicKeyId: row.wechat_pay_public_key_id, wechatPayPublicKey: decrypt(row.encrypted_wechat_pay_public_key), source })
const environmentCredentials = (): WechatPayCredentials | null => [config.wechatPayAppId, config.wechatPayMerchantId, config.wechatPayMerchantSerialNo, config.wechatPayPrivateKey, config.wechatPayApiV3Key, config.wechatPayPublicKeyId, config.wechatPayPublicKey].every(Boolean) ? { appId: config.wechatPayAppId, merchantId: config.wechatPayMerchantId, merchantSerialNo: config.wechatPayMerchantSerialNo, privateKey: config.wechatPayPrivateKey, apiV3Key: config.wechatPayApiV3Key, wechatPayPublicKeyId: config.wechatPayPublicKeyId, wechatPayPublicKey: config.wechatPayPublicKey, source: 'environment' } : null
async function platformTenant() { const row = (await query<{ id: string; name: string }>(`SELECT id,name FROM app.tenants WHERE slug='skillport-platform' LIMIT 1`)).rows[0]; if (!row) throw Object.assign(new Error('平台工作空间不存在'), { statusCode: 500 }); return row }
async function credentialRow(tenantId: string) { return (await query<CredentialRow>(`SELECT * FROM app.wechat_pay_credentials WHERE tenant_id=$1`, [tenantId])).rows[0] }
async function effectivePaymentConfig(tenantId: string) {
  const platform = await platformTenant()
  const [scopeRow, platformRow] = await Promise.all([credentialRow(tenantId), tenantId === platform.id ? Promise.resolve(undefined) : credentialRow(platform.id)])
  const row = scopeRow ?? platformRow
  const credentials = row ? credentialsFromRow(row, row.tenant_id === platform.id ? 'platform' : 'tenant_override') : environmentCredentials()
  const notifyUrl = (tenantId === platform.id ? scopeRow?.notify_url : platformRow?.notify_url) || config.wechatPayNotifyUrl || developmentNotifyUrl()
  return { platform, scopeRow, platformRow: tenantId === platform.id ? scopeRow : platformRow, credentials, notifyUrl }
}
async function validateTargetTenant(tenantId: string | undefined, fallback: string) { const id = tenantId ?? fallback; const row = (await query<{ id: string; name: string; slug: string }>(`SELECT id,name,slug FROM app.tenants WHERE id=$1`, [id])).rows[0]; if (!row) throw Object.assign(new Error('目标租户不存在'), { statusCode: 404 }); return row }
function validatePrivateKey(value: string) { try { createPrivateKey(value) } catch { throw Object.assign(new Error('商户 API 私钥不是有效的 PEM 私钥'), { statusCode: 400 }) } }
function validatePublicKey(value: string) { try { createPublicKey(value) } catch { throw Object.assign(new Error('微信支付公钥不是有效的 PEM 公钥'), { statusCode: 400 }) } }
function validateNotifyUrl(value: string) { let url: URL; try { url = new URL(value) } catch { throw Object.assign(new Error('支付回调地址格式不正确'), { statusCode: 400 }) }; if (config.production && url.protocol !== 'https:') throw Object.assign(new Error('生产环境支付回调地址必须使用 HTTPS'), { statusCode: 400 }); if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('支付回调地址必须使用 HTTP 或 HTTPS'), { statusCode: 400 }) }

async function activate(order: { id: string; tenant_id: string; plan_id: string; provider_ref: string | null; billing_period: string }) {
  await transaction(async client => {
    const paid = await client.query(`UPDATE app.payment_orders SET status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() WHERE id=$1 AND tenant_id=$2 AND status='pending' RETURNING id`, [order.id, order.tenant_id])
    if (!paid.rowCount) return
    await client.query(`UPDATE app.subscriptions SET status='cancelled' WHERE tenant_id=$1 AND status='active'`, [order.tenant_id])
    await client.query(`INSERT INTO app.subscriptions(tenant_id,plan_id,provider,provider_ref,status,period_start,period_end) VALUES($1,$2,'wechat',$3,'active',now(),${periodSql(order.billing_period)})`, [order.tenant_id, order.plan_id, order.provider_ref])
    await client.query(`INSERT INTO app.audit_logs(tenant_id,action,resource_type,resource_id,details) VALUES($1,'payment.order.paid','payment_order',$2,$3)`, [order.tenant_id, order.id, JSON.stringify({ provider: 'wechat', providerRef: order.provider_ref, planId: order.plan_id })])
  })
}

export function registerPaymentRoutes(app: FastifyInstance, permit: (permission: string) => PreHandler, superAdmin: PreHandler) {
  app.get('/api/settings/payment/wechat', { preHandler: superAdmin }, async (request: RequestWithSession) => {
    const rawTenantId = (request.query as { tenantId?: string }).tenantId
    const target = await validateTargetTenant(rawTenantId ? z.string().uuid().parse(rawTenantId) : undefined, request.session!.tenantId)
    const resolved = await effectivePaymentConfig(target.id)
    const current = resolved.scopeRow ? credentialsFromRow(resolved.scopeRow, target.id === resolved.platform.id ? 'platform' : 'tenant_override') : resolved.credentials
    return ok({ targetTenant: target, platformTenantId: resolved.platform.id, scope: target.id === resolved.platform.id ? 'platform' : 'tenant_override', scopeConfigured: !!resolved.scopeRow, configured: !!resolved.credentials, source: resolved.credentials?.source ?? null, appId: current?.appId ?? '', merchantId: current?.merchantId ?? '', merchantSerialNo: current?.merchantSerialNo ?? '', wechatPayPublicKeyId: current?.wechatPayPublicKeyId ?? '', privateKeyMasked: current ? '••••••••（已加密保存）' : '', apiV3KeyMasked: current ? '••••••••（已加密保存）' : '', wechatPayPublicKeyMasked: current ? '••••••••（已加密保存）' : '', notifyUrl: resolved.notifyUrl })
  })

  app.put('/api/settings/payment/wechat', { preHandler: superAdmin }, async (request: RequestWithSession) => {
    const body = z.discriminatedUnion('clear', [z.object({ tenantId: z.string().uuid().optional(), clear: z.literal(true) }), z.object({ tenantId: z.string().uuid().optional(), appId: z.string().trim().min(3).max(64), merchantId: z.string().trim().min(6).max(32), merchantSerialNo: z.string().trim().min(8).max(128), privateKey: z.string().trim().min(16).max(10000).optional(), apiV3Key: z.string().refine(value => Buffer.byteLength(value) === 32, 'API v3 密钥必须正好为 32 字节').optional(), wechatPayPublicKeyId: z.string().trim().min(8).max(128), wechatPayPublicKey: z.string().trim().min(16).max(10000).optional(), notifyUrl: z.string().trim().max(2000).optional(), clear: z.literal(false) })]).parse(request.body)
    const target = await validateTargetTenant(body.tenantId, request.session!.tenantId)
    const platform = await platformTenant()
    const platformScope = target.id === platform.id
    if (body.clear) { await query(`DELETE FROM app.wechat_pay_credentials WHERE tenant_id=$1`, [target.id]); await audit(request, 'payment.credentials.delete', 'wechat', { targetTenantId: target.id, scope: platformScope ? 'platform' : 'tenant_override' }); return ok({ scopeConfigured: false }) }
    const existing = await credentialRow(target.id)
    if ((!body.privateKey || !body.apiV3Key || !body.wechatPayPublicKey) && !existing) throw Object.assign(new Error('首次配置必须填写商户私钥、API v3 密钥和微信支付公钥'), { statusCode: 400 })
    if (body.privateKey) validatePrivateKey(body.privateKey)
    if (body.wechatPayPublicKey) validatePublicKey(body.wechatPayPublicKey)
    const notifyUrl = platformScope ? (body.notifyUrl ?? existing?.notify_url ?? config.wechatPayNotifyUrl) : null
    if (platformScope && !notifyUrl && config.production) throw Object.assign(new Error('生产环境必须配置支付回调地址'), { statusCode: 400 })
    if (notifyUrl) validateNotifyUrl(notifyUrl)
    await query(`INSERT INTO app.wechat_pay_credentials(tenant_id,app_id,merchant_id,merchant_serial_no,encrypted_private_key,encrypted_api_v3_key,wechat_pay_public_key_id,encrypted_wechat_pay_public_key,notify_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant_id) DO UPDATE SET app_id=EXCLUDED.app_id,merchant_id=EXCLUDED.merchant_id,merchant_serial_no=EXCLUDED.merchant_serial_no,encrypted_private_key=EXCLUDED.encrypted_private_key,encrypted_api_v3_key=EXCLUDED.encrypted_api_v3_key,wechat_pay_public_key_id=EXCLUDED.wechat_pay_public_key_id,encrypted_wechat_pay_public_key=EXCLUDED.encrypted_wechat_pay_public_key,notify_url=EXCLUDED.notify_url,updated_at=now()`, [target.id, body.appId, body.merchantId, body.merchantSerialNo, body.privateKey ? encrypt(body.privateKey) : existing!.encrypted_private_key, body.apiV3Key ? encrypt(body.apiV3Key) : existing!.encrypted_api_v3_key, body.wechatPayPublicKeyId, body.wechatPayPublicKey ? encrypt(body.wechatPayPublicKey) : existing!.encrypted_wechat_pay_public_key, notifyUrl])
    await audit(request, 'payment.credentials.update', 'wechat', { targetTenantId: target.id, scope: platformScope ? 'platform' : 'tenant_override' })
    const resolved = await effectivePaymentConfig(target.id)
    return ok({ targetTenant: target, platformTenantId: platform.id, scope: platformScope ? 'platform' : 'tenant_override', scopeConfigured: true, configured: true, source: platformScope ? 'platform' : 'tenant_override', appId: body.appId, merchantId: body.merchantId, merchantSerialNo: body.merchantSerialNo, wechatPayPublicKeyId: body.wechatPayPublicKeyId, privateKeyMasked: '••••••••（已加密保存）', apiV3KeyMasked: '••••••••（已加密保存）', wechatPayPublicKeyMasked: '••••••••（已加密保存）', notifyUrl: resolved.notifyUrl })
  })

  app.delete('/api/settings/payment/wechat', { preHandler: superAdmin }, async (request: RequestWithSession) => {
    const rawTenantId = (request.query as { tenantId?: string }).tenantId
    const target = await validateTargetTenant(rawTenantId ? z.string().uuid().parse(rawTenantId) : undefined, request.session!.tenantId)
    const platform = await platformTenant()
    await query(`DELETE FROM app.wechat_pay_credentials WHERE tenant_id=$1`, [target.id])
    await audit(request, 'payment.credentials.delete', 'wechat', { targetTenantId: target.id, scope: target.id === platform.id ? 'platform' : 'tenant_override' })
    return ok({ scopeConfigured: false })
  })

  app.post('/api/billing/checkout', { preHandler: permit('plans:manage') }, async (request: RequestWithSession, reply) => {
    const body = z.object({ planId: z.string().uuid(), region: z.enum(['CN', 'GLOBAL']).default('CN'), paymentMethod: z.enum(['wechat', 'alipay', 'bank_card', 'stripe']).optional() }).parse(request.body)
    if ((body.paymentMethod ?? 'wechat') !== 'wechat' || body.region !== 'CN') return reply.code(501).send({ error: 'payment_method_not_implemented', message: '该支付方式尚未接入，目前仅支持国内微信支付' })
    const resolved = await effectivePaymentConfig(request.session!.tenantId)
    if (!resolved.credentials) return reply.code(503).send({ error: 'provider_not_configured', message: '微信支付商户凭证尚未配置' })
    if (!resolved.notifyUrl) return reply.code(503).send({ error: 'notify_url_not_configured', message: '生产环境必须配置微信支付回调地址' })
    const plan = (await query<PaymentPlan>(`SELECT * FROM app.plans WHERE id=$1 AND active=true`, [body.planId])).rows[0]
    if (!plan) return reply.code(404).send({ error: 'plan_not_found', message: '套餐不存在或已停用' })
    const order = (await query(`INSERT INTO app.payment_orders(tenant_id,plan_id,provider,amount,currency,provider_channel,payment_payload) VALUES($1,$2,'wechat',$3,'CNY','native',$4) RETURNING *`, [request.session!.tenantId, plan.id, plan.price_cny, JSON.stringify({ paymentMethod: 'wechat' })])).rows[0]
    try {
      const merchantOrderNo = orderNo(order.id)
      const result = await createWechatNativeOrder(resolved.credentials, { orderNo: merchantOrderNo, description: `SkillPort AI ${plan.name}`, amount: cents(order.amount), notifyUrl: resolved.notifyUrl, attach: order.id }, config.production)
      const checkoutUrl = result.code_url
      if (!checkoutUrl) throw Object.assign(new Error('微信支付未返回 Native 支付二维码'), { statusCode: 502 })
      const qrCodeDataUrl = await QRCode.toDataURL(checkoutUrl, { margin: 1, width: 240 })
      const saved = (await query(`UPDATE app.payment_orders SET provider_ref=$1,checkout_url=$2,payment_payload=payment_payload||$3::jsonb,updated_at=now() WHERE id=$4 AND tenant_id=$5 RETURNING *`, [merchantOrderNo, checkoutUrl, JSON.stringify({ nativeOrder: { outTradeNo: merchantOrderNo, mock: 'mock' in result }, qrCodeDataUrl, credentialSource: resolved.credentials.source }), order.id, request.session!.tenantId])).rows[0]
      await audit(request, 'payment.order.create', order.id, { provider: 'wechat', channel: 'native', credentialSource: resolved.credentials.source })
      return ok(saved)
    } catch (error) {
      await query(`UPDATE app.payment_orders SET status='failed',updated_at=now(),payment_payload=payment_payload||$1::jsonb WHERE id=$2 AND tenant_id=$3`, [JSON.stringify({ createError: error instanceof Error ? error.message : '微信支付下单失败' }), order.id, request.session!.tenantId])
      throw error
    }
  })

  app.post('/api/billing/webhooks/wechat', async (request: RequestWithSession, reply) => {
    const raw = request.rawBody ?? (typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {}))
    const envelope = z.object({ id: z.string(), event_type: z.string(), resource: z.object({ algorithm: z.string(), ciphertext: z.string(), associated_data: z.string().optional(), nonce: z.string() }) }).parse(typeof request.body === 'string' ? JSON.parse(request.body) : request.body)
    if (envelope.event_type !== 'TRANSACTION.SUCCESS') return reply.code(204).send()
    const serial = String(request.headers['wechatpay-serial'] ?? '')
    const platform = await platformTenant()
    const rows = (await query<CredentialRow>(`SELECT * FROM app.wechat_pay_credentials WHERE wechat_pay_public_key_id=$1`, [serial])).rows
    const candidates: CredentialCandidate[] = rows.map(row => ({ tenantId: row.tenant_id, global: row.tenant_id === platform.id, credentials: credentialsFromRow(row, row.tenant_id === platform.id ? 'platform' : 'tenant_override') }))
    const env = environmentCredentials(); if (env && env.wechatPayPublicKeyId === serial) candidates.push({ tenantId: '', global: true, credentials: env })
    const verified: { candidate: CredentialCandidate; transaction: Record<string, unknown> }[] = []
    for (const candidate of candidates) { try { verifyWechatPaySignature(candidate.credentials, request.headers, raw); verified.push({ candidate, transaction: decryptWechatPayResource(candidate.credentials.apiV3Key, envelope.resource) }) } catch { /* Try another credential with the same public key ID. */ } }
    if (!verified.length) throw Object.assign(new Error('微信支付回调签名或密文验证失败'), { statusCode: 401 })
    const orderQuery = `SELECT o.id,o.tenant_id,o.plan_id,o.provider_ref,o.amount,o.currency,o.status,p.billing_period FROM app.payment_orders o JOIN app.plans p ON p.id=o.plan_id WHERE o.provider='wechat' AND (o.provider_ref=$1 OR o.payment_payload->'nativeOrder'->>'outTradeNo'=$1) LIMIT 1`
    let matched: { candidate: CredentialCandidate; transaction: Record<string, unknown>; order: PaymentOrder } | undefined
    for (const item of verified) { const merchantOrderNo = String(item.transaction.out_trade_no ?? ''); if (!merchantOrderNo) continue; const order = (await query<PaymentOrder>(orderQuery, [merchantOrderNo])).rows[0]; if (order) { matched = { candidate: item.candidate, transaction: item.transaction, order }; break } }
    const order = matched?.order
    if (!order) return reply.code(204).send()
    const accepted = verified.find(item => item.candidate.tenantId === order.tenant_id) ?? verified.find(item => item.candidate.global)
    if (!accepted) throw Object.assign(new Error('微信支付回调租户不匹配'), { statusCode: 400 })
    const transaction = accepted.transaction, credentials = accepted.candidate.credentials
    const amount = transaction.amount as { total?: number; currency?: string } | undefined
    if (String(transaction.mchid ?? '') !== credentials.merchantId || String(transaction.trade_state ?? '') !== 'SUCCESS' || Number(amount?.total ?? 0) !== cents(order.amount) || String(amount?.currency ?? '').toUpperCase() !== order.currency) throw Object.assign(new Error('微信支付回调商户、状态、金额或币种不匹配'), { statusCode: 400 })
    const transactionId = String(transaction.transaction_id ?? '')
    if (order.status === 'pending') await activate({ ...order, provider_ref: transactionId || order.provider_ref })
    await query(`UPDATE app.payment_orders SET provider_ref=coalesce(nullif($1,''),provider_ref),provider_event_id=$2,payment_payload=payment_payload||$3::jsonb,updated_at=now() WHERE id=$4 AND tenant_id=$5`, [transactionId, envelope.id, JSON.stringify({ wechatTransaction: { transactionId, successTime: transaction.success_time, tradeType: transaction.trade_type } }), order.id, order.tenant_id])
    return reply.code(204).send()
  })
}