import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local を手動で読み込む
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const value = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = value
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('ERROR: .env.local に以下を設定してください:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL  :', url ? '✓' : '未設定')
  console.error('  SUPABASE_SERVICE_ROLE_KEY :', serviceRoleKey ? '✓' : '未設定')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TARGET_EMAIL = 'onelessroom@gmail.com'
const NEW_PASSWORD = 'Admin1234!'

console.log(`対象ユーザー: ${TARGET_EMAIL}`)
console.log('ユーザーを検索中...')

const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
if (listError) {
  console.error('ユーザー一覧取得エラー:', listError.message)
  process.exit(1)
}

const user = users.find((u) => u.email === TARGET_EMAIL)
if (!user) {
  console.error(`エラー: ${TARGET_EMAIL} が見つかりません`)
  process.exit(1)
}

console.log(`ユーザー発見: id=${user.id}`)
console.log('パスワードを更新中...')

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password: NEW_PASSWORD,
})

if (updateError) {
  console.error('パスワード更新エラー:', updateError.message)
  process.exit(1)
}

console.log('✓ パスワードの設定が完了しました')
console.log(`  email   : ${TARGET_EMAIL}`)
console.log(`  password: ${NEW_PASSWORD}`)
