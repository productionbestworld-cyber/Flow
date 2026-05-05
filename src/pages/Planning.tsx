import { useState, useEffect, useRef } from 'react'
import { Wind, Printer, X, Plus, Clock, CheckCircle2, Package, Cog, ChevronUp, ChevronDown, Edit2, Download, FileText } from 'lucide-react'
import { downloadCSV, printDocument } from '../lib/csvUtils'
import { useSaleOrders, useUpdateSaleOrder } from '../hooks/useSaleOrders'
import { usePlanningJobs, useCreatePlanningJob, useAssignMachine, useUnassignMachine, useUpdatePlanningJob, useDeletePlanningJob, usePromoteQueuedJobs } from '../hooks/usePlanning'
import { formatNumber, cn } from '../lib/utils'
import SODetail from '../components/shared/SODetail'
import type { SaleOrder, PlanningJob, PlanningDept, RouteAfter } from '../types'

// ─── Config เครื่องจักร ────────────────────────────────────────────────────────

const BLOW_MACHINES      = ['B-01','B-02','B-03','B-04','B-05','B-06','B-07','B-08','B-09','B-10','B-11']
const SF_MACHINES        = ['SF-01']
const EXTRUSION_MACHINES = [...SF_MACHINES, ...BLOW_MACHINES]
const PRINTING_MACHINES  = ['P-01','P-02','P-03']

// ─── MachineRow ────────────────────────────────────────────────────────────────

interface MachineRowProps {
  machineName: string
  activeJob?: PlanningJob
  queuedJobs: PlanningJob[]
  unassignedJobs: PlanningJob[]
  onAssign: (jobId: string, machine: string) => void
  onUnassign: (jobId: string) => void
  onCreateJob: (machine: string) => void
  onEdit: (job: PlanningJob) => void
  assigning: boolean
}

