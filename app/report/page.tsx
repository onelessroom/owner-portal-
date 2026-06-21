import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import BottomNav from '@/components/BottomNav'

function formatJpn(n: number): string {
  if (n === 0) return '0円'
  const man = Math.floor(n / 10000)
  const rem = n % 10000
  if (man === 0) return `${rem.toLocaleString('ja-JP')}円`
  if (rem === 0) return `${man}万円`
  return `${man}万${rem.toLocaleString('ja-JP')}円`
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = params.year ? parseInt(params.year) : now.getFullYear()
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const isNextFuture =
    new Date(nextYear, nextMonth - 1) > new Date(now.getFullYear(), now.getMonth())

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

  const { data: props } = await supabase
    .from('properties').select('id').eq('owner_id', owner.id)
  const pids = (props ?? []).map(p => p.id)

  const [{ data: remRow }, { data: prevRemRow }, { data: expRows }] = await Promise.all([
    svc.from('remittances')
      .select('remittance_amount')
      .eq('owner_id', owner.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    svc.from('remittances')
      .select('remittance_amount')
      .eq('owner_id', owner.id)
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .maybeSingle(),
    supabase.from('expenses')
      .select('amount, description, category')
      .in('property_id', pids.length ? pids : [''])
      .eq('year', year)
      .eq('month', month)
      .order('amount', { ascending: false }),
  ])

  const remittance =
    (remRow as { remittance_amount: number } | null)?.remittance_amount ?? null
  const prevRemittance =
    (prevRemRow as { remittance_amount: number } | null)?.remittance_amount ?? null
  const expenses =
    (expRows ?? []) as { amount: number; description: string | null; category: string }[]

  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const income = remittance !== null ? remittance + totalExpense : null
  const topExpenses = expenses.slice(0, 2)
  const hasRepairExpenses = expenses.some(e => e.category === '修繕費')
  const remittanceDiff = remittance !== null && prevRemittance !== null
    ? remittance - prevRemittance
    : null

  const chevronRight = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-300 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )

  const relatedLinks = [
    { href: '/remittances', label: '送金履歴を見る' },
    { href: `/expenses?year=${year}&month=${month}`, label: `${month}月の支出の内訳` },
    { href: '/repairs', label: '修繕履歴' },
    { href: '/dashboard', label: 'ダッシュボードへ戻る' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-blue-600 text-sm font-medium shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          戻る
        </Link>
        <h1 className="font-bold text-gray-900 text-base">月次レポート</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between">
          <Link
            href={`/report?year=${prevYear}&month=${prevMonth}`}
            className="text-sm font-medium text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            ◀ 前月
          </Link>
          <p className="text-base font-bold text-gray-900">{year}年{month}月</p>
          {isNextFuture ? (
            <span className="text-sm text-gray-300 px-3 py-2">翌月 ▶</span>
          ) : (
            <Link
              href={`/report?year=${nextYear}&month=${nextMonth}`}
              className="text-sm font-medium text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors"
            >
              翌月 ▶
            </Link>
          )}
        </div>

        {/* ── メイン文章カード ─────────────────────────────── */}
        <div className="bg-white rounded-2xl px-6 py-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 mb-5 tracking-wider">
            {year}年{month}月のレポート
          </p>

          {remittance === null ? (
            <p className="text-base text-gray-500 leading-relaxed">
              この月の送金データはまだありません。
            </p>
          ) : (
            <div className="space-y-5">

              {/* 送金額（青色で金額を強調） */}
              <p className="text-xl font-bold text-gray-900 leading-relaxed">
                今月の送金額は{' '}
                <span className="text-blue-600">{formatJpn(remittance)}</span>
                {' '}でした。
              </p>

              {/* 前月比（色なし・中立） */}
              {remittanceDiff !== null && (
                <p className="text-base text-gray-700 leading-relaxed">
                  {remittanceDiff === 0
                    ? '先月と同額でした。'
                    : `先月より${formatJpn(Math.abs(remittanceDiff))}${remittanceDiff > 0 ? '増えました' : '減りました'}。`
                  }
                </p>
              )}

              {/* 費用（箇条書き） */}
              {topExpenses.length > 0 ? (
                <div>
                  <p className="text-base text-gray-700 font-medium mb-2">主な費用：</p>
                  <div className="space-y-2">
                    {topExpenses.map((e, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-base text-gray-700">
                        <span className="shrink-0 text-gray-400 mt-0.5">・</span>
                        <span className="flex-1 leading-snug">{e.description || e.category}</span>
                        <span className="tabular-nums shrink-0 ml-2 font-semibold text-gray-900">
                          {formatJpn(e.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!hasRepairExpenses && (
                    <p className="text-base text-gray-600 mt-4 leading-relaxed">
                      今月は大きな修繕はありませんでした。
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-base text-gray-700 leading-relaxed">
                  今月は大きな費用はありませんでした。
                </p>
              )}

            </div>
          )}
        </div>

        {/* ── 内訳カード（送金額が主役・青背景） ─────────────── */}
        {remittance !== null && (
          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* 送金額：主役・塗りつぶし青 */}
            <div className="bg-blue-600 px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold text-white/80">送金額</span>
              <span className="text-2xl font-bold text-white tabular-nums">
                {formatJpn(remittance)}
              </span>
            </div>

            {/* 家賃収入・支出 */}
            <div className="bg-white px-5 py-4 space-y-3">
              {income !== null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-600">家賃収入</span>
                  <span className="text-base font-semibold text-blue-600 tabular-nums">
                    {formatJpn(income)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">支出</span>
                <span className="text-base font-semibold text-red-500 tabular-nums">
                  − {formatJpn(totalExpense)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 関連ページへの導線 ──────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2 px-1 tracking-wider">関連ページ</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {relatedLinks.map(({ href, label }, i) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors ${
                  i < relatedLinks.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <span className="text-sm font-medium text-gray-800">{label}</span>
                {chevronRight}
              </Link>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
