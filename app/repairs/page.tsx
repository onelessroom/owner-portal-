'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Repair } from '@/types'

export default function RepairsPage() {
  const router = useRouter()
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

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

      // オーナーの物件IDを取得
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', owner.id)

      const propertyIds = (properties ?? []).map((p) => p.id)

      const { data } = await supabase
        .from('repairs')
        .select('*')
        .in('property_id', propertyIds.length > 0 ? propertyIds : [''])
        .order('repair_date', { ascending: false })

      setRepairs((data ?? []) as Repair[])
      setLoading(false)
    }

    init()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            ← 戻る
          </Link>
          <h1 className="font-bold text-gray-900">修繕履歴</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ログアウト
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">読み込み中...</div>
        ) : repairs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            修繕履歴はありません
          </div>
        ) : (
          repairs.map((repair) => (
            <div
              key={repair.id}
              className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{repair.title}</h2>
                  {repair.repair_date && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      施工日：{repair.repair_date}
                    </p>
                  )}
                </div>
              </div>

              {repair.reason && (
                <div>
                  <span className="text-xs font-medium text-gray-500">
                    発生理由：
                  </span>
                  <p className="text-sm text-gray-700 mt-0.5">{repair.reason}</p>
                </div>
              )}

              {repair.contractor && (
                <div>
                  <span className="text-xs font-medium text-gray-500">
                    施工業者：
                  </span>
                  <span className="text-sm text-gray-700 ml-1">
                    {repair.contractor}
                  </span>
                </div>
              )}

              {/* 書類リンク */}
              <div className="flex flex-wrap gap-2">
                {repair.estimate_url && (
                  <a
                    href={repair.estimate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    📄 見積書
                  </a>
                )}
                {repair.invoice_url && (
                  <a
                    href={repair.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    🧾 請求書
                  </a>
                )}
              </div>

              {/* 施工写真 */}
              {repair.photo_urls && repair.photo_urls.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500">
                    施工写真：
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {repair.photo_urls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setLightboxUrl(url)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`写真 ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* 写真拡大ライトボックス */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-2xl w-full mx-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="拡大写真"
              className="w-full h-auto rounded-lg"
            />
            <button
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
              onClick={() => setLightboxUrl(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
