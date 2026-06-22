/**
 * 各物件の年間家賃収入（在室room合計 × 12）÷ 0.08 で取得価格を逆算し、
 * acquisition_price が NULL の物件を更新する。
 * 端数は1万円単位（10,000円）で四捨五入。
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// 全物件 + rooms を取得
const { data: props, error } = await svc
  .from('properties')
  .select('id, name, acquisition_price, rooms(id, rent_amount, status)')
  .order('name')

if (error) { console.error('取得エラー:', error.message); process.exit(1) }

console.log('\n=== 物件一覧 ===')
for (const p of props) {
  const occupied = p.rooms.filter(r => r.status === 'occupied')
  const monthlyRent = occupied.reduce((s, r) => s + (r.rent_amount ?? 0), 0)
  const annualRent = monthlyRent * 12
  // 1万円単位で四捨五入
  const calcPrice = annualRent > 0
    ? Math.round((annualRent / 0.08) / 10000) * 10000
    : null

  console.log(`  ${p.name}`)
  console.log(`    在室 ${occupied.length}室 / 月額家賃 ${monthlyRent.toLocaleString('ja-JP')}円 / 年間 ${annualRent.toLocaleString('ja-JP')}円`)
  console.log(`    取得価格 現在=${p.acquisition_price ?? 'NULL'} → 逆算=${calcPrice != null ? calcPrice.toLocaleString('ja-JP') : 'スキップ(家賃0)'}`)

  if (p.acquisition_price != null) {
    console.log(`    → 既に登録済みのためスキップ`)
    continue
  }
  if (calcPrice == null) {
    console.log(`    → 家賃収入が0のためスキップ`)
    continue
  }

  const { error: updateErr } = await svc
    .from('properties')
    .update({ acquisition_price: calcPrice })
    .eq('id', p.id)

  if (updateErr) {
    console.error(`    ✗ 更新失敗: ${updateErr.message}`)
  } else {
    console.log(`    ✅ 更新完了: ¥${calcPrice.toLocaleString('ja-JP')}`)
  }
}

console.log('\n完了')
