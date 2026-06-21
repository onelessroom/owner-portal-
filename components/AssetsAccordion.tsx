'use client'

import { useState } from 'react'

export interface PropertyAsset {
  id: string
  name: string
  address: string | null
  acquisition_price: number | null
  annualExpense: number
  estimatedAnnualIncome: number
}

function formatJpn(n: number): string {
  if (n === 0) return '0円'
  const man = Math.floor(n / 10000)
  const rem = n % 10000
  if (man === 0) return `${rem.toLocaleString('ja-JP')}円`
  if (rem === 0) return `${man}万円`
  return `${man}万${rem.toLocaleString('ja-JP')}円`
}

function formatYield(income: number, price: number | null): string {
  if (price == null || price === 0) return '—'
  return ((income / price) * 100).toFixed(2) + '%'
}

interface Props {
  properties: PropertyAsset[]
}

export default function AssetsAccordion({ properties }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (properties.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">物件データがありません</p>
  }

  return (
    <div className="space-y-2">
      {properties.map(p => {
        const isOpen = openIds.has(p.id)
        const yieldPct = formatYield(p.estimatedAnnualIncome, p.acquisition_price)
        return (
          <div key={p.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => toggle(p.id)}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <p className="font-bold text-gray-900">{p.name}</p>
                {p.acquisition_price != null ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    取得価格 {formatJpn(p.acquisition_price)}
                    {yieldPct !== '—' && <span className="ml-2 text-blue-600 font-semibold">利回り {yieldPct}</span>}
                  </p>
                ) : (
                  <p className="text-xs text-orange-500 mt-0.5">取得価格未登録</p>
                )}
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-gray-50 px-4 py-4 space-y-3 bg-gray-50/50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">推定年間収入</span>
                  <span className="font-semibold text-blue-600">{formatJpn(p.estimatedAnnualIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">年間支出</span>
                  <span className="font-semibold text-red-500">− {formatJpn(p.annualExpense)}</span>
                </div>
                {p.acquisition_price != null ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">取得価格</span>
                      <span className="font-semibold text-gray-900">{formatJpn(p.acquisition_price)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-100 pt-3 mt-1">
                      <span className="text-gray-600 font-medium">表面利回り</span>
                      <span className="font-bold text-gray-900">{yieldPct}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      年間家賃収入 ÷ 物件の購入価格で計算した、ざっくりの利回りです
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-orange-500">
                    取得価格を登録すると利回りが表示されます（管理画面で設定できます）
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
