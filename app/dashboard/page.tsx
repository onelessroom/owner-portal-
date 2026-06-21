import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import DashboardCharts from '@/components/DashboardCharts'
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
      .select('id, title, repair_date, created_at, rooms(room_number)')
      .in('property_id', pids.length ? pids : noPids)
      .order('created_at', { ascending: false }).limit(10),
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
  const recentRepairs = allRepairs.slice(0, 3)
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
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px]">
              <p className="text-sm font-bold text-gray-800">今月の支出</p>
              <p className="text-2xl font-bold text-red-500 mt-3 leading-tight tabular-nums">
                ¥{monthlyExpense.toLocaleString('ja-JP')}
              </p>
              <p className="text-xs mt-2 invisible">-</p>
            </div>

            {/* 入居率 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px]">
              <p className="text-sm font-bold text-gray-800">入居率</p>
              <p className="text-2xl font-bold text-green-600 mt-3 leading-tight">{occupancy}%</p>
              <p className="text-xs text-gray-500 mt-2">{occupied}/{totalRooms} 室入居中</p>
            </div>

            {/* 修繕件数 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[130px]">
              <p className="text-sm font-bold text-gray-800">修繕件数</p>
              <p className="text-2xl font-bold text-orange-500 mt-3 leading-tight">{thisMonthRepairCount}件</p>
              <p className="text-xs text-gray-400 mt-2">対応中 0件</p>
            </div>
          </div>
        </section>

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
                const st = repairStatus(r.repair_date)
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
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
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {room ? `${room.room_number}号室 ` : ''}{r.title}
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

        {/* グラフ（recharts, CSR） */}
        <DashboardCharts
          expenses={(expRows ?? []) as Expense[]}
          monthlyData={monthlyData}
        />

        <div className="h-2" />
      </main>

      {/* ボトムナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          <Link href="/dashboard" className="flex flex-col items-center py-3 gap-0.5 text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
              <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.432z" />
            </svg>
            <span className="text-xs font-semibold">ダッシュボード</span>
          </Link>
          <Link href="/remittances" className="flex flex-col items-center py-3 gap-0.5 text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
            <span className="text-xs">送金履歴</span>
          </Link>
          <Link href="/expenses" className="flex flex-col items-center py-3 gap-0.5 text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <span className="text-xs">支出一覧</span>
          </Link>
          <Link href="/repairs" className="flex flex-col items-center py-3 gap-0.5 text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
            <span className="text-xs">修繕履歴</span>
          </Link>
        </div>
      </nav>

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
