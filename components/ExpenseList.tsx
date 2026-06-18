'use client'

import { useState } from 'react'
import { Expense, ExpenseCategory } from '@/types'
import ExpenseDetail from './ExpenseDetail'

interface ExpenseListProps {
  expenses: Expense[]
}

// カテゴリ別カラー
const categoryColor: Record<ExpenseCategory | string, string> = {
  管理料: 'bg-blue-100 text-blue-700',
  修繕費: 'bg-red-100 text-red-700',
  クリーニング費: 'bg-purple-100 text-purple-700',
  広告料: 'bg-yellow-100 text-yellow-700',
  仲介手数料: 'bg-orange-100 text-orange-700',
  設備交換費: 'bg-pink-100 text-pink-700',
  その他: 'bg-gray-100 text-gray-700',
}

export default function ExpenseList({ expenses }: ExpenseListProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        該当する支出はありません
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
        >
          {/* 一覧行（タップで展開） */}
          <button
            className="w-full text-left px-4 py-3 flex items-start justify-between gap-2 hover:bg-gray-50 transition-colors"
            onClick={() =>
              setOpenId(openId === expense.id ? null : expense.id)
            }
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    categoryColor[expense.category] ?? categoryColor['その他']
                  }`}
                >
                  {expense.category}
                </span>
                <span className="text-xs text-gray-400">
                  {expense.expense_date}
                </span>
              </div>
              <p className="text-sm text-gray-700 truncate">
                {expense.description ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-gray-900">
                ¥{expense.amount.toLocaleString('ja-JP')}
              </span>
              <span className="text-gray-400 text-sm">
                {openId === expense.id ? '▲' : '▼'}
              </span>
            </div>
          </button>

          {/* 詳細（アコーディオン） */}
          {openId === expense.id && (
            <div className="px-4 pb-4">
              <ExpenseDetail expense={expense} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
