import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

// ブラウザコンソールを全てキャプチャ
page.on('console', msg => {
  console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text())
})

console.log('=== STEP 1: /login にアクセス ===')
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
console.log('URL:', page.url())

console.log('\n=== STEP 2: フォーム入力 ===')
await page.fill('#email', 'onelessroom@gmail.com')
await page.fill('#password', 'Admin1234!')

console.log('\n=== STEP 3: ログインボタンクリック（10秒待機）===')
await page.click('button[type="submit"]')
await page.waitForTimeout(8000)
console.log('最終URL:', page.url())

const h1 = await page.textContent('h1').catch(() => null)
const errorMsg = await page.locator('p.text-red-600').first().textContent().catch(() => null)
console.log('h1:', h1)
console.log('エラーメッセージ:', errorMsg)

const bodyText = await page.locator('body').textContent().catch(() => null)
console.log('body(先頭200字):', bodyText?.trim().slice(0, 200))

console.log('\n=== PROBE: Cookie 確認 ===')
const cookies = await page.context().cookies('http://localhost:3000')
const sessionCookies = cookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-'))
console.log('Supabase Cookie 数:', sessionCookies.length)
sessionCookies.forEach(c => console.log(' -', c.name, '=', c.value.slice(0, 50) + '...'))

console.log('\n=== PROBE: 未ログイン /admin ===')
const browser2 = await chromium.launch({ headless: true })
const page2 = await browser2.newPage()
await page2.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' })
console.log('未ログイン /admin 後URL:', page2.url())
await browser2.close()

await browser.close()
console.log('\nDone.')
