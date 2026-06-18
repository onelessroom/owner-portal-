'use client'

import dynamic from 'next/dynamic'
import type { Expense } from '@/types'
import type { MonthlyData } from './MonthlyBarChart'

const ExpensePieChart = dynamic(() => import('./ExpensePieChart'), { ssr: false })
const MonthlyBarChart = dynamic(() => import('./MonthlyBarChart'), { ssr: false })

interface Props {
  expenses: Expense[]
  monthlyData: MonthlyData[]
}

export default function DashboardCharts({ expenses, monthlyData }: Props) {
  return (
    <>
      <ExpensePieChart expenses={expenses} />
      <MonthlyBarChart data={monthlyData} />
    </>
  )
}
