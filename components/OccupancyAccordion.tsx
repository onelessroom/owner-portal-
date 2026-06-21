'use client'
import { useState } from 'react'

interface RoomItem {
  id: string
  room_number: string
  floor_plan: string | null
  status: string
  rent_amount: number | null
}

interface PropertyGroup {
  id: string
  name: string
  total_units: number
  rooms: RoomItem[]
}

export default function OccupancyAccordion({ properties }: { properties: PropertyGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {properties.map(prop => {
        const occupied = prop.rooms.filter(r => r.status === 'occupied').length
        const total = prop.rooms.length
        const pct = total > 0 ? Math.round((occupied / total) * 100) : 0
        const isOpen = openId === prop.id
        const sorted = [...prop.rooms].sort((a, b) =>
          a.room_number.localeCompare(b.room_number, 'ja', { numeric: true })
        )

        return (
          <div key={prop.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-4 text-left"
              onClick={() => setOpenId(isOpen ? null : prop.id)}
            >
              <span className="text-base font-semibold text-gray-900 flex-1 mr-3">{prop.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-gray-700 tabular-nums">
                  {occupied}/{total} 室
                </span>
                <span className={`text-sm font-bold tabular-nums ${pct === 100 ? 'text-green-600' : pct >= 80 ? 'text-blue-600' : 'text-orange-500'}`}>
                  ({pct}%)
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
                {sorted.map((room, i) => {
                  const isOccupied = room.status === 'occupied'
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center gap-3 px-5 py-3.5 ${
                        i < sorted.length - 1 ? 'border-b border-gray-50' : ''
                      } ${!isOccupied ? 'bg-amber-50/60' : ''}`}
                    >
                      {/* 部屋番号 */}
                      <span className="text-sm font-medium text-gray-800 w-14 shrink-0">
                        {room.room_number}号室
                      </span>

                      {/* 間取り */}
                      <span className="text-xs text-gray-500 w-12 shrink-0">
                        {room.floor_plan ?? '—'}
                      </span>

                      {/* 状態バッジ */}
                      {isOccupied ? (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                          入居中
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                          空室
                        </span>
                      )}

                      {/* 家賃 */}
                      <span className="ml-auto text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                        {isOccupied
                          ? `¥${(room.rent_amount ?? 0).toLocaleString('ja-JP')}`
                          : <span className="text-amber-600">（想定 ¥{(room.rent_amount ?? 0).toLocaleString('ja-JP')}）</span>
                        }
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
