'use client'

import { Remittance } from '@/types'

interface RemittanceHistoryProps {
  remittances: Remittance[]
}

function NoteBreakdown({ note }: { note: string }) {
  const parts = note.split(' ／ ')
  if (parts.length !== 2) {
    return <p className="text-sm text-gray-600 mt-1">{note}</p>
  }
  return (
    <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:gap-2 text-sm text-gray-600">
      <span>{parts[0]}</span>
      <span className="hidden sm:inline text-gray-300 select-none">｜</span>
      <span>{parts[1]}</span>
    </div>
  )
}

export default function RemittanceHistory({
  remittances,
}: RemittanceHistoryProps) {
  if (remittances.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        送金履歴はありません
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {remittances.map((r) => (
        <div
          key={r.id}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {r.year}年{r.month}月分
              </p>
              {r.remittance_date && (
                <p className="text-xs text-gray-400 mt-0.5">
                  送金日：{r.remittance_date}
                </p>
              )}
              {r.note && <NoteBreakdown note={r.note} />}
            </div>
            <span className="text-lg font-bold text-green-700 shrink-0">
              ¥{r.remittance_amount.toLocaleString('ja-JP')}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
