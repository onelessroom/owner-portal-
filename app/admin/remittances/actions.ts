'use server'

import { sendRemittanceNotification } from '@/lib/resend'

export async function sendRemittanceEmail({
  ownerEmail,
  ownerName,
  year,
  month,
  amount,
}: {
  ownerEmail: string
  ownerName: string
  year: number
  month: number
  amount: number
}) {
  const result = await sendRemittanceNotification({ ownerEmail, ownerName, year, month, amount })
  if (result.error) {
    console.error('[Resend] メール送信エラー:', result.error)
  } else {
    console.log('[Resend] メール送信成功:', result.data)
  }
}
