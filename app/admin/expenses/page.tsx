'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Property, Room, ExpenseCategory } from '@/types'

const CATEGORIES: ExpenseCategory[] = [
  '修繕費',
  '清掃費',
  '保険料',
  '租税公課',
  '管理料',
  'その他',
]

export default function AdminExpensesPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    property_id: '',
    room_id: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    category: '修繕費' as ExpenseCategory,
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  })

  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [estimateFile, setEstimateFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null)

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

      const { data: props } = await supabase
        .from('properties')
        .select('*')
        .order('name')
      setProperties((props ?? []) as Property[])
    }
    init()
  }, [router])

  // 物件選択時に部屋を取得
  useEffect(() => {
    if (!form.property_id) {
      setRooms([])
      return
    }
    const fetchRooms = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', form.property_id)
        .order('room_number')
      setRooms((data ?? []) as Room[])
    }
    fetchRooms()
  }, [form.property_id])

  const uploadFile = async (
    file: File,
    bucket: string,
    folder: string
  ): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    formData.append('folder', folder)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error ?? `アップロードエラー (HTTP ${res.status})`)
    }
    return json.url as string
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.property_id || !form.amount) {
      setError('物件と金額は必須です')
      return
    }

    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    try {
      let receipt_url: string | null = null
      let estimate_url: string | null = null
      const photo_urls: string[] = []

      // ファイルアップロード（サービスロール経由 API Route を使用）
      if (receiptFile) {
        receipt_url = await uploadFile(receiptFile, 'receipts', 'receipts')
      }
      if (estimateFile) {
        estimate_url = await uploadFile(estimateFile, 'receipts', 'estimates')
      }
      if (photoFiles) {
        for (const file of Array.from(photoFiles)) {
          const url = await uploadFile(file, 'photos', 'repairs')
          photo_urls.push(url)
        }
      }

      const { error: insertError } = await supabase.from('expenses').insert({
        property_id: form.property_id || null,
        room_id: form.room_id || null,
        year: form.year,
        month: form.month,
        category: form.category,
        amount: parseInt(form.amount, 10),
        description: form.description || null,
        expense_date: form.expense_date,
        receipt_url,
        estimate_url,
        photo_urls: photo_urls.length > 0 ? photo_urls : null,
      })

      if (insertError) throw insertError

      setSuccess(true)
      setForm({
        property_id: '',
        room_id: '',
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        category: '修繕費',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
      })
      setReceiptFile(null)
      setEstimateFile(null)
      setPhotoFiles(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      console.error('支出登録エラー:', err)
      setError(`登録に失敗しました: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          ← 戻る
        </Link>
        <h1 className="font-bold text-gray-900">支出入力</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">
            支出を登録しました
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 物件 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h2 className="font-medium text-gray-900">物件・部屋</h2>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                物件 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.property_id}
                onChange={(e) =>
                  setForm({ ...form, property_id: e.target.value, room_id: '' })
                }
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">物件を選択</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {rooms.length > 0 && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  部屋（任意）
                </label>
                <select
                  value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">部屋を選択（任意）</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_number}号室
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 支出情報 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h2 className="font-medium text-gray-900">支出情報</h2>

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
                カテゴリ <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as ExpenseCategory })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                金額（円） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                required
                min={1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                支出日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) =>
                  setForm({ ...form, expense_date: e.target.value })
                }
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                内容・理由
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                placeholder="何のための支出か、オーナーへの説明を記載"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* ファイルアップロード */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h2 className="font-medium text-gray-900">書類・写真</h2>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                見積書（PDF）
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setEstimateFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                請求書（PDF）
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                施工写真（複数可）
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotoFiles(e.target.files)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
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
            {submitting ? '登録中...' : '支出を登録する'}
          </button>
        </form>
      </main>
    </div>
  )
}
