import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: props, error } = await svc.from('properties').select('id, name, acquisition_price').order('name')
if (error) { console.error(error.message); process.exit(1) }

console.log('登録済み物件:')
props.forEach(p => console.log(`  ${p.name}: 取得価格=${p.acquisition_price ?? '未登録'}`))

// 先頭2件に取得価格をセット（すでに設定されている場合はスキップ）
const targets = props.filter(p => p.acquisition_price == null).slice(0, 2)
if (targets.length === 0) {
  console.log('すでに取得価格が登録されています')
  process.exit(0)
}

const prices = [120_000_000, 85_000_000]
for (let i = 0; i < targets.length; i++) {
  const { error } = await svc.from('properties')
    .update({ acquisition_price: prices[i] })
    .eq('id', targets[i].id)
  if (error) {
    console.error(`${targets[i].name}: 更新失敗 - ${error.message}`)
  } else {
    console.log(`✅ ${targets[i].name}: 取得価格 ¥${prices[i].toLocaleString('ja-JP')} をセット`)
  }
}
