-- ============================================================
-- user_roles テーブルの RLS 設定
-- ============================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは自分のロールのみ読み取れる
CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- is_admin() ヘルパー関数
-- SECURITY DEFINER により RLS をバイパスして user_roles を参照
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- owners テーブルへの admin ポリシー
-- ============================================================
CREATE POLICY "owners_admin_select" ON owners
  FOR SELECT USING (is_admin());

CREATE POLICY "owners_admin_insert" ON owners
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "owners_admin_update" ON owners
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "owners_admin_delete" ON owners
  FOR DELETE USING (is_admin());

-- ============================================================
-- rooms テーブルへの admin ポリシー
-- ============================================================
CREATE POLICY "rooms_admin_select" ON rooms
  FOR SELECT USING (is_admin());

CREATE POLICY "rooms_admin_insert" ON rooms
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "rooms_admin_update" ON rooms
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "rooms_admin_delete" ON rooms
  FOR DELETE USING (is_admin());

-- ============================================================
-- expenses テーブルへの admin ポリシー
-- ============================================================
CREATE POLICY "expenses_admin_select" ON expenses
  FOR SELECT USING (is_admin());

CREATE POLICY "expenses_admin_insert" ON expenses
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "expenses_admin_update" ON expenses
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "expenses_admin_delete" ON expenses
  FOR DELETE USING (is_admin());

-- ============================================================
-- remittances テーブルへの admin ポリシー
-- ============================================================
CREATE POLICY "remittances_admin_select" ON remittances
  FOR SELECT USING (is_admin());

CREATE POLICY "remittances_admin_insert" ON remittances
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "remittances_admin_update" ON remittances
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "remittances_admin_delete" ON remittances
  FOR DELETE USING (is_admin());
