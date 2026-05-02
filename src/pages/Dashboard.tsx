import { useState, useEffect } from 'react'
import { ShoppingCart, Wind, Warehouse, CheckCircle, AlertCircle, Clock, Cog, Printer, TrendingUp, Package, RefreshCw } from 'lucide-react'
import { useSaleOrders } from '../hooks/useSaleOrders'
import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import { useWarehouseStock } from '../hooks/useWarehouse'
import { useRequisitions } from '../hooks/useSales'
import { useAuth } from '../lib/AuthContext'
import { formatNumber, cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

// ─── mini bar chart ───────────────────────────────────────────────────────────

function Bar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-semibold">{formatNumber(value)} kg{sub ? ` · ${sub}` : ''}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-slate-600 text-[10px] text-right">{pct}%</p>
    </div>
  )
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, onClick, active }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string
  color: string; onClick?: () => void; active?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-slate-900 border rounded-xl p-5 transition-all',
        onClick ? 'cursor-pointer hover:border-slate-600' : '',
        active ? 'border-brand-500/60 ring-1 ring-brand-500/30' : 'border-slate-800'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg', color)}>{icon}</div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user }  = useAuth()
  const { data: orders }  = useSaleOrders()
  const { data: jobs }    = usePlanningJobs()
  const { data: allLogs } = useProductionLogs()
  const { data: stock }   = useWarehouseStock()
  const { data: reqs }    = useRequisitions()

  const [activeChart, setActiveChart] = useState<'overview'|'jobtype'|'grinding'>('overview')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const qc = useQueryClient()

  function refreshAll() {
    qc.invalidateQueries()
    setLastRefresh(new Date())
  }

  // Supabase Realtime — subscribe to key tables
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_orders' },    () => { qc.invalidateQueries({ queryKey: ['sale_orders'] }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_jobs' },  () => { qc.invalidateQueries({ queryKey: ['planning_jobs'] }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs' },() => { qc.invalidateQueries({ queryKey: ['production_logs'] }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock' },() => { qc.invalidateQueries({ queryKey: ['warehouse_stock'] }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' },   () => { qc.invalidateQueries({ queryKey: ['requisitions'] }) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── คำนวณ KPIs ──
  const totalSOQty    = orders?.reduce((s, o) => s + o.qty, 0) ?? 0
  const totalProdQty  = allLogs?.reduce((s, l) => s + (l.good_qty ?? 0), 0) ?? 0
  const totalWaste    = allLogs?.reduce((s, l) => s + (l.waste_qty ?? 0), 0) ?? 0
  const totalBadQty   = allLogs?.filter(l => {
    const job = jobs?.find(j => j.id === l.planning_job_id)
    return job?.dept === 'extrusion'
  }).reduce((s, l) => s + (l.bad_qty ?? 0), 0) ?? 0
  const dispatchedQty = reqs?.filter(r => r.status === 'dispatched')
    .reduce((s, r) => s + (r.sale_order?.qty ?? 0), 0) ?? 0
  const goodStock     = stock?.filter(s => s.condition === 'good').reduce((s, st) => s + st.qty, 0) ?? 0

  // grinding jobs
  const grdJobs       = jobs?.filter(j => j.dept === 'grinding') ?? []
  const grdTotal      = grdJobs.reduce((s, j) => s + j.planned_qty, 0)
  const grdLogs       = allLogs?.filter(l => {
    const job = jobs?.find(j => j.id === l.planning_job_id); return job?.dept === 'grinding'
  }) ?? []
  const grdGoodQty    = grdLogs.reduce((s, l) => s + (l.good_qty ?? 0), 0)
  const grdWaste      = grdLogs.reduce((s, l) => s + (l.waste_qty ?? 0), 0)

  // by job type
  const jobTypes = ['Shrink Film','Stretch Film','ฟิล์มพิมพ์','ถุงคลุม','แผ่นชีส','ถุงหลอด','อื่นๆ']
  const jobTypeData = jobTypes.map(jt => {
    const soList = jt === 'อื่นๆ'
      ? (orders?.filter(o => !jobTypes.slice(0,-1).includes(o.job_type ?? '')) ?? [])
      : (orders?.filter(o => (o.job_type ?? '') === jt) ?? [])
    return { label: jt, qty: soList.reduce((s, o) => s + o.qty, 0), count: soList.length }
  }).filter(d => d.qty > 0)
  const maxJobType = Math.max(...jobTypeData.map(d => d.qty), 1)

  // status counts
  const pendingApproval = orders?.filter(o => o.status === 'draft').length ?? 0
  const inProduction    = jobs?.filter(j => j.status === 'ongoing').length ?? 0
  const pendingReceipt  = jobs?.filter(j => j.status === 'pending_receipt').length ?? 0

  const maxKpi = Math.max(totalSOQty, 1)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">ยินดีต้อนรับ, {user?.full_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-xs">อัพเดต {lastRefresh.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <button onClick={refreshAll} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(pendingReceipt > 0 || pendingApproval > 0) && (
        <div className="space-y-2">
          {pendingReceipt > 0 && (
            <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="text-yellow-400 shrink-0" />
              <span className="text-yellow-300 text-sm">มี <strong>{pendingReceipt}</strong> งานผลิตเสร็จ รอรับเข้าคลัง</span>
            </div>
          )}
          {pendingApproval > 0 && (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
              <Clock size={16} className="text-blue-400 shrink-0" />
              <span className="text-blue-300 text-sm">มี <strong>{pendingApproval}</strong> Sale Order รอ Approve</span>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ShoppingCart size={18} className="text-blue-400" />}  label="ยอด SO รวม"     value={`${formatNumber(totalSOQty)} kg`}     sub={`${orders?.length ?? 0} ใบ`}                                        color="bg-blue-500/10"   onClick={() => setActiveChart('overview')} active={activeChart==='overview'} />
        <StatCard icon={<Wind size={18} className="text-green-400" />}          label="ผลิตได้รวม"     value={`${formatNumber(totalProdQty)} kg`}   sub={`เสีย ${formatNumber(totalWaste)} kg`}                               color="bg-green-500/10" />
        <StatCard icon={<TrendingUp size={18} className="text-pink-400" />}     label="ส่งออกแล้ว"     value={`${formatNumber(dispatchedQty)} kg`}  sub={`${reqs?.filter(r=>r.status==='dispatched').length ?? 0} ใบเบิก`}   color="bg-pink-500/10" />
        <StatCard icon={<Warehouse size={18} className="text-yellow-400" />}    label="สต็อกคงเหลือ"  value={`${formatNumber(goodStock)} kg`}      sub={`${stock?.filter(s=>s.condition==='good').length ?? 0} Lot`}         color="bg-yellow-500/10" />
        <StatCard icon={<Cog size={18} className="text-orange-400" />}          label="ม้วนกรอรวม"    value={`${formatNumber(totalBadQty)} kg`}    sub={`${grdJobs.length} งาน · กรอคืน ${formatNumber(grdGoodQty)} kg`}    color="bg-orange-500/10" onClick={() => setActiveChart('grinding')} active={activeChart==='grinding'} />
        <StatCard icon={<Printer size={18} className="text-purple-400" />}      label="ตามประเภทงาน"  value={`${jobTypeData.length} ประเภท`}       sub="คลิกดูรายละเอียด"                                                    color="bg-purple-500/10" onClick={() => setActiveChart('jobtype')} active={activeChart==='jobtype'} />
        <StatCard icon={<Package size={18} className="text-red-400" />}         label="เศษเสียรวม"    value={`${formatNumber(totalWaste)} kg`}     sub="เศษจากทุกแผนก (ไม่รวมม้วนกรอ)"                                     color="bg-red-500/10" />
        <StatCard icon={<CheckCircle size={18} className="text-teal-400" />}    label="SO เสร็จสิ้น"  value={orders?.filter(o=>o.status==='completed').length ?? 0} sub={`กำลังผลิต ${inProduction}`}           color="bg-teal-500/10" />
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <p className="text-white font-medium text-sm mb-4">Workflow Pipeline</p>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {[
            { label: 'Sale Order',   value: orders?.length ?? 0,                                             sub: `${formatNumber(totalSOQty)} kg`,        color: 'bg-blue-500/20 border-blue-500/40 text-blue-300',   dot: 'bg-blue-500' },
            { label: 'Planning',     value: jobs?.filter(j=>['queued','ongoing'].includes(j.status)).length ?? 0, sub: 'รอ / กำลังผลิต',                  color: 'bg-sky-500/20 border-sky-500/40 text-sky-300',      dot: 'bg-sky-500' },
            { label: 'Extrusion',    value: jobs?.filter(j=>j.dept==='extrusion'&&j.status==='ongoing').length ?? 0, sub: `ม้วนกรอ ${formatNumber(totalBadQty)} kg`, color: 'bg-brand-500/20 border-brand-500/40 text-brand-300', dot: 'bg-brand-500' },
            { label: 'Grinding',     value: grdJobs.filter(j=>['queued','ongoing'].includes(j.status)).length, sub: `คืนได้ ${formatNumber(grdGoodQty)} kg`, color: 'bg-orange-500/20 border-orange-500/40 text-orange-300', dot: 'bg-orange-500' },
            { label: 'Printing',     value: jobs?.filter(j=>j.dept==='printing'&&j.status==='ongoing').length ?? 0, sub: 'ม้วนพิมพ์',                     color: 'bg-purple-500/20 border-purple-500/40 text-purple-300', dot: 'bg-purple-500' },
            { label: 'คลังสินค้า',  value: stock?.filter(s=>s.condition==='good').length ?? 0,               sub: `${formatNumber(goodStock)} kg`,         color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', dot: 'bg-yellow-500' },
            { label: 'ส่งลูกค้า',   value: reqs?.filter(r=>r.status==='dispatched').length ?? 0,             sub: `${formatNumber(dispatchedQty)} kg`,     color: 'bg-green-500/20 border-green-500/40 text-green-300',  dot: 'bg-green-500' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center shrink-0">
              <div className={`border rounded-xl px-4 py-3 min-w-[110px] text-center ${step.color}`}>
                <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${step.dot}`} />
                <p className="font-bold text-lg leading-none">{step.value}</p>
                <p className="text-xs font-medium mt-1">{step.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{step.sub}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="flex flex-col items-center px-1">
                  <div className="w-6 h-px bg-slate-600" />
                  <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-slate-600" />
                </div>
              )}
            </div>
          ))}
        </div>
        {/* เศษเสีย flow */}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/40" />
          <span>เศษเสียรวม: <span className="text-red-300 font-medium">{formatNumber(totalWaste)} kg</span></span>
          <span className="mx-2">·</span>
          <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500/40" />
          <span>ม้วนกรอ: <span className="text-orange-300 font-medium">{formatNumber(totalBadQty)} kg</span> → กรอคืน <span className="text-green-300 font-medium">{formatNumber(grdGoodQty)} kg</span></span>
        </div>
      </div>

      {/* Interactive Chart Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {/* Tab */}
        <div className="flex border-b border-slate-800">
          {[
            { key: 'overview', label: 'ภาพรวมยอด' },
            { key: 'jobtype',  label: 'ตามประเภทงาน' },
            { key: 'grinding', label: 'งานกรอ' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveChart(t.key as any)}
              className={cn('px-5 py-3 text-sm font-medium transition-colors', activeChart === t.key ? 'text-white border-b-2 border-brand-500' : 'text-slate-400 hover:text-white')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview */}
          {activeChart === 'overview' && (
            <div className="space-y-5">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">ยอด kg เปรียบเทียบ</p>
              <Bar label="ยอด SO รวม (ลูกค้าสั่ง)"   value={totalSOQty}    max={maxKpi} color="bg-blue-500" />
              <Bar label="ผลิตได้จริง (ม้วนดี)"       value={totalProdQty}  max={maxKpi} color="bg-green-500" />
              <Bar label="ส่งออกให้ลูกค้า"             value={dispatchedQty} max={maxKpi} color="bg-pink-500" />
              <Bar label="สต็อกคงเหลือในคลัง"          value={goodStock}     max={maxKpi} color="bg-yellow-500" />
              <Bar label="เศษเสียรวม (เป่า+กรอ+พิม)"    value={totalWaste} max={maxKpi} color="bg-red-500" />

              {/* yield summary */}
              {totalProdQty > 0 && totalSOQty > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  {[
                    { label: 'Yield รวม',       value: Math.round(totalProdQty / (totalProdQty + totalWaste) * 100), unit: '%', color: 'text-green-300' },
                    { label: '% ส่งจากยอด SO', value: Math.round(dispatchedQty / totalSOQty * 100), unit: '%', color: 'text-pink-300' },
                    { label: '% คงเหลือ',       value: Math.round(goodStock / totalSOQty * 100), unit: '%', color: 'text-yellow-300' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800 rounded-lg px-4 py-3 text-center">
                      <p className="text-slate-500 text-xs">{s.label}</p>
                      <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}{s.unit}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Job Type */}
          {activeChart === 'jobtype' && (
            <div className="space-y-5">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">ยอดตามประเภทงาน</p>
              {jobTypeData.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">ยังไม่มีข้อมูล job_type ใน SO</p>
              ) : jobTypeData.map(d => (
                <Bar key={d.label} label={d.label} value={d.qty} max={maxJobType} color="bg-purple-500" sub={`${d.count} SO`} />
              ))}
            </div>
          )}

          {/* Grinding */}
          {activeChart === 'grinding' && (
            <div className="space-y-5">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">สรุปงานกรอ</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'รับเข้ากรอ',   value: grdTotal,   color: 'text-orange-300' },
                  { label: 'กรอได้',        value: grdGoodQty, color: 'text-green-300' },
                  { label: 'เศษสแคป',       value: grdWaste,   color: 'text-red-300' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800 rounded-lg px-4 py-3 text-center">
                    <p className="text-slate-500 text-xs">{s.label}</p>
                    <p className={cn('text-xl font-bold mt-1', s.color)}>{formatNumber(s.value)} kg</p>
                  </div>
                ))}
              </div>
              {grdTotal > 0 && (
                <>
                  <Bar label="กรอได้ (คืนสายผลิต)" value={grdGoodQty} max={grdTotal} color="bg-green-500" />
                  <Bar label="เศษสแคป"              value={grdWaste}   max={grdTotal} color="bg-red-500" />
                  <div className="bg-slate-800 rounded-lg px-4 py-3 text-center mt-2">
                    <p className="text-slate-500 text-xs">Recovery Rate</p>
                    <p className="text-green-300 text-2xl font-bold mt-1">{Math.round(grdGoodQty / grdTotal * 100)}%</p>
                  </div>
                </>
              )}
              {grdJobs.length === 0 && <p className="text-slate-500 text-sm text-center py-8">ยังไม่มีงานกรอ</p>}
            </div>
          )}
        </div>
      </div>

      {/* แดชบอร์ดแต่ละหน่วยงาน — ย้ายเข้าหน้าแผนก */}
      {false && (() => {
        const extLogs = allLogs?.filter(l => jobs?.find(j => j.id === l.planning_job_id)?.dept === 'extrusion') ?? []
        const prtLogs = allLogs?.filter(l => jobs?.find(j => j.id === l.planning_job_id)?.dept === 'printing')  ?? []
        const grdLogsAll = allLogs?.filter(l => jobs?.find(j => j.id === l.planning_job_id)?.dept === 'grinding') ?? []

        // Extrusion
        const extRawMat   = jobs?.filter(j => j.dept === 'extrusion').reduce((s, j) => s + (j.raw_material_qty ?? 0), 0) ?? 0
        const extGood     = extLogs.reduce((s, l) => s + (l.good_qty ?? 0), 0)
        const extGoodRoll = extLogs.reduce((s, l) => s + (l.good_rolls ?? 0), 0)
        const extBad      = extLogs.reduce((s, l) => s + (l.bad_qty ?? 0), 0)
        const extBadRoll  = extLogs.reduce((s, l) => s + (l.bad_rolls ?? 0), 0)
        const extWaste    = extLogs.reduce((s, l) => s + (l.waste_qty ?? 0), 0)
        const extYield    = extRawMat > 0 ? Math.round(extGood / extRawMat * 100) : 0

        // Printing
        const prtJobs     = jobs?.filter(j => j.dept === 'printing') ?? []
        const prtInput    = prtJobs.reduce((s, j) => s + j.planned_qty, 0)
        const prtGood     = prtLogs.reduce((s, l) => s + (l.good_qty ?? 0), 0)
        const prtGoodRoll = prtLogs.reduce((s, l) => s + (l.good_rolls ?? 0), 0)
        const prtWaste    = prtLogs.reduce((s, l) => s + (l.waste_qty ?? 0), 0)
        const prtYield    = prtInput > 0 ? Math.round(prtGood / prtInput * 100) : 0

        // Grinding
        const grdInput    = grdJobs.reduce((s, j) => s + j.planned_qty, 0)
        const grdGood2    = grdLogsAll.reduce((s, l) => s + (l.good_qty ?? 0), 0)
        const grdRoll     = grdLogsAll.reduce((s, l) => s + (l.good_rolls ?? 0), 0)
        const grdWaste2   = grdLogsAll.reduce((s, l) => s + (l.waste_qty ?? 0), 0)
        const grdRecovery = grdInput > 0 ? Math.round(grdGood2 / grdInput * 100) : 0

        type DeptRow = { label: string; value: number | string; sub?: string; color: string }
        function DeptCard({ title, icon, color, rows, yield: yld }: { title: string; icon: React.ReactNode; color: string; rows: DeptRow[]; yield?: number }) {
          return (
            <div className={cn('bg-slate-900 border rounded-xl overflow-hidden', color)}>
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
                {icon}
                <span className="text-white font-semibold text-sm">{title}</span>
                {yld !== undefined && (
                  <span className={cn('ml-auto text-xs font-bold px-2 py-0.5 rounded-full', yld >= 95 ? 'bg-green-500/20 text-green-300' : yld >= 90 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300')}>
                    Yield {yld}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-800">
                {rows.map(r => (
                  <div key={r.label} className="px-4 py-4 text-center">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{r.label}</p>
                    <p className={cn('text-xl font-bold', r.color)}>{typeof r.value === 'number' ? formatNumber(r.value) : r.value}</p>
                    {r.sub && <p className="text-slate-500 text-[10px] mt-0.5">{r.sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
          <div className="space-y-3">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">แดชบอร์ดแต่ละหน่วยงาน</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Extrusion */}
              <DeptCard
                title="Extrusion"
                icon={<Wind size={15} className="text-brand-400" />}
                color="border-brand-500/20"
                yield={extYield}
                rows={[
                  { label: 'วัตถุดิบเบิก',                      value: extRawMat,  sub: 'kg',                   color: 'text-slate-300' },
                  { label: `ม้วนดี${extGoodRoll ? ` ${extGoodRoll} ม้วน` : ''}`, value: extGood, sub: 'kg',    color: 'text-green-300' },
                  { label: `ม้วนกรอ${extBadRoll ? ` ${extBadRoll} ม้วน` : ''}`,  value: extBad,  sub: 'kg',    color: 'text-orange-300' },
                ]}
              />
              <div className="bg-slate-900 border border-brand-500/20 rounded-xl">
                <div className="grid grid-cols-2 divide-x divide-slate-800 border-t border-slate-800">
                  {[
                    { label: 'เศษเป่า', value: extWaste, color: 'text-red-300' },
                    { label: 'งาน active', value: jobs?.filter(j=>j.dept==='extrusion'&&j.status==='ongoing').length ?? 0, color: 'text-sky-300', isCount: true },
                  ].map(r => (
                    <div key={r.label} className="px-4 py-3 text-center">
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{r.label}</p>
                      <p className={cn('text-lg font-bold', r.color)}>{(r as any).isCount ? r.value : formatNumber(r.value as number)}</p>
                      {!(r as any).isCount && <p className="text-slate-500 text-[10px]">kg</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Printing */}
              <DeptCard
                title="Printing"
                icon={<Printer size={15} className="text-purple-400" />}
                color="border-purple-500/20"
                yield={prtYield}
                rows={[
                  { label: 'รับจากผลิต',                          value: prtInput,    sub: 'kg',                 color: 'text-slate-300' },
                  { label: `พิมได้${prtGoodRoll ? ` ${prtGoodRoll} ม้วน` : ''}`, value: prtGood, sub: 'kg',      color: 'text-purple-300' },
                  { label: 'เศษพิมพ์',                             value: prtWaste,    sub: 'kg',                 color: 'text-red-300' },
                ]}
              />

              {/* Grinding */}
              <DeptCard
                title="Grinding"
                icon={<Cog size={15} className="text-orange-400" />}
                color="border-orange-500/20"
                yield={grdRecovery}
                rows={[
                  { label: 'รับม้วนกรอ',  value: grdInput,  sub: `${grdJobs.length} งาน`,   color: 'text-slate-300' },
                  { label: `กรอคืน${grdRoll ? ` ${grdRoll} ม้วน` : ''}`, value: grdGood2, sub: 'kg', color: 'text-green-300' },
                  { label: 'เศษสแคป',      value: grdWaste2, sub: 'kg',                       color: 'text-red-300' },
                ]}
              />

            </div>
          </div>
        )
      })()}
    </div>
  )
}
