import { formatNumber, formatDate } from '../../lib/utils'
import type { SaleOrder } from '../../types'
import SOProductionSummary from './SOProductionSummary'

const COVER_LABEL = { short: 'ใบปะหน้าสั้น', long: 'ใบปะหน้ายาว' }
const PALLET_LABEL = { wood: 'พาเลทไม้', loscam: 'LOSCAM', plastic: 'พาเลทพลาสติก' }
const CORE_LABEL = { pvc: 'PVC', paper: 'กระดาษ' }

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-slate-500 text-xs shrink-0">{label}</span>
      <span className="text-slate-200 text-xs text-right">{value}</span>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">
      {children}
    </span>
  )
}

interface Props {
  so: SaleOrder
  compact?: boolean
  showSummary?: boolean
}

export default function SODetail({ so, compact = false, showSummary = false }: Props) {
  const isPrint = so.product?.type === 'print' || so.product?.type === 'blow_print' || so.job_type === 'ฟิล์มพิมพ์'
  const hasSpecs = so.weight_per_roll || so.length_per_roll || so.core_type || so.core_size_mil
  const hasJoint = so.joints || so.joint_red_tape || so.joint_count
  const hasPallet = so.pallet_type || so.pallet_qty || so.rolls_per_pallet

  return (
    <div className="space-y-3">
      {/* ── หัวข้อหลัก ──────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white font-bold text-base">{so.so_no}</p>
          <p className="text-slate-300 text-sm mt-0.5">{so.customer?.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-semibold">{formatNumber(so.qty)} {so.unit}</p>
          {so.delivery_date && (
            <p className="text-slate-400 text-xs mt-0.5">ส่ง {formatDate(so.delivery_date)}</p>
          )}
        </div>
      </div>

      {/* ── สินค้า ──────────────────────────────── */}
      <div className="bg-slate-800/60 rounded-lg p-3 space-y-0.5">
        <p className="text-white text-sm font-medium">{so.product?.part_name}</p>
        {so.mat_code && <p className="text-brand-400 text-xs font-mono">{so.mat_code}</p>}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {so.grade       && <Tag>เกรด {so.grade}</Tag>}
          {so.job_type    && <Tag>{so.job_type}</Tag>}
          {so.po_no       && <Tag>PO: {so.po_no}</Tag>}
          {so.ship_to     && <Tag>ส่ง: {so.ship_to}</Tag>}
        </div>
      </div>

      {!compact && (
        <>
          {/* ── สเปค ───────────────────────────────── */}
          {hasSpecs && (
            <div className="bg-slate-800/40 rounded-lg p-3 space-y-0.5">
              <p className="text-slate-400 text-xs font-medium mb-1.5">สเปคการผลิต</p>
              <Row label="น้ำหนักต่อม้วน"   value={so.weight_per_roll  ? `${so.weight_per_roll} KG`  : null} />
              <Row label="ความยาวต่อม้วน"  value={so.length_per_roll  ? `${so.length_per_roll} ม.`  : null} />
              <Row label="จำนวน ใบ/มัด"    value={so.rolls_per_bundle ? `${so.rolls_per_bundle} ใบ` : null} />
              <Row label="แกน"             value={so.core_type ? `${CORE_LABEL[so.core_type]}${so.core_size_mil ? ` ${so.core_size_mil} มิล` : ''}` : null} />
            </div>
          )}

          {/* ── รอยต่อ ──────────────────────────────── */}
          {hasJoint && (
            <div className="bg-slate-800/40 rounded-lg p-3 space-y-0.5">
              <p className="text-slate-400 text-xs font-medium mb-1.5">รอยต่อ</p>
              <Row label="จำนวนรอย" value={so.joints ? `${so.joints} รอย` : null} />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {so.joint_red_tape && <Tag>ติดเทปแดง</Tag>}
                {so.joint_count    && <Tag>ติดจำนวนรอยต่อ</Tag>}
              </div>
            </div>
          )}

          {/* ── ใบปะหน้า + พาเลท ───────────────────── */}
          {(so.cover_sheet || hasPallet) && (
            <div className="bg-slate-800/40 rounded-lg p-3 space-y-0.5">
              <p className="text-slate-400 text-xs font-medium mb-1.5">บรรจุภัณฑ์</p>
              {so.cover_sheet && (
                <Row label="ใบปะหน้า" value={COVER_LABEL[so.cover_sheet]} />
              )}
              {so.pallet_type && (
                <Row label="พาเลท" value={`${PALLET_LABEL[so.pallet_type]}${so.pallet_qty ? ` × ${so.pallet_qty}` : ''}${so.rolls_per_pallet ? ` (${so.rolls_per_pallet} ม้วน/พาเลท)` : ''}`} />
              )}
            </div>
          )}

          {/* ── หมายเหตุ ────────────────────────────── */}
          {so.remark && (
            <div className="bg-slate-800/40 rounded-lg px-3 py-2">
              <p className="text-slate-400 text-xs font-medium mb-0.5">หมายเหตุ</p>
              <p className="text-slate-300 text-xs">{so.remark}</p>
            </div>
          )}
        </>
      )}

      {/* ── สรุปการผลิต ─────────────────────────── */}
      {showSummary && <SOProductionSummary soId={so.id} isPrint={isPrint} />}
    </div>
  )
}
