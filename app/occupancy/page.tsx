import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import OccupancyAccordion from '@/components/OccupancyAccordion'

export default async function OccupancyPage() {
  const supabase = await createServerSupabaseClient()
  const svc = createServiceRoleSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'owner') redirect('/login')

  let { data: owner } = await supabase
    .from('owners').select('id, name').eq('user_id', user.id).single()
  if (!owner && user.email) {
    const { data: byEmail } = await svc
      .from('owners').select('id, name').eq('email', user.email).single()
    if (byEmail) {
      await svc.from('owners').update({ user_id: user.id }).eq('id', byEmail.id)
      owner = byEmail
    }
  }
  if (!owner) redirect('/dashboard')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: props } = await supabase
    .from('properties')
    .select('id, name, total_units')
    .eq('owner_id', owner.id)
    .order('name')

  const pids = (props ?? []).map(p => p.id)

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, property_id, room_number, floor_plan, status, rent_amount')
    .in('property_id', pids.length ? pids : [''])
    .order('room_number')

  const propertiesWithRooms = (props ?? []).map(p => ({
    id: p.id,
    name: p.name,
    total_units: p.total_units,
    rooms: (rooms ?? []).filter(r => r.property_id === p.id),
  }))

  // 整合性チェック（入居数 > total_units の検出）
  const warnings = propertiesWithRooms.filter(p => {
    const occ = p.rooms.filter(r => r.status === 'occupied').length
    return occ > p.total_units
  })

  const totalRooms = (rooms ?? []).length
  const totalOccupied = (rooms ?? []).filter(r => r.status === 'occupied').length
  const totalOccupancy = totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-blue-600 text-sm font-medium shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          戻る
        </Link>
        <h1 className="font-bold text-gray-900 text-base">入居状況の内訳</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* 整合性警告 */}
        {warnings.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
            ⚠️ 入居数が総戸数を超えている物件があります：
            {warnings.map(w => {
              const occ = w.rooms.filter(r => r.status === 'occupied').length
              return <span key={w.id} className="font-semibold"> {w.name}（{occ}/{w.total_units}）</span>
            })}
          </div>
        )}

        {/* 全体サマリーカード */}
        <div className="bg-green-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">{year}年{month}月　入居状況</p>
          <p className="text-4xl font-bold mt-1.5 tracking-tight tabular-nums">{totalOccupancy}%</p>
          <p className="text-lg font-semibold mt-1 opacity-90 tabular-nums">
            {totalOccupied}/{totalRooms} 室入居中
          </p>
        </div>

        {/* 物件別アコーディオン */}
        <OccupancyAccordion properties={propertiesWithRooms} />

      </main>
    </div>
  )
}
