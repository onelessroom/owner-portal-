'use client'
import { useState } from 'react'

interface Room {
  id: string
  room_number: string
  rent_amount: number | null
  status: string
}

interface Property {
  id: string
  name: string
  rooms: Room[]
}

export default function RentIncomeAccordion({ properties }: { properties: Property[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {properties.map(prop => {
        const occupiedRooms = prop.rooms
          .filter(r => r.status === 'occupied')
          .sort((a, b) => a.room_number.localeCompare(b.room_number, 'ja'))
        const propTotal = occupiedRooms.reduce((s, r) => s + (r.rent_amount ?? 0), 0)
        const isOpen = openId === prop.id

        return (
          <div key={prop.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-4 text-left"
              onClick={() => setOpenId(isOpen ? null : prop.id)}
            >
              <span className="text-base font-semibold text-gray-900 flex-1 mr-3">{prop.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-lg font-bold text-blue-600 tabular-nums">
                  ¥{propTotal.toLocaleString('ja-JP')}
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
                {occupiedRooms.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">入居中の部屋がありません</p>
                ) : (
                  occupiedRooms.map((room, i) => (
                    <div
                      key={room.id}
                      className={`flex items-center justify-between px-5 py-3.5 ${
                        i < occupiedRooms.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <span className="text-sm text-gray-600">{room.room_number}号室</span>
                      <span className="text-base font-semibold text-gray-900 tabular-nums">
                        ¥{(room.rent_amount ?? 0).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
