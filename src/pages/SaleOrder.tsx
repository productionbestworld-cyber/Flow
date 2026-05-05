import React, { useState, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, CheckCircle, X, Package, Printer, Upload, Download } from 'lucide-react'
import { useSaleOrders, useCreateSaleOrder, useUpdateSaleOrder, useDeleteSaleOrder } from '../hooks/useSaleOrders'
import { useCustomers } from '../hooks/useCustomers'
import { useProducts } from '../hooks/useProducts'
import { useAddManualStock } from '../hooks/useWarehouse'
import { useAuth } from '../lib/AuthContext'
import { formatDate, formatNumber, cn } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import type { SaleOrder } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-slate-400 mb-1">{children}</span>
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white',
        'placeholder-slate-500 outline-none focus:border-brand-500 transition-colors',
        className
      )}
    />
  )
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white',
        'outline-none focus:border-brand-500 transition-colors',
        className
      )}
    >
      {children}
    </select>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3">
      <div className="h-px flex-1 bg-slate-700" />
      <span className="text-slate-400 text-xs font-medium uppercase tracking-wider px-2">{children}</span>
      <div className="h-px flex-1 bg-slate-700" />
    </div>
  )
}

function CheckBox({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
          checked ? 'bg-brand-600 border-brand-600' : 'border-slate-600 group-hover:border-slate-400'
        )}
      >
        {checked && <CheckCircle size={10} className="text-white" />}
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  )
}

function extractSize(width?: number, thickness?: number): string {
  if (width && thickness) return `${width}x${thickness}`
  return '-'
}

// ─── Remark color helpers ─────────────────────────────────────────────────────

