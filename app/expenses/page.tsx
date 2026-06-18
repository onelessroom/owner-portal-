'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import ExpenseList from '@/components/ExpenseList'
import { Expense } from '@/types'

export default function ExpensesPage() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [ownerId, setOwnerId] = useState<string | null>(null)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (userRole?.role !== 'owner') {
        router.push('/login')
        return
      }

      const { data: owner } = await supabase
        .from('owners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (owner) setOwnerId(owner.id)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!ownerId) return

    const fetchExpenses = async () => {
      setLoading(true)
      const supabase = createClient()

      // オーナーの物件IDを取得
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', ownerId)

      const propertyIds = (properties ?? []).map((p) => p.id)

      const { data } = await supabase
        .from('expenses')
        .select('*')
        .in('property_id', propertyIds.length > 0 ? propertyIds : [''])
        .eq('year', year)
        .eq('month', month)
        .order('expense_date', { ascending: false })

      setExpenses((data ?? []) as Expense[])
      setLoading(false)
    }

    fetchExpenses()
  }, [ownerId, year, month])

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  // 月移動
  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            ← 戻る
          </Link>
          <h1 className="font-bold text-gray-900">支出一覧</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ログアウト
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 月フィルター */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <button
            onClick={prevMonth}
            className="text-gray-400 hover:text-gray-700 text-lg px-2"
          >
            ‹
          </button>
          <span className="font-semibold text-gray-900">
            {year}年{month}月
          </span>
          <button
            onClick={nextMonth}
            className="text-gray-400 hover:text-gray-700 text-lg px-2"
          >
            ›
          </button>
        </div>

        {/* 合計 */}
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-red-700 font-medium">支出合計</span>
          <span className="font-bold text-red-700 text-lg">
            ¥{totalAmount.toLocaleString('ja-JP')}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">読み込み中...</div>
        ) : (
          <ExpenseList expenses={expenses} />
        )}
      </main>
    </div>
  )
}
