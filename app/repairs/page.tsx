import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import RepairAccordion from '@/components/RepairAccordion'

export default async function RepairsPage() {
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

  const { data: props } = await svc
    .from('properties')
    .select('id, name')
    .eq('owner_id', owner.id)
    .order('name')

  const pids = (props ?? []).map(p => p.id)

  type RawRepair = {
    id: string
    title: string
    reason: string | null
    contractor: string | null
    repair_date: string | null
    photo_urls: string[] | null
    estimate_url: string | null
    invoice_url: string | null
    property_id: string
    rooms: { room_number: string } | null
    expenses: { amount: number } | null
  }

  const { data: rawRepairs } = await svc
    .from('repairs')
    .select('id, title, reason, contractor, repair_date, photo_urls, estimate_url, invoice_url, property_id, rooms(room_number), expenses(amount)')
    .in('property_id', pids.length ? pids : [''])
    .order('repair_date', { ascending: false, nullsFirst: true })

  const repairs = ((rawRepairs ?? []) as unknown as RawRepair[]).map(r => ({
    id: r.id,
    title: r.title,
    reason: r.reason,
    contractor: r.contractor,
    repair_date: r.repair_date,
    expense_amount: (r.expenses as { amount: number } | null)?.amount ?? null,
    estimate_url: r.estimate_url,
    invoice_url: r.invoice_url,
    photo_urls: r.photo_urls,
    room_number: null as string | null,
    property_id: r.property_id,
  }))

  const propertiesWithRepairs = (props ?? []).map(p => ({
    id: p.id,
    name: p.name,
    repairs: repairs.filter(r => r.property_id === p.id),
  }))

  const totalCount = repairs.length
  const inProgressCount = repairs.filter(r => !r.repair_date).length

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
        <h1 className="font-bold text-gray-900 text-base">修繕履歴の内訳</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* サマリーカード */}
        <div className="bg-orange-500 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">修繕履歴　全件</p>
          <p className="text-4xl font-bold mt-1.5 tracking-tight tabular-nums">{totalCount}件</p>
          {inProgressCount > 0 ? (
            <p className="text-base font-semibold mt-1 opacity-90">
              うち対応中 {inProgressCount}件
            </p>
          ) : (
            <p className="text-base font-semibold mt-1 opacity-70">
              対応中なし
            </p>
          )}
        </div>

        {/* 物件別アコーディオン */}
        <RepairAccordion properties={propertiesWithRepairs} />

      </main>
    </div>
  )
}
