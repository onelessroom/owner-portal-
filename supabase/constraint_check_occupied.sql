-- 入居数が総戸数を超えないようにするDB制約
-- Supabase SQLエディタに貼り付けて実行してください

CREATE OR REPLACE FUNCTION check_occupied_not_exceed_total()
RETURNS TRIGGER AS $$
DECLARE
  v_total    INTEGER;
  v_occupied INTEGER;
BEGIN
  SELECT total_units INTO v_total FROM properties WHERE id = NEW.property_id;

  SELECT COUNT(*) INTO v_occupied
  FROM rooms
  WHERE property_id = NEW.property_id
    AND status = 'occupied'
    AND id != NEW.id;

  IF NEW.status = 'occupied' AND (v_occupied + 1) > v_total THEN
    RAISE EXCEPTION
      '入居数が総戸数（%戸）を超えることはできません。現在の入居数：%室',
      v_total, v_occupied;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_occupied ON rooms;
CREATE TRIGGER trg_check_occupied
  BEFORE INSERT OR UPDATE OF status ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION check_occupied_not_exceed_total();
