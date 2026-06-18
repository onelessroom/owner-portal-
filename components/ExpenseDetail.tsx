'use client'

import { useState } from 'react'
import { Expense } from '@/types'

interface ExpenseDetailProps {
  expense: Expense
}

export default function ExpenseDetail({ expense }: ExpenseDetailProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
      {/* 説明 */}
      {expense.description && (
        <div>
          <span className="font-medium text-gray-600">内容・理由：</span>
          <p className="mt-1 text-gray-800">{expense.description}</p>
        </div>
      )}

      {/* 書類リンク */}
      <div className="flex flex-wrap gap-2">
        {expense.estimate_url && (
          <a
            href={expense.estimate_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            📄 見積書
          </a>
        )}
        {expense.receipt_url && (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            🧾 請求書
          </a>
        )}
      </div>

      {/* 写真サムネイル */}
      {expense.photo_urls && expense.photo_urls.length > 0 && (
        <div>
          <span className="font-medium text-gray-600">写真：</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {expense.photo_urls.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightboxUrl(url)}
                className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`写真 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 写真拡大ライトボックス */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-2xl w-full mx-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="拡大写真"
              className="w-full h-auto rounded-lg"
            />
            <button
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
              onClick={() => setLightboxUrl(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
