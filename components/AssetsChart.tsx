'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface ChartMonth {
  label: string
  income: number
  expense: number
  profit: number
}

interface AssetsChartProps {
  data: ChartMonth[]
}

function fmt(v: number) {
  const man = Math.floor(v / 10000)
  if (man >= 100) return `${Math.floor(man / 10000)}億${man % 10000 ? man % 10000 + '万' : ''}`
  if (man > 0) return `${man}万`
  return `${v.toLocaleString('ja-JP')}`
}

export default function AssetsChart({ data }: AssetsChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={44} />
        <Tooltip
          formatter={(value) => [
            typeof value === 'number' ? `¥${value.toLocaleString('ja-JP')}` : value,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="収入" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        <Bar dataKey="expense" name="支出" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="profit" name="収支" fill="#374151" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
