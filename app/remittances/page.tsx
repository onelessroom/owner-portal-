'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import RemittanceHistory from '@/components/RemittanceHistory'
import BottomNav from '@/components/BottomNav'
import { Remittance } from '@/types'

export default function RemittancesPage() {
  const router = useRouter()
  const [remittances, setRemittances] = useState<Remittance[]>([])
  const [loading, setLoading] = useState(true)

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

      if (!owner) return

      const { data } = await supabase
        .from('remittances')
        .select('*')
        .eq('owner_id', owner.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      setRemittances((data ?? []) as Remittance[])
      setLoading(false)
    }

    init()
  }, [router])

  const totalAmount = remittances.reduce(
    (sum, r) => sum + r.remittance_amount,
    0
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            ← 戻る
          </Link>
          <h1 className="font-bold text-gray-900">送金履歴</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ログアウト
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 累計 */}
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-green-700 font-medium">累計送金額</span>
          <span className="font-bold text-green-700 text-lg">
            ¥{totalAmount.toLocaleString('ja-JP')}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">読み込み中...</div>
        ) : (
          <RemittanceHistory remittances={remittances} />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
