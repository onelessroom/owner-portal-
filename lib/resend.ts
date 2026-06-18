import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

// オーナーへの送金通知メール送信
export async function sendRemittanceNotification({
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
  const formattedAmount = amount.toLocaleString('ja-JP')

  return resend.emails.send({
    from: 'onboarding@resend.dev',
    to: ownerEmail,
    subject: `【送金のお知らせ】${year}年${month}月分`,
    html: `
      <p>${ownerName} 様</p>
      <p>${year}年${month}月分の送金が確定しました。</p>
      <p>送金額：<strong>¥${formattedAmount}</strong></p>
      <p>詳細はオーナーポータルよりご確認ください。</p>
    `,
  })
}
