import { randomUUID } from 'node:crypto'
import svgCaptcha from 'svg-captcha'
import { config } from './config.js'
import { redis } from './db.js'
import { sha256 } from './security.js'

const CAPTCHA_TTL_SECONDS = 300
const captchaKey = (id: string) => `captcha:${id}`
const captchaHash = (value: string) => sha256(`${config.secret}:${value.trim().toLowerCase()}`)

export async function createCaptcha() {
  const id = randomUUID()
  const captcha = svgCaptcha.create({
    size: 4,
    width: 132,
    height: 44,
    fontSize: 48,
    noise: 3,
    color: true,
    background: '#f7f7fb',
    ignoreChars: '0o1ilI',
  })
  await redis.set(captchaKey(id), captchaHash(captcha.text), 'EX', CAPTCHA_TTL_SECONDS)
  return { id, svg: captcha.data, expiresIn: CAPTCHA_TTL_SECONDS }
}

export async function verifyCaptcha(id: string, value: string) {
  const expected = await redis.eval(
    `local value = redis.call('GET', KEYS[1])
     if value then redis.call('DEL', KEYS[1]) end
     return value`,
    1,
    captchaKey(id),
  ) as string | null
  return expected !== null && expected === captchaHash(value)
}
