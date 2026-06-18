-- ユーザーロール管理
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'owner'  -- 'admin' or 'owner'
);

-- オーナー
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 物件
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES owners(id),
  name TEXT NOT NULL,
  address TEXT,
  total_units INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 部屋
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  room_number TEXT NOT NULL,
  floor_plan TEXT,
  rent_amount BIGINT,
  status TEXT DEFAULT 'vacant',  -- 'occupied' or 'vacant'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 入居者
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  name TEXT NOT NULL,
  move_in_date DATE,
  move_out_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 家賃入金
CREATE TABLE rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount BIGINT NOT NULL,
  paid_date DATE,
  status TEXT DEFAULT 'paid',  -- 'paid' / 'unpaid' / 'late'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 支出
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  room_id UUID REFERENCES rooms(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  category TEXT NOT NULL,  -- '管理料','修繕費','クリーニング費','広告料','仲介手数料','設備交換費','その他'
  amount BIGINT NOT NULL,
  description TEXT,        -- 何のための支出か（理由）
  expense_date DATE NOT NULL,
  receipt_url TEXT,        -- 請求書PDF
  estimate_url TEXT,       -- 見積書PDF
  photo_urls TEXT[],       -- 施工前後写真（複数）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 修繕記録（支出と紐づく詳細情報）
CREATE TABLE repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id),
  property_id UUID REFERENCES properties(id),
  room_id UUID REFERENCES rooms(id),
  title TEXT NOT NULL,      -- 例：エアコン交換
  reason TEXT,              -- なぜ発生したか
  contractor TEXT,          -- 業者名
  repair_date DATE,
  photo_urls TEXT[],
  estimate_url TEXT,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 送金履歴
CREATE TABLE remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES owners(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  remittance_amount BIGINT NOT NULL,
  remittance_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS（行レベルセキュリティ）有効化
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;

-- オーナーは自分のデータのみ閲覧可能
CREATE POLICY "owners_select_own" ON owners
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "properties_select_own" ON properties
  FOR SELECT USING (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

CREATE POLICY "rooms_select_own" ON rooms
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN owners o ON p.owner_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "expenses_select_own" ON expenses
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN owners o ON p.owner_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "repairs_select_own" ON repairs
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN owners o ON p.owner_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "remittances_select_own" ON remittances
  FOR SELECT USING (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

-- adminは全データにアクセス可能（service_roleで操作するため別途設定）
-- Storage バケット（receipts / photos）はSupabaseダッシュボードで作成すること
cp /Users/ootatoshinin/owner-portal/.env.local.example /Users/ootatoshinin/owner-portal/.env.local

