'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Property, Room, Expense, ExpenseCategory } from '@/types'

const CATEGORIES: ExpenseCategory[] = [
  '修繕費',
  '清掃費',
  '保険料',
  '租税公課',
  '管理料',
  'その他',
]

interface ExpenseRow extends Expense {
  properties?: { name: string } | null
  rooms?: { room_number: string } | null
}

interface FormFields {
  property_id: string
  room_id: string
  year: number
  month: number
  category: ExpenseCategory
  amount: string
  description: string
  expense_date: string
}

const defaultForm = (): FormFields => ({
  property_id: '',
  room_id: '',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  category: '修繕費',
  amount: '',
  description: '',
  expense_date: new Date().toISOString().split('T')[0],
})

export default function AdminExpensesPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'new' | 'list'>('new')
  const [properties, setProperties] = useState<Property[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  // 新規登録フォーム
  const [form, setForm] = useState<FormFields>(defaultForm())
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [estimateFile, setEstimateFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 一覧
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listYear, setListYear] = useState(new Date().getFullYear())
  const [listMonth, setListMonth] = useState(new Date().getMonth() + 1)

  // 編集モーダル
  const [editExpense, setEditExpense] = useState<ExpenseRow | null>(null)
  const [editForm, setEditForm] = useState<
    FormFields & { receipt_url: string | null; estimate_url: string | null; photo_urls: string[] }
  | null>(null)
  const [editRooms, setEditRooms] = useState<Room[]>([])
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null)
  const [editEstimateFile, setEditEstimateFile] = useState<File | null>(null)
  const [editPhotoFiles, setEditPhotoFiles] = useState<FileList | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // 削除確認
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // 認証・物件取得
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

  // 新規登録フォーム：物件選択で部屋を取得
  useEffect(() => {
    if (!form.property_id) {
      setRooms([])
      return
    }
    const supabase = createClient()
    supabase
      .from('rooms')
      .select('*')
      .eq('property_id', form.property_id)
      .order('room_number')
      .then(({ data }) => setRooms((data ?? []) as Room[]))
  }, [form.property_id])

  // 一覧取得
  const fetchExpenses = useCallback(async () => {
    setListLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('*, properties(name), rooms(room_number)')
      .eq('year', listYear)
      .eq('month', listMonth)
      .order('expense_date', { ascending: false })
    setExpenses((data ?? []) as ExpenseRow[])
    setListLoading(false)
  }, [listYear, listMonth])

  useEffect(() => {
    if (tab === 'list') fetchExpenses()
  }, [tab, fetchExpenses])

  // ファイルアップロード（API Route 経由）
  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('bucket', bucket)
    fd.append('folder', folder)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? `アップロードエラー (HTTP ${res.status})`)
    return json.url as string
  }

  // 新規登録
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
      if (receiptFile) receipt_url = await uploadFile(receiptFile, 'receipts', 'receipts')
      if (estimateFile) estimate_url = await uploadFile(estimateFile, 'receipts', 'estimates')
      if (photoFiles) {
        for (const file of Array.from(photoFiles)) {
          photo_urls.push(await uploadFile(file, 'photos', 'repairs'))
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
      setForm(defaultForm())
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

  // 編集モーダルを開く
  const openEdit = async (expense: ExpenseRow) => {
    setEditExpense(expense)
    setEditForm({
      property_id: expense.property_id ?? '',
      room_id: expense.room_id ?? '',
      year: expense.year,
      month: expense.month,
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description ?? '',
      expense_date: expense.expense_date,
      receipt_url: expense.receipt_url,
      estimate_url: expense.estimate_url,
      photo_urls: expense.photo_urls ?? [],
    })
    setEditReceiptFile(null)
    setEditEstimateFile(null)
    setEditPhotoFiles(null)
    setEditError(null)
    if (expense.property_id) {
      const supabase = createClient()
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', expense.property_id)
        .order('room_number')
      setEditRooms((data ?? []) as Room[])
    } else {
      setEditRooms([])
    }
  }

  const closeEdit = () => {
    setEditExpense(null)
    setEditForm(null)
  }

  // 編集フォーム：物件変更で部屋を再取得
  const handleEditPropertyChange = async (propertyId: string) => {
    if (!editForm) return
    setEditForm({ ...editForm, property_id: propertyId, room_id: '' })
    if (propertyId) {
      const supabase = createClient()
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', propertyId)
        .order('room_number')
      setEditRooms((data ?? []) as Room[])
    } else {
      setEditRooms([])
    }
  }

  // 支出の更新
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editExpense || !editForm) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      let receipt_url = editForm.receipt_url
      let estimate_url = editForm.estimate_url
      let photo_urls = [...editForm.photo_urls]

      if (editReceiptFile)
        receipt_url = await uploadFile(editReceiptFile, 'receipts', 'receipts')
      if (editEstimateFile)
        estimate_url = await uploadFile(editEstimateFile, 'receipts', 'estimates')
      if (editPhotoFiles) {
        const newUrls = await Promise.all(
          Array.from(editPhotoFiles).map((f) => uploadFile(f, 'photos', 'repairs'))
        )
        photo_urls = [...photo_urls, ...newUrls]
      }

      const res = await fetch(`/api/expenses/${editExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: editForm.property_id || null,
          room_id: editForm.room_id || null,
          year: editForm.year,
          month: editForm.month,
          category: editForm.category,
          amount: parseInt(editForm.amount, 10),
          description: editForm.description || null,
          expense_date: editForm.expense_date,
          receipt_url,
          estimate_url,
          photo_urls: photo_urls.length > 0 ? photo_urls : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '更新に失敗しました')

      closeEdit()
      await fetchExpenses()
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      setEditError(`更新に失敗しました: ${message}`)
    } finally {
      setEditSubmitting(false)
    }
  }

  // 削除
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/expenses/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '削除に失敗しました')
      setDeleteId(null)
      await fetchExpenses()
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      alert(`削除に失敗しました: ${message}`)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // 写真の個別削除（編集フォーム内）
  const removePhotoAt = (index: number) => {
    if (!editForm) return
    setEditForm({
      ...editForm,
      photo_urls: editForm.photo_urls.filter((_, i) => i !== index),
    })
  }

  const listPrevMonth = () => {
    if (listMonth === 1) {
      setListYear((y) => y - 1)
      setListMonth(12)
    } else {
      setListMonth((m) => m - 1)
    }
  }
  const listNextMonth = () => {
    if (listMonth === 12) {
      setListYear((y) => y + 1)
      setListMonth(1)
    } else {
      setListMonth((m) => m + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          ← 戻る
        </Link>
        <h1 className="font-bold text-gray-900">支出管理</h1>
      </header>

      {/* タブ */}
      <div className="sticky top-[57px] z-10 bg-white border-b border-gray-200 flex px-4">
        {(['new', 'list'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSuccess(false); setError(null) }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'new' ? '新規登録' : '登録済み一覧'}
          </button>
        ))}
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* ===== 新規登録 ===== */}
        {tab === 'new' && (
          <div className="space-y-4">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                支出を登録しました
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 物件・部屋 */}
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
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {rooms.length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">部屋（任意）</label>
                    <select
                      value={form.room_id}
                      onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">部屋を選択（任意）</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.room_number}号室</option>
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
                      onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">月</label>
                    <select
                      value={form.month}
                      onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{m}月</option>
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
                      <option key={c} value={c}>{c}</option>
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
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">内容・理由</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="何のための支出か、オーナーへの説明を記載"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* 書類・写真 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h2 className="font-medium text-gray-900">書類・写真</h2>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">見積書（PDF）</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setEstimateFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">請求書（PDF）</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">施工写真（複数可）</label>
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
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {submitting ? '登録中...' : '支出を登録する'}
              </button>
            </form>
          </div>
        )}

        {/* ===== 登録済み一覧 ===== */}
        {tab === 'list' && (
          <div className="space-y-4">
            {/* 年月フィルター */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <button
                onClick={listPrevMonth}
                className="text-gray-400 hover:text-gray-700 text-lg px-2"
              >
                ‹
              </button>
              <span className="font-semibold text-gray-900">
                {listYear}年{listMonth}月
              </span>
              <button
                onClick={listNextMonth}
                className="text-gray-400 hover:text-gray-700 text-lg px-2"
              >
                ›
              </button>
            </div>

            {listLoading ? (
              <div className="text-center py-8 text-gray-400">読み込み中...</div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8 text-gray-400">この月の支出はありません</div>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="bg-white border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {expense.category}
                          </span>
                          <span className="text-xs text-gray-400">{expense.expense_date}</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {expense.properties?.name ?? '—'}
                          {expense.rooms?.room_number
                            ? ` · ${expense.rooms.room_number}号室`
                            : ''}
                        </p>
                        {expense.description && (
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                            {expense.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="font-bold text-gray-900">
                          ¥{expense.amount.toLocaleString('ja-JP')}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(expense)}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setDeleteId(expense.id)}
                            className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 添付ファイルバッジ */}
                    {(expense.estimate_url ||
                      expense.receipt_url ||
                      (expense.photo_urls && expense.photo_urls.length > 0)) && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        {expense.estimate_url && (
                          <a
                            href={expense.estimate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100"
                          >
                            📄 見積書
                          </a>
                        )}
                        {expense.receipt_url && (
                          <a
                            href={expense.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100"
                          >
                            🧾 請求書
                          </a>
                        )}
                        {expense.photo_urls && expense.photo_urls.length > 0 && (
                          <span className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600">
                            📷 写真 {expense.photo_urls.length}枚
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== 削除確認ダイアログ ===== */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">支出を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleteSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-sm font-medium"
              >
                {deleteSubmitting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 編集モーダル ===== */}
      {editExpense && editForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">支出を編集</h2>
              <button
                onClick={closeEdit}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              {/* 物件・部屋 */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">物件</label>
                  <select
                    value={editForm.property_id}
                    onChange={(e) => handleEditPropertyChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">物件を選択</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {editRooms.length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">部屋（任意）</label>
                    <select
                      value={editForm.room_id}
                      onChange={(e) =>
                        setEditForm({ ...editForm, room_id: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">部屋を選択（任意）</option>
                      {editRooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.room_number}号室</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">年</label>
                  <input
                    type="number"
                    value={editForm.year}
                    onChange={(e) =>
                      setEditForm({ ...editForm, year: parseInt(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">月</label>
                  <select
                    value={editForm.month}
                    onChange={(e) =>
                      setEditForm({ ...editForm, month: parseInt(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">カテゴリ</label>
                <select
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category: e.target.value as ExpenseCategory })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">金額（円）</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">支出日</label>
                <input
                  type="date"
                  value={editForm.expense_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, expense_date: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">内容・理由</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* 書類・写真 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <h3 className="font-medium text-gray-900 text-sm">書類・写真</h3>

                {/* 見積書 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">見積書</label>
                  {editForm.estimate_url && (
                    <div className="flex items-center gap-2 mb-2">
                      <a
                        href={editForm.estimate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600 hover:bg-gray-200"
                      >
                        📄 現在のファイルを確認
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm({ ...editForm, estimate_url: null })
                        }
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setEditEstimateFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>

                {/* 請求書 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">請求書</label>
                  {editForm.receipt_url && (
                    <div className="flex items-center gap-2 mb-2">
                      <a
                        href={editForm.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600 hover:bg-gray-200"
                      >
                        🧾 現在のファイルを確認
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm({ ...editForm, receipt_url: null })
                        }
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setEditReceiptFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>

                {/* 施工写真 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">施工写真</label>
                  {editForm.photo_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editForm.photo_urls.map((url, i) => (
                        <div key={i} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`写真${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removePhotoAt(i)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setEditPhotoFiles(e.target.files)}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {editPhotoFiles && editPhotoFiles.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {editPhotoFiles.length}枚を追加します
                    </p>
                  )}
                </div>
              </div>

              {editError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}

              <div className="flex gap-3 pb-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={editSubmitting}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium"
                >
                  {editSubmitting ? '更新中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
