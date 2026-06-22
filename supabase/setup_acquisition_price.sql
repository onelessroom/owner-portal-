-- ================================================================
-- 物件取得価格の追加とデータ登録
-- Supabase SQL Editor に貼り付けて実行してください
-- ================================================================

-- Step 1: acquisition_price カラムを追加
ALTER TABLE properties ADD COLUMN IF NOT EXISTS acquisition_price BIGINT;

-- Step 2: 取得価格を逆算して登録
--   計算式: ROUND(年間家賃収入 / 0.08 / 10000) * 10000
--   年間家賃収入 = 在室(occupied)の部屋の rent_amount 合計 × 12
UPDATE properties
SET acquisition_price = (
  SELECT (ROUND(SUM(r.rent_amount)::float * 12.0 / 0.08 / 10000))::bigint * 10000
  FROM rooms r
  WHERE r.property_id = properties.id
    AND r.status = 'occupied'
)
WHERE acquisition_price IS NULL
  AND EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.property_id = properties.id
      AND r.status = 'occupied'
  );

-- 結果確認
SELECT
  p.name,
  COUNT(r.id) FILTER (WHERE r.status = 'occupied') AS occupied_rooms,
  SUM(r.rent_amount) FILTER (WHERE r.status = 'occupied') AS monthly_rent,
  SUM(r.rent_amount) FILTER (WHERE r.status = 'occupied') * 12 AS annual_rent,
  p.acquisition_price,
  ROUND(
    SUM(r.rent_amount) FILTER (WHERE r.status = 'occupied')::float * 12.0 / p.acquisition_price * 100,
    2
  ) AS yield_pct
FROM properties p
LEFT JOIN rooms r ON r.property_id = p.id
GROUP BY p.id, p.name, p.acquisition_price
ORDER BY p.name;
