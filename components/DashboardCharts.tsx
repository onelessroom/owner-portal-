'use client'

import ExpensePieChart from './ExpensePieChart'
import MonthlyBarChart from './MonthlyBarChart'
import type { Expense } from '@/types'
import type { MonthlyData } from './MonthlyBarChart'

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