const REMARK_COLORS = [
  { key: 'RED',    label: 'ด่วน',    bg: 'bg-red-500/20',    border: 'border-red-500/50',    text: 'text-red-300',    dot: 'bg-red-500'    },
  { key: 'ORANGE', label: 'ระวัง',   bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-300', dot: 'bg-orange-500' },
  { key: 'YELLOW', label: 'แจ้งเตือน', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  { key: 'GREEN',  label: 'ปกติ',    bg: 'bg-green-500/20',  border: 'border-green-500/50',  text: 'text-green-300',  dot: 'bg-green-500'  },
  { key: 'BLUE',   label: 'ข้อมูล',  bg: 'bg-blue-500/20',   border: 'border-blue-500/50',   text: 'text-blue-300',   dot: 'bg-blue-500'   },
  { key: 'PURPLE', label: 'พิเศษ',   bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-300', dot: 'bg-purple-500' },
] as const

type RemarkColorKey = typeof REMARK_COLORS[number]['key'] | ''

function parseRemark(raw: string | undefined | null): { color: RemarkColorKey; text: string } {
  if (!raw) return { color: '', text: '' }
  const match = raw.match(/^\[([A-Z]+)\](.*)$/s)
  if (match) {
    const key = match[1] as RemarkColorKey
    if (REMARK_COLORS.some(c => c.key === key)) return { color: key, text: match[2].trim() }
  }
  return { color: '', text: raw }
}

function encodeRemark(color: RemarkColorKey, text: string): string {
  if (!text.trim()) return ''
  return color ? `[${color}]${text}` : text
}

function RemarkBadge({ raw, className }: { raw?: string | null; className?: string }) {
  const { color, text } = parseRemark(raw)
  if (!text) return null
  const cfg = REMARK_COLORS.find(c => c.key === color)
  if (!cfg) return <span className={cn('text-xs text-slate-400', className)}>{text}</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border', cfg.bg, cfg.border, cfg.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      <span className="font-medium">{cfg.label}</span>
      <span className="opacity-80">{text}</span>
    </span>
  )
}

// ─── Default form values ──────────────────────────────────────────────────────

const DEFAULT_FORM = {
  so_no: '',
  customer_id: '',
  product_id: '',
  item_code: '',
  mat_code: '',
  po_no: '',
  ship_to: '',
  qty: '',
  unit: 'kg',
  delivery_date: '',
  remark: '',
  remarkColor: '' as RemarkColorKey,
  grade: '' as '' | 'A' | 'B' | 'PCR',
  job_type: '',
  width: '',
  thickness: '',
  weight_per_roll: '',
  core_type: '' as '' | 'pvc' | 'paper',
  core_size_mil: '',
  length_per_roll: '',
  rolls_per_bundle: '',
  joints: '',
  joint_red_tape: false,
  joint_count: false,
  cover_sheet: '' as '' | 'short' | 'long',
  on_pallet: false,
  pallet_type: '' as '' | 'wood' | 'loscam' | 'plastic',
  pallet_qty: '',
  rolls_per_pallet: '',
}

type FormState = typeof DEFAULT_FORM

function soToForm(o: SaleOrder): FormState {
  return {
    customer_id:      o.customer_id,
    product_id:       o.product_id,
    so_no:            o.so_no ?? '',
    item_code:        o.item_code ?? o.product?.item_code ?? '',
    mat_code:         o.mat_code ?? '',
    po_no:            o.po_no ?? '',
    ship_to:          o.ship_to ?? '',
    qty:              o.qty.toString(),
    unit:             o.unit,
    delivery_date:    o.delivery_date ?? '',
    remark:           parseRemark(o.remark).text,
    remarkColor:      parseRemark(o.remark).color,
    grade:            o.grade ?? '',
    job_type:         o.job_type ?? '',
    width:            o.product?.width?.toString() ?? '',
    thickness:        o.product?.thickness?.toString() ?? '',
    weight_per_roll:  o.weight_per_roll?.toString() ?? '',
    core_type:        o.core_type ?? '',
    core_size_mil:    o.core_size_mil?.toString() ?? '',
    length_per_roll:  o.length_per_roll?.toString() ?? '',
    rolls_per_bundle: o.rolls_per_bundle?.toString() ?? '',
    joints:           o.joints?.toString() ?? '',
    joint_red_tape:   o.joint_red_tape ?? false,
    joint_count:      o.joint_count ?? false,
    cover_sheet:      o.cover_sheet ?? '',
    on_pallet:        !!o.pallet_type,
    pallet_type:      o.pallet_type ?? '',
    pallet_qty:       o.pallet_qty?.toString() ?? '',
    rolls_per_pallet: o.rolls_per_pallet?.toString() ?? '',
  }
}

function formToPayload(f: FormState, userId?: string) {
  const num = (v: string) => v ? parseFloat(v) : undefined
  const base = {
    so_no:         f.so_no || undefined,
    customer_id:   f.customer_id,
    product_id:    f.product_id,
    po_no:         f.po_no || undefined,
    ship_to:       f.ship_to || undefined,
    qty:           parseFloat(f.qty),
    unit:          f.unit,
    delivery_date: f.delivery_date || undefined,
    remark:        encodeRemark(f.remarkColor, f.remark) || undefined,
    created_by:    userId,
  }
  // spec fields — ส่งเฉพาะตัวที่มีค่า เพื่อหลีกเลี่ยง 400 ถ้า column ยังไม่ได้สร้าง
  const spec: Record<string, unknown> = {}
  if (f.grade)            spec.grade            = f.grade
  if (f.job_type)         spec.job_type         = f.job_type
  if (num(f.weight_per_roll))  spec.weight_per_roll  = num(f.weight_per_roll)
  if (f.core_type)        spec.core_type        = f.core_type
  if (num(f.core_size_mil))    spec.core_size_mil    = num(f.core_size_mil)
  if (num(f.length_per_roll))  spec.length_per_roll  = num(f.length_per_roll)
  if (num(f.rolls_per_bundle)) spec.rolls_per_bundle = num(f.rolls_per_bundle)
  if (num(f.joints))           spec.joints           = num(f.joints)
  if (f.joint_red_tape)   spec.joint_red_tape   = f.joint_red_tape
  if (f.joint_count)      spec.joint_count      = f.joint_count
  if (f.cover_sheet)      spec.cover_sheet      = f.cover_sheet
  if (f.on_pallet && f.pallet_type)           spec.pallet_type      = f.pallet_type
  if (f.on_pallet && num(f.pallet_qty))       spec.pallet_qty       = num(f.pallet_qty)
  if (f.on_pallet && num(f.rolls_per_pallet)) spec.rolls_per_pallet = num(f.rolls_per_pallet)
  return { ...base, ...spec }
}

// ─── Searchable Select ────────────────────────────────────────────────────────

function SearchableSelect({
  value, onChange, options, placeholder = '-- ค้นหาหรือเลือก --', className,
}: {
  value: string
  onChange: (id: string) => void
  options: { id: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.id === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <input
        type="text"
        value={open ? query : (selected?.label ?? '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500 transition-colors cursor-text"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">ไม่พบสินค้า</div>
          ) : filtered.map(o => (
            <div
              key={o.id}
              onMouseDown={() => { onChange(o.id); setQuery(''); setOpen(false) }}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer transition-colors',
                o.id === value ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              )}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Print SO ─────────────────────────────────────────────────────────────────

// helper: field row สำหรับ print
function PF({ label, value, dash = true }: { label: string; value?: string | number | null; dash?: boolean }) {
  const display = value != null && value !== '' ? String(value) : (dash ? '—' : '')
  return (
    <div>
      <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: 3, minHeight: 20 }}>{display}</div>
    </div>
  )
}

function SHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
      {children}
      <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
    </div>
  )
}

function PrintSOModal({ so, onClose }: { so: SaleOrder; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)
  const productionQty = Math.max(0, so.qty - (so.stock_qty ?? 0))
  const unit = so.unit || 'kg'

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=794,height=1123')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>SO ${so.so_no}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Sarabun','Tahoma',sans-serif;font-size:12px;color:#111;background:#fff}
        .page{width:210mm;min-height:297mm;padding:12mm 14mm 10mm}
        @media print{@page{size:A4;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style>
    </head><body><div class="page">${content}</div></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  // shared inline styles
  const s = {
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' } as React.CSSProperties,
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' } as React.CSSProperties,
    label: { fontSize: 9, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2 },
    val:   { fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e5e7eb', paddingBottom: 3, minHeight: 20 },
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0 bg-slate-50 rounded-t-2xl">
          <span className="font-semibold text-slate-700">ตัวอย่าง SO {so.so_no}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              <Printer size={15} /> พิมพ์
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* preview — wrapper scales A4 content to fit modal */}
        <div className="overflow-y-auto flex-1 bg-slate-100" style={{ padding: '16px 0' }}>
          {/* scaler: A4 = 794px, modal inner ≈ 672px → scale 672/794 */}
          <div style={{ width: 794, transform: 'scale(0.847)', transformOrigin: 'top center', marginBottom: 'calc((794px * 0.847) - 794px)' }}>
          <div
            ref={printRef}
            className="bg-white shadow-lg mx-auto"
            style={{ width: 794, minHeight: '297mm', padding: '12mm 14mm 10mm', fontFamily: 'Sarabun, Tahoma, sans-serif', fontSize: 12, color: '#111' }}
          >
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>FlowPro</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>ระบบจัดการการผลิต</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>ใบสั่งขาย / SALE ORDER</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>{so.so_no}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>วันที่: {formatDate(so.created_at)}</div>
              </div>
            </div>

            {/* ── จำนวน (top summary) ── */}
            <div style={{ border: '1.5px solid #111', marginBottom: 14, textAlign: 'center' }}>
              <div style={{ padding: '10px 8px' }}>
                <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>ลูกค้าสั่ง</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(so.qty)}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>{unit}</div>
              </div>
            </div>

            {/* ── ข้อมูลพื้นฐาน ── */}
            <div style={{ ...s.grid2, marginBottom: 10 }}>
              <PF label="SO No."        value={so.so_no} />
              <PF label="ชื่อลูกค้า"    value={so.customer?.name} />
              <PF label="ชื่อสินค้า"    value={so.product?.part_name} />
              <PF label="Item Code"     value={so.item_code || so.product?.item_code} />
              <PF label="Mat Code"      value={so.mat_code} />
              <PF label="PO No."        value={so.po_no} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <PF label="ส่งที่" value={so.ship_to} />
            </div>

            {/* ── ขนาดผลิตภัณฑ์ ── */}
            <SHead>ขนาดผลิตภัณฑ์</SHead>
            <div style={{ ...s.grid3, marginBottom: 10 }}>
              <PF label="ประเภทงาน" value={so.job_type} />
              <PF label="เกรด"      value={so.grade ? `เกรด ${so.grade}` : null} />
              <PF label="Size (กว้าง × หนา)"
                value={so.product?.width && so.product?.thickness ? `${so.product.width} × ${so.product.thickness} มิล` : null} />
            </div>

            {/* ── น้ำหนัก & แกน ── */}
            <SHead>น้ำหนัก &amp; แกน</SHead>
            <div style={{ ...s.grid3, marginBottom: 10 }}>
              <PF label="น้ำหนักต่อม้วน (KG)" value={so.weight_per_roll} />
              <PF label="แกน"
                value={so.core_type ? (so.core_type === 'pvc' ? 'PVC' : 'แกนกระดาษ') : null} />
              <PF label="ขนาดแกน (มิล)" value={so.core_size_mil} />
            </div>

            {/* ── ความยาว & จำนวน ── */}
            <SHead>ความยาว &amp; จำนวน</SHead>
            <div style={{ ...s.grid3, marginBottom: 10 }}>
              <PF label="ความยาวต่อม้วน (เมตร)" value={so.length_per_roll} />
              <PF label="หน่วย"          value={so.unit} />
              <PF label="จำนวน ใบ/มัด"  value={so.rolls_per_bundle} />
            </div>

            {/* ── รอยต่อ ── */}
            <SHead>รอยต่อ</SHead>
            <div style={{ ...s.grid3, marginBottom: 10 }}>
              <PF label="จำนวนรอย" value={so.joints} />
              <PF label="ติดเทปแดง"     value={so.joint_red_tape ? 'ใช่' : 'ไม่'} />
              <PF label="ติดจำนวนรอยต่อ" value={so.joint_count   ? 'ใช่' : 'ไม่'} />
            </div>

            {/* ── ใบปะหน้า ── */}
            <SHead>ใบปะหน้า</SHead>
            <div style={{ ...s.grid2, marginBottom: 10 }}>
              <PF label="ใบปะหน้า"
                value={so.cover_sheet ? (so.cover_sheet === 'short' ? 'ใบปะหน้าสั้น' : 'ใบปะหน้ายาว') : null} />
            </div>

            {/* ── พาเลท ── */}
            <SHead>พาเลท</SHead>
            <div style={{ ...s.grid3, marginBottom: 10 }}>
              <PF label="ประเภทพาเลท"
                value={so.pallet_type === 'wood' ? 'พาเลทไม้' : so.pallet_type === 'loscam' ? 'LOSCAM' : so.pallet_type === 'plastic' ? 'พาเลทพลาสติก' : null} />
              <PF label="จำนวนพาเลท"  value={so.pallet_qty} />
              <PF label="ม้วน/พาเลท" value={so.rolls_per_pallet} />
            </div>

            {/* ── ข้อมูลจัดส่ง ── */}
            <SHead>ข้อมูลจัดส่ง</SHead>
            <div style={{ ...s.grid2, marginBottom: 10 }}>
              <PF label="กำหนดส่ง" value={formatDate(so.delivery_date)} />
            </div>

            {/* ── หมายเหตุ ── */}
            <SHead>หมายเหตุ</SHead>
            {(() => {
              const { color, text } = parseRemark(so.remark)
              const colorMap: Record<string, { bg: string; border: string; label: string; dot: string }> = {
                RED:    { bg: '#fef2f2', border: '#fca5a5', label: 'ด่วน',     dot: '#ef4444' },
                ORANGE: { bg: '#fff7ed', border: '#fdba74', label: 'ระวัง',    dot: '#f97316' },
                YELLOW: { bg: '#fefce8', border: '#fde047', label: 'แจ้งเตือน', dot: '#eab308' },
                GREEN:  { bg: '#f0fdf4', border: '#86efac', label: 'ปกติ',     dot: '#22c55e' },
                BLUE:   { bg: '#eff6ff', border: '#93c5fd', label: 'ข้อมูล',   dot: '#3b82f6' },
                PURPLE: { bg: '#faf5ff', border: '#d8b4fe', label: 'พิเศษ',    dot: '#a855f7' },
              }
              const cfg = color ? colorMap[color] : null
              return (
                <div style={{
                  border: `1px solid ${cfg?.border ?? '#e5e7eb'}`,
                  background: cfg?.bg ?? '#fff',
                  borderRadius: 4, padding: '8px 10px', minHeight: 48, fontSize: 12, marginBottom: 16
                }}>
                  {cfg && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700, marginBottom: 4, marginRight: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                      {cfg.label}
                    </span>
                  )}
                  {text}
                </div>
              )
            })()}

            {/* ── ลายเซ็น ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 28 }}>
              {['ผู้สั่งซื้อ', 'ผู้อนุมัติ', 'ฝ่ายผลิต'].map(label => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ height: 40 }} />
                  <div style={{ borderTop: '1px solid #aaa', paddingTop: 4, fontSize: 10, color: '#777' }}>{label}</div>
                </div>
              ))}
            </div>

          </div>
          </div>{/* end scaler */}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SaleOrder() {
  const { user } = useAuth()
  const { data: orders, isLoading } = useSaleOrders()
  const { data: customers } = useCustomers()
  const { data: products }  = useProducts()
  const createOrder    = useCreateSaleOrder()
  const updateOrder    = useUpdateSaleOrder()
  const deleteOrder    = useDeleteSaleOrder()
  const addStock       = useAddManualStock()

  const [search, setSearch]   = useState('')
  const [showModal, setShow]  = useState(false)
  const [editing, setEditing] = useState<SaleOrder | null>(null)
  const [form, setForm]       = useState<FormState>({ ...DEFAULT_FORM })
  const [saving, setSaving]   = useState(false)

  const [error, setError]     = useState('')
  const [printingSO, setPrintingSO] = useState<SaleOrder | null>(null)
  const [csvRows, setCsvRows]       = useState<Record<string,string>[]>([])
  const [showCsvModal, setShowCsv]  = useState(false)
  const [importingCsv, setImporting] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // CSV template fields
  // Thai ↔ English header mapping
  const CSV_FIELD_MAP: [string, string][] = [
    ['เลขที่ SO',              'so_no'],
    ['รหัสลูกค้า',             'customer_code'],
    ['รหัสสินค้า (Item Code)', 'product_item_code'],
    ['จำนวนลูกค้าสั่ง',       'qty'],
    ['หน่วย',                  'unit'],
    ['สต็อกที่มีอยู่',         'stock_qty'],
    ['กำหนดส่ง (YYYY-MM-DD)',  'delivery_date'],
    ['PO No.',                  'po_no'],
    ['ส่งที่',                  'ship_to'],
    ['ประเภทงาน',              'job_type'],
    ['เกรด (A/B)',             'grade'],
    ['น้ำหนักต่อม้วน (kg)',    'weight_per_roll'],
    ['แกน (pvc/paper)',        'core_type'],
    ['ขนาดแกน (มิล)',          'core_size_mil'],
    ['ความยาวต่อม้วน (เมตร)',  'length_per_roll'],
    ['จำนวน ใบ/มัด',          'rolls_per_bundle'],
    ['รอยต่อ',                 'joints'],
    ['ใบปะหน้า (short/long)',  'cover_sheet'],
    ['พาเลท (wood/loscam/plastic)', 'pallet_type'],
    ['จำนวนพาเลท',            'pallet_qty'],
    ['ม้วน/พาเลท',            'rolls_per_pallet'],
    ['หมายเหตุ',               'remark'],
  ]
  const thaiToField = Object.fromEntries(CSV_FIELD_MAP.map(([th, en]) => [th, en]))

  function downloadTemplate() {
    const header  = CSV_FIELD_MAP.map(([th]) => th).join(',')
    const example = [
      'SO-001','CUST001','ITEM001','5000','kg','2000',
      '2025-12-31','PO-001','ที่อยู่ลูกค้า','Shrink Film','A',
      '100','pvc','3','1500',
      '5','2','short','wood','2','50','หมายเหตุ'
    ].join(',')
    const blob = new Blob(['﻿' + header + '\n' + example], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'so_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      // รองรับทั้ง header ภาษาไทยและ English
      const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^﻿/, ''))
      const headers = rawHeaders.map(h => thaiToField[h] ?? h)
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',')
        const row: Record<string,string> = {}
        headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
        return row
      }).filter(r => r.so_no || r.qty)
      setCsvRows(rows); setShowCsv(true)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function handleImportCsv() {
    setImporting(true)
    let ok = 0, fail = 0
    for (const row of csvRows) {
      try {
        const cust = customers?.find(c => c.code === row.customer_code)
        const prod = products?.find(p => p.item_code === row.product_item_code)
        if (!cust || !prod) { fail++; continue }
        await createOrder.mutateAsync({
          so_no:            row.so_no || undefined,
          customer_id:      cust.id,
          product_id:       prod.id,
          item_code:        prod.item_code,
          qty:              parseFloat(row.qty) || 0,
          unit:             row.unit || 'kg',
          stock_qty:        row.stock_qty ? parseFloat(row.stock_qty) : undefined,
          delivery_date:    row.delivery_date || undefined,
          po_no:            row.po_no || undefined,
          ship_to:          row.ship_to || undefined,
          job_type:         row.job_type || undefined,
          grade:            (row.grade as 'A'|'B') || undefined,
          weight_per_roll:  row.weight_per_roll ? parseFloat(row.weight_per_roll) : undefined,
          core_type:        (row.core_type as 'pvc'|'paper') || undefined,
          core_size_mil:    row.core_size_mil ? parseFloat(row.core_size_mil) : undefined,
          length_per_roll:  row.length_per_roll ? parseFloat(row.length_per_roll) : undefined,
          rolls_per_bundle: row.rolls_per_bundle ? parseFloat(row.rolls_per_bundle) : undefined,
          joints:           row.joints ? parseFloat(row.joints) : undefined,
          cover_sheet:      (row.cover_sheet as 'short'|'long') || undefined,
          pallet_type:      (row.pallet_type as 'wood'|'loscam'|'plastic') || undefined,
          pallet_qty:       row.pallet_qty ? parseFloat(row.pallet_qty) : undefined,
          rolls_per_pallet: row.rolls_per_pallet ? parseFloat(row.rolls_per_pallet) : undefined,
          remark:           row.remark || undefined,
          status:           'draft',
        })
        ok++
      } catch { fail++ }
    }
    setImporting(false); setShowCsv(false); setCsvRows([])
    alert(`นำเข้าสำเร็จ ${ok} รายการ${fail > 0 ? ` · ล้มเหลว ${fail} รายการ (ตรวจสอบ customer_code/product_item_code)` : ''}`)
  }

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }))

  const filtered = orders?.filter(o =>
    o.so_no.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.product?.part_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  function openCreate() {
    setEditing(null); setForm({ ...DEFAULT_FORM }); setError(''); setShow(true)
  }
  function openEdit(o: SaleOrder) {
    setEditing(o); setForm(soToForm(o)); setError(''); setShow(true)
  }
  function close() { setShow(false); setEditing(null) }

  async function handleSave() {
    if (!form.so_no) { setError('กรุณาใส่ SO No.'); return }
    if (!form.customer_id) { setError('กรุณาเลือกลูกค้า'); return }
    if (!form.product_id)  { setError('กรุณาเลือกสินค้า'); return }
    if (!form.qty || isNaN(parseFloat(form.qty))) { setError('กรุณาระบุจำนวน'); return }
    if (!form.job_type) { setError('กรุณาเลือกประเภทงาน'); return }
    setSaving(true); setError('')
    const payload = formToPayload(form, user?.id)
    if (editing) await updateOrder.mutateAsync({ id: editing.id, ...payload })
    else await createOrder.mutateAsync({ ...payload, status: 'draft' })
    setSaving(false); close()
  }

  async function handleApprove(o: SaleOrder) {
    if (!confirm(`Approve ${o.so_no}?`)) return
    await updateOrder.mutateAsync({ id: o.id, status: 'approved' })
    // ถ้า SO มีสต็อกเดิม → สร้าง lot เข้าคลังทันที
    if ((o.stock_qty ?? 0) > 0 && o.product_id) {
      const today = new Date()
      const lotNo = `STK-${o.so_no}-${today.getFullYear().toString().slice(2)}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
      await addStock.mutateAsync({
        lot_no: lotNo,
        product_id: o.product_id,
        qty: o.stock_qty!,
        unit: o.unit,
        received_by: user?.id,
      })
    }
  }

  async function handleDelete(o: SaleOrder) {
    if (!confirm(`ลบ ${o.so_no}?`)) return
    await deleteOrder.mutateAsync(o.id)
  }



  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Sale Order</h1>
          <p className="text-slate-400 text-sm mt-0.5">จัดการใบสั่งขาย</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors" title="ดาวน์โหลด CSV Template">
            <Download size={15} /> Template
          </button>
          <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <Upload size={15} /> Import CSV
          </button>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          <button onClick={openCreate} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> สร้าง SO
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา SO, ลูกค้า, สินค้า..." className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500" />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">SO No.</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">ลูกค้า</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">สินค้า</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Size</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">ประเภท</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">จำนวน</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">กำหนดส่ง</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">หมายเหตุ</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">สถานะ</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              <tr><td colSpan={9} className="p-4"><TableSkeleton rows={5} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-slate-500">ไม่มีข้อมูล</td></tr>
            ) : filtered.map(o => (
              <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{o.so_no}</td>
                <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate">{o.customer?.name ?? '-'}</td>
                <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">{o.product?.part_name ?? '-'}</td>
                <td className="px-4 py-3 text-slate-400">{o.product ? extractSize(o.product.width, o.product.thickness) : '-'}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {o.job_type && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{o.job_type}</span>}
                  {o.grade && <span className="text-xs bg-brand-600/20 text-brand-300 px-2 py-0.5 rounded ml-1">เกรด {o.grade}</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-slate-300">{formatNumber(o.qty)} {o.unit}</span>
                  {(o.stock_qty ?? 0) > 0 && (
                    <div className="text-[10px] text-green-400 mt-0.5">
                      สต็อก {formatNumber(o.stock_qty!)} · ผลิต {formatNumber(Math.max(0, o.qty - o.stock_qty!))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{formatDate(o.delivery_date)}</td>
                <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                  {o.remark && <RemarkBadge raw={o.remark} />}
                </td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setPrintingSO(o)} title="พิมพ์ SO" className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"><Printer size={15} /></button>
                    {o.status === 'draft' && (
                      <button onClick={() => handleApprove(o)} title="Approve" className="p-1.5 text-green-400 hover:bg-green-400/10 rounded transition-colors"><CheckCircle size={15} /></button>
                    )}
                    {!['completed','cancelled'].includes(o.status) && (
                      <button onClick={() => openEdit(o)} title="แก้ไข" className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Edit2 size={15} /></button>
                    )}
                    {o.status !== 'completed' && (
                      <button onClick={() => handleDelete(o)} title="ลบ" className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <h2 className="text-white font-semibold text-base">
                {editing ? `แก้ไข ${editing.so_no}` : 'สร้าง Sale Order'}
              </h2>
              <button onClick={close} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto scrollbar-thin flex-1 px-6 py-4 space-y-1">

              {/* ── จำนวนลูกค้าสั่ง ─────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>จำนวนลูกค้าสั่ง *</Label>
                  <Input
                    type="number"
                    value={form.qty}
                    onChange={e => set('qty', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>หน่วย</Label>
                  <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
                    <option value="kg">kg.</option>
                    <option value="meter">เมตร</option>
                    <option value="roll">ม้วน</option>
                    <option value="sheet">แผ่น</option>
                    <option value="piece">ชิ้น</option>
                    <option value="ใบ">ใบ</option>
                  </Select>
                </div>
              </div>

              {/* ── ข้อมูลพื้นฐาน ────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SO No.</Label>
                  <Input value={form.so_no} onChange={e => set('so_no', e.target.value)} placeholder="SO-00001" />
                </div>
                <div>
                  <Label>ชื่อลูกค้า *</Label>
                  <SearchableSelect
                    value={form.customer_id}
                    placeholder="-- ค้นหาหรือเลือกลูกค้า --"
                    options={customers?.map(c => ({ id: c.id, label: `${c.code} — ${c.name}` })) ?? []}
                    onChange={id => set('customer_id', id)}
                  />
                </div>
                <div>
                  <Label>ชื่อสินค้า *</Label>
                  <SearchableSelect
                    value={form.product_id}
                    placeholder="-- ค้นหาหรือเลือกสินค้า --"
                    options={products?.map(p => ({ id: p.id, label: p.part_name })) ?? []}
                    onChange={id => {
                      const p = products?.find(x => x.id === id)
                      set('product_id', id)
                      if (p?.item_code) set('item_code', p.item_code)
                      if (p?.width != null) set('width', p.width.toString())
                      else set('width', '')
                      if (p?.thickness != null) set('thickness', p.thickness.toString())
                      else set('thickness', '')
                    }}
                  />
                </div>
                <div>
                  <Label>Item Code</Label>
                  <Input
                    value={form.item_code}
                    onChange={e => set('item_code', e.target.value)}
                    placeholder="Item Code"
                  />
                </div>
                <div>
                  <Label>Mat Code</Label>
                  <Input value={form.mat_code} onChange={e => set('mat_code', e.target.value)} placeholder="Mat Code" />
                </div>
                <div>
                  <Label>PO No.</Label>
                  <Input value={form.po_no} onChange={e => set('po_no', e.target.value)} placeholder="PO-001" />
                </div>
                <div className="col-span-2">
                  <Label>ส่งที่</Label>
                  <Input value={form.ship_to} onChange={e => set('ship_to', e.target.value)} placeholder="ที่อยู่จัดส่ง" />
                </div>
              </div>

              {/* ── ขนาดผลิตภัณฑ์ ───────────────────────────────────────── */}
              <SectionTitle>ขนาดผลิตภัณฑ์</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>ประเภทงาน <span className="text-red-400">*</span></Label>
                  <Select value={form.job_type} onChange={e => set('job_type', e.target.value)} className={!form.job_type ? 'border-red-500/60' : ''}>
                    <option value="">-- เลือกประเภทงาน --</option>
                    <option value="Shrink Film">Shrink Film</option>
                    <option value="Stretch Film">Stretch Film</option>
                    <option value="ถุงคลุม">ถุงคลุม</option>
                    <option value="แผ่นชีส">แผ่นชีส</option>
                    <option value="ฟิล์มพิมพ์">ฟิล์มพิมพ์</option>
                    <option value="ถุงหลอด">ถุงหลอด</option>
                  </Select>
                </div>
                <div>
                  <Label>เกรด</Label>
                  <div className="flex gap-3 pt-1 flex-wrap">
                    {(['A','B','PCR'] as const).map(g => (
                      <CheckBox key={g} checked={form.grade === g} onChange={v => set('grade', v ? g : '')} label={`เกรด ${g}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Size (กว้าง x หนา)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" value={form.width} onChange={e => set('width', e.target.value)} placeholder="กว้าง" />
                    <Input type="number" value={form.thickness} onChange={e => set('thickness', e.target.value)} placeholder="หนา" />
                  </div>
                </div>
              </div>

              {/* ── น้ำหนัก & แกน ───────────────────────────────────────── */}
              <SectionTitle>น้ำหนัก & แกน</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>น้ำหนักต่อม้วน (KG)</Label>
                  <Input type="number" value={form.weight_per_roll} onChange={e => set('weight_per_roll', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>แกน</Label>
                  <div className="flex flex-col gap-2 pt-1">
                    <CheckBox checked={form.core_type === 'pvc'} onChange={v => set('core_type', v ? 'pvc' : '')} label="PVC" />
                    <CheckBox checked={form.core_type === 'paper'} onChange={v => set('core_type', v ? 'paper' : '')} label="แกนกระดาษ" />
                  </div>
                </div>
                <div>
                  <Label>ขนาดแกน (มิล)</Label>
                  <Input type="number" value={form.core_size_mil} onChange={e => set('core_size_mil', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* ── ความยาว & จำนวน ─────────────────────────────────────── */}
              <SectionTitle>ความยาว & จำนวน</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ความยาวต่อม้วน (เมตร)</Label>
                  <Input type="number" value={form.length_per_roll} onChange={e => set('length_per_roll', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>จำนวน ใบ/มัด</Label>
                  <Input type="number" value={form.rolls_per_bundle} onChange={e => set('rolls_per_bundle', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* ── รอยต่อ ───────────────────────────────────────────────── */}
              <SectionTitle>รอยต่อ</SectionTitle>
              <div className="grid grid-cols-3 gap-3 items-start">
                <div>
                  <Label>จำนวนรอย</Label>
                  <Input type="number" value={form.joints} onChange={e => set('joints', e.target.value)} placeholder="0" />
                </div>
                <div className="col-span-2 pt-5 flex gap-4">
                  <CheckBox checked={form.joint_red_tape} onChange={v => set('joint_red_tape', v)} label="ติดเทปแดง" />
                  <CheckBox checked={form.joint_count} onChange={v => set('joint_count', v)} label="ติดจำนวนรอยต่อ" />
                </div>
              </div>

              {/* ── ใบปะหน้า ─────────────────────────────────────────────── */}
              <SectionTitle>ใบปะหน้า</SectionTitle>
              <div className="flex gap-6">
                <CheckBox checked={form.cover_sheet === 'short'} onChange={v => set('cover_sheet', v ? 'short' : '')} label="ใบปะหน้าสั้น" />
                <CheckBox checked={form.cover_sheet === 'long'}  onChange={v => set('cover_sheet', v ? 'long'  : '')} label="ใบปะหน้ายาว" />
              </div>

              {/* ── พาเลท ────────────────────────────────────────────────── */}
              <SectionTitle>พาเลท</SectionTitle>
              {/* Toggle ออนพาเลท / ไม่ออนพาเลท */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { set('on_pallet', false); set('pallet_type', ''); set('pallet_qty', ''); set('rolls_per_pallet', '') }}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    !form.on_pallet
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                  )}
                >
                  ไม่ออนพาเลท
                </button>
                <button
                  type="button"
                  onClick={() => set('on_pallet', true)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    form.on_pallet
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                  )}
                >
                  ออนพาเลท
                </button>
              </div>

              {/* ลักษณะพาเลท — แสดงเฉพาะเมื่อออนพาเลท */}
              {form.on_pallet && (
                <div className="space-y-3 bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <div>
                    <Label>ลักษณะพาเลท</Label>
                    <div className="flex gap-4 pt-1 flex-wrap">
                      <CheckBox checked={form.pallet_type === 'wood'}    onChange={v => set('pallet_type', v ? 'wood'    : '')} label="พาเลทไม้" />
                      <CheckBox checked={form.pallet_type === 'loscam'}  onChange={v => set('pallet_type', v ? 'loscam'  : '')} label="LOSCAM" />
                      <CheckBox checked={form.pallet_type === 'plastic'} onChange={v => set('pallet_type', v ? 'plastic' : '')} label="พาเลทพลาสติก" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>จำนวนพาเลท</Label>
                      <Input type="number" value={form.pallet_qty} onChange={e => set('pallet_qty', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>ม้วน/พาเลท</Label>
                      <Input type="number" value={form.rolls_per_pallet} onChange={e => set('rolls_per_pallet', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── ข้อมูลจัดส่ง ─────────────────────────────────────────── */}
              <SectionTitle>ข้อมูลจัดส่ง</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>กำหนดส่ง</Label>
                  <Input type="date" value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Label>หมายเหตุ</Label>
                {/* color picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => set('remarkColor', '')}
                    className={cn('px-2.5 py-1 rounded-full text-xs border transition-colors',
                      form.remarkColor === '' ? 'bg-slate-600 border-slate-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white')}
                  >ไม่มีสี</button>
                  {REMARK_COLORS.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => set('remarkColor', c.key)}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors',
                        form.remarkColor === c.key ? `${c.bg} ${c.border} ${c.text}` : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white')}
                    >
                      <span className={cn('w-2 h-2 rounded-full', c.dot)} />
                      {c.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={form.remark}
                  onChange={e => set('remark', e.target.value)}
                  rows={3}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className={cn(
                    'w-full border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none resize-none transition-colors',
                    form.remarkColor
                      ? (() => { const c = REMARK_COLORS.find(x => x.key === form.remarkColor)!; return `${c.bg} ${c.border} focus:${c.border}` })()
                      : 'bg-slate-800 border-slate-700 focus:border-brand-500'
                  )}
                />
                {/* preview */}
                {form.remark && form.remarkColor && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">ตัวอย่าง:</span>
                    <RemarkBadge raw={encodeRemark(form.remarkColor, form.remark)} />
                  </div>
                )}
              </div>

              {error && <p className="text-red-400 text-sm pt-1">{error}</p>}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
              <button onClick={close} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm transition-colors">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'กำลังบันทึก...' : editing ? 'บันทึก' : 'สร้าง SO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Print Modal ────────────────────────────────────────────── */}
      {printingSO && <PrintSOModal so={printingSO} onClose={() => setPrintingSO(null)} />}

      {/* ─── CSV Import Modal ────────────────────────────────────────── */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-white font-semibold">ตรวจสอบข้อมูล CSV</h2>
                <p className="text-slate-400 text-xs mt-0.5">{csvRows.length} รายการ — ตรวจสอบก่อนนำเข้า</p>
              </div>
              <button onClick={() => { setShowCsv(false); setCsvRows([]) }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800">
                    {['so_no','customer_code','product_item_code','qty','unit','stock_qty','delivery_date','po_no','job_type','grade','remark'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium border border-slate-700 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-3 py-2 text-slate-400 font-medium border border-slate-700">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, i) => {
                    const cust = customers?.find(c => c.code === row.customer_code)
                    const prod = products?.find(p => p.item_code === row.product_item_code)
                    const valid = !!cust && !!prod && parseFloat(row.qty) > 0
                    return (
                      <tr key={i} className={valid ? 'hover:bg-slate-800/30' : 'bg-red-500/5'}>
                        {['so_no','customer_code','product_item_code','qty','unit','stock_qty','delivery_date','po_no','job_type','grade','remark'].map(h => (
                          <td key={h} className="px-3 py-2 border border-slate-800 text-slate-300">{row[h] || '-'}</td>
                        ))}
                        <td className="px-3 py-2 border border-slate-800">
                          {valid
                            ? <span className="text-green-400">✓ พร้อมนำเข้า</span>
                            : <span className="text-red-400">✗ {!cust ? 'ไม่พบลูกค้า' : !prod ? 'ไม่พบสินค้า' : 'qty ผิด'}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
              <div className="flex-1 text-xs text-slate-500 self-center">
                พร้อมนำเข้า: {csvRows.filter(r => customers?.find(c=>c.code===r.customer_code) && products?.find(p=>p.item_code===r.product_item_code) && parseFloat(r.qty)>0).length} / {csvRows.length} รายการ
              </div>
              <button onClick={() => { setShowCsv(false); setCsvRows([]) }} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm">ยกเลิก</button>
              <button onClick={handleImportCsv} disabled={importingCsv} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2">
                <Upload size={15} /> {importingCsv ? 'กำลังนำเข้า...' : 'นำเข้า'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
