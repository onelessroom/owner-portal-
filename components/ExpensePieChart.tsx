'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Expense } from '@/types'

const COLORS: Record<string, string> = {
  修繕費: '#ef4444',
  清掃費: '#f97316',
  保険料: '#eab308',
  租税公課: '#8b5cf6',
  管理料: '#3b82f6',
  その他: '#6b7280',
}

const DEFAULT_COLOR = '#6b7280'

interface Props {
  expenses: Expense[]
}

export default function ExpensePieChart({ expenses }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const totals: Record<string, number> = {}
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] ?? 0) + e.amount
  }

  const data = Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .map(([name, value]) => ({ name, value }))

  if (!mounted) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-gray-900 mb-3">支出内訳（当月）</h2>
        <div className="h-[240px] bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-gray-900 mb-3">支出内訳（当月）</h2>
        <p className="text-sm text-gray-400 text-center py-6">今月の支出データがありません</p>
      </div>
    )
  }

  const fmt = (v: number | string | undefined) =>
    typeof v === 'number' ? `¥${v.toLocaleString()}` : ''

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="font-semibold text-gray-900 mb-3">支出内訳（当月）</h2>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? DEFAULT_COLOR} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => fmt(value as number | string | undefined)} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-700">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
