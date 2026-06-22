/**
 * 金額を ¥カンマ区切り形式で返す共通フォーマッタ
 * 例: 11387000 → "¥11,387,000"
 *     -500000  → "−¥500,000"
 */
export function formatYen(n: number): string {
  const prefix = n < 0 ? '−¥' : '¥'
  return prefix + Math.abs(n).toLocaleString('ja-JP')
}
