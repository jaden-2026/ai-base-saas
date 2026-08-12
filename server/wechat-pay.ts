import { createDecipheriv, createSign, createVerify, randomBytes } from 'node:crypto'

export type WechatPayCredentials = {
  appId: string
  merchantId: string
  merchantSerialNo: string
  privateKey: string
  apiV3Key: string
  wechatPayPublicKeyId: string
  wechatPayPublicKey: string
  source: 'tenant_override' | 'platform' | 'environment'
}

export type WechatPayHeaders = Record<string, string | string[] | undefined>

const normalizePem = (value: string) => value.replace(/\\n/g, '\n')
const signatureMessage = (timestamp: string, nonce: string, body: string) => `${timestamp}\n${nonce}\n${body}\n`

export function signWechatPayRequest(credentials: WechatPayCredentials, method: string, canonicalUrl: string, body = '') {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomBytes(16).toString('hex')
  const message = `${method.toUpperCase()}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`
  const signer = createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  const signature = signer.sign(normalizePem(credentials.privateKey), 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${credentials.merchantId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${credentials.merchantSerialNo}",signature="${signature}"`
}

export function verifyWechatPaySignature(credentials: WechatPayCredentials, headers: WechatPayHeaders, body: string) {
  const serial = String(headers['wechatpay-serial'] ?? '')
  const signature = String(headers['wechatpay-signature'] ?? '')
  const timestamp = String(headers['wechatpay-timestamp'] ?? '')
  const nonce = String(headers['wechatpay-nonce'] ?? '')
  if (!serial || !signature || !timestamp || !nonce) throw Object.assign(new Error('缺少微信支付签名请求头'), { statusCode: 401 })
  if (serial !== credentials.wechatPayPublicKeyId) throw Object.assign(new Error('微信支付公钥 ID 不匹配'), { statusCode: 401 })
  if (signature.startsWith('WECHATPAY/SIGNTEST/')) throw Object.assign(new Error('拒绝微信支付签名探测流量'), { statusCode: 401 })
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw Object.assign(new Error('微信支付签名时间戳已过期'), { statusCode: 401 })
  const verifier = createVerify('RSA-SHA256')
  verifier.update(signatureMessage(timestamp, nonce, body))
  verifier.end()
  if (!verifier.verify(normalizePem(credentials.wechatPayPublicKey), signature, 'base64')) throw Object.assign(new Error('微信支付签名验证失败'), { statusCode: 401 })
}

export function decryptWechatPayResource(apiV3Key: string, resource: { algorithm: string; ciphertext: string; associated_data?: string; nonce: string }) {
  if (resource.algorithm !== 'AEAD_AES_256_GCM') throw Object.assign(new Error('不支持的微信支付回调加密算法'), { statusCode: 400 })
  if (Buffer.byteLength(apiV3Key) !== 32) throw Object.assign(new Error('微信支付 API v3 密钥必须为 32 字节'), { statusCode: 500 })
  const encrypted = Buffer.from(resource.ciphertext, 'base64')
  if (encrypted.length <= 16) throw Object.assign(new Error('微信支付回调密文不合法'), { statusCode: 400 })
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key), Buffer.from(resource.nonce))
  decipher.setAuthTag(encrypted.subarray(encrypted.length - 16))
  decipher.setAAD(Buffer.from(resource.associated_data ?? ''))
  return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8')) as Record<string, unknown>
}

export async function createWechatNativeOrder(credentials: WechatPayCredentials, input: { orderNo: string; description: string; amount: number; notifyUrl: string; attach: string }, production: boolean) {
  if (!production && credentials.merchantId.startsWith('mock_')) return { code_url: `weixin://wxpay/mock/${input.orderNo}`, mock: true }
  const path = '/v3/pay/transactions/native'
  const body = JSON.stringify({ appid: credentials.appId, mchid: credentials.merchantId, description: input.description.slice(0, 127), out_trade_no: input.orderNo, notify_url: input.notifyUrl, attach: input.attach, amount: { total: input.amount, currency: 'CNY' } })
  let response: Response
  try {
    response = await fetch(`https://api.mch.weixin.qq.com${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: signWechatPayRequest(credentials, 'POST', path, body) }, body, signal: AbortSignal.timeout(15000) })
  } catch (error) {
    throw Object.assign(new Error(`微信支付连接失败：${error instanceof Error ? error.message : '网络错误'}`), { statusCode: 502 })
  }
  const raw = await response.text()
  if (!response.ok) {
    const detail = (() => { try { const value = JSON.parse(raw) as { message?: string }; return value.message } catch { return '' } })()
    throw Object.assign(new Error(`微信支付下单失败：${detail || response.statusText}`), { statusCode: 502 })
  }
  verifyWechatPaySignature(credentials, Object.fromEntries(response.headers.entries()), raw)
  const result = JSON.parse(raw) as { code_url?: string }
  if (!result.code_url) throw Object.assign(new Error('微信支付未返回 Native 支付二维码'), { statusCode: 502 })
  return result
}