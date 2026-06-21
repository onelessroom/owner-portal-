'use client'
import { useState } from 'react'

interface ExpenseItem {
  id: string
  category: string
  description: string | null
  amount: number
  expense_date: string
}

interface PropertyGroup {
  id: string
  name: string
  expenses: ExpenseItem[]
}

function fmtDate(d: string): string {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

export default function ExpenseAccordion({ properties }: { properties: PropertyGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (properties.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center text-sm text-gray-400">
        この月の支出はありません
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {properties.map(prop => {
        const propTotal = prop.expenses.reduce((s, e) => s + e.amount, 0)
        const isOpen = openId === prop.id

        return (
          <div key={prop.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-4 text-left"
              onClick={() => setOpenId(isOpen ? null : prop.id)}
            >
              <span className="text-base font-semibold text-gray-900 flex-1 mr-3">{prop.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-lg font-bold text-red-500 tabular-nums">
                  ¥{propTotal.toLocaleString('ja-JP')}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {prop.expenses.map((e, i) => (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 px-5 py-3.5 ${
                      i < prop.expenses.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <span className="text-xs text-gray-400 w-10 shrink-0 tabular-nums">
                      {fmtDate(e.expense_date)}
                    </span>
                    <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                      {e.description || e.category}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                      ¥{e.amount.toLocaleString('ja-JP')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
