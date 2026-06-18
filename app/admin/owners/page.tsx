'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Owner, Property } from '@/types'

type Tab = 'owner' | 'property' | 'room'

export default function AdminOwnersPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('owner')
  const [owners, setOwners] = useState<Owner[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // フォーム状態
  const [ownerForm, setOwnerForm] = useState({ name: '', email: '' })
  const [propertyForm, setPropertyForm] = useState({
    owner_id: '',
    name: '',
    address: '',
    total_units: '1',
  })
  const [roomForm, setRoomForm] = useState({
    property_id: '',
    room_number: '',
    floor_plan: '',
    rent_amount: '',
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

      const [{ data: ownersData }, { data: propsData }] = await Promise.all([
        supabase.from('owners').select('*').order('name'),
        supabase.from('properties').select('*').order('name'),
      ])
      setOwners((ownersData ?? []) as Owner[])
      setProperties((propsData ?? []) as Property[])
    }
    init()
  }, [router])

  const refreshData = async () => {
    const supabase = createClient()
    const [{ data: ownersData }, { data: propsData }] = await Promise.all([
      supabase.from('owners').select('*').order('name'),
      supabase.from('properties').select('*').order('name'),
    ])
    setOwners((ownersData ?? []) as Owner[])
    setProperties((propsData ?? []) as Property[])
  }

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    const { error } = await supabase
      .from('owners')
      .insert({ name: ownerForm.name, email: ownerForm.email })

    if (error) {
      setError('登録に失敗しました：' + error.message)
    } else {
      setSuccess('オーナーを登録しました')
      setOwnerForm({ name: '', email: '' })
      await refreshData()
    }
    setSubmitting(false)
  }

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    const { error } = await supabase.from('properties').insert({
      owner_id: propertyForm.owner_id,
      name: propertyForm.name,
      address: propertyForm.address || null,
      total_units: parseInt(propertyForm.total_units, 10),
    })

    if (error) {
      setError('登録に失敗しました：' + error.message)
    } else {
      setSuccess('物件を登録しました')
      setPropertyForm({ owner_id: '', name: '', address: '', total_units: '1' })
      await refreshData()
    }
    setSubmitting(false)
  }

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    const { error } = await supabase.from('rooms').insert({
      property_id: roomForm.property_id,
      room_number: roomForm.room_number,
      floor_plan: roomForm.floor_plan || null,
      rent_amount: roomForm.rent_amount
        ? parseInt(roomForm.rent_amount, 10)
        : null,
      status: 'vacant',
    })

    if (error) {
      setError('登録に失敗しました：' + error.message)
    } else {
      setSuccess('部屋を登録しました')
      setRoomForm({ property_id: '', room_number: '', floor_plan: '', rent_amount: '' })
    }
    setSubmitting(false)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'owner', label: 'オーナー' },
    { id: 'property', label: '物件' },
    { id: 'room', label: '部屋' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          ← 戻る
        </Link>
        <h1 className="font-bold text-gray-900">オーナー・物件管理</h1>
      </header>

      {/* タブ */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id)
              setSuccess(null)
              setError(null)
            }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}登録
          </button>
        ))}
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* オーナー登録フォーム */}
        {tab === 'owner' && (
          <form onSubmit={handleOwnerSubmit} className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ownerForm.name}
                  onChange={(e) =>
                    setOwnerForm({ ...ownerForm, name: e.target.value })
                  }
                  required
                  placeholder="山田 太郎"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={ownerForm.email}
                  onChange={(e) =>
                    setOwnerForm({ ...ownerForm, email: e.target.value })
                  }
                  required
                  placeholder="owner@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {submitting ? '登録中...' : 'オーナーを登録する'}
            </button>

            {/* 登録済みオーナー一覧 */}
            {owners.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  登録済みオーナー
                </h2>
                <div className="space-y-2">
                  {owners.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 flex justify-between items-center"
                    >
                      <span className="font-medium text-gray-900 text-sm">
                        {o.name}
                      </span>
                      <span className="text-xs text-gray-400">{o.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* 物件登録フォーム */}
        {tab === 'property' && (
          <form onSubmit={handlePropertySubmit} className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  オーナー <span className="text-red-500">*</span>
                </label>
                <select
                  value={propertyForm.owner_id}
                  onChange={(e) =>
                    setPropertyForm({ ...propertyForm, owner_id: e.target.value })
                  }
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  物件名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyForm.name}
                  onChange={(e) =>
                    setPropertyForm({ ...propertyForm, name: e.target.value })
                  }
                  required
                  placeholder="〇〇マンション"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">住所</label>
                <input
                  type="text"
                  value={propertyForm.address}
                  onChange={(e) =>
                    setPropertyForm({ ...propertyForm, address: e.target.value })
                  }
                  placeholder="東京都渋谷区..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  総戸数
                </label>
                <input
                  type="number"
                  value={propertyForm.total_units}
                  onChange={(e) =>
                    setPropertyForm({
                      ...propertyForm,
                      total_units: e.target.value,
                    })
                  }
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {submitting ? '登録中...' : '物件を登録する'}
            </button>

            {/* 登録済み物件一覧 */}
            {properties.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  登録済み物件
                </h2>
                <div className="space-y-2">
                  {properties.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-2.5"
                    >
                      <p className="font-medium text-gray-900 text-sm">
                        {p.name}
                      </p>
                      {p.address && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.address}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* 部屋登録フォーム */}
        {tab === 'room' && (
          <form onSubmit={handleRoomSubmit} className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  物件 <span className="text-red-500">*</span>
                </label>
                <select
                  value={roomForm.property_id}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, property_id: e.target.value })
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  部屋番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roomForm.room_number}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, room_number: e.target.value })
                  }
                  required
                  placeholder="101"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  間取り
                </label>
                <input
                  type="text"
                  value={roomForm.floor_plan}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, floor_plan: e.target.value })
                  }
                  placeholder="1LDK"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  家賃（円）
                </label>
                <input
                  type="number"
                  value={roomForm.rent_amount}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, rent_amount: e.target.value })
                  }
                  placeholder="80000"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {submitting ? '登録中...' : '部屋を登録する'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
