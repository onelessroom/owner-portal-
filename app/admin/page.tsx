import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function logoutAction() {
  'use server'
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (userRole?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">管理画面</h1>
          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ログアウト
          </button>
        </form>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <Link href="/admin/owners" className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-medium text-gray-900">オーナー・物件管理</p>
              <p className="text-xs text-gray-400">オーナー・物件・部屋の登録</p>
            </div>
          </div>
          <span className="text-gray-300">›</span>
        </Link>

        <Link href="/admin/expenses" className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-medium text-gray-900">支出入力</p>
              <p className="text-xs text-gray-400">支出の登録・写真・書類アップロード</p>
            </div>
          </div>
          <span className="text-gray-300">›</span>
        </Link>

        <Link href="/admin/remittances" className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <p className="font-medium text-gray-900">送金額確定</p>
              <p className="text-xs text-gray-400">月次送金額の入力・確定</p>
            </div>
          </div>
          <span className="text-gray-300">›</span>
        </Link>
      </main>
    </div>
  )
}
