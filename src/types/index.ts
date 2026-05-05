// ─── Users ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'planner' | 'operator' | 'warehouse' | 'sales'

export interface AppUser {
  id: string
  username: string
  full_name: string
  role: UserRole
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  code: string
  name: string
  address?: string
  contact?: string
  created_at: string
}

// ─── Products ────────────────────────────────────────────────────────────────

export type ProductType = 'blow' | 'print' | 'blow_print'

export interface Product {
  id: string
  item_code: string
  part_name: string
  type: ProductType
  width?: number
  thickness?: number
  unit: string
  created_at: string
}

// ─── Sale Orders ─────────────────────────────────────────────────────────────

export type SaleOrderStatus =
  | 'draft'
  | 'approved'
  | 'in_planning'
  | 'in_production'
  | 'completed'
  | 'cancelled'

export interface SaleOrder {
  id: string
  so_no: string
  customer_id: string
  product_id: string
  po_no?: string
  ship_to?: string
  qty: number
  unit: string
  delivery_date?: string
  remark?: string
  status: SaleOrderStatus
  created_by?: string
  created_at: string
  item_code?: string
  mat_code?: string
  // spec fields
  grade?: 'A' | 'B' | 'PCR'
  job_type?: string
  weight_per_roll?: number
  core_type?: 'pvc' | 'paper'
  core_size_mil?: number
  length_per_roll?: number
  rolls_per_bundle?: number
  joints?: number
  joint_red_tape?: boolean
  joint_count?: boolean
  cover_sheet?: 'short' | 'long'
  pallet_type?: 'wood' | 'loscam' | 'plastic'
  pallet_qty?: number
  rolls_per_pallet?: number
  // stock fulfillment
  stock_qty?: number        // จำนวนที่นำมาจากสต็อกที่มีอยู่
  // joined
  customer?: Customer
  product?: Product
}

export type SaleOrderInsert = Omit<SaleOrder, 'id' | 'so_no' | 'created_at' | 'customer' | 'product'>

// ─── Planning Jobs ────────────────────────────────────────────────────────────

export type PlanningDept = 'extrusion' | 'printing' | 'grinding'
export type RouteAfter = 'to_printing' | 'to_warehouse' | 'to_grinding'
export type PlanningStatus = 'queued' | 'ongoing' | 'pending_receipt' | 'done'

export interface PlanningJob {
  id: string
  sale_order_id: string
  dept: PlanningDept
  machine_no?: string
  route_after?: RouteAfter
  status: PlanningStatus
  lot_no?: string
  planned_qty: number
  raw_material_qty?: number
  created_at: string
  sale_order?: SaleOrder
}

export type PlanningJobInsert = Omit<PlanningJob, 'id' | 'created_at' | 'sale_order'>

// ─── Production Logs ─────────────────────────────────────────────────────────

export interface ProductionLog {
  id: string
  planning_job_id: string
  dept: PlanningDept
  actual_qty?: number
  rolls_qty?: number
  good_rolls?: number
  good_qty?: number
  bad_rolls?: number
  bad_qty?: number
  waste_qty?: number
  started_at?: string
  finished_at?: string
  approved_by?: string
  created_at: string
  planning_job?: PlanningJob
}

// ─── Warehouse ────────────────────────────────────────────────────────────────

export type StockCondition = 'good' | 'hold' | 'rejected'

export interface WarehouseStock {
  id: string
  planning_job_id: string
  lot_no: string
  product_id: string
  qty: number
  unit: string
  location?: string
  condition: StockCondition
  received_at: string
  received_by?: string
  product?: Product
  planning_job?: PlanningJob
}

// ─── Requisitions ─────────────────────────────────────────────────────────────

export type RequisitionStatus = 'pending' | 'approved' | 'dispatched' | 'cancelled'

export interface RequisitionItem {
  stock_id: string
  qty: number
}

export interface Requisition {
  id: string
  sale_order_id: string
  items: RequisitionItem[]
  status: RequisitionStatus
  requested_by: string
  approved_by?: string
  created_at: string
  sale_order?: SaleOrder
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'

export interface Invoice {
  id: string
  sale_order_id: string
  requisition_id?: string
  amount: number
  tax: number
  total: number
  status: InvoiceStatus
  issued_at?: string
  paid_at?: string
  created_at: string
  sale_order?: SaleOrder
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
}
