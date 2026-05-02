import { cn } from '../../lib/utils'
import type { SaleOrderStatus, PlanningStatus, RequisitionStatus, InvoiceStatus } from '../../types'

type AnyStatus = SaleOrderStatus | PlanningStatus | RequisitionStatus | InvoiceStatus

const config: Record<string, { label: string; className: string }> = {
  // Sale Order
  draft:         { label: 'แบบร่าง',       className: 'bg-slate-500/20 text-slate-300' },
  approved:      { label: 'อนุมัติแล้ว',   className: 'bg-blue-500/20 text-blue-300' },
  in_planning:   { label: 'กำลังวางแผน',  className: 'bg-yellow-500/20 text-yellow-300' },
  in_production: { label: 'กำลังผลิต',     className: 'bg-orange-500/20 text-orange-300' },
  completed:     { label: 'เสร็จสิ้น',     className: 'bg-green-500/20 text-green-300' },
  cancelled:     { label: 'ยกเลิก',         className: 'bg-red-500/20 text-red-300' },
  // Planning
  queued:           { label: 'รอคิว',          className: 'bg-slate-500/20 text-slate-300' },
  ongoing:          { label: 'กำลังผลิต',      className: 'bg-orange-500/20 text-orange-300' },
  pending_receipt:  { label: 'รอรับเข้าคลัง', className: 'bg-yellow-500/20 text-yellow-300' },
  done:             { label: 'เสร็จ',           className: 'bg-green-500/20 text-green-300' },
  // Requisition
  pending:    { label: 'รอดำเนินการ', className: 'bg-yellow-500/20 text-yellow-300' },
  dispatched: { label: 'จัดส่งแล้ว',  className: 'bg-green-500/20 text-green-300' },
  // Invoice
  issued: { label: 'ออกใบแจ้งหนี้', className: 'bg-blue-500/20 text-blue-300' },
  paid:   { label: 'ชำระแล้ว',       className: 'bg-green-500/20 text-green-300' },
}

interface Props {
  status: AnyStatus
}

export default function StatusBadge({ status }: Props) {
  const { label, className } = config[status] ?? { label: status, className: 'bg-slate-500/20 text-slate-300' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {label}
    </span>
  )
}
