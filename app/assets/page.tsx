import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import BottomNav from '@/components/BottomNav'
import AssetsChart, { ChartMonth } from '@/components/AssetsChart'
import AssetsAccordion, { PropertyAsset } from '@/components/AssetsAccordion'

function formatJpn(n: number): string {
  if (n === 0) return '0円'
  const man = Math.floor(n / 10000)
  const rem = n % 10000
  if (man === 0) return `${rem.toLocaleString('ja-JP')}円`
  if (rem === 0) return `${man}万円`
  return `${man}万${rem.toLocaleString('ja-JP')}円`
}

function pctStr(v: number) {
  return v.toFixed(2) + '%'
}

function diffLabel(curr: number, prev: number | null) {
  if (prev === null || prev === 0) return null
  const diff = curr - prev
  const sign = diff >= 0 ? '+' : ''
  return { text: `${sign}${formatJpn(Math.abs(diff))} (${sign}${((diff / prev) * 100).toFixed(1)}%)`, positive: diff >= 0 }
}

export default async function AssetsPage() {
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

  // 直近12ヶ月のリスト
  const now = new Date()
  const months12: Array<{ year: number; month: number }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months12.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  const startYear = months12[0].year
  // 前年同期間
  const months12Prev = months12.map(m => ({ year: m.year - 1, month: m.month }))
  const startYearPrev = months12Prev[0].year

  const isInMonths = (year: number, month: number, ms: Array<{ year: number; month: number }>) =>
    ms.some(m => m.year === year && m.month === month)

  // 物件取得
  const { data: propsRaw } = await svc
    .from('properties')
    .select('id, name, address, acquisition_price, total_units, rooms(id, rent_amount, status)')
    .eq('owner_id', owner.id)
    .order('name')

  const props = (propsRaw ?? []) as Array<{
    id: string; name: string; address: string | null;
    acquisition_price: number | null; total_units: number;
    rooms: Array<{ id: string; rent_amount: number | null; status: string }>
  }>
  const pids = props.map(p => p.id)

  // データ取得
  const [
    { data: remRows },
    { data: expRows },
    { data: remRowsPrev },
    { data: expRowsPrev },
  ] = await Promise.all([
    svc.from('remittances').select('year,month,remittance_amount')
      .eq('owner_id', owner.id).gte('year', startYear),
    svc.from('expenses').select('year,month,amount,property_id')
      .in('property_id', pids.length ? pids : ['_']).gte('year', startYear),
    svc.from('remittances').select('year,month,remittance_amount')
      .eq('owner_id', owner.id).gte('year', startYearPrev).lt('year', startYear),
    svc.from('expenses').select('year,month,amount,property_id')
      .in('property_id', pids.length ? pids : ['_']).gte('year', startYearPrev).lt('year', startYear),
  ])

  type Rem = { year: number; month: number; remittance_amount: number }
  type Exp = { year: number; month: number; amount: number; property_id: string }

  const rems = ((remRows ?? []) as Rem[]).filter(r => isInMonths(r.year, r.month, months12))
  const exps = ((expRows ?? []) as Exp[]).filter(e => isInMonths(e.year, e.month, months12))
  const remsPrev = ((remRowsPrev ?? []) as Rem[]).filter(r => isInMonths(r.year, r.month, months12Prev))
  const expsPrev = ((expRowsPrev ?? []) as Exp[]).filter(e => isInMonths(e.year, e.month, months12Prev))

  // 集計（当期）
  const totalRemittance = rems.reduce((s, r) => s + r.remittance_amount, 0)
  const totalExpense = exps.reduce((s, e) => s + e.amount, 0)
  const totalIncome = totalRemittance + totalExpense // 家賃収入（グロス）
  const totalProfit = totalRemittance // 収支 = 家賃収入 - 支出 = 送金額

  // 集計（前年）
  const totalRemittancePrev = remsPrev.reduce((s, r) => s + r.remittance_amount, 0)
  const totalExpensePrev = expsPrev.reduce((s, e) => s + e.amount, 0)
  const totalIncomePrev = totalRemittancePrev + totalExpensePrev
  const hasPrevData = remsPrev.length > 0 || expsPrev.length > 0

  // 全体利回り（取得価格登録済み物件のみ）
  const propsWithPrice = props.filter(p => p.acquisition_price != null && p.acquisition_price > 0)
  const totalAcqPrice = propsWithPrice.reduce((s, p) => s + (p.acquisition_price ?? 0), 0)
  const overallYield = propsWithPrice.length > 0 && totalAcqPrice > 0
    ? (totalIncome / totalAcqPrice) * 100
    : null

  // 月次チャートデータ
  const chartData: ChartMonth[] = months12.map(({ year, month }) => {
    const rem = rems.find(r => r.year === year && r.month === month)?.remittance_amount ?? 0
    const exp = exps.filter(e => e.year === year && e.month === month)
      .reduce((s, e) => s + e.amount, 0)
    return {
      label: `${String(month).padStart(2, '0')}月`,
      income: rem + exp,
      expense: exp,
      profit: rem,
    }
  })

  // 物件別アコーディオンデータ
  const propertyAssets: PropertyAsset[] = props.map(p => {
    const annualExpense = exps
      .filter(e => e.property_id === p.id)
      .reduce((s, e) => s + e.amount, 0)
    const monthlyRent = p.rooms
      .filter(r => r.status === 'occupied')
      .reduce((s, r) => s + (r.rent_amount ?? 0), 0)
    const estimatedAnnualIncome = monthlyRent * 12
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      acquisition_price: p.acquisition_price,
      annualExpense,
      estimatedAnnualIncome,
    }
  })

  const incDiff = hasPrevData ? diffLabel(totalIncome, totalIncomePrev) : null
  const expDiff = hasPrevData ? diffLabel(totalExpense, totalExpensePrev) : null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/dashboard" className="flex items-center gap-1 text-blue-600 text-sm font-medium shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          戻る
        </Link>
        <h1 className="font-bold text-gray-900 text-base">資産状況</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* ── 全体サマリー ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 tracking-wider mb-1">
              直近12ヶ月の資産状況
            </p>
            <p className="text-xs text-gray-400">
              {months12[0].year}年{months12[0].month}月 〜 {months12[11].year}年{months12[11].month}月
            </p>
          </div>

          <div className="px-5 py-5 space-y-4">
            {/* 年間家賃収入 */}
            <div>
              <p className="text-sm text-gray-500 mb-0.5">年間家賃収入</p>
              <p className="text-3xl font-bold text-blue-600">{formatJpn(totalIncome)}</p>
              {incDiff && (
                <p className={`text-xs mt-1 ${incDiff.positive ? 'text-blue-500' : 'text-red-500'}`}>
                  前年比 {incDiff.text}
                </p>
              )}
              {!hasPrevData && <p className="text-xs text-gray-400 mt-1">前年データなし</p>}
            </div>

            {/* 年間支出・収支 */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-xs text-red-500 font-medium mb-1">年間支出</p>
                <p className="text-xl font-bold text-red-600">{formatJpn(totalExpense)}</p>
                {expDiff && (
                  <p className={`text-xs mt-1 ${expDiff.positive ? 'text-red-500' : 'text-green-500'}`}>
                    前年比 {expDiff.text}
                  </p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 font-medium mb-1">年間収支</p>
                <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {totalProfit >= 0 ? '' : '− '}{formatJpn(Math.abs(totalProfit))}
                </p>
              </div>
            </div>

            {/* 全体利回り */}
            <div className="border-t border-gray-100 pt-4">
              {overallYield !== null ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-gray-600 font-medium">全体の表面利回り</span>
                    <span className="text-2xl font-bold text-gray-900">{pctStr(overallYield)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    取得価格登録済み {propsWithPrice.length}/{props.length} 件
                    　合計取得価格 {formatJpn(totalAcqPrice)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    年間家賃収入 ÷ 物件の購入価格で計算した、ざっくりの利回りです
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">全体の表面利回り</span>
                  <span className="text-sm text-orange-500">取得価格未登録</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 月次推移グラフ ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-xs font-semibold text-gray-400 tracking-wider mb-3">月次推移</p>
          <AssetsChart data={chartData} />
        </section>

        {/* ── 物件別アコーディオン ── */}
        <section>
          <p className="text-xs font-semibold text-gray-400 tracking-wider mb-2 px-1">物件別の内訳</p>
          <AssetsAccordion properties={propertyAssets} />
        </section>

      </main>

      <BottomNav />
    </div>
  )
}
