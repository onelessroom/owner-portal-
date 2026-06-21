/**
 * マイグレーション: 間取り（floor_plan）付与 + 入居数上限チェック制約追加
 * 実行: node supabase/migrate_floor_plan_and_constraint.js
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  console.log('=== マイグレーション開始 ===')

  // ── 1. 物件IDを取得 ──────────────────────────────────────
  const { data: props, error: pErr } = await sb
    .from('properties')
    .select('id, name')
  if (pErr) throw pErr

  const propId = (name) => props.find(p => p.name === name)?.id
  const PROP_WAN = propId('ワンレスマンション')
  const PROP_GRD = propId('グランフォート静岡')
  const PROP_MAI = propId('メゾン葵')
  const PROP_SUN = propId('サンハイツ富士')

  console.log('物件:', { PROP_WAN, PROP_GRD, PROP_MAI, PROP_SUN })

  // ── 2. floor_plan を更新 ─────────────────────────────────
  console.log('\n1. floor_plan を更新中...')

  // ワンレスマンション: 全室 1K
  if (PROP_WAN) {
    const { error } = await sb.from('rooms').update({ floor_plan: '1K' }).eq('property_id', PROP_WAN)
    if (error) throw error
    console.log('  ワンレスマンション: 全室 → 1K')
  }

  // グランフォート静岡: 1F=1LDK / 2F=2LDK
  if (PROP_GRD) {
    const { error: e1 } = await sb.from('rooms').update({ floor_plan: '1LDK' })
      .eq('property_id', PROP_GRD).in('room_number', ['101','102','103','104','105'])
    if (e1) throw e1
    const { error: e2 } = await sb.from('rooms').update({ floor_plan: '2LDK' })
      .eq('property_id', PROP_GRD).in('room_number', ['201','202','203','204','205'])
    if (e2) throw e2
    console.log('  グランフォート静岡: 101-105 → 1LDK, 201-205 → 2LDK')
  }

  // メゾン葵: 全室 1DK
  if (PROP_MAI) {
    const { error } = await sb.from('rooms').update({ floor_plan: '1DK' }).eq('property_id', PROP_MAI)
    if (error) throw error
    console.log('  メゾン葵: 全室 → 1DK')
  }

  // サンハイツ富士: 1F=1K / 2F=1DK
  if (PROP_SUN) {
    const { error: e1 } = await sb.from('rooms').update({ floor_plan: '1K' })
      .eq('property_id', PROP_SUN).in('room_number', ['101','102','103','104','105'])
    if (e1) throw e1
    const { error: e2 } = await sb.from('rooms').update({ floor_plan: '1DK' })
      .eq('property_id', PROP_SUN).in('room_number', ['201','202','203','204','205'])
    if (e2) throw e2
    console.log('  サンハイツ富士: 101-105 → 1K, 201-205 → 1DK')
  }

  // ── 3. 入居数上限チェック制約（DB関数 + トリガー）─────────
  console.log('\n2. 入居数上限チェックのDB関数・トリガーを作成中...')

  const { error: fnErr } = await sb.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION check_occupied_not_exceed_total()
      RETURNS TRIGGER AS $$
      DECLARE
        v_total   INTEGER;
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
            '入居数が総戸数（%戸）を超えることはできません。現在の入居数：%室', v_total, v_occupied;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS trg_check_occupied ON rooms;
      CREATE TRIGGER trg_check_occupied
        BEFORE INSERT OR UPDATE OF status ON rooms
        FOR EACH ROW
        EXECUTE FUNCTION check_occupied_not_exceed_total();
    `
  })

  if (fnErr) {
    // exec_sql RPCが存在しない場合はスキップして警告を出す
    console.warn('  ⚠️ DB関数/トリガーの作成をスキップ（exec_sql RPCが未定義）')
    console.warn('  → supabase/constraint_check_occupied.sql を手動でSupabase SQLエディタに貼り付けてください')
  } else {
    console.log('  ✓ DB関数・トリガー作成完了')
  }

  // ── 4. 整合性確認 ────────────────────────────────────────
  console.log('\n3. データ整合性確認...')
  const { data: allProps } = await sb.from('properties').select('id, name, total_units')
  for (const p of allProps ?? []) {
    const { count: total } = await sb.from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', p.id)
    const { count: occ } = await sb.from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', p.id).eq('status', 'occupied')
    const ok = occ <= p.total_units ? '✓' : '⚠️ 超過！'
    console.log(`  ${p.name}: ${occ}/${total} 室入居中 (total_units=${p.total_units}) ${ok}`)
  }

  console.log('\n=== マイグレーション完了 ===')
}

main().catch(e => { console.error(e); process.exit(1) })
