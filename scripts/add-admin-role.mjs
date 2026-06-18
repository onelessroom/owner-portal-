import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const value = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = value
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TARGET_EMAIL = 'onelessroom@gmail.com'

// ユーザーID取得
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
if (listError) { console.error(listError.message); process.exit(1) }

const user = users.find((u) => u.email === TARGET_EMAIL)
if (!user) { console.error(`${TARGET_EMAIL} が見つかりません`); process.exit(1) }

console.log(`ユーザー発見: id=${user.id}`)

// admin レコード挿入
const { error } = await supabase
  .from('user_roles')
  .insert({ user_id: user.id, role: 'admin' })

if (error) {
  if (error.code === '23505') {
    console.log('✓ すでに admin レコードが存在します（重複のためスキップ）')
  } else {
    console.error('挿入エラー:', error.message)
    process.exit(1)
  }
} else {
  console.log('✓ user_roles に admin レコードを追加しました')
  console.log(`  user_id: ${user.id}`)
  console.log(`  role   : admin`)
}
