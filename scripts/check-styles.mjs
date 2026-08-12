import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const distMode = process.argv.includes('--dist')
const read = path => readFileSync(resolve(root, path), 'utf8')
const failures = []
const requireMatch = (content, pattern, message) => {
  if (!pattern.test(content)) failures.push(message)
}
const rejectMatch = (content, pattern, message) => {
  if (pattern.test(content)) failures.push(message)
}
const validateCss = (css, label) => {
  rejectMatch(css, /@import\s/i, `${label} must not use @import; keep critical styles independent of remote or chained stylesheets`)
  rejectMatch(css, /url\(\s*(['"]?)https?:\/\//i, `${label} must not load remote CSS/font assets`)
  requireMatch(css, /\.login-page\s*\{/, `${label} is missing the login page layout`)
  requireMatch(css, /\.login-hero\s*\{/, `${label} is missing the login brand area`)
  requireMatch(css, /@media\s*\((?:max-width:\s*900px|width\s*<=\s*900px)\)[^{]*\{[^}]*\.login-page\s*\{/s, `${label} is missing the 900px login layout`)
  if ((css.match(/{/g) ?? []).length !== (css.match(/}/g) ?? []).length) failures.push(`${label} has unbalanced braces`)
}

if (distMode) {
  const htmlPath = resolve(root, 'dist/index.html')
  if (!existsSync(htmlPath)) failures.push('dist/index.html is missing; run Vite build before the dist style check')
  else {
    const html = readFileSync(htmlPath, 'utf8')
    const href = html.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["']/i)?.[1]
      ?? html.match(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*rel=["']stylesheet["']/i)?.[1]
    if (!href) failures.push('dist/index.html does not contain a stylesheet link')
    else {
      const cssPath = resolve(root, 'dist', href.replace(/^\//, ''))
      if (!existsSync(cssPath)) failures.push(`built stylesheet does not exist: ${href}`)
      else validateCss(readFileSync(cssPath, 'utf8'), href)
    }
  }
} else {
  const html = read('index.html')
  const main = read('src/main.tsx')
  const css = read('src/styles.css')
  requireMatch(html, /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\/src\/styles\.css["']/i, 'index.html must load /src/styles.css as a browser stylesheet')
  rejectMatch(main, /import\s+['"]\.\/styles\.css['"]/, 'src/main.tsx must not inject the global stylesheet through JavaScript')
  validateCss(css, 'src/styles.css')
}

if (failures.length) {
  console.error(`Style integrity check failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`Style integrity check passed (${distMode ? 'dist' : 'source'}).`)