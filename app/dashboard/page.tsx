import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import SummaryCard from '@/components/SummaryCard'
import ExpenseList from '@/components/ExpenseList'
import { Expense } from '@/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  // 未ログインはログインページへ
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (userRole?.role !== 'owner') redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // オーナー情報を取得
  const { data: owner } = await supabase
    .from('owners')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

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

  // 物件一覧を取得
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', owner.id)

  const propertyIds = (properties ?? []).map((p) => p.id)

  // 今月の家賃入金合計
  const { data: payments } = await supabase
    .from('rent_payments')
    .select('amount, room_id, rooms(property_id)')
    .eq('year', year)
    .eq('month', month)

  const monthlyIncome = (payments ?? [])
    .filter((p) => {
      const room = p.rooms as unknown as { property_id: string } | null
      return room && propertyIds.includes(room.property_id)
    })
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)

  // 今月の支出合計
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .in('property_id', propertyIds.length > 0 ? propertyIds : [''])
    .eq('year', year)
    .eq('month', month)
    .order('expense_date', { ascending: false })

  const monthlyExpense = (expenses ?? []).reduce(
    (sum, e) => sum + (e.amount ?? 0),
    0
  )

  // 今月の送金額
  const { data: remittance } = await supabase
    .from('remittances')
    .select('remittance_amount')
    .eq('owner_id', owner.id)
    .eq('year', year)
    .eq('month', month)
    .single()

  // 入居率（全部屋中occupiedの割合）
  const { data: allRooms } = await supabase
    .from('rooms')
    .select('status, property_id')
    .in('property_id', propertyIds.length > 0 ? propertyIds : [''])

  const totalRooms = (allRooms ?? []).length
  const occupiedRooms = (allRooms ?? []).filter(
    (r) => r.status === 'occupied'
  ).length
  const occupancyRate =
    totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-gray-900">オーナーポータル</h1>
          <p className="text-xs text-gray-400">{owner.name} 様</p>
        </div>
        <LogoutButton />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 期間表示 */}
        <p className="text-sm font-medium text-gray-500">
          {year}年{month}月分
        </p>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            title="今月の収入"
            amount={monthlyIncome}
            unit="円"
            icon="💰"
            color="blue"
          />
          <SummaryCard
            title="今月の支出"
            amount={monthlyExpense}
            unit="円"
            icon="📋"
            color="red"
          />
          <SummaryCard
            title="送金額"
            amount={remittance?.remittance_amount ?? 0}
            unit="円"
            icon="🏦"
            color="green"
          />
          <SummaryCard
            title="入居率"
            amount={occupancyRate}
            unit="%"
            icon="🏠"
            color="orange"
          />
        </div>

        {/* 今月の支出一覧 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">今月の支出</h2>
            <Link
              href="/expenses"
              className="text-sm text-blue-600 hover:underline"
            >
              すべて見る
            </Link>
          </div>
          <ExpenseList expenses={(expenses ?? []) as Expense[]} />
        </section>

        {/* ナビゲーション */}
        <nav className="grid grid-cols-3 gap-3">
          <Link
            href="/remittances"
            className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors"
          >
            <div className="text-2xl mb-1">🏦</div>
            <div className="text-xs font-medium text-gray-700">送金履歴</div>
          </Link>
          <Link
            href="/expenses"
            className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors"
          >
            <div className="text-2xl mb-1">📋</div>
            <div className="text-xs font-medium text-gray-700">支出一覧</div>
          </Link>
          <Link
            href="/repairs"
            className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors"
          >
            <div className="text-2xl mb-1">🔧</div>
            <div className="text-xs font-medium text-gray-700">修繕履歴</div>
          </Link>
        </nav>
      </main>
    </div>
  )
}

// ログアウトボタン（クライアントコンポーネント）
function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        ログアウト
      </button>
    </form>
  )
}
