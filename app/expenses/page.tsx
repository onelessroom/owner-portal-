import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase-server'
import ExpenseAccordion from '@/components/ExpenseAccordion'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const svc = createServiceRoleSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'owner') redirect('/login')

  let { data: owner } = await supabase
    .from('owners').select('id').eq('user_id', user.id).single()
  if (!owner && user.email) {
    const { data: byEmail } = await svc
      .from('owners').select('id').eq('email', user.email).single()
    if (byEmail) {
      await svc.from('owners').update({ user_id: user.id }).eq('id', byEmail.id)
      owner = byEmail
    }
  }
  if (!owner) redirect('/dashboard')

  const now = new Date()
  const params = await searchParams
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1

  const { data: props } = await supabase
    .from('properties')
    .select('id, name')
    .eq('owner_id', owner.id)
    .order('name')

  const pids = (props ?? []).map(p => p.id)

  const { data: expRows } = await supabase
    .from('expenses')
    .select('*')
    .in('property_id', pids.length ? pids : [''])
    .eq('year', year)
    .eq('month', month)
    .order('expense_date', { ascending: false })

  // 物件ごとにグループ化（支出がある物件のみ表示）
  const propertiesWithExpenses = (props ?? [])
    .map(p => ({
      id: p.id,
      name: p.name,
      expenses: (expRows ?? []).filter(e => e.property_id === p.id),
    }))
    .filter(p => p.expenses.length > 0)

  // 物件未設定の支出は「未分類」としてまとめる
  const unassigned = (expRows ?? []).filter(e => !e.property_id)
  if (unassigned.length > 0) {
    propertiesWithExpenses.push({ id: 'unassigned', name: '未分類', expenses: unassigned })
  }

  const totalExpense = (expRows ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)

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
        <h1 className="font-bold text-gray-900 text-base">支出一覧</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* 月切り替え */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
          <Link
            href={`/expenses?year=${prevYear}&month=${prevMonth}`}
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-full text-xl font-light"
          >
            ‹
          </Link>
          <span className="font-semibold text-gray-900 text-base">{year}年{month}月</span>
          <Link
            href={`/expenses?year=${nextYear}&month=${nextMonth}`}
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-full text-xl font-light"
          >
            ›
          </Link>
        </div>

        {/* 合計カード */}
        <div className="bg-red-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">{year}年{month}月　支出合計</p>
          <p className="text-4xl font-bold mt-1.5 tracking-tight tabular-nums">
            ¥{totalExpense.toLocaleString('ja-JP')}
          </p>
        </div>

        {/* 物件別アコーディオン */}
        <ExpenseAccordion properties={propertiesWithExpenses} />

      </main>
    </div>
  )
}
