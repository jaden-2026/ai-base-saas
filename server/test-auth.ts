import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { redis } from './db.js'
import { sha256 } from './security.js'

export async function createTestCaptcha(value = 'TEST') {
  const captchaId = randomUUID()
  const answerHash = sha256(`${config.secret}:${value.trim().toLowerCase()}`)
  await redis.set(`captcha:${captchaId}`, answerHash, 'EX', 300)
  return { captchaId, captchaCode: value }
}

export async function loginBody(email: string, password: string) {
  return { email, password, ...await createTestCaptcha() }
}