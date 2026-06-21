import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map((v, i) => i === 0 ? v : v.replace(/^"|"$/g, '')))
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: props } = await sb.from('properties').select('id, name, total_units')
const propId = n => props.find(p => p.name === n)?.id
const PROP_WAN = propId('ワンレスマンション')
const PROP_GRD = propId('グランフォート静岡')
const PROP_MAI = propId('メゾン葵')
const PROP_SUN = propId('サンハイツ富士')

await sb.from('rooms').update({ floor_plan: '1K' }).eq('property_id', PROP_WAN)
await sb.from('rooms').update({ floor_plan: '1LDK' }).eq('property_id', PROP_GRD).in('room_number', ['101','102','103','104','105'])
await sb.from('rooms').update({ floor_plan: '2LDK' }).eq('property_id', PROP_GRD).in('room_number', ['201','202','203','204','205'])
await sb.from('rooms').update({ floor_plan: '1DK' }).eq('property_id', PROP_MAI)
await sb.from('rooms').update({ floor_plan: '1K' }).eq('property_id', PROP_SUN).in('room_number', ['101','102','103','104','105'])
await sb.from('rooms').update({ floor_plan: '1DK' }).eq('property_id', PROP_SUN).in('room_number', ['201','202','203','204','205'])

for (const p of props) {
  const { data: rooms } = await sb.from('rooms').select('room_number, floor_plan, status, rent_amount').eq('property_id', p.id).order('room_number')
  const occ = rooms.filter(r => r.status === 'occupied').length
  console.log(`\n${p.name} (${occ}/${rooms.length}室 入居中 total_units=${p.total_units}) ${occ <= p.total_units ? '✓' : '⚠️超過'}`)
  rooms.forEach(r => console.log(`  ${r.room_number}号室 ${r.floor_plan} [${r.status}] ¥${r.rent_amount?.toLocaleString()}`))
}
console.log('\n✅ 完了')
