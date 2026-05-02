import { useMemo, useState } from 'react'
import {
  ShoppingCart, ClipboardList, Wind, Package, Truck, Search,
  CheckCircle2, Cog, Printer, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useSaleOrders } from '../hooks/useSaleOrders'
import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import { useWarehouseStock } from '../hooks/useWarehouse'
import { useRequisitions } from '../hooks/useSales'
import { formatNumber, cn } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'

// ─── Event ────────────────────────────────────────────────────────────────────

type EventType = 'so_created' | 'so_approved' | 'job_planned' | 'production_done' | 'stock_received' | 'req_created' | 'req_dispatched'

interface SOEvent {
  id: string
  type: EventType
  timestamp: string
  label: string
  detail?: string
  dept?: string
  qty?: number
  unit?: string
}

const EVENT_CFG: Record<EventType, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  so_created:      { color: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   icon: <ShoppingCart size={11} /> },
  so_approved:     { color: 'text-sky-300',    bg: 'bg-sky-500/15',    border: 'border-sky-500/30',    icon: <CheckCircle2 size={11} /> },
  job_planned:     { color: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: <ClipboardList size={11} /> },
  production_done: { color: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-500/30',  icon: <Wind size={11} /> },
  stock_received:  { color: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', icon: <Package size={11} /> },
  req_created:     { color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30', icon: <Truck size={11} /> },
  req_dispatched:  { color: 'text-pink-300',   bg: 'bg-pink-500/15',   border: 'border-pink-500/30',   icon: <Truck size={11} /> },
}

function deptLabel(dept?: string) {
  if (dept === 'printing') return <span className="flex items-center gap-0.5 text-purple-300 text-[10px]"><Printer size={9} /> Printing</span>
  if (dept === 'grinding') return <span className="flex items-center gap-0.5 text-orange-300 text-[10px]"><Cog size={9} /> Grinding</span>
  if (dept === 'extrusion') return <span className="flex items-center gap-0.5 text-brand-300 text-[10px]"><Wind size={9} /> Extrusion</span>
  return null
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ActivityLog() {
  const { data: orders } = useSaleOrders()
  const { data: jobs }   = usePlanningJobs()
  const { data: logs }   = useProductionLogs()
  const { data: stock }  = useWarehouseStock()
  const { data: reqs }   = useRequisitions()

  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(soId: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(soId) ? n.delete(soId) : n.add(soId); return n })
  }

  // Build per-SO event list
  type SOSummary = {
    so_id: string
    so_no: string
    customer: string
    product: string
    status: any
    qty: number
    unit: string
    lastActivity: string
    events: SOEvent[]
  }

  const soMap = useMemo<SOSummary[]>(() => {
    if (!orders) return []

    return orders.map(o => {
      const events: SOEvent[] = []

      // 1. SO created
      events.push({ id: `so-${o.id}`, type: 'so_created', timestamp: o.created_at, label: 'สร้าง SO', detail: `${formatNumber(o.qty)} ${o.unit}`, qty: o.qty, unit: o.unit })

      // 2. Planning jobs
      const soJobs = jobs?.filter(j => j.sale_order_id === o.id) ?? []
      soJobs.forEach(j => {
        events.push({
          id: `job-${j.id}`, type: 'job_planned', timestamp: j.created_at, dept: j.dept,
          label: `วางแผน ${j.dept === 'printing' ? 'Printing' : j.dept === 'grinding' ? 'Grinding' : 'Extrusion'}`,
          detail: `${j.lot_no} · ${formatNumber(j.planned_qty)} kg${j.machine_no ? ` · ${j.machine_no}` : ''}`,
          qty: j.planned_qty, unit: 'kg',
        })

        // 3. Production log
        const log = logs?.find(l => l.planning_job_id === j.id)
        if (log) {
          const parts = [
            log.good_rolls ? `✓ ดี ${log.good_rolls} ม้วน` : '',
            log.good_qty   ? `${formatNumber(log.good_qty)} kg` : '',
            log.waste_qty  ? `✗ เศษ ${formatNumber(log.waste_qty)} kg` : '',
            log.bad_qty    ? `⚙ กรอ ${formatNumber(log.bad_qty)} kg` : '',
          ].filter(Boolean).join(' · ')
          events.push({
            id: `log-${log.id}`, type: 'production_done', timestamp: log.finished_at ?? log.created_at, dept: j.dept,
            label: `บันทึกผล ${j.dept === 'printing' ? 'Printing' : j.dept === 'grinding' ? 'Grinding' : 'Extrusion'}`,
            detail: parts, qty: log.good_qty ?? undefined, unit: 'kg',
          })
        }

        // 4. Received to warehouse
        const st = stock?.find(s => s.planning_job_id === j.id)
        if (st) {
          events.push({
            id: `st-${st.id}`, type: 'stock_received', timestamp: st.received_at,
            label: `รับเข้าคลัง Lot ${st.lot_no}`,
            detail: `${formatNumber(st.qty)} ${st.unit}`,
            qty: st.qty, unit: st.unit,
          })
        }
      })

      // 5. Requisitions
      const soReqs = reqs?.filter(r => r.sale_order_id === o.id) ?? []
      soReqs.forEach(r => {
        const rItems: any[] = (r as any).items ?? []
        const isStock = rItems.some((i: any) => i.stock_id === '__stock_portion__')
        events.push({
          id: `req-${r.id}`, type: 'req_created', timestamp: r.created_at,
          label: `สร้างใบเบิก${isStock ? ' (ส่วนสต็อก)' : ''}`,
          detail: `${formatNumber(o.qty)} ${o.unit}`,
        })
        if (r.status === 'dispatched') {
          events.push({
            id: `disp-${r.id}`, type: 'req_dispatched', timestamp: r.created_at,
            label: `ปล่อยของ${isStock ? ' (ส่วนสต็อก)' : ''}`,
            detail: `${formatNumber(o.qty)} ${o.unit}`,
          })
        }
      })

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      const lastActivity = events[0]?.timestamp ?? o.created_at

      return {
        so_id: o.id, so_no: o.so_no,
        customer: o.customer?.name ?? '-', product: o.product?.part_name ?? '-',
        status: o.status, qty: o.qty, unit: o.unit,
        lastActivity, events,
      }
    }).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
  }, [orders, jobs, logs, stock, reqs])

  const filtered = soMap.filter(s => {
    const q = search.toLowerCase()
    return !q || [s.so_no, s.customer, s.product].some(v => v.toLowerCase().includes(q))
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Activity Log</h1>
        <p className="text-slate-400 text-sm mt-0.5">ประวัติกิจกรรมทั้งหมด จัดกลุ่มตาม SO</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'SO ทั้งหมด',    value: soMap.length,                                          color: 'text-white' },
          { label: 'กำลังผลิต',     value: soMap.filter(s => s.status === 'in_production').length, color: 'text-green-300' },
          { label: 'รอวางแผน',      value: soMap.filter(s => s.status === 'approved').length,      color: 'text-sky-300' },
          { label: 'เสร็จแล้ว',     value: soMap.filter(s => s.status === 'completed').length,     color: 'text-pink-300' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา SO, ลูกค้า, สินค้า..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
        />
      </div>

      {/* SO list */}
      <div className="space-y-2">
        {filtered.map(s => {
          const isOpen = expanded.has(s.so_id)
          return (
            <div key={s.so_id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* SO row */}
              <button
                onClick={() => toggle(s.so_id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
              >
                {isOpen
                  ? <ChevronDown size={15} className="text-slate-500 shrink-0" />
                  : <ChevronRight size={15} className="text-slate-500 shrink-0" />}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-sm">{s.so_no}</span>
                    <StatusBadge status={s.status} />
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{s.events.length} events</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{s.customer} · {s.product}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <p className="text-white font-semibold text-sm">{formatNumber(s.qty)} {s.unit}</p>
                    <p className="text-slate-500 text-[10px]">{formatTs(s.lastActivity)}</p>
                  </div>
                </div>
              </button>

              {/* Event timeline */}
              {isOpen && (
                <div className="border-t border-slate-800 px-5 py-4">
                  <div className="relative">
                    {/* vertical line */}
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-800" />

                    <div className="space-y-3">
                      {s.events.map(e => {
                        const cfg = EVENT_CFG[e.type]
                        return (
                          <div key={e.id} className="flex gap-3 items-start">
                            {/* dot */}
                            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center border shrink-0 z-10', cfg.bg, cfg.border, cfg.color)}>
                              {cfg.icon}
                            </div>
                            {/* content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', cfg.bg, cfg.border, cfg.color)}>
                                    {e.label}
                                  </span>
                                  {e.dept && deptLabel(e.dept)}
                                </div>
                                <span className="text-slate-600 text-[10px] shrink-0">{formatTs(e.timestamp)}</span>
                              </div>
                              {e.detail && (
                                <p className={cn('text-xs mt-0.5', cfg.color)}>{e.detail}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center text-slate-500">ไม่พบข้อมูล</div>
        )}
      </div>
    </div>
  )
}
