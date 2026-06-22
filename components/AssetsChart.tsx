'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
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

function fmtYAxis(v: number): string {
  if (v === 0) return '0'
  const man = Math.floor(Math.abs(v) / 10000)
  const oku = Math.floor(man / 10000)
  const remainMan = man % 10000
  if (oku > 0) {
    return remainMan > 0 ? `${oku}億${remainMan}万` : `${oku}億`
  }
  if (man > 0) return `${man}万`
  return String(v)
}

function fmtTooltip(value: unknown): string {
  return typeof value === 'number' ? `¥${value.toLocaleString('ja-JP')}` : String(value)
}

export default function AssetsChart({ data }: AssetsChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-72 bg-gray-50 rounded-xl animate-pulse" />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={fmtYAxis}
          tick={{ fontSize: 10 }}
          width={48}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value, name) => [fmtTooltip(value), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="income" name="収入" fill="#93c5fd" radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Bar dataKey="expense" name="支出" fill="#fca5a5" radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Line
          type="monotone"
          dataKey="profit"
          name="収支"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 3, fill: '#2563eb' }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
