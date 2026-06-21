import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// .env.local を手動パース
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('環境変数が取得できません')
  process.exit(1)
}

// project ref を URL から抽出 (https://<ref>.supabase.co)
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
console.log('Project ref:', projectRef)

const sql = `ALTER TABLE properties ADD COLUMN IF NOT EXISTS acquisition_price BIGINT;`

// pg-meta API でDDL実行
async function runMigration() {
  const pgMetaUrl = `${SUPABASE_URL}/pg-meta/v0/query`

  try {
    const res = await fetch(pgMetaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'x-pg-meta-schema': 'public',
      },
      body: JSON.stringify({ query: sql }),
    })

    if (res.ok) {
      const data = await res.json()
      console.log('✅ pg-meta API成功:', data)
      return true
    } else {
      const text = await res.text()
      console.warn('⚠️ pg-meta API失敗 (status', res.status, '):', text.slice(0, 300))
      return false
    }
  } catch (e) {
    console.warn('⚠️ pg-meta APIエラー:', e.message)
    return false
  }
}

// supabase-js でカラム存在チェック
async function checkColumn() {
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data, error } = await svc
    .from('properties')
    .select('acquisition_price')
    .limit(1)

  if (error && error.message.includes('acquisition_price')) {
    return false
  }
  return true
}

async function main() {
  console.log('カラム存在チェック中...')
  const exists = await checkColumn()

  if (exists) {
    console.log('✅ acquisition_price カラムはすでに存在します')
    return
  }

  console.log('カラムが存在しないため、マイグレーションを実行します...')
  const ok = await runMigration()

  if (!ok) {
    console.log('\n──────────────────────────────────────────')
    console.log('手動でSupabase SQL Editorから以下を実行してください:')
    console.log(sql)
    console.log('──────────────────────────────────────────')
    process.exit(1)
  }

  // 確認
  const existsAfter = await checkColumn()
  if (existsAfter) {
    console.log('✅ マイグレーション完了: acquisition_price BIGINT カラムを追加しました')
  } else {
    console.log('❌ マイグレーション後もカラムが見つかりません')
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
