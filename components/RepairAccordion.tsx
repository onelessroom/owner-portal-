'use client'
import { useState } from 'react'

interface RepairItem {
  id: string
  title: string
  reason: string | null
  contractor: string | null
  repair_date: string | null
  expense_amount: number | null
  estimate_url: string | null
  invoice_url: string | null
  photo_urls: string[] | null
  room_number: string | null
}

interface PropertyGroup {
  id: string
  name: string
  repairs: RepairItem[]
}

function repairStatus(repairDate: string | null) {
  if (!repairDate) return { label: '対応中', cls: 'bg-yellow-100 text-yellow-700' }
  const today = new Date().toISOString().split('T')[0]
  if (repairDate > today) return { label: '対応予定', cls: 'bg-orange-100 text-orange-700' }
  return { label: '完了', cls: 'bg-green-100 text-green-700' }
}

function fmtDate(d: string): string {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

export default function RepairAccordion({ properties }: { properties: PropertyGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  return (
    <>
      <div className="space-y-2">
        {properties.map(prop => {
          const isOpen = openId === prop.id
          const count = prop.repairs.length
          const inProgress = prop.repairs.filter(r => !r.repair_date).length

          return (
            <div key={prop.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-4 text-left"
                onClick={() => setOpenId(isOpen ? null : prop.id)}
              >
                <span className="text-base font-semibold text-gray-900 flex-1 mr-3">{prop.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {count === 0 ? (
                    <span className="text-sm text-gray-400">修繕なし</span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-gray-700">{count}件</span>
                      {inProgress > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                          対応中 {inProgress}
                        </span>
                      )}
                    </>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {count === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">この期間の修繕はありません</p>
                  ) : (
                    prop.repairs.map((r, i) => {
                      const st = repairStatus(r.repair_date)
                      return (
                        <div
                          key={r.id}
                          className={`px-5 py-4 ${i < prop.repairs.length - 1 ? 'border-b border-gray-50' : ''}`}
                        >
                          {/* 1行目：日付・タイトル・ステータス */}
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-400 w-10 shrink-0 pt-0.5 tabular-nums">
                              {r.repair_date ? fmtDate(r.repair_date) : '—'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">
                                  {r.title}
                                </span>
                                {r.room_number && (
                                  <span className="text-xs text-gray-400">{r.room_number}号室</span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                                  {st.label}
                                </span>
                              </div>

                              {/* 理由 */}
                              {r.reason && (
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.reason}</p>
                              )}

                              {/* 業者・金額 */}
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                {r.contractor && <span>🔧 {r.contractor}</span>}
                                {r.expense_amount != null && (
                                  <span className="font-semibold text-gray-700">
                                    ¥{r.expense_amount.toLocaleString('ja-JP')}
                                  </span>
                                )}
                              </div>

                              {/* 書類・写真 */}
                              {(r.estimate_url || r.invoice_url || (r.photo_urls && r.photo_urls.length > 0)) ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {r.estimate_url && (
                                    <a href={r.estimate_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors">
                                      📄 見積書
                                    </a>
                                  )}
                                  {r.invoice_url && (
                                    <a href={r.invoice_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors">
                                      🧾 請求書
                                    </a>
                                  )}
                                  {r.photo_urls?.map((url, pi) => (
                                    <button key={pi} onClick={() => setLightboxUrl(url)}
                                      className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={`写真${pi + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1.5 text-xs text-gray-300">書類・写真なし</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ライトボックス */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-lg w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxUrl} alt="拡大写真" className="w-full h-auto rounded-xl" />
            <button
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center text-sm"
              onClick={() => setLightboxUrl(null)}
            >✕</button>
          </div>
        </div>
      )}
    </>
  )
}
