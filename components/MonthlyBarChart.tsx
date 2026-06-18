'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface MonthlyData {
  label: string
  income: number
  expense: number
  remittance: number  // unused; kept for type compatibility
}

interface Props {
  data: MonthlyData[]
}

const fmt = (v: number | string | undefined) =>
  typeof v === 'number' ? `¥${v.toLocaleString()}` : ''

export default function MonthlyBarChart({ data }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="font-semibold text-gray-900 mb-3">月次推移（過去6ヶ月）</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 10000 ? `${Math.round(v / 10000)}万` : String(v)
            }
            tick={{ fontSize: 11 }}
            width={42}
          />
          <Tooltip formatter={(value) => fmt(value as number | string | undefined)} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-700">
                {value === 'income' ? '収入（送金額）' : '支出'}
              </span>
            )}
          />
          <Bar dataKey="income" name="income" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
