'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Owner } from '@/types'
import { sendRemittanceEmail } from './actions'

export default function AdminRemittancesPage() {
  const router = useRouter()
  const [owners, setOwners] = useState<Owner[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    owner_id: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    remittance_amount: '',
    remittance_date: new Date().toISOString().split('T')[0],
    note: '',
  })

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

      if (userRole?.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      const { data } = await supabase
        .from('owners')
        .select('*')
        .order('name')
      setOwners((data ?? []) as Owner[])
    }
    init()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.owner_id || !form.remittance_amount) {
      setError('オーナーと送金額は必須です')
      return
    }

    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    const { error: insertError } = await supabase.from('remittances').insert({
      owner_id: form.owner_id,
      year: form.year,
      month: form.month,
      remittance_amount: parseInt(form.remittance_amount, 10),
      remittance_date: form.remittance_date || null,
      note: form.note || null,
    })

    if (insertError) {
      setError('登録に失敗しました。再度お試しください。')
    } else {
      const selectedOwner = owners.find((o) => o.id === form.owner_id)
      if (selectedOwner) {
        try {
          await sendRemittanceEmail({
            ownerEmail: selectedOwner.email,
            ownerName: selectedOwner.name,
            year: form.year,
            month: form.month,
            amount: parseInt(form.remittance_amount, 10),
          })
        } catch {
          // メール送信失敗は登録成功に影響させない
        }
      }

      setSuccess(true)
      setForm({
        owner_id: '',
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        remittance_amount: '',
        remittance_date: new Date().toISOString().split('T')[0],
        note: '',
      })
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          ← 戻る
        </Link>
        <h1 className="font-bold text-gray-900">送金額確定</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">
            送金情報を登録しました
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                オーナー <span className="text-red-500">*</span>
              </label>
              <select
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">オーナーを選択</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">年</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) =>
                    setForm({ ...form, year: parseInt(e.target.value) })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">月</label>
                <select
                  value={form.month}
                  onChange={(e) =>
                    setForm({ ...form, month: parseInt(e.target.value) })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                送金額（円） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.remittance_amount}
                onChange={(e) =>
                  setForm({ ...form, remittance_amount: e.target.value })
                }
                placeholder="0"
                required
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                送金日
              </label>
              <input
                type="date"
                value={form.remittance_date}
                onChange={(e) =>
                  setForm({ ...form, remittance_date: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">備考</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={3}
                placeholder="特記事項など"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {submitting ? '登録中...' : '送金額を確定する'}
          </button>
        </form>
      </main>
    </div>
  )
}
