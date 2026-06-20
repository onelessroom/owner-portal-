#!/usr/bin/env node
// デモデータ投入スクリプト
// 実行: node supabase/seed_demo.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const eq = line.indexOf('=')
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
})

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const OWNER_ID    = '545fec1a-40c1-452b-9e43-d1a3e49b761f'
const PROP_WAN_ID = '4cbd2296-158b-45c5-9238-132eec33b93e' // ワンレスマンション（既存）

async function run() {
  // ── 1. 既存テストデータ削除 ──────────────────────────────
  console.log('1. 既存テストデータを削除...')
  for (const tbl of ['remittances','repairs','expenses','rent_payments','tenants','rooms']) {
    const { error } = await sb.from(tbl).delete().not('id', 'is', null)
    if (error) throw new Error(`${tbl} 削除失敗: ${error.message}`)
  }

  // ── 2. ワンレスマンション更新 ───────────────────────────
  await sb.from('properties')
    .update({ total_units: 10, address: '静岡県静岡市葵区鷹匠1-1-1' })
    .eq('id', PROP_WAN_ID)

  // ── 3. 追加物件 3 棟 ────────────────────────────────────
  console.log('2. 物件を追加...')
  const { data: newProps, error: pErr } = await sb.from('properties').insert([
    { owner_id: OWNER_ID, name: 'グランフォート静岡', address: '静岡県静岡市葵区常磐町2-3-5', total_units: 10 },
    { owner_id: OWNER_ID, name: 'メゾン葵',           address: '静岡県静岡市葵区長沼1-12-8',  total_units: 10 },
    { owner_id: OWNER_ID, name: 'サンハイツ富士',     address: '静岡県富士市柳島2-4-7',       total_units: 10 },
  ]).select()
  if (pErr) throw pErr
  const [PROP_GRD_ID, PROP_MAI_ID, PROP_SUN_ID] = newProps.map(p => p.id)

  // ── 4. 部屋 40 室 ────────────────────────────────────────
  console.log('3. 部屋を作成...')
  //  ワンレス 101-110  ／ 109=常時空室, 110=V1(4月新テナント→occupied)
  //  グランフォート 101-105,201-205  ／ 全室 occupied(205=V2 5月〜)
  //  メゾン葵 101-110  ／ 109=常時空室, 110=V3(6月新テナント→occupied)
  //  サンハイツ 101-105,201-205  ／ 全室 occupied
  const roomDefs = [
    ...[
      ['101',58000,'occupied'],['102',60000,'occupied'],['103',60000,'occupied'],
      ['104',62000,'occupied'],['105',62000,'occupied'],['106',63000,'occupied'],
      ['107',63000,'occupied'],['108',65000,'occupied'],
      ['109',62000,'vacant'],  ['110',63000,'occupied'],
    ].map(([n,r,s])=>({property_id:PROP_WAN_ID,room_number:n,rent_amount:r,status:s})),
    ...[
      ['101',72000],['102',72000],['103',75000],['104',75000],['105',78000],
      ['201',80000],['202',80000],['203',82000],['204',85000],['205',82000],
    ].map(([n,r])=>({property_id:PROP_GRD_ID,room_number:n,rent_amount:r,status:'occupied'})),
    ...[
      ['101',48000,'occupied'],['102',48000,'occupied'],['103',50000,'occupied'],
      ['104',50000,'occupied'],['105',52000,'occupied'],['106',52000,'occupied'],
      ['107',53000,'occupied'],['108',55000,'occupied'],
      ['109',50000,'vacant'],  ['110',53000,'occupied'],
    ].map(([n,r,s])=>({property_id:PROP_MAI_ID,room_number:n,rent_amount:r,status:s})),
    ...[
      ['101',42000],['102',42000],['103',44000],['104',44000],['105',46000],
      ['201',46000],['202',48000],['203',48000],['204',50000],['205',50000],
    ].map(([n,r])=>({property_id:PROP_SUN_ID,room_number:n,rent_amount:r,status:'occupied'})),
  ]
  const { data: allRooms, error: rErr } = await sb.from('rooms').insert(roomDefs).select()
  if (rErr) throw rErr
  const roomId = (propId, num) =>
    allRooms.find(r => r.property_id === propId && r.room_number === num)?.id
  console.log(`   ${allRooms.length} 部屋作成`)

  // ── 5. 入居者 ───────────────────────────────────────────
  console.log('4. 入居者を作成...')
  const tenants = [
    // ワンレスマンション 常時 8 名 + 変動 2 名(旧+新)
    {room_id:roomId(PROP_WAN_ID,'101'),name:'田中 健太',  move_in_date:'2024-04-01'},
    {room_id:roomId(PROP_WAN_ID,'102'),name:'佐藤 美咲',  move_in_date:'2023-09-01'},
    {room_id:roomId(PROP_WAN_ID,'103'),name:'鈴木 大輔',  move_in_date:'2025-01-01'},
    {room_id:roomId(PROP_WAN_ID,'104'),name:'高橋 愛',    move_in_date:'2024-10-01'},
    {room_id:roomId(PROP_WAN_ID,'105'),name:'渡辺 浩',    move_in_date:'2023-06-01'},
    {room_id:roomId(PROP_WAN_ID,'106'),name:'伊藤 由美',  move_in_date:'2025-03-01'},
    {room_id:roomId(PROP_WAN_ID,'107'),name:'中村 誠',    move_in_date:'2024-07-01'},
    {room_id:roomId(PROP_WAN_ID,'108'),name:'小林 幸子',  move_in_date:'2022-11-01'},
    {room_id:roomId(PROP_WAN_ID,'110'),name:'加藤 明',    move_in_date:'2024-05-01',move_out_date:'2026-01-31'}, // V1旧
    {room_id:roomId(PROP_WAN_ID,'110'),name:'木村 拓也',  move_in_date:'2026-04-01'}, // V1新
    // グランフォート 常時 9 名 + 変動 2 名
    {room_id:roomId(PROP_GRD_ID,'101'),name:'松田 洋子',  move_in_date:'2023-10-01'},
    {room_id:roomId(PROP_GRD_ID,'102'),name:'井上 隆',    move_in_date:'2024-02-01'},
    {room_id:roomId(PROP_GRD_ID,'103'),name:'木下 真理',  move_in_date:'2025-04-01'},
    {room_id:roomId(PROP_GRD_ID,'104'),name:'斎藤 剛',    move_in_date:'2023-08-01'},
    {room_id:roomId(PROP_GRD_ID,'105'),name:'清水 奈々',  move_in_date:'2024-11-01'},
    {room_id:roomId(PROP_GRD_ID,'201'),name:'山田 浩二',  move_in_date:'2023-03-01'},
    {room_id:roomId(PROP_GRD_ID,'202'),name:'林 恵美',    move_in_date:'2024-06-01'},
    {room_id:roomId(PROP_GRD_ID,'203'),name:'石川 俊',    move_in_date:'2025-01-01'},
    {room_id:roomId(PROP_GRD_ID,'204'),name:'藤田 早苗',  move_in_date:'2022-12-01'},
    {room_id:roomId(PROP_GRD_ID,'205'),name:'前田 哲也',  move_in_date:'2024-03-01',move_out_date:'2026-02-28'}, // V2旧
    {room_id:roomId(PROP_GRD_ID,'205'),name:'後藤 紗希',  move_in_date:'2026-05-01'}, // V2新
    // メゾン葵 常時 8 名 + 変動 2 名
    {room_id:roomId(PROP_MAI_ID,'101'),name:'西村 徹',    move_in_date:'2024-08-01'},
    {room_id:roomId(PROP_MAI_ID,'102'),name:'中島 妙子',  move_in_date:'2023-05-01'},
    {room_id:roomId(PROP_MAI_ID,'103'),name:'橋本 勇',    move_in_date:'2025-02-01'},
    {room_id:roomId(PROP_MAI_ID,'104'),name:'山口 里奈',  move_in_date:'2024-09-01'},
    {room_id:roomId(PROP_MAI_ID,'105'),name:'岡田 哲',    move_in_date:'2023-07-01'},
    {room_id:roomId(PROP_MAI_ID,'106'),name:'長谷川 静香',move_in_date:'2024-12-01'},
    {room_id:roomId(PROP_MAI_ID,'107'),name:'村田 義男',  move_in_date:'2025-03-01'},
    {room_id:roomId(PROP_MAI_ID,'108'),name:'坂本 千鶴',  move_in_date:'2023-11-01'},
    {room_id:roomId(PROP_MAI_ID,'110'),name:'松本 信也',  move_in_date:'2024-06-01',move_out_date:'2026-02-28'}, // V3旧
    {room_id:roomId(PROP_MAI_ID,'110'),name:'小川 彩花',  move_in_date:'2026-06-01'}, // V3新
    // サンハイツ富士 全 10 名
    {room_id:roomId(PROP_SUN_ID,'101'),name:'三浦 孝雄',  move_in_date:'2024-01-01'},
    {room_id:roomId(PROP_SUN_ID,'102'),name:'池田 香澄',  move_in_date:'2023-04-01'},
    {room_id:roomId(PROP_SUN_ID,'103'),name:'阿部 龍',    move_in_date:'2025-01-01'},
    {room_id:roomId(PROP_SUN_ID,'104'),name:'原田 まゆみ',move_in_date:'2024-05-01'},
    {room_id:roomId(PROP_SUN_ID,'105'),name:'石田 博',    move_in_date:'2023-09-01'},
    {room_id:roomId(PROP_SUN_ID,'201'),name:'上田 玲子',  move_in_date:'2025-04-01'},
    {room_id:roomId(PROP_SUN_ID,'202'),name:'近藤 広明',  move_in_date:'2024-03-01'},
    {room_id:roomId(PROP_SUN_ID,'203'),name:'藤井 光子',  move_in_date:'2023-06-01'},
    {room_id:roomId(PROP_SUN_ID,'204'),name:'武田 和也',  move_in_date:'2024-08-01'},
    {room_id:roomId(PROP_SUN_ID,'205'),name:'野村 京子',  move_in_date:'2022-10-01'},
  ]
  const { error: tErr } = await sb.from('tenants').insert(tenants)
  if (tErr) throw tErr
  console.log(`   ${tenants.length} 名作成`)

  // ── 6. 支出 ─────────────────────────────────────────────
  console.log('5. 支出データを作成...')
  // 共通ヘルパー
  const e = (propId, y, m, cat, amt, desc, date, roomNum=null) => ({
    property_id: propId,
    room_id: roomNum ? roomId(propId, roomNum) : null,
    year: y, month: m, category: cat, amount: amt,
    description: desc, expense_date: date,
  })
  const expenses = [
    // ====== 1月 ======
    e(PROP_WAN_ID,2026,1,'管理料', 28000,'管理委託費（1月分）',           '2026-01-05'),
    e(PROP_GRD_ID,2026,1,'管理料', 39000,'管理委託費（1月分）',           '2026-01-05'),
    e(PROP_MAI_ID,2026,1,'管理料', 21000,'管理委託費（1月分）',           '2026-01-05'),
    e(PROP_SUN_ID,2026,1,'管理料', 23000,'管理委託費（1月分）',           '2026-01-05'),
    e(PROP_WAN_ID,2026,1,'清掃費', 12000,'共用部清掃（1月）',             '2026-01-10'),
    e(PROP_GRD_ID,2026,1,'清掃費', 14000,'共用部清掃（1月）',             '2026-01-10'),
    e(PROP_MAI_ID,2026,1,'清掃費', 10000,'共用部清掃（1月）',             '2026-01-10'),
    e(PROP_SUN_ID,2026,1,'清掃費', 10000,'共用部清掃（1月）',             '2026-01-10'),
    e(PROP_WAN_ID,2026,1,'保険料', 48000,'火災保険料（年払い）',          '2026-01-15'),
    e(PROP_WAN_ID,2026,1,'その他',  8500,'共用部水道代（1月）',           '2026-01-20'),
    e(PROP_GRD_ID,2026,1,'その他',  9000,'共用部水道代（1月）',           '2026-01-20'),
    // ====== 2月 ======
    e(PROP_WAN_ID,2026,2,'管理料', 28000,'管理委託費（2月分）',           '2026-02-05'),
    e(PROP_GRD_ID,2026,2,'管理料', 39000,'管理委託費（2月分）',           '2026-02-05'),
    e(PROP_MAI_ID,2026,2,'管理料', 21000,'管理委託費（2月分）',           '2026-02-05'),
    e(PROP_SUN_ID,2026,2,'管理料', 23000,'管理委託費（2月分）',           '2026-02-05'),
    e(PROP_WAN_ID,2026,2,'清掃費', 12000,'共用部清掃（2月）',             '2026-02-10'),
    e(PROP_GRD_ID,2026,2,'清掃費', 14000,'共用部清掃（2月）',             '2026-02-10'),
    e(PROP_MAI_ID,2026,2,'清掃費', 10000,'共用部清掃（2月）',             '2026-02-10'),
    e(PROP_SUN_ID,2026,2,'清掃費', 10000,'共用部清掃（2月）',             '2026-02-10'),
    e(PROP_WAN_ID,2026,2,'その他',  7800,'共用部電気代（2月）',           '2026-02-18'),
    e(PROP_GRD_ID,2026,2,'その他',  8500,'共用部電気代（2月）',           '2026-02-18'),
    e(PROP_MAI_ID,2026,2,'修繕費',  4200,'廊下照明交換（107号室前）',     '2026-02-20','107'),
    // ====== 3月 ======
    e(PROP_WAN_ID,2026,3,'管理料', 28000,'管理委託費（3月分）',           '2026-03-05'),
    e(PROP_GRD_ID,2026,3,'管理料', 39000,'管理委託費（3月分）',           '2026-03-05'),
    e(PROP_MAI_ID,2026,3,'管理料', 21000,'管理委託費（3月分）',           '2026-03-05'),
    e(PROP_SUN_ID,2026,3,'管理料', 23000,'管理委託費（3月分）',           '2026-03-05'),
    e(PROP_WAN_ID,2026,3,'清掃費', 12000,'共用部清掃（3月）',             '2026-03-10'),
    e(PROP_GRD_ID,2026,3,'清掃費', 14000,'共用部清掃（3月）',             '2026-03-10'),
    e(PROP_MAI_ID,2026,3,'清掃費', 10000,'共用部清掃（3月）',             '2026-03-10'),
    e(PROP_SUN_ID,2026,3,'清掃費', 10000,'共用部清掃（3月）',             '2026-03-10'),
    e(PROP_WAN_ID,2026,3,'修繕費', 87500,'エアコン交換（103号室）',       '2026-03-15','103'),
    e(PROP_WAN_ID,2026,3,'その他', 19000,'消防設備点検（ワンレスマンション）','2026-03-25'),
    e(PROP_MAI_ID,2026,3,'その他', 19000,'消防設備点検（メゾン葵）',      '2026-03-25'),
    e(PROP_WAN_ID,2026,3,'その他',  8200,'共用部水道代（3月）',           '2026-03-22'),
    e(PROP_MAI_ID,2026,3,'その他',  8800,'共用部水道代（3月）',           '2026-03-22'),
    // ====== 4月 ======
    e(PROP_WAN_ID,2026,4,'管理料', 28000,'管理委託費（4月分）',           '2026-04-05'),
    e(PROP_GRD_ID,2026,4,'管理料', 39000,'管理委託費（4月分）',           '2026-04-05'),
    e(PROP_MAI_ID,2026,4,'管理料', 21000,'管理委託費（4月分）',           '2026-04-05'),
    e(PROP_SUN_ID,2026,4,'管理料', 23000,'管理委託費（4月分）',           '2026-04-05'),
    e(PROP_WAN_ID,2026,4,'清掃費', 12000,'共用部清掃（4月）',             '2026-04-10'),
    e(PROP_GRD_ID,2026,4,'清掃費', 14000,'共用部清掃（4月）',             '2026-04-10'),
    e(PROP_MAI_ID,2026,4,'清掃費', 10000,'共用部清掃（4月）',             '2026-04-10'),
    e(PROP_SUN_ID,2026,4,'清掃費', 10000,'共用部清掃（4月）',             '2026-04-10'),
    e(PROP_MAI_ID,2026,4,'修繕費', 42000,'水漏れ補修（105号室 洗面台下）','2026-04-08','105'),
    e(PROP_GRD_ID,2026,4,'清掃費', 52000,'外壁・共用廊下高圧洗浄',       '2026-04-18'),
    e(PROP_MAI_ID,2026,4,'その他', 18000,'敷地内草刈り',                  '2026-04-22'),
    // ====== 5月 ======
    e(PROP_WAN_ID,2026,5,'管理料', 28000,'管理委託費（5月分）',           '2026-05-05'),
    e(PROP_GRD_ID,2026,5,'管理料', 39000,'管理委託費（5月分）',           '2026-05-05'),
    e(PROP_MAI_ID,2026,5,'管理料', 21000,'管理委託費（5月分）',           '2026-05-05'),
    e(PROP_SUN_ID,2026,5,'管理料', 23000,'管理委託費（5月分）',           '2026-05-05'),
    e(PROP_WAN_ID,2026,5,'清掃費', 12000,'共用部清掃（5月）',             '2026-05-10'),
    e(PROP_GRD_ID,2026,5,'清掃費', 14000,'共用部清掃（5月）',             '2026-05-10'),
    e(PROP_MAI_ID,2026,5,'清掃費', 10000,'共用部清掃（5月）',             '2026-05-10'),
    e(PROP_SUN_ID,2026,5,'清掃費', 10000,'共用部清掃（5月）',             '2026-05-10'),
    e(PROP_SUN_ID,2026,5,'修繕費', 75000,'給湯器交換（201号室）',         '2026-05-12','201'),
    e(PROP_MAI_ID,2026,5,'修繕費', 28000,'共用廊下照明LED化（全フロア）', '2026-05-28'),
    e(PROP_WAN_ID,2026,5,'その他',  8200,'共用部電気代（5月）',           '2026-05-20'),
    e(PROP_GRD_ID,2026,5,'その他',  8300,'共用部電気代（5月）',           '2026-05-20'),
    // ====== 6月 ======
    e(PROP_WAN_ID,2026,6,'管理料', 28000,'管理委託費（6月分）',           '2026-06-05'),
    e(PROP_GRD_ID,2026,6,'管理料', 39000,'管理委託費（6月分）',           '2026-06-05'),
    e(PROP_MAI_ID,2026,6,'管理料', 21000,'管理委託費（6月分）',           '2026-06-05'),
    e(PROP_SUN_ID,2026,6,'管理料', 23000,'管理委託費（6月分）',           '2026-06-05'),
    e(PROP_WAN_ID,2026,6,'清掃費', 12000,'共用部清掃（6月）',             '2026-06-10'),
    e(PROP_GRD_ID,2026,6,'清掃費', 14000,'共用部清掃（6月）',             '2026-06-10'),
    e(PROP_MAI_ID,2026,6,'清掃費', 10000,'共用部清掃（6月）',             '2026-06-10'),
    e(PROP_SUN_ID,2026,6,'清掃費', 10000,'共用部清掃（6月）',             '2026-06-10'),
    e(PROP_WAN_ID,2026,6,'修繕費', 52000,'クロス張替え・原状回復（110号室 退去後）','2026-06-10','110'),
    e(PROP_GRD_ID,2026,6,'その他', 24000,'害虫防除（シロアリ予防処理）',  '2026-06-14'),
    e(PROP_WAN_ID,2026,6,'租税公課',49500,'固定資産税 第1期（ワンレスマンション）','2026-06-02'),
    e(PROP_GRD_ID,2026,6,'租税公課',68000,'固定資産税 第1期（グランフォート静岡）','2026-06-02'),
    e(PROP_MAI_ID,2026,6,'租税公課',42000,'固定資産税 第1期（メゾン葵）',        '2026-06-02'),
    e(PROP_SUN_ID,2026,6,'租税公課',38500,'固定資産税 第1期（サンハイツ富士）',  '2026-06-02'),
    e(PROP_GRD_ID,2026,6,'その他', 19000,'消防設備点検（グランフォート静岡）',    '2026-06-18'),
    e(PROP_SUN_ID,2026,6,'その他', 17000,'消防設備点検（サンハイツ富士）',        '2026-06-18'),
  ]

  const { data: expData, error: eErr } = await sb.from('expenses').insert(expenses).select()
  if (eErr) throw eErr
  console.log(`   ${expData.length} 件作成`)

  // ── 7. 修繕記録 ─────────────────────────────────────────
  console.log('6. 修繕記録を作成...')
  const findExp = (desc) => expData.find(x => x.description === desc)?.id

  const repairs = [
    {
      expense_id: findExp('廊下照明交換（107号室前）'),
      property_id: PROP_MAI_ID, room_id: roomId(PROP_MAI_ID,'107'),
      title: '廊下照明交換', repair_date: '2026-02-20',
      reason: '107号室前廊下の蛍光灯が断線、点灯不可', contractor: '静岡電設サービス',
    },
    {
      expense_id: findExp('エアコン交換（103号室）'),
      property_id: PROP_WAN_ID, room_id: roomId(PROP_WAN_ID,'103'),
      title: 'エアコン交換（103号室）', repair_date: '2026-03-15',
      reason: '設置15年超・コンプレッサー異音・冷房停止', contractor: '中部家電設備',
    },
    {
      expense_id: findExp('水漏れ補修（105号室 洗面台下）'),
      property_id: PROP_MAI_ID, room_id: roomId(PROP_MAI_ID,'105'),
      title: '水漏れ補修（洗面台下配管）', repair_date: '2026-04-08',
      reason: '洗面台下の給水管継手から水漏れ、入居者より報告', contractor: '葵水道設備',
    },
    {
      expense_id: findExp('給湯器交換（201号室）'),
      property_id: PROP_SUN_ID, room_id: roomId(PROP_SUN_ID,'201'),
      title: '給湯器交換（201号室）', repair_date: '2026-05-12',
      reason: '設置12年・エラーコード連発・お湯が出ない', contractor: '富士ガス設備',
    },
    {
      expense_id: findExp('共用廊下照明LED化（全フロア）'),
      property_id: PROP_MAI_ID,
      title: '共用廊下照明LED化', repair_date: '2026-05-28',
      reason: '蛍光灯の断続的な故障に伴いLED一括交換、省エネ対応', contractor: '静岡電設サービス',
    },
    {
      expense_id: findExp('クロス張替え・原状回復（110号室 退去後）'),
      property_id: PROP_WAN_ID, room_id: roomId(PROP_WAN_ID,'110'),
      title: 'クロス張替え・原状回復（110号室）', repair_date: '2026-06-10',
      reason: '加藤 明 氏退去後の原状回復工事', contractor: 'タカハシリフォーム',
    },
  ]
  const { data: repData, error: repErr } = await sb.from('repairs').insert(repairs).select()
  if (repErr) throw repErr
  console.log(`   ${repData.length} 件作成`)

  // ── 8. 送金履歴 ─────────────────────────────────────────
  console.log('7. 送金履歴を作成...')
  // 月別収入（家賃の合計、入居率から計算済み）
  const incomeByMonth = {
    '2026-1': 2258000, '2026-2': 2195000, '2026-3': 2060000,
    '2026-4': 2123000, '2026-5': 2205000, '2026-6': 2258000,
  }
  // 月別支出合計（スクリプト内で検算）
  const expByMonth = {}
  expenses.forEach(ex => {
    const k = `${ex.year}-${ex.month}`
    expByMonth[k] = (expByMonth[k]||0) + ex.amount
  })

  const remittances = Object.entries(incomeByMonth).map(([k, income]) => {
    const [yr, mo] = k.split('-').map(Number)
    const expTotal = expByMonth[k] || 0
    const remAmt   = income - expTotal
    return {
      owner_id: OWNER_ID, year: yr, month: mo,
      remittance_amount: remAmt,
      remittance_date: `${yr}-${String(mo).padStart(2,'0')}-25`,
      note: `家賃収入 ¥${income.toLocaleString()} ／ 支出合計 ¥${expTotal.toLocaleString()}`,
    }
  })

  const { data: remitData, error: remitErr } = await sb.from('remittances').insert(remittances).select()
  if (remitErr) throw remitErr
  console.log(`   ${remitData.length} 件作成`)

  // ── 9. 検算 ─────────────────────────────────────────────
  console.log('\n📊 月別収支 検算:')
  const header = ['月','収入','支出','送金額'].map(s=>s.padEnd(12)).join('')
  console.log(header)
  for (const [k, income] of Object.entries(incomeByMonth)) {
    const [yr,mo] = k.split('-').map(Number)
    const exp = expByMonth[k]||0
    const rem = income - exp
    console.log(`${yr}年${mo}月`.padEnd(12) +
      `¥${income.toLocaleString()}`.padEnd(14) +
      `¥${exp.toLocaleString()}`.padEnd(14) +
      `¥${rem.toLocaleString()}`)
  }

  // 入居率確認
  const monthlyOccupancy = {
    '1月': {occupied:38,total:40}, '2月': {occupied:37,total:40},
    '3月': {occupied:35,total:40}, '4月': {occupied:36,total:40},
    '5月': {occupied:37,total:40}, '6月': {occupied:38,total:40},
  }
  console.log('\n📊 月別入居率:')
  for (const [m,{occupied,total}] of Object.entries(monthlyOccupancy)) {
    console.log(`  ${m}: ${occupied}/${total} = ${Math.round(occupied/total*100)}%`)
  }

  console.log('\n✅ デモデータ投入完了！')
  console.log(`   オーナー: 1名 (既存流用)`)
  console.log(`   物件: 4棟 (1棟既存 + 3棟追加)`)
  console.log(`   部屋: ${allRooms.length}室`)
  console.log(`   入居者: ${tenants.length}名 (退去済み含む)`)
  console.log(`   支出: ${expData.length}件`)
  console.log(`   修繕記録: ${repData.length}件`)
  console.log(`   送金履歴: ${remitData.length}件`)
}

run().catch(err => { console.error('❌', err.message||err); process.exit(1) })
