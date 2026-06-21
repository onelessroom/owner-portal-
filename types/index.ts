// 全テーブルのTypeScript型定義

export type Role = 'admin' | 'owner'

export interface UserRole {
  user_id: string
  role: Role
}

export interface Owner {
  id: string
  user_id: string | null
  name: string
  email: string
  created_at: string
}

export interface Property {
  id: string
  owner_id: string
  name: string
  address: string | null
  total_units: number
  acquisition_price?: number | null
  created_at: string
}

export type RoomStatus = 'occupied' | 'vacant'

export interface Room {
  id: string
  property_id: string
  room_number: string
  floor_plan: string | null
  rent_amount: number | null
  status: RoomStatus
  created_at: string
}

export interface Tenant {
  id: string
  room_id: string
  name: string
  move_in_date: string | null
  move_out_date: string | null
  created_at: string
}

export type PaymentStatus = 'paid' | 'unpaid' | 'late'

export interface RentPayment {
  id: string
  room_id: string
  year: number
  month: number
  amount: number
  paid_date: string | null
  status: PaymentStatus
  created_at: string
}

export type ExpenseCategory =
  | '修繕費'
  | '清掃費'
  | '保険料'
  | '租税公課'
  | '管理料'
  | 'その他'

export interface Expense {
  id: string
  property_id: string | null
  room_id: string | null
  year: number
  month: number
  category: ExpenseCategory
  amount: number
  description: string | null
  expense_date: string
  receipt_url: string | null
  estimate_url: string | null
  photo_urls: string[] | null
  created_at: string
}

export interface Repair {
  id: string
  expense_id: string | null
  property_id: string | null
  room_id: string | null
  title: string
  reason: string | null
  contractor: string | null
  repair_date: string | null
  photo_urls: string[] | null
  estimate_url: string | null
  invoice_url: string | null
  created_at: string
}

export interface Remittance {
  id: string
  owner_id: string
  year: number
  month: number
  remittance_amount: number
  remittance_date: string | null
  note: string | null
  created_at: string
}

// テーブル結合後の拡張型
export interface ExpenseWithProperty extends Expense {
  properties?: { name: string } | null
  rooms?: { room_number: string } | null
}

export interface RepairWithDetails extends Repair {
  expenses?: Expense | null
  properties?: { name: string } | null
  rooms?: { room_number: string } | null
}

export interface RoomWithTenant extends Room {
  tenants?: Tenant[]
}

export interface PropertyWithRooms extends Property {
  rooms?: RoomWithTenant[]
}