function JobCells({ job, onEdit }: { job: PlanningJob; onEdit: (job: PlanningJob) => void }) {
  const so = job.sale_order
  return (
    <>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-white text-xs font-semibold">{so?.so_no}</span>
      </td>
      <td className="px-3 py-2.5 max-w-[140px]">
        <span className="text-slate-300 text-xs truncate block">{so?.customer?.name}</span>
      </td>
      <td className="px-3 py-2.5 max-w-[180px]">
        <span className="text-slate-300 text-xs truncate block">{so?.product?.part_name}</span>
        <div className="flex gap-1 mt-0.5 flex-wrap">
          {so?.grade && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">เกรด {so.grade}</span>}
          {so?.weight_per_roll && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{so.weight_per_roll} kg/ม้วน</span>}
          {so?.core_type && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">แกน {so.core_type === 'pvc' ? 'PVC' : 'กระดาษ'}</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <div>
            <span className="text-white text-xs font-medium">{formatNumber(job.planned_qty)} kg</span>
            <p className="text-slate-500 text-[10px] font-mono mt-0.5">{job.lot_no}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {job.route_after === 'to_printing' && (
            <span className="flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] px-2 py-0.5 rounded-full w-fit">
              <Printer size={9} /> Printing
            </span>
          )}
          {job.route_after === 'to_warehouse' && (
            <span className="flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-[10px] px-2 py-0.5 rounded-full w-fit">
              <Package size={9} /> คลัง
            </span>
          )}
          <button
            onClick={() => onEdit(job)}
            className="text-slate-500 hover:text-white transition-colors ml-0.5"
            title="แก้ไขงาน"
          >
            <Edit2 size={11} />
          </button>
        </div>
      </td>
    </>
  )
}

function MachineRow({
  machineName, activeJob, queuedJobs, unassignedJobs, onAssign, onUnassign, onCreateJob, onEdit, assigning,
}: MachineRowProps) {
  const [selectedJobId, setSelectedJobId] = useState('')
  const [orderedQueue, setOrderedQueue] = useState<PlanningJob[]>(queuedJobs)

  // sync เมื่อ queuedJobs เปลี่ยน แต่รักษาลำดับที่ user เรียงไว้
  const queueKey = queuedJobs.map(j => j.id).join(',')
  useEffect(() => {
    setOrderedQueue(prev => {
      const existing = prev.filter(j => queuedJobs.some(q => q.id === j.id))
      const added    = queuedJobs.filter(q => !prev.some(j => j.id === q.id))
      return [...existing, ...added]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey])

  function moveUp(i: number) {
    if (i === 0) return
    setOrderedQueue(q => { const a = [...q]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a })
  }
  function moveDown(i: number) {
    if (i === orderedQueue.length - 1) return
    setOrderedQueue(q => { const a = [...q]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a })
  }

  const isProducing = !!activeJob
  const hasQueue    = orderedQueue.length > 0
  const totalRows   = (activeJob ? 1 : 0) + orderedQueue.length || 1

  const dotColor    = isProducing ? 'bg-green-400 animate-pulse shadow-green-400/50 shadow-sm'
                    : hasQueue    ? 'bg-yellow-400'
                    : 'bg-slate-600'
  const statusLabel = isProducing ? 'กำลังผลิต' : hasQueue ? 'มีคิวรอ' : 'ว่าง'
  const statusColor = isProducing ? 'text-green-400' : hasQueue ? 'text-yellow-400' : 'text-slate-500'

  return (
    <>
      {/* ─── Row หลัก: active job หรือ idle ─── */}
      <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
        {/* เครื่อง — rowSpan ทุก job */}
        <td rowSpan={totalRows} className="px-3 py-2.5 whitespace-nowrap border-r border-slate-800 align-top">
          <div className="flex items-center gap-2 pt-0.5">
            <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
            <span className="text-white font-bold text-sm">{machineName}</span>
          </div>
          <span className={cn('text-[10px] font-medium ml-4', statusColor)}>{statusLabel}</span>
        </td>

        {/* Actions — rowSpan ทุก job */}
        <td rowSpan={totalRows} className="px-3 py-2.5 whitespace-nowrap border-r border-slate-800 align-top">
          <div className="flex flex-col gap-1.5 pt-0.5">
            {isProducing ? (
              <button
                onClick={() => onCreateJob(machineName)}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 transition-colors"
              >
                <Plus size={11} /> เพิ่มงาน
              </button>
            ) : unassignedJobs.length > 0 ? (
              <div className="flex gap-1">
                <select
                  value={selectedJobId}
                  onChange={e => setSelectedJobId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-[10px] rounded px-1.5 py-1 outline-none focus:border-brand-500 flex-1 min-w-0"
                >
                  <option value="">— เลือกงาน —</option>
                  {unassignedJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.sale_order?.so_no}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (selectedJobId) { onAssign(selectedJobId, machineName); setSelectedJobId('') } }}
                  disabled={!selectedJobId || assigning}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-[10px] px-2 py-1 rounded transition-colors shrink-0"
                >
                  Assign
                </button>
              </div>
            ) : (
              <button
                onClick={() => onCreateJob(machineName)}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 transition-colors"
              >
                <Plus size={11} /> เพิ่มงาน
              </button>
            )}
          </div>
        </td>

        {/* Active job cells หรือ idle placeholder */}
        {activeJob ? (
          <JobCells job={activeJob} onEdit={onEdit} />
        ) : (
          <>
            <td className="px-3 py-2.5"><span className="text-slate-600 text-xs">—</span></td>
            <td className="px-3 py-2.5"><span className="text-slate-600 text-xs">—</span></td>
            <td className="px-3 py-2.5"><span className="text-slate-600 text-xs">—</span></td>
            <td className="px-3 py-2.5"><span className="text-slate-600 text-xs">—</span></td>
            <td className="px-3 py-2.5"><span className="text-slate-600 text-xs">—</span></td>
          </>
        )}

        {/* ถอดงาน — เฉพาะ active */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          {activeJob && (
            <button
              onClick={() => onUnassign(activeJob.id)}
              className="text-rose-400 text-[10px] px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            >
              ถอดงาน
            </button>
          )}
        </td>
      </tr>

      {/* ─── Sub-rows: queued jobs ─── */}
      {orderedQueue.map((j, i) => (
        <tr key={j.id} className={cn('hover:bg-slate-800/30 transition-colors', i < orderedQueue.length - 1 ? 'border-b border-slate-700/30' : 'border-b border-slate-700/50')}>
          <td className="px-3 py-2 whitespace-nowrap" />
          <JobCells job={j} onEdit={onEdit} />
          <td className="px-3 py-2 whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              {/* ลำดับ + ปุ่มขยับ */}
              <span className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded">
                <Clock size={8} /> คิว {i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === orderedQueue.length - 1}
                  className="text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <button
                onClick={() => onUnassign(j.id)}
                className="text-rose-400 text-[10px] px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
              >
                ถอด
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Machine Table ─────────────────────────────────────────────────────────────

interface MachineTableProps {
  label: string
  machines: string[]
  unassigned: PlanningJob[]
  allActiveJobs: PlanningJob[]
  onAssign: (id: string, machine: string) => void
  onUnassign: (id: string) => void
  onCreateJob: (machine: string) => void
  onEdit: (job: PlanningJob) => void
  assigning: boolean
}

function MachineTable({ label, machines, unassigned, allActiveJobs, onAssign, onUnassign, onCreateJob, onEdit, assigning }: MachineTableProps) {
  function getMachineJobs(machine: string) {
    const ongoingAll = allActiveJobs
      .filter(j => j.machine_no === machine && j.status === 'ongoing')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    // งานเก่าสุด = active จริง, ที่เหลือ treat เป็น queued (data inconsistency จากเก่า)
    const active = ongoingAll[0]
    const queuedOngoing = ongoingAll.slice(1)
    const queued = [
      ...queuedOngoing,
      ...allActiveJobs.filter(j => j.machine_no === machine && j.status === 'queued'),
    ]
    return { active, queued }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/50">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/30">
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap border-r border-slate-800">เครื่อง</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap border-r border-slate-800">Actions</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">SO</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">ลูกค้า</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">สินค้า</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">จำนวน</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">ส่งต่อ</th>
              <th className="px-3 py-2 text-slate-500 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {machines.map(m => {
              const { active, queued } = getMachineJobs(m)
              return (
                <MachineRow
                  key={m}
                  machineName={m}
                  activeJob={active}
                  queuedJobs={queued}
                  unassignedJobs={unassigned}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                  onCreateJob={onCreateJob}
                  onEdit={onEdit}
                  assigning={assigning}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Planning Page ─────────────────────────────────────────────────────────────

export default function Planning() {
  const { data: orders } = useSaleOrders()
  const { data: jobs, isLoading } = usePlanningJobs()
  const promoteQueue   = usePromoteQueuedJobs()
  const promotedRef    = useRef(false)
  const updateOrder    = useUpdateSaleOrder()
  const createJob      = useCreatePlanningJob()
  const assignMachine  = useAssignMachine()
  const unassignMachine = useUnassignMachine()
  const updateJob      = useUpdatePlanningJob()
  const deleteJob      = useDeletePlanningJob()
  const [showModal, setShowModal]         = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null)
  const [machineForCreate, setMachineForCreate] = useState<string | null>(null)
  const [isGrinding, setIsGrinding]       = useState(false)
  const [activeTab, setActiveTab]         = useState<'extrusion' | 'printing'>('extrusion')
  const [editingJob, setEditingJob]       = useState<PlanningJob | null>(null)
  const [editQty, setEditQty]             = useState('')
  const [editRoute, setEditRoute]         = useState<RouteAfter | ''>('')
  const [editRawQty, setEditRawQty]       = useState('')
  const [createRawQty, setCreateRawQty]   = useState('')
  const [createStockQty, setCreateStockQty] = useState('')

  useEffect(() => {
    if (jobs && jobs.length > 0 && !promotedRef.current) {
      promotedRef.current = true
      promoteQueue.mutate(jobs)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs])

  function getRawTolerance(o: SaleOrder): number {
    const type = o.product?.type
    const isPrint = type === 'print' || type === 'blow_print' || o.job_type === 'ฟิล์มพิมพ์'
    return isPrint ? 0.10 : 0.03
  }

  function getRouteAfter(o: SaleOrder): RouteAfter {
    const isPrint =
      o.job_type === 'ฟิล์มพิมพ์' ||
      o.product?.type === 'print' ||
      o.product?.type === 'blow_print'
    return isPrint ? 'to_printing' : 'to_warehouse'
  }

  const approvedOrders  = orders?.filter(o => o.status === 'approved') ?? []
  // สำหรับสร้าง grinding job — รวม in_production ด้วย (กรณีม้วนเสียต้องกรอ)
  const grindableOrders = orders?.filter(o => ['approved','in_planning','in_production'].includes(o.status)) ?? []
  const allActiveJobs   = jobs?.filter(j => ['queued','ongoing','pending_receipt'].includes(j.status)) ?? []

  const unassignedExtJobs = allActiveJobs.filter(j => j.dept === 'extrusion' && j.status === 'queued' && !j.machine_no)
  const unassignedPrtJobs = allActiveJobs.filter(j => j.dept === 'printing'  && j.status === 'queued' && !j.machine_no)


  const pendingReceipt = jobs?.filter(j => j.status === 'pending_receipt') ?? []

  const stats = {
    idle:      (activeTab === 'extrusion' ? EXTRUSION_MACHINES : PRINTING_MACHINES)
                 .filter(m => !allActiveJobs.find(j => j.machine_no === m && j.status === 'ongoing')).length,
    producing: allActiveJobs.filter(j => j.status === 'ongoing' && j.dept === activeTab).length,
    queued:    allActiveJobs.filter(j => j.status === 'queued'  && j.dept === activeTab).length,
  }

  const unassigned = activeTab === 'extrusion' ? unassignedExtJobs : unassignedPrtJobs

  async function handleAssign(jobId: string, machine: string) {
    await assignMachine.mutateAsync({ id: jobId, machine_no: machine })
  }

  async function handleUnassign(jobId: string) {
    if (!confirm('ถอดงานออกจากเครื่อง? (งานยังอยู่ในคิว)')) return
    await unassignMachine.mutateAsync({ id: jobId })
  }

  async function handleCancelJob(job: PlanningJob) {
    if (!confirm(`ยกเลิกงาน ${job.sale_order?.so_no}? จะลบแผนนี้ออกทั้งหมด`)) return
    await deleteJob.mutateAsync({ id: job.id, sale_order_id: job.sale_order_id })
  }

  function handleCreateOnMachine(machine: string) {
    setMachineForCreate(machine)
    setIsGrinding(false)
    setSelectedOrder(null)
    setShowModal(true)
  }

  async function handleCreateJob(asGrinding = false) {
    if (!selectedOrder) return
    if (!asGrinding && !createRawQty) {
      alert('กรุณากรอกวัตถุดิบที่เบิก (kg) ก่อนสร้างแผน')
      return
    }
    // บันทึก stock_qty กลับไปที่ SO ถ้าผู้วางแผนกรอก
    const stockQty = createStockQty !== '' ? parseFloat(createStockQty) : (selectedOrder.stock_qty ?? 0)
    if (createStockQty !== '') {
      await updateOrder.mutateAsync({ id: selectedOrder.id, stock_qty: stockQty })
    }
    const dept: PlanningDept       = asGrinding ? 'grinding' : 'extrusion'
    const route_after: RouteAfter | undefined = asGrinding ? undefined : getRouteAfter(selectedOrder)
    const productionQty = Math.max(0, selectedOrder.qty - stockQty)
    if (!asGrinding && createRawQty) {
      const tol    = getRawTolerance(selectedOrder)
      const maxRaw = productionQty * (1 + tol)
      if (parseFloat(createRawQty) > maxRaw) {
        alert(`วัตถุดิบเกินกำหนด!\nสินค้านี้เบิกได้ไม่เกิน ${(tol * 100).toFixed(0)}% ของยอดผลิต\nเบิกได้สูงสุด: ${maxRaw.toLocaleString('th', { maximumFractionDigits: 2 })} kg`)
        return
      }
    }
    if (!asGrinding && productionQty === 0) {
      alert('SO นี้ของครบจากสต็อกแล้ว ไม่ต้องสร้างแผนผลิต — ไปเบิกจากคลังได้เลย')
      setShowModal(false)
      setSelectedOrder(null)
      return
    }
    await createJob.mutateAsync({
      sale_order_id:    selectedOrder.id,
      dept,
      route_after,
      planned_qty:      productionQty,
      machine_no:       machineForCreate ?? undefined,
      raw_material_qty: createRawQty ? parseFloat(createRawQty) : undefined,
    })
    setShowModal(false)
    setSelectedOrder(null)
    setMachineForCreate(null)
    setIsGrinding(false)
    setCreateRawQty('')
    setCreateStockQty('')
  }

  function handleOpenEdit(job: PlanningJob) {
    setEditingJob(job)
    setEditQty(job.planned_qty.toString())
    setEditRoute(job.route_after ?? '')
    setEditRawQty(job.raw_material_qty?.toString() ?? '')
  }

  async function handleSaveEdit() {
    if (!editingJob) return
    await updateJob.mutateAsync({
      id: editingJob.id,
      planned_qty:      editQty    ? parseFloat(editQty)    : undefined,
      route_after:      editRoute || undefined,
      raw_material_qty: editRawQty ? parseFloat(editRawQty) : undefined,
    })
    setEditingJob(null)
  }

  const tableProps = {
    allActiveJobs,
    unassigned,
    onAssign: handleAssign,
    onUnassign: handleUnassign,
    onCreateJob: handleCreateOnMachine,
    onEdit: handleOpenEdit,
    assigning: assignMachine.isPending || unassignMachine.isPending,
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Planning</h1>
          <p className="text-slate-400 text-sm mt-0.5">สถานะเครื่องจักรและแผนการผลิต</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => {
              const headers = ['Lot No.','SO No.','ลูกค้า','สินค้า','แผนก','เครื่อง','จำนวนวางแผน (kg)','วัตถุดิบ (kg)','ส่งต่อ','สถานะ']
              const rows = (jobs ?? []).map(j => [
                j.lot_no ?? '', j.sale_order?.so_no ?? '', j.sale_order?.customer?.name ?? '',
                j.sale_order?.product?.part_name ?? '', j.dept, j.machine_no ?? '',
                j.planned_qty, j.raw_material_qty ?? '', j.route_after ?? '', j.status,
              ])
              downloadCSV(`planning_${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => {
              const rows = (jobs ?? []).filter(j => ['queued','ongoing','pending_receipt'].includes(j.status))
              const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
              printDocument('แผนการผลิต', `
                <h1>แผนการผลิต</h1>
                <p class="meta">วันที่พิมพ์: ${date} · รวม ${rows.length} งาน</p>
                <table>
                  <thead><tr>
                    <th>Lot No.</th><th>SO No.</th><th>ลูกค้า</th><th>สินค้า</th>
                    <th>แผนก</th><th>เครื่อง</th><th>จำนวน (kg)</th><th>วัตถุดิบ (kg)</th><th>ส่งต่อ</th><th>สถานะ</th>
                  </tr></thead>
                  <tbody>${rows.map(j => `<tr>
                    <td>${j.lot_no ?? ''}</td><td>${j.sale_order?.so_no ?? ''}</td>
                    <td>${j.sale_order?.customer?.name ?? ''}</td><td>${j.sale_order?.product?.part_name ?? ''}</td>
                    <td>${j.dept}</td><td>${j.machine_no ?? '-'}</td>
                    <td style="text-align:right">${(j.planned_qty ?? 0).toLocaleString()}</td>
                    <td style="text-align:right">${j.raw_material_qty?.toLocaleString() ?? '-'}</td>
                    <td>${j.route_after ?? '-'}</td><td>${j.status}</td>
                  </tr>`).join('')}</tbody>
                </table>
              `)
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <FileText size={15} /> พิมพ์
          </button>
          <button
            onClick={() => { setSelectedOrder(null); setMachineForCreate(null); setIsGrinding(false); setShowModal(true) }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> วางแผนใหม่
          </button>
        </div>
      </div>

      {/* ── Planning Dashboard ───────────────────────────────────────────── */}
      {(() => {
        const totalBlow     = EXTRUSION_MACHINES.length
        const totalPrint    = PRINTING_MACHINES.length
        const blowActive    = allActiveJobs.filter(j => j.dept === 'extrusion' && j.status === 'ongoing').length
        const printActive   = allActiveJobs.filter(j => j.dept === 'printing'  && j.status === 'ongoing').length
        const blowQueued    = allActiveJobs.filter(j => j.dept === 'extrusion' && j.status === 'queued').length
        const printQueued   = allActiveJobs.filter(j => j.dept === 'printing'  && j.status === 'queued').length
        const blowIdle      = totalBlow  - blowActive
        const printIdle     = totalPrint - printActive
        const totalPlannedQty = allActiveJobs.reduce((s, j) => s + (j.planned_qty ?? 0), 0)
        const totalSOQty      = (orders?.filter(o => ['approved','in_planning','in_production'].includes(o.status)) ?? [])
                                  .reduce((s, o) => s + Math.max(0, o.qty - (o.stock_qty ?? 0)), 0)
        const blowUtil  = totalBlow  > 0 ? Math.round(blowActive  / totalBlow  * 100) : 0
        const printUtil = totalPrint > 0 ? Math.round(printActive / totalPrint * 100) : 0

        const cards = [
          { label: 'SO รอวางแผน',   value: approvedOrders.length, unit: 'ใบ',    color: 'text-sky-300',    bg: 'bg-sky-500/10 border-sky-500/25',    dot: 'bg-sky-400' },
          { label: 'กำลังผลิต',      value: blowActive + printActive, unit: 'เครื่อง', color: 'text-green-300', bg: 'bg-green-500/10 border-green-500/25', dot: 'bg-green-400 animate-pulse' },
          { label: 'คิวรอ',          value: blowQueued + printQueued, unit: 'งาน',   color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/25', dot: 'bg-yellow-400' },
          { label: 'เครื่องว่าง',    value: blowIdle + printIdle,     unit: 'เครื่อง', color: 'text-slate-300',  bg: 'bg-slate-800 border-slate-700',      dot: 'bg-slate-500' },
        ]

        return (
          <div className="space-y-3">
            {/* stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {cards.map(c => (
                <div key={c.label} className={`border rounded-xl px-4 py-4 flex items-center gap-3 ${c.bg}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">{c.label}</p>
                    <p className={`text-2xl font-bold leading-none ${c.color}`}>
                      {c.value}
                      <span className="text-xs font-normal text-slate-400 ml-1">{c.unit}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* machine utilization + planned qty */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {/* Blow utilization */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Wind size={13} className="text-brand-400" />
                    <span className="text-slate-300 text-xs font-semibold">Blow</span>
                  </div>
                  <span className="text-xs text-slate-400">{blowActive}/{totalBlow} เครื่อง</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${blowUtil}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>ผลิต {blowActive} · คิว {blowQueued} · ว่าง {blowIdle}</span>
                  <span className={blowUtil >= 70 ? 'text-green-400 font-bold' : blowUtil >= 40 ? 'text-yellow-400' : 'text-slate-500'}>{blowUtil}%</span>
                </div>
              </div>

              {/* Printing utilization */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Printer size={13} className="text-purple-400" />
                    <span className="text-slate-300 text-xs font-semibold">Printing</span>
                  </div>
                  <span className="text-xs text-slate-400">{printActive}/{totalPrint} เครื่อง</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${printUtil}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>ผลิต {printActive} · คิว {printQueued} · ว่าง {printIdle}</span>
                  <span className={printUtil >= 70 ? 'text-green-400 font-bold' : printUtil >= 40 ? 'text-yellow-400' : 'text-slate-500'}>{printUtil}%</span>
                </div>
              </div>

              {/* ยอดวางแผน vs ยอด SO */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Package size={13} className="text-sky-400" />
                    <span className="text-slate-300 text-xs font-semibold">ยอดที่วางแผน</span>
                  </div>
                  <span className="text-xs text-slate-400">{allActiveJobs.length} งาน</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ width: totalSOQty > 0 ? `${Math.min(100, Math.round(totalPlannedQty / totalSOQty * 100))}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{(totalPlannedQty / 1000).toFixed(1)}t / {(totalSOQty / 1000).toFixed(1)}t</span>
                  <span className="text-sky-400 font-bold">
                    {totalSOQty > 0 ? `${Math.min(100, Math.round(totalPlannedQty / totalSOQty * 100))}%` : '—'}
                  </span>
                </div>
              </div>

              {/* วัตถุดิบที่เบิก */}
              {(() => {
                const totalRaw     = allActiveJobs.reduce((s, j) => s + (j.raw_material_qty ?? 0), 0)
                const totalProdQty = allActiveJobs.reduce((s, j) => s + (j.planned_qty ?? 0), 0)
                const lossQty      = Math.max(0, totalRaw - totalProdQty)
                const yld          = totalRaw > 0 ? Math.round(totalProdQty / totalRaw * 100) : null
                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Cog size={13} className="text-amber-400" />
                        <span className="text-slate-300 text-xs font-semibold">วัตถุดิบที่เบิก</span>
                      </div>
                      {yld !== null && (
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          yld >= 95 ? 'bg-green-500/20 text-green-300' : yld >= 90 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'
                        )}>Yield {yld}%</span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-amber-300 leading-none mb-2">
                      {formatNumber(totalRaw)}
                      <span className="text-xs font-normal text-slate-400 ml-1">kg</span>
                    </p>
                    <div className="flex gap-3 text-[10px] text-slate-500">
                      <span className="text-sky-400">→ ผลิต {formatNumber(totalProdQty)} kg</span>
                      {lossQty > 0 && <span className="text-red-400">สูญเสีย {formatNumber(lossQty)} kg</span>}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

      {/* SO รอวางแผน */}
      {approvedOrders.length > 0 && (
        <div className="rounded-xl border-2 border-sky-400/60 bg-sky-500/5 shadow-[0_0_24px_rgba(56,189,248,0.10)]">
          {/* header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-sky-400/20 rounded-t-xl">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-400/20 shrink-0">
              <Wind size={14} className="text-sky-300 animate-pulse" />
            </div>
            <div>
              <span className="text-sky-200 font-bold text-sm tracking-wide">Sale Orders รอวางแผน</span>
              <span className="ml-2 text-xs bg-sky-400 text-slate-900 font-bold px-2 py-0.5 rounded-full">{approvedOrders.length}</span>
            </div>
            <span className="ml-auto text-sky-400/60 text-xs">กรุณาวางแผนการผลิต</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-400/10">
                  <th className="px-5 py-2.5 text-sky-300/60 text-[10px] font-bold uppercase tracking-wider">SO</th>
                  <th className="px-5 py-2.5 text-sky-300/60 text-[10px] font-bold uppercase tracking-wider">ลูกค้า</th>
                  <th className="px-5 py-2.5 text-sky-300/60 text-[10px] font-bold uppercase tracking-wider">สินค้า</th>
                  <th className="px-5 py-2.5 text-sky-300/60 text-[10px] font-bold uppercase tracking-wider">จำนวน</th>
                  <th className="px-5 py-2.5 text-sky-300/60 text-[10px] font-bold uppercase tracking-wider">ประเภท</th>
                  <th className="px-5 py-2.5 text-sky-300/60 text-[10px] font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedOrders.map(o => (
                  <tr key={o.id} className="border-b border-sky-400/10 hover:bg-sky-400/5 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-sky-200 text-sm font-bold">{o.so_no}</span>
                    </td>
                    <td className="px-5 py-3 max-w-[160px]">
                      <span className="text-slate-300 text-xs truncate block">{o.customer?.name}</span>
                    </td>
                    <td className="px-5 py-3 max-w-[200px]">
                      <span className="text-slate-300 text-xs truncate block">{o.product?.part_name}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-white text-sm font-semibold">{formatNumber(Math.max(0, o.qty - (o.stock_qty ?? 0)))}</span>
                      <span className="text-slate-400 text-xs ml-1">{o.unit}</span>
                      {(o.stock_qty ?? 0) > 0 && (
                        <div className="text-[10px] text-slate-500 mt-0.5">สั่ง {formatNumber(o.qty)} · สต็อก {formatNumber(o.stock_qty!)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {o.product?.type === 'print' || o.product?.type === 'blow_print' || o.job_type === 'ฟิล์มพิมพ์' ? (
                        <span className="flex items-center gap-1 text-purple-300 text-[10px] bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full w-fit">
                          <Printer size={9} /> ฟิล์มพิมพ์
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sky-300 text-[10px] bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full w-fit">
                          <Wind size={9} /> ฟิล์มทั่วไป
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <button
                        onClick={() => { setSelectedOrder(o); setIsGrinding(false); setShowModal(true) }}
                        className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        <Wind size={11} /> ผลิต
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending receipt */}
      {pendingReceipt.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-yellow-400 shrink-0" />
          <span className="text-yellow-300 text-sm">
            มี <strong>{pendingReceipt.length}</strong> งานผลิตเสร็จแล้ว รอรับเข้าคลัง
            {pendingReceipt.map(j => ` · ${j.sale_order?.so_no}`).join('')}
          </span>
        </div>
      )}

      {/* Printing jobs รอคิว (ม้วนพิมที่ extrusion เสร็จแล้ว รอเข้า Printing) */}
      {(() => {
        const prtQueued = jobs?.filter(j => j.dept === 'printing' && (j.status === 'queued' || j.status === 'ongoing')) ?? []
        if (prtQueued.length === 0) return null
        return (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <Printer size={15} className="text-purple-400 shrink-0" />
            <span className="text-purple-300 text-sm">
              มี <strong>{prtQueued.length}</strong> งาน Printing รอดำเนินการ
              {prtQueued.map(j => ` · ${j.sale_order?.so_no}`).join('')}
            </span>
            <span className="ml-auto text-purple-400/60 text-xs">→ ไปหน้า Printing</span>
          </div>
        )
      })()}

      {/* Dept Tab + Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          {(['extrusion','printing'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {tab === 'extrusion' ? <Wind size={15} /> : <Printer size={15} />}
              {tab === 'extrusion' ? 'Blow' : 'Printing'}
              {(() => {
                const pending = allActiveJobs.filter(j => j.dept === tab && j.status === 'queued').length
                return pending > 0 ? (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', activeTab === tab ? 'bg-white/20' : 'bg-yellow-500/30 text-yellow-300')}>
                    {pending}
                  </span>
                ) : null
              })()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-400 font-medium">{stats.producing} ผลิตอยู่</span>
          <span className="text-yellow-400 font-medium">{stats.queued} คิวรอ</span>
          <span className="text-slate-500">{stats.idle} ว่าง</span>
        </div>
      </div>

      {/* Queue panel — งานรอคิวที่ยังไม่มีเครื่อง */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400/60 bg-amber-500/5 shadow-[0_0_24px_rgba(251,191,36,0.12)]">
          {/* header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-amber-400/20 bg-amber-400/8 rounded-t-xl">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-400/20 shrink-0">
              <Clock size={14} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <span className="text-amber-200 font-bold text-sm tracking-wide">รอวางแผน — ยังไม่มีเครื่อง</span>
              <span className="ml-2 text-xs bg-amber-400 text-slate-900 font-bold px-2 py-0.5 rounded-full">{unassigned.length}</span>
            </div>
            <span className="ml-auto text-amber-400/60 text-xs">กรุณา Assign เครื่องให้งานด้านล่าง</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-400/10">
                  <th className="px-5 py-2.5 text-amber-300/60 text-[10px] font-bold uppercase tracking-wider">SO</th>
                  <th className="px-5 py-2.5 text-amber-300/60 text-[10px] font-bold uppercase tracking-wider">ลูกค้า</th>
                  <th className="px-5 py-2.5 text-amber-300/60 text-[10px] font-bold uppercase tracking-wider">สินค้า</th>
                  <th className="px-5 py-2.5 text-amber-300/60 text-[10px] font-bold uppercase tracking-wider">Lot</th>
                  <th className="px-5 py-2.5 text-amber-300/60 text-[10px] font-bold uppercase tracking-wider">จำนวน</th>
                  <th className="px-5 py-2.5 text-amber-300/60 text-[10px] font-bold uppercase tracking-wider">ส่งต่อ</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {unassigned.map(j => (
                  <tr key={j.id} className="border-b border-amber-400/10 hover:bg-amber-400/5 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-amber-200 text-sm font-bold">{j.sale_order?.so_no}</span>
                    </td>
                    <td className="px-5 py-3 max-w-[160px]">
                      <span className="text-slate-300 text-xs truncate block">{j.sale_order?.customer?.name}</span>
                    </td>
                    <td className="px-5 py-3 max-w-[200px]">
                      <span className="text-slate-300 text-xs truncate block">{j.sale_order?.product?.part_name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-slate-500 text-[10px] font-mono">{j.lot_no}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-white text-sm font-semibold">{j.planned_qty?.toLocaleString()}</span>
                      <span className="text-slate-400 text-xs ml-1">kg</span>
                    </td>
                    <td className="px-5 py-3">
                      {j.route_after === 'to_printing' && (
                        <span className="flex items-center gap-1 text-purple-300 text-[10px] bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full w-fit">
                          <Printer size={9} /> → Printing
                        </span>
                      )}
                      {j.route_after === 'to_warehouse' && (
                        <span className="flex items-center gap-1 text-yellow-300 text-[10px] bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 rounded-full w-fit">
                          <Package size={9} /> → คลัง
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleCancelJob(j)}
                        className="text-rose-400 text-[10px] px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Machine Tables */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 animate-pulse">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      ) : activeTab === 'extrusion' ? (
        <div className="space-y-4">
          <MachineTable label="Stretch Film" machines={SF_MACHINES} {...tableProps} />
          <MachineTable label="Blow Machines" machines={BLOW_MACHINES} {...tableProps} />
        </div>
      ) : (
        <MachineTable label="Printing Machines" machines={PRINTING_MACHINES} {...tableProps} />
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">แก้ไขงาน — {editingJob.sale_order?.so_no}</h2>
              <button onClick={() => setEditingJob(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">วัตถุดิบที่เบิก (kg)</label>
                <input
                  type="number"
                  value={editRawQty}
                  onChange={e => setEditRawQty(e.target.value)}
                  placeholder="เช่น 5,200"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
                {editRawQty && editQty && (
                  <p className="text-xs text-slate-500 mt-1">
                    Yield คาด: {Math.round(parseFloat(editQty) / parseFloat(editRawQty) * 100)}%
                    · สูญเสีย {(parseFloat(editRawQty) - parseFloat(editQty)).toLocaleString()} kg
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">จำนวนที่วางแผน (kg)</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">ส่งต่อ</label>
                <select
                  value={editRoute}
                  onChange={e => setEditRoute(e.target.value as RouteAfter | '')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                >
                  <option value="">— ไม่ระบุ —</option>
                  <option value="to_printing">→ Printing</option>
                  <option value="to_warehouse">→ คลัง</option>
                  <option value="to_grinding">→ Grinding</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={() => setEditingJob(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm">ยกเลิก</button>
              <button
                onClick={handleSaveEdit}
                disabled={updateJob.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                {updateJob.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <h2 className="text-white font-semibold">
                {selectedOrder ? 'ยืนยันแผนการผลิต' : machineForCreate ? `เพิ่มงานให้ ${machineForCreate}` : 'วางแผนใหม่'}
              </h2>
              <button onClick={() => { setShowModal(false); setSelectedOrder(null); setMachineForCreate(null); setCreateStockQty('') }} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto scrollbar-thin flex-1 p-5 space-y-4">
              {selectedOrder ? (
                <>
                  <SODetail so={selectedOrder} />

                  {/* ── ยอดสั่งผลิต — ผู้วางแผนกรอก stock_qty ── */}
                  {(() => {
                    const stockNum  = createStockQty !== '' ? (parseFloat(createStockQty) || 0) : (selectedOrder.stock_qty ?? 0)
                    const prodQtyCalc = Math.max(0, selectedOrder.qty - stockNum)
                    return (
                      <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-slate-400 mb-1">ลูกค้าสั่ง</p>
                            <p className="text-white font-bold text-base">{selectedOrder.qty.toLocaleString()} <span className="text-slate-400 text-xs font-normal">{selectedOrder.unit}</span></p>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">สต็อกที่มีอยู่ <span className="text-slate-500">(กรอกโดยผู้วางแผน)</span></label>
                            <input
                              type="number"
                              value={createStockQty}
                              onChange={e => setCreateStockQty(e.target.value)}
                              placeholder={selectedOrder.stock_qty?.toString() ?? '0'}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                            />
                          </div>
                        </div>
                        <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm font-semibold ${prodQtyCalc === 0 ? 'bg-green-500/10 border border-green-500/25' : 'bg-yellow-500/10 border border-yellow-500/25'}`}>
                          <span className={prodQtyCalc === 0 ? 'text-green-300' : 'text-yellow-300'}>ต้องผลิต</span>
                          <span className={prodQtyCalc === 0 ? 'text-green-200' : 'text-yellow-200'}>{prodQtyCalc.toLocaleString()} {selectedOrder.unit}</span>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="bg-slate-800 rounded-lg px-4 py-3 space-y-2">
                    <div>
                      {(() => {
                        const stockNum = createStockQty !== '' ? (parseFloat(createStockQty) || 0) : (selectedOrder.stock_qty ?? 0)
                        const prodQty  = Math.max(0, selectedOrder.qty - stockNum)
                        const tol    = getRawTolerance(selectedOrder)
                        const maxRaw = prodQty * (1 + tol)
                        const rawNum = parseFloat(createRawQty) || 0
                        const isOver = createRawQty !== '' && rawNum > maxRaw
                        const typeName = (selectedOrder.product?.type === 'print' || selectedOrder.product?.type === 'blow_print' || selectedOrder.job_type === 'ฟิล์มพิมพ์') ? 'ม้วนพิมพ์' : 'ม้วนใส'
                        return (
                          <>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-slate-400">วัตถุดิบที่เบิก (kg) <span className="text-red-400">*</span></label>
                              <span className="text-[10px] text-slate-500">{typeName} เบิกได้ไม่เกิน +{(tol * 100).toFixed(0)}% · สูงสุด {maxRaw.toLocaleString('th', { maximumFractionDigits: 0 })} kg</span>
                            </div>
                            <input
                              type="number"
                              value={createRawQty}
                              onChange={e => setCreateRawQty(e.target.value)}
                              placeholder={`ผลิต: ${prodQty.toLocaleString()} kg — เบิกมากกว่า`}
                              className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500 ${
                                isOver ? 'border-red-500' : !createRawQty ? 'border-red-500/60' : 'border-slate-600'
                              }`}
                            />
                            {!createRawQty && <p className="text-red-400 text-xs mt-1">จำเป็นต้องกรอก</p>}
                            {isOver && (
                              <p className="text-red-400 text-xs mt-1 font-medium">
                                เกินกำหนด! เบิกได้สูงสุด {maxRaw.toLocaleString('th', { maximumFractionDigits: 0 })} kg (+{(tol * 100).toFixed(0)}%)
                              </p>
                            )}
                            {createRawQty && !isOver && rawNum > 0 && (
                              <p className="text-xs text-slate-500 mt-1">
                                Yield คาด: {Math.round(prodQty / rawNum * 100)}%
                                · สูญเสีย {(rawNum - prodQty).toLocaleString('th', { maximumFractionDigits: 0 })} kg
                              </p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg px-4 py-3 space-y-1">
                    <p className="text-slate-400 text-xs">ประเภทงาน</p>
                    {isGrinding ? (
                      <div className="flex items-center gap-2 text-orange-300 text-sm font-medium">
                        <Cog size={14} /> Grinding
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Wind size={14} className="text-brand-400" />
                        <span className="text-white">Blow</span>
                        <span className="text-slate-500">→</span>
                        {getRouteAfter(selectedOrder) === 'to_printing' ? (
                          <span className="flex items-center gap-1 text-purple-300"><Printer size={13} /> Printing → คลัง</span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-300"><Package size={13} /> คลัง</span>
                        )}
                      </div>
                    )}
                    <p className="text-slate-500 text-xs">
                      {isGrinding ? 'สร้างงาน Grinding' : getRouteAfter(selectedOrder) === 'to_printing'
                        ? `product type: ${selectedOrder.product?.type} — ส่งต่อ Printing อัตโนมัติ`
                        : `product type: ${selectedOrder.product?.type} — ส่งเข้าคลังโดยตรง`}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {machineForCreate && (
                    <p className="text-slate-300 text-sm">เพิ่มงานเข้าเครื่อง <span className="font-semibold text-white">{machineForCreate}</span></p>
                  )}

                  {unassigned.length > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-2 flex items-center gap-1"><Clock size={11} /> งานในคิวรอ</p>
                      <div className="space-y-2">
                        {unassigned.map(j => (
                          <div key={j.id} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium">{j.sale_order?.so_no}</p>
                              <p className="text-slate-400 text-xs truncate">{j.sale_order?.customer?.name} · {j.sale_order?.product?.part_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-slate-500 text-xs font-mono">{j.lot_no}</span>
                                <span className="text-slate-400 text-xs">{j.planned_qty?.toLocaleString()} kg</span>
                                {j.route_after === 'to_printing' && (
                                  <span className="flex items-center gap-0.5 text-purple-300 text-[10px] bg-purple-500/10 px-1.5 py-0.5 rounded">
                                    <Printer size={9} /> → Printing
                                  </span>
                                )}
                                {j.route_after === 'to_warehouse' && (
                                  <span className="flex items-center gap-0.5 text-yellow-300 text-[10px] bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                    <Package size={9} /> → คลัง
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (!machineForCreate) return
                                await assignMachine.mutateAsync({ id: j.id, machine_no: machineForCreate })
                                setShowModal(false)
                                setMachineForCreate(null)
                              }}
                              disabled={assignMachine.isPending}
                              className="shrink-0 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Assign
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SO สำหรับ extrusion (approved เท่านั้น) */}
                  {!isGrinding && approvedOrders.length > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-2">Sale Orders รอวางแผน</p>
                      <div className="space-y-3">
                        {approvedOrders.map(o => (
                          <div key={o.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <SODetail so={o} />
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => { setSelectedOrder(o); setIsGrinding(false) }}
                                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
                              >
                                <Wind size={11} className="inline mr-1" /> Blow
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SO สำหรับ grinding — รวม in_production ด้วย (ม้วนเสียจากสายผลิต) */}
                  {isGrinding && grindableOrders.length > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-2">เลือก SO สำหรับงาน Grinding</p>
                      <div className="space-y-3">
                        {grindableOrders.map(o => (
                          <div key={o.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                            <SODetail so={o} />
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                o.status === 'approved' ? 'bg-blue-500/15 text-blue-300' :
                                o.status === 'in_production' ? 'bg-green-500/15 text-green-300' :
                                'bg-slate-700 text-slate-400'
                              }`}>{o.status}</span>
                              <button
                                onClick={() => setSelectedOrder(o)}
                                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Cog size={11} className="inline mr-1" /> เลือก
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {unassigned.length === 0 && approvedOrders.length === 0 && (
                    <div className="text-slate-400 text-sm text-center py-4">ไม่มีงานรอวางแผน</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-slate-800 shrink-0">
              <button
                onClick={() => { setShowModal(false); setSelectedOrder(null); setMachineForCreate(null); setCreateStockQty('') }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm"
              >ยกเลิก</button>
              {selectedOrder ? (() => {
                const stockNum_ = createStockQty !== '' ? (parseFloat(createStockQty) || 0) : (selectedOrder.stock_qty ?? 0)
                const prodQty  = Math.max(0, selectedOrder.qty - stockNum_)
                const tol_     = getRawTolerance(selectedOrder)
                const maxRaw   = prodQty * (1 + tol_)
                const rawNum   = parseFloat(createRawQty) || 0
                const isRawOver = !isGrinding && createRawQty !== '' && rawNum > maxRaw
                return (
                <button
                  onClick={() => handleCreateJob(isGrinding)}
                  disabled={createJob.isPending || (!isGrinding && !createRawQty) || isRawOver}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {createJob.isPending ? 'กำลังสร้าง...' : 'สร้างแผนการผลิต'}
                </button>
                )
              })() : (
                <button disabled className="flex-1 bg-slate-700 text-slate-500 py-2.5 rounded-lg text-sm font-medium">
                  เลือก SO ก่อน
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
