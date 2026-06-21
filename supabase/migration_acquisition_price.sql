-- propertiesテーブルに取得価格カラムを追加
-- Supabase SQL Editorで実行してください
ALTER TABLE properties ADD COLUMN IF NOT EXISTS acquisition_price BIGINT;
