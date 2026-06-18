'use client'

interface SummaryCardProps {
  title: string
  amount: number | string
  unit: string
  icon: React.ReactNode
  color?: 'blue' | 'red' | 'green' | 'orange'
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
}

const iconColorMap = {
  blue: 'text-blue-500',
  red: 'text-red-500',
  green: 'text-green-500',
  orange: 'text-orange-500',
}

export default function SummaryCard({
  title,
  amount,
  unit,
  icon,
  color = 'blue',
}: SummaryCardProps) {
  const formattedAmount =
    typeof amount === 'number'
      ? amount.toLocaleString('ja-JP')
      : amount

  return (
    <div className={`border rounded-xl p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{title}</span>
        <span className={`text-2xl ${iconColorMap[color]}`}>{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold">{formattedAmount}</span>
        <span className="text-sm mb-0.5">{unit}</span>
      </div>
    </div>
  )
}
