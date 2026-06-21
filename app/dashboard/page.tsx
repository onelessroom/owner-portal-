import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import DashboardCharts from '@/components/DashboardCharts'
import BottomNav from '@/components/BottomNav'
import type { MonthlyData } from '@/components/MonthlyBarChart'
import type { Expense } from '@/types'

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function getRemittanceAmount(r: Record<string, unknown>): number {
  if (typeof r.remittance_amount === 'number') return r.remittance_amount
  if (typeof r.amount === 'number') return r.amount
  return 0
}

function formatMoM(current: number, prev: number) {
  if (prev === 0) return { text: '前月比 -', cls: 'text-gray-400' }
  const d = ((current - prev) / prev) * 100
  if (Math.abs(d) < 0.05) return { text: '前月比 ±0%', cls: 'text-gray-400' }
  return d > 0
    ? { text: `前月比 +${d.toFixed(1)}% ↑`, cls: 'text-green-500' }
    : { text: `前月比 ${d.toFixed(1)}% ↓`, cls: 'text-red-500' }
}

function getDow(year: number, month: number, day: number) {
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(year, month - 1, day).getDay()]
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`
}

function categoryEmoji(cat: string): string {
  const m: Record<string, string> = {
    修繕費: '🔧', 清掃費: '🧹', 保険料: '🛡️', 租税公課: '🏛️', 管理料: '📋',
  }
  return m[cat] ?? '📌'
}

interface RepairRow {
  id: string
  title: string
  repair_date: string | null
  created_at: string
  rooms: { room_number: string } | null
  properties: { name: string } | null
}

function repairStatus(repairDate: string | null) {
  if (!repairDate)
    return { label: '対応中', badge: 'bg-yellow-100 text-yellow-700', ring: 'bg-yellow-100' }
  const today = new Date().toISOString().split('T')[0]
  if (repairDate <= today)
    return { label: '完了', badge: 'bg-green-100 text-green-700', ring: 'bg-green-100' }
  return { label: '対応予定', badge: 'bg-orange-100 text-orange-700', ring: 'bg-orange-100' }
}

// ─── ページ ──────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const svc = createServiceRoleSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'owner') redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  // オーナー情報（user_id未リンクは email で自動紐づけ）
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
  if (!owner) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500">アカウント情報が見つかりません。</p>
          <p className="text-sm text-gray-400 mt-1">管理会社にお問い合わせください。</p>
        </div>
      </div>
    )
  }

  const { data: props } = await supabase
    .from('properties').select('id').eq('owner_id', owner.id)
  const pids = (props ?? []).map(p => p.id)
  const noPids = ['']

  // 棒グラフ用の過去6ヶ月範囲
  const months6: { year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    months6.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  const minYear = months6[0].year
  const maxYear = months6[months6.length - 1].year

  // 並行クエリ
  const [
    { data: expRows },
    { data: prevExpRows },
    { data: remRows },
    { data: prevRemRows },
    { data: roomRows },
    { data: repRows },
    { data: histExp },
    { data: histRem },
  ] = await Promise.all([
    supabase.from('expenses').select('*')
      .in('property_id', pids.length ? pids : noPids)
      .eq('year', year).eq('month', month)
      .order('expense_date', { ascending: false }),
    supabase.from('expenses').select('amount')
      .in('property_id', pids.length ? pids : noPids)
      .eq('year', prevYear).eq('month', prevMonth),
    svc.from('remittances').select('*')
      .eq('owner_id', owner.id).eq('year', year).eq('month', month),
    svc.from('remittances').select('*')
      .eq('owner_id', owner.id).eq('year', prevYear).eq('month', prevMonth),
    supabase.from('rooms').select('status, property_id')
      .in('property_id', pids.length ? pids : noPids),
    svc.from('repairs')
      .select('id, title, repair_date, created_at, rooms(room_number), properties(name)')
      .in('property_id', pids.length ? pids : noPids)
      .order('repair_date', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('expenses').select('amount, year, month')
      .in('property_id', pids.length ? pids : noPids)
      .gte('year', minYear).lte('year', maxYear),
    svc.from('remittances').select('*')
      .eq('owner_id', owner.id).gte('year', minYear).lte('year', maxYear),
  ])

  // 集計
  const monthlyExpense = (expRows ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const prevExpense = (prevExpRows ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const monthlyRemittance = (remRows ?? []).reduce(
    (s, r) => s + getRemittanceAmount(r as Record<string, unknown>), 0)
  const prevRemittance = (prevRemRows ?? []).reduce(
    (s, r) => s + getRemittanceAmount(r as Record<string, unknown>), 0)
  const monthlyIncome = monthlyRemittance + monthlyExpense
  const prevIncome = prevRemittance + prevExpense

  const totalRooms = (roomRows ?? []).length
  const occupied = (roomRows ?? []).filter(r => r.status === 'occupied').length
  const occupancy = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0

  const allRepairs = (repRows ?? []) as unknown as RepairRow[]
  const thisMonthRepairCount = allRepairs.filter(r => {
    const d = new Date((r.repair_date || r.created_at.split('T')[0]) as string)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  }).length
  const inProgressRepairs = allRepairs.filter(r => !r.repair_date)
  const completedRepairs = allRepairs.filter(r => r.repair_date)
  const recentRepairs = [...inProgressRepairs, ...completedRepairs.slice(0, 3)]
  const recentExpenses = (expRows ?? []).slice(0, 3) as Expense[]

  const monthlyData: MonthlyData[] = months6.map(({ year: y, month: m }) => ({
    label: `${m}月`,
    income: (histRem ?? [])
      .filter(r => (r as Record<string, unknown>).year === y && (r as Record<string, unknown>).month === m)
      .reduce((s, r) => s + getRemittanceAmount(r as Record<string, unknown>), 0),
    expense: (histExp ?? [])
      .filter(e => e.year === y && e.month === m)
      .reduce((s, e) => s + (e.amount ?? 0), 0),
    remittance: 0,
  }))

  const incomeMoM = formatMoM(monthlyIncome, prevIncome)
  const expenseMoM = formatMoM(monthlyExpense, prevExpense)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-gray-500 leading-none select-none">≡</span>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">オーナーポータル</h1>
            <p className="text-xs text-gray-500">{owner.name} 様</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* 送金予定額カード（メイン青カード） */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl p-5 text-white shadow-lg">

          {/* 送金予定額：最上部に大きく */}
          <p className="text-sm font-medium opacity-80">今月の送金予定額</p>
          <p className="text-4xl font-bold mt-1 tracking-tight tabular-nums">
            ¥{monthlyRemittance.toLocaleString('ja-JP')}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-sm opacity-75">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <span>{month}月25日（{getDow(year, month, 25)}）振込予定</span>
          </div>

          {/* 内訳 */}
          <div className="mt-4 border-t border-white/30 pt-3 space-y-1.5">
            <p className="text-xs font-medium opacity-60 mb-2">内訳</p>
            <div className="flex items-baseline justify-between">
              <span className="text-sm opacity-80">家賃収入</span>
              <span className="text-base font-semibold tabular-nums">¥{monthlyIncome.toLocaleString('ja-JP')}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm opacity-80">支出</span>
              <span className="text-base font-semibold tabular-nums opacity-90">− ¥{monthlyExpense.toLocaleString('ja-JP')}</span>
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <Link
              href="/remittances"
              className="bg-white/90 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm"
            >
              送金履歴
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </div>

        {/* 今月の状況 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            今月の状況（{year}年{month}月）
          </h2>
          <div className="grid grid-cols-2 gap-3">

            {/* 家賃収入 */}
            <Link href="/rent-income" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px] active:bg-blue-50 transition-colors">
              <p className="text-sm font-bold text-gray-800">家賃収入（総収入）</p>
              <p className="text-2xl font-bold text-blue-600 mt-3 leading-tight tabular-nums">
                ¥{monthlyIncome.toLocaleString('ja-JP')}
              </p>
              <p className="text-xs text-blue-400 mt-2 text-right">内訳を見る →</p>
            </Link>

            {/* 支出 */}
            <Link href="/expenses" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px] active:bg-red-50 transition-colors">
              <p className="text-sm font-bold text-gray-800">今月の支出</p>
              <p className="text-2xl font-bold text-red-500 mt-3 leading-tight tabular-nums">
                ¥{monthlyExpense.toLocaleString('ja-JP')}
              </p>
              <p className="text-xs text-red-400 mt-2 text-right">内訳を見る →</p>
            </Link>

            {/* 入居率 */}
            <Link href="/occupancy" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px] active:bg-green-50 transition-colors">
              <p className="text-sm font-bold text-gray-800">入居率</p>
              <p className="text-2xl font-bold text-green-600 mt-3 leading-tight">{occupancy}%</p>
              <div className="flex items-end justify-between mt-2">
                <p className="text-xs text-gray-500">{occupied}/{totalRooms}</p>
                <p className="text-xs text-green-500">内訳を見る →</p>
              </div>
            </Link>

            {/* 修繕件数 */}
            <Link href="/repairs" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px] active:bg-orange-50 transition-colors">
              <p className="text-sm font-bold text-gray-800">修繕件数</p>
              <p className="text-2xl font-bold text-orange-500 mt-3 leading-tight">{thisMonthRepairCount}件</p>
              <p className="text-xs text-orange-400 mt-2 text-right">内訳を見る →</p>
            </Link>
          </div>
        </section>

        {/* 月次レポート */}
        <Link
          href={`/report?year=${year}&month=${month}`}
          className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5 flex items-center justify-between active:bg-blue-100 transition-colors"
        >
          <div>
            <p className="text-sm font-bold text-blue-900">{year}年{month}月のレポートを見る</p>
            <p className="text-xs text-blue-600 mt-0.5">収支の流れを文章でわかりやすく</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-400 shrink-0 ml-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {/* グラフ（recharts, CSR） */}
        <DashboardCharts
          expenses={(expRows ?? []) as Expense[]}
          monthlyData={monthlyData}
        />

        {/* 最近の支出 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">最近の支出</h2>
            <Link href="/expenses" className="text-xs text-blue-600 font-medium">すべて見る</Link>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center text-sm text-gray-400">
              今月の支出はありません
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {recentExpenses.map((e, i) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i < recentExpenses.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0 text-base">
                    {categoryEmoji(e.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {e.description || e.category}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.expense_date)}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0 tabular-nums">
                    ¥{e.amount.toLocaleString('ja-JP')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 最近の修繕・対応 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">最近の修繕・対応</h2>
            <Link href="/repairs" className="text-xs text-blue-600 font-medium">すべて見る</Link>
          </div>
          {recentRepairs.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center text-sm text-gray-400">
              修繕記録はありません
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {recentRepairs.map((r, i) => {
                const room = r.rooms as { room_number: string } | null
                const propName = (r.properties as { name: string } | null)?.name ?? null
                const st = repairStatus(r.repair_date)
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-4 ${
                      i < recentRepairs.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${st.ring}`}>
                      {st.label === '完了' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-green-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {propName && (
                        <p className="text-xs font-medium text-gray-400 mb-0.5">{propName}</p>
                      )}
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {room ? `${room.room_number}号室　` : ''}{r.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">
                          {fmtDate(r.repair_date || r.created_at.split('T')[0])}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${st.badge}`}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-300 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="h-2" />
      </main>

      <BottomNav />

    </div>
  )
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="text-sm text-blue-600 font-medium hover:text-blue-800 px-2 py-1"
      >
        ログアウト
      </button>
    </form>
  )
}
