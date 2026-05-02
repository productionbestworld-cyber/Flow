import { useState } from 'react'
import { X, PackagePlus, CheckCircle, ClipboardList, Truck, Wind, Printer } from 'lucide-react'
import { useWarehouseStock, useReceiveToStock } from '../hooks/useWarehouse'
import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import { useRequisitions, useApproveRequisition, useDispatchRequisition, useCancelRequisition } from '../hooks/useSales'
import { useAuth } from '../lib/AuthContext'
import { formatDate, formatNumber } from '../lib/utils'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import type { PlanningJob, Requisition } from '../types'

export default function Warehouse() {
  const { user } = useAuth()
  const { data: stock, isLoading: stockLoading } = useWarehouseStock()
  const { data: jobs } = usePlanningJobs()
  const { data: logs } = useProductionLogs()
  const { data: reqs } = useRequisitions()
  const receive     = useReceiveToStock()
  const approveReq  = useApproveRequisition()
  const dispatchReq = useDispatchRequisition()
  const cancelReq   = useCancelRequisition()

  const [receiveModal, setReceiveModal] = useState<PlanningJob | null>(null)
  const [location, setLocation] = useState('')
  const [dispatchModal, setDispatchModal] = useState<Requisition | null>(null)
  const [supplements, setSupplements] = useState<{ stock_id: string; qty: number; label: string }[]>([])
  const [suppStockId, setSuppStockId] = useState('')
  const [suppQty, setSuppQty] = useState('')
  const [manualQty, setManualQty] = useState('')

  // แสดงแค่ job สุดท้ายต่อ SO (printing > extrusion — ไม่รวม grinding)
  const allPendingReceipt = jobs?.filter(j => j.status === 'pending_receipt' && j.dept !== 'grinding') ?? []
  const pendingReceiptBySo = Object.values(
    allPendingReceipt.reduce<Record<string, PlanningJob>>((acc, j) => {
      const existing = acc[j.sale_order_id]
      if (!existing || j.dept === 'printing') acc[j.sale_order_id] = j
      return acc
    }, {})
  )
  const goodStock      = stock?.filter(s => s.condition === 'good') ?? []
  const pendingReqs    = reqs?.filter(r => r.status === 'pending') ?? []
  const approvedReqs   = reqs?.filter(r => r.status === 'approved') ?? []
  const dispatchedReqs = reqs?.filter(r => r.status === 'dispatched') ?? []
  const totalQty       = goodStock.reduce((sum, s) => sum + s.qty, 0)

  // ดึง production summary แยกตาม dept ของ SO
  function getSoProductionSummary(soId: string) {
    const soJobs = jobs?.filter(j => j.sale_order_id === soId) ?? []
    const getJobLog = (jobId: string) => logs?.find(l => l.planning_job_id === jobId)

    const extJob  = soJobs.find(j => j.dept === 'extrusion')
    const grdJobs = soJobs.filter(j => j.dept === 'grinding')
    const prtJob  = soJobs.find(j => j.dept === 'printing')

    const extLog  = extJob  ? getJobLog(extJob.id)  : undefined
    const grdLogs = grdJobs.map(j => ({ job: j, log: getJobLog(j.id) }))
    const prtLog  = prtJob  ? getJobLog(prtJob.id)  : undefined

    const ext = {
      rawMaterial: extJob?.raw_material_qty,
      goodQty:     extLog?.good_qty,
      goodRolls:   extLog?.good_rolls,
      badQty:      extLog?.bad_qty   ?? 0,
      badRolls:    extLog?.bad_rolls  ?? 0,
      wasteQty:    extLog?.waste_qty  ?? 0,
    }
    const grd = grdLogs.length > 0 ? {
      inputQty:  grdJobs.reduce((s, j) => s + (j.planned_qty ?? 0), 0),
      goodQty:   grdLogs.reduce((s, g) => s + (g.log?.good_qty  ?? 0), 0),
      goodRolls: grdLogs.reduce((s, g) => s + (g.log?.good_rolls ?? 0), 0),
      wasteQty:  grdLogs.reduce((s, g) => s + (g.log?.waste_qty  ?? 0), 0),
    } : null
    // printing รับ = ม้วนดีจากเป่า + ที่กรอคืนมา
    const prtInputQty = (ext.goodQty ?? 0) + (grd?.goodQty ?? 0) || prtJob?.planned_qty ?? 0
    const prt = prtJob ? {
      inputQty:  prtInputQty,
      goodQty:   prtLog?.good_qty,
      goodRolls: prtLog?.good_rolls,
      wasteQty:  prtLog?.waste_qty ?? 0,
    } : null

    // bad_qty ไม่ใช่ loss — ถูกส่งไป grinding แล้วกลับมาเป็นของดี
    // loss จริง = เศษเป่า + เศษกรอ + เศษพิม
    const totalLoss = (ext.wasteQty) + (grd?.wasteQty ?? 0) + (prt?.wasteQty ?? 0)
    return { ext, grd, prt, totalLoss }
  }

  function getLastLog(jobId: string) {
    return logs?.find(l => l.planning_job_id === jobId)
  }

  function openReceive(j: PlanningJob) {
    setReceiveModal(j)
    setLocation('')
  }

  async function handleReceive() {
    if (!receiveModal) return
    const job = receiveModal
    const { ext, grd, prt } = getSoProductionSummary(job.sale_order_id)
    // ยอดรับ = input พิม - เศษพิม → good_qty พิม → (good เป่า + กรอคืน) → planned_qty
    const prtCalcQty = prt ? (prt.inputQty - prt.wasteQty) : undefined
    const qty = prtCalcQty ?? prt?.goodQty
      ?? ((ext.goodQty ?? 0) + (grd?.goodQty ?? 0) || job.planned_qty)
    await receive.mutateAsync({
      planning_job_id: job.id,
      lot_no:          job.lot_no ?? '',
      product_id:      job.sale_order?.product_id ?? '',
      qty,
      unit:            job.sale_order?.unit ?? 'kg',
      location:        location || undefined,
      received_by:     user?.id,
    })
    setReceiveModal(null)
    setLocation('')
  }

  async function handleApproveReq(id: string) {
    if (!user || !confirm('อนุมัติใบเบิกนี้?')) return
    await approveReq.mutateAsync({ id, approved_by: user.id })
  }

  function openDispatchModal(r: Requisition) {
    setDispatchModal(r)
    setSuppStockId('')
    setSuppQty('')
    setManualQty('')

    // ถ้าเป็นใบเบิกส่วนสต็อก → auto-รวม production lot + ยอดสต็อกจาก SO
    const rItems: { stock_id: string; qty: number }[] = (r as any).items ?? []
    const isStockPortion = rItems.some(i => i.stock_id === '__stock_portion__')
    if (isStockPortion) {
      const autoSupps: { stock_id: string; qty: number; label: string }[] = []

      // 1. production lot ของ SO เดียวกัน (อยู่ใน warehouse_stock จริง)
      const soJobIds = new Set((jobs ?? []).filter(j => j.sale_order_id === r.sale_order_id).map(j => j.id))
      const prodLots = (stock ?? []).filter(s => s.planning_job_id && soJobIds.has(s.planning_job_id))
      prodLots.forEach(s => autoSupps.push({ stock_id: s.id, qty: s.qty, label: s.lot_no }))

      // 2. ยอดสต็อกที่กรอกไว้ใน SO (ไม่ได้อยู่ในระบบ — manual, แยกจาก production lot)
      const soStockQty = (r.sale_order as any)?.stock_qty
      if (soStockQty && soStockQty > 0) {
        autoSupps.push({ stock_id: `manual-stock-${r.id}`, qty: soStockQty, label: `สต็อกเดิมตาม SO (${soStockQty.toLocaleString()} kg)` })
      }

      setSupplements(autoSupps)
    } else {
      setSupplements([])
    }
  }

  function addStockSupplement() {
    if (!suppStockId || !suppQty || parseFloat(suppQty) <= 0) return
    const st = goodStock.find(s => s.id === suppStockId)
    setSupplements(prev => [...prev.filter(s => s.stock_id !== suppStockId), { stock_id: suppStockId, qty: parseFloat(suppQty), label: st?.lot_no ?? suppStockId }])
    setSuppStockId('')
    setSuppQty('')
  }

  function addManualSupplement() {
    const qty = parseFloat(manualQty)
    if (!qty || qty <= 0) return
    const fakeId = `manual-${Date.now()}`
    setSupplements(prev => [...prev, { stock_id: fakeId, qty, label: `เติมเพิ่ม ${qty} kg` }])
    setManualQty('')
  }

  async function handleDispatchConfirm() {
    if (!dispatchModal) return
    // กรองเฉพาะ real stock_id (ไม่ใช่ manual-)
    const realExtras = supplements.filter(s => !s.stock_id.startsWith('manual-'))
    await dispatchReq.mutateAsync({ id: dispatchModal.id, extraItems: realExtras.length > 0 ? realExtras : undefined })
    setDispatchModal(null)
    setSupplements([])
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">คลังสินค้า</h1>
        <p className="text-slate-400 text-sm mt-0.5">รับสินค้าเข้าคลัง อนุมัติใบเบิก และดูสต็อกปัจจุบัน</p>
      </div>

      {/* Summary */}
      {(() => {
        // แยกสต็อกตามประเภทสินค้า
        const printStock = goodStock.filter(s => {
          const ptype = s.planning_job?.sale_order?.product?.type
          const jtype = s.planning_job?.sale_order?.job_type
          return ptype === 'print' || ptype === 'blow_print' || jtype === 'ฟิล์มพิมพ์' || s.lot_no.startsWith('PRI-')
        })
        const blowStock  = goodStock.filter(s => !printStock.includes(s))
        const printQty   = printStock.reduce((sum, s) => sum + s.qty, 0)
        const blowQty    = blowStock.reduce((sum, s) => sum + s.qty, 0)
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-400 text-xs">สต็อกรวม</p>
              <p className="text-2xl font-bold text-white mt-1">{formatNumber(totalQty)}</p>
              <p className="text-slate-500 text-[10px] mt-1">kg · {goodStock.length} Lot</p>
            </div>
            <div className="bg-slate-900 border border-brand-500/20 rounded-xl p-4">
              <p className="text-slate-400 text-xs flex items-center gap-1"><Wind size={11} /> ม้วนใส</p>
              <p className="text-2xl font-bold text-brand-300 mt-1">{formatNumber(blowQty)}</p>
              <p className="text-slate-500 text-[10px] mt-1">kg · {blowStock.length} Lot</p>
            </div>
            <div className="bg-slate-900 border border-purple-500/20 rounded-xl p-4">
              <p className="text-slate-400 text-xs flex items-center gap-1"><Printer size={11} /> ม้วนพิมพ์</p>
              <p className="text-2xl font-bold text-purple-300 mt-1">{formatNumber(printQty)}</p>
              <p className="text-slate-500 text-[10px] mt-1">kg · {printStock.length} Lot</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-400 text-xs">รอรับ / ใบเบิกรอ</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{pendingReceiptBySo.length}</p>
              <p className="text-slate-500 text-[10px] mt-1">รับ · {pendingReqs.length} ใบเบิก</p>
            </div>
          </div>
        )
      })()}

      {/* Requisitions รออนุมัติจากคลัง */}
      {pendingReqs.length > 0 && (
        <div className="bg-slate-900 border border-orange-500/20 rounded-xl">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
            <ClipboardList size={16} className="text-orange-400" />
            <span className="text-white font-medium text-sm">ใบเบิกรออนุมัติจากคลัง</span>
            <span className="ml-auto bg-orange-500/20 text-orange-300 text-xs px-2 py-0.5 rounded-full">{pendingReqs.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {pendingReqs.map(r => {
              const rItems: { stock_id: string; qty: number }[] = (r as any).items ?? []
              const stockPart = rItems.find(i => i.stock_id === '__stock_portion__')
              const dispQty = (() => {
                if (!stockPart) {
                  // ใช้ยอดจาก items จริง ถ้ามี
                  const realItems = rItems.filter((i: any) => !i.stock_id.startsWith('manual-'))
                  if (realItems.length > 0) return realItems.reduce((s: number, i: any) => s + (i.qty ?? 0), 0)
                  return r.sale_order?.qty ?? 0
                }
                const soJobIds = new Set((jobs ?? []).filter(j => j.sale_order_id === r.sale_order_id).map(j => j.id))
                const prodTotal = (stock ?? []).filter(s => s.planning_job_id && soJobIds.has(s.planning_job_id)).reduce((sum, s) => sum + s.qty, 0)
                const soStockQty = (r.sale_order as any)?.stock_qty ?? 0
                return prodTotal + soStockQty
              })()
              const { ext, grd, prt, totalLoss } = stockPart ? getSoProductionSummary(r.sale_order_id) : { ext: {} as any, grd: null, prt: null, totalLoss: 0 }
              const soStockQty  = (r.sale_order as any)?.stock_qty ?? 0
              const unit        = r.sale_order?.unit ?? 'kg'
              return (
                <div key={r.id} className="px-5 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{r.sale_order?.so_no}</p>
                        {stockPart && <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-1.5 py-0.5 rounded">ส่วนสต็อก</span>}
                      </div>
                      <p className="text-slate-400 text-xs">{r.sale_order?.customer?.name}</p>
                      <p className="text-slate-500 text-xs">{r.sale_order?.product?.part_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{formatNumber(dispQty)} {unit}</span>
                      <span className="text-slate-500 text-xs">{formatDate(r.created_at)}</span>
                      {stockPart && (
                        <button
                          onClick={() => { if (confirm('ยกเลิกใบเบิกนี้?')) cancelReq.mutate(r.id) }}
                          className="text-red-400 text-xs px-2 py-1.5 rounded hover:bg-red-500/10 transition-colors"
                        >
                          ยกเลิก
                        </button>
                      )}
                      <button
                        onClick={() => handleApproveReq(r.id)}
                        disabled={approveReq.isPending}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <CheckCircle size={13} /> อนุมัติ
                      </button>
                    </div>
                  </div>

                  {/* Production breakdown */}
                  {stockPart && (
                    <div className="bg-slate-800/60 rounded-lg px-4 py-2.5 text-xs space-y-1">
                      <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-slate-700">
                        <div><p className="text-slate-500">ลูกค้าสั่ง</p><p className="text-white font-bold">{formatNumber(r.sale_order?.qty ?? 0)} {unit}</p></div>
                        <div><p className="text-green-500">สต็อกเดิม</p><p className="text-green-300 font-bold">{formatNumber(soStockQty)} {unit}</p></div>
                        <div><p className="text-yellow-500">ผลิตได้จริง</p><p className="text-yellow-300 font-bold">{formatNumber(dispQty - soStockQty)} {unit}</p></div>
                      </div>
                      {ext.rawMaterial != null && <div className="flex justify-between text-slate-400"><span>วัตถุดิบเบิก</span><span>{formatNumber(ext.rawMaterial)} {unit}</span></div>}
                      {ext.goodQty   != null && <div className="flex justify-between"><span className="text-green-400">✓ เป่าได้{ext.goodRolls ? ` ${ext.goodRolls} ม้วน` : ''}</span><span className="text-green-300">{formatNumber(ext.goodQty)} {unit}</span></div>}
                      {ext.badQty > 0 && <div className="flex justify-between text-slate-500"><span>⚙ กรอคืน</span><span>+{formatNumber(grd?.goodQty ?? 0)} {unit}</span></div>}
                      {ext.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษเป่า</span><span>{formatNumber(ext.wasteQty)} {unit}</span></div>}
                      {grd?.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษกรอ</span><span>{formatNumber(grd.wasteQty)} {unit}</span></div>}
                      {prt && <div className="flex justify-between"><span className="text-purple-400">🖨 พิมพ์ได้{prt.goodRolls ? ` ${prt.goodRolls} ม้วน` : ''}</span><span className="text-green-300">{formatNumber(prt.goodQty ?? 0)} {unit}</span></div>}
                      {prt?.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษพิม</span><span>{formatNumber(prt.wasteQty)} {unit}</span></div>}
                      {totalLoss > 0 && <div className="flex justify-between text-red-400 border-t border-slate-700 pt-1 font-medium"><span>รวมเสีย</span><span>{formatNumber(totalLoss)} {unit}</span></div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Approved requisitions — รอปล่อยของ */}
      {approvedReqs.length > 0 && (
        <div className="bg-slate-900 border border-blue-500/20 rounded-xl">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
            <Truck size={16} className="text-blue-400" />
            <span className="text-white font-medium text-sm">รออนุมัติปล่อยของ</span>
            <span className="ml-auto bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">{approvedReqs.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {approvedReqs.map(r => {
              const rItems: { stock_id: string; qty: number }[] = (r as any).items ?? []
              const stockPart = rItems.find(i => i.stock_id === '__stock_portion__')
              const dispQty = (() => {
                if (!stockPart) {
                  // ใช้ยอดจาก items จริง ถ้ามี
                  const realItems = rItems.filter((i: any) => !i.stock_id.startsWith('manual-'))
                  if (realItems.length > 0) return realItems.reduce((s: number, i: any) => s + (i.qty ?? 0), 0)
                  return r.sale_order?.qty ?? 0
                }
                const soJobIds = new Set((jobs ?? []).filter(j => j.sale_order_id === r.sale_order_id).map(j => j.id))
                const prodTotal = (stock ?? []).filter(s => s.planning_job_id && soJobIds.has(s.planning_job_id)).reduce((sum, s) => sum + s.qty, 0)
                const soStockQty = (r.sale_order as any)?.stock_qty ?? 0
                return prodTotal + soStockQty
              })()
              const { ext, grd, prt, totalLoss } = stockPart ? getSoProductionSummary(r.sale_order_id) : { ext: {} as any, grd: null, prt: null, totalLoss: 0 }
              const soStockQty  = (r.sale_order as any)?.stock_qty ?? 0
              const unit        = r.sale_order?.unit ?? 'kg'
              return (
                <div key={r.id} className="px-5 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{r.sale_order?.so_no}</p>
                        {stockPart && <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-1.5 py-0.5 rounded">ส่วนสต็อก</span>}
                      </div>
                      <p className="text-slate-400 text-xs">{r.sale_order?.customer?.name}</p>
                      <p className="text-slate-500 text-xs">{r.sale_order?.product?.part_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{formatNumber(dispQty)} {unit}</span>
                      <span className="text-slate-500 text-xs">{formatDate(r.created_at)}</span>
                      {stockPart && (
                        <button
                          onClick={() => { if (confirm('ยกเลิกใบเบิกนี้?')) cancelReq.mutate(r.id) }}
                          className="text-red-400 text-xs px-2 py-1.5 rounded hover:bg-red-500/10 transition-colors"
                        >
                          ยกเลิก
                        </button>
                      )}
                      <button
                        onClick={() => openDispatchModal(r)}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Truck size={13} /> ปล่อยของ
                      </button>
                    </div>
                  </div>

                  {/* Production breakdown */}
                  {stockPart && (
                    <div className="bg-slate-800/60 rounded-lg px-4 py-2.5 text-xs space-y-1">
                      <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-slate-700">
                        <div><p className="text-slate-500">ลูกค้าสั่ง</p><p className="text-white font-bold">{formatNumber(r.sale_order?.qty ?? 0)} {unit}</p></div>
                        <div><p className="text-green-500">สต็อกเดิม</p><p className="text-green-300 font-bold">{formatNumber(soStockQty)} {unit}</p></div>
                        <div><p className="text-yellow-500">ผลิตได้จริง</p><p className="text-yellow-300 font-bold">{formatNumber(dispQty - soStockQty)} {unit}</p></div>
                      </div>
                      {ext.rawMaterial != null && <div className="flex justify-between text-slate-400"><span>วัตถุดิบเบิก</span><span>{formatNumber(ext.rawMaterial)} {unit}</span></div>}
                      {ext.goodQty   != null && <div className="flex justify-between"><span className="text-green-400">✓ เป่าได้{ext.goodRolls ? ` ${ext.goodRolls} ม้วน` : ''}</span><span className="text-green-300">{formatNumber(ext.goodQty)} {unit}</span></div>}
                      {ext.badQty > 0 && <div className="flex justify-between text-slate-500"><span>⚙ กรอคืน</span><span>+{formatNumber(grd?.goodQty ?? 0)} {unit}</span></div>}
                      {ext.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษเป่า</span><span>{formatNumber(ext.wasteQty)} {unit}</span></div>}
                      {grd?.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษกรอ</span><span>{formatNumber(grd.wasteQty)} {unit}</span></div>}
                      {prt && <div className="flex justify-between"><span className="text-purple-400">🖨 พิมพ์ได้{prt.goodRolls ? ` ${prt.goodRolls} ม้วน` : ''}</span><span className="text-green-300">{formatNumber(prt.goodQty ?? 0)} {unit}</span></div>}
                      {prt?.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษพิม</span><span>{formatNumber(prt.wasteQty)} {unit}</span></div>}
                      {totalLoss > 0 && <div className="flex justify-between text-red-400 border-t border-slate-700 pt-1 font-medium"><span>รวมเสีย</span><span>{formatNumber(totalLoss)} {unit}</span></div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending receipt (รับสินค้าจากผลิต) */}
      {pendingReceiptBySo.length > 0 && (
        <div className="bg-slate-900 border border-yellow-500/20 rounded-xl">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
            <PackagePlus size={16} className="text-yellow-400" />
            <span className="text-white font-medium text-sm">รับสินค้าจากผลิต</span>
          </div>
          <div className="divide-y divide-slate-800">
            {pendingReceiptBySo.map(j => {
              const soId    = j.sale_order_id
              const soPlanned = j.sale_order?.qty ?? j.planned_qty
              const { ext, grd, prt, totalLoss } = getSoProductionSummary(soId)
              const finalGoodQty   = prt?.goodQty ?? ((ext.goodQty ?? 0) + (grd?.goodQty ?? 0)) || j.planned_qty
              const extRolls = (ext.goodRolls ?? 0) + (grd?.goodRolls ?? 0)
              const finalGoodRolls = prt?.goodRolls ?? (extRolls > 0 ? extRolls : undefined)
              return (
                <div key={j.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white text-sm font-medium">{j.sale_order?.so_no}</p>
                      <p className="text-slate-400 text-xs">{j.sale_order?.product?.part_name} · Lot: {j.lot_no}</p>
                      <p className="text-slate-500 text-xs">{j.dept} · {j.machine_no}</p>
                    </div>
                    <button
                      onClick={() => openReceive(j)}
                      className="shrink-0 bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      รับเข้าคลัง
                    </button>
                  </div>

                  {/* Production chain breakdown */}
                  <div className="bg-slate-800/50 rounded-lg p-3 space-y-2 text-xs">
                    {/* Header */}
                    <div className="flex justify-between text-slate-400 pb-1 border-b border-slate-700">
                      <span>SO วางแผน</span>
                      <span className="text-white font-medium">{formatNumber(soPlanned)} kg{ext.rawMaterial ? ` · วัตถุดิบ ${formatNumber(ext.rawMaterial)} kg` : ''}</span>
                    </div>

                    {/* Extrusion */}
                    {ext.goodQty !== undefined && (
                      <div className="space-y-0.5">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">Extrusion</p>
                        <div className="flex justify-between">
                          <span className="text-green-400">✓ ม้วนดี{ext.goodRolls ? ` ${ext.goodRolls} ม้วน` : ''}</span>
                          <span className="text-green-300">{formatNumber(ext.goodQty)} kg</span>
                        </div>
                        {ext.badQty > 0 && (
                          <div className="flex justify-between text-slate-500">
                            <span>⚙ ม้วนเสีย {ext.badRolls} ม้วน → Grinding (กรอคืนแล้ว)</span>
                            <span>{formatNumber(ext.badQty)} kg</span>
                          </div>
                        )}
                        {ext.wasteQty > 0 && (
                          <div className="flex justify-between text-red-400">
                            <span>✗ เศษเป่า</span>
                            <span>{formatNumber(ext.wasteQty)} kg</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grinding */}
                    {grd && grd.inputQty > 0 && (
                      <div className="space-y-0.5 border-t border-slate-700/50 pt-2">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">Grinding</p>
                        <div className="flex justify-between">
                          <span className="text-slate-400">รับมา {formatNumber(grd.inputQty)} kg → กรอได้{grd.goodRolls ? ` ${grd.goodRolls} ม้วน` : ''}</span>
                          <span className="text-green-300">{formatNumber(grd.goodQty)} kg</span>
                        </div>
                        {grd.wasteQty > 0 && (
                          <div className="flex justify-between text-red-400">
                            <span>✗ เศษสแคป</span>
                            <span>{formatNumber(grd.wasteQty)} kg</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Printing */}
                    {prt && (
                      <div className="space-y-0.5 border-t border-slate-700/50 pt-2">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">Printing</p>
                        <div className="flex justify-between">
                          <span className="text-slate-400">รับมา {formatNumber(prt.inputQty)} kg → ดี{prt.goodRolls ? ` ${prt.goodRolls} ม้วน` : ''}</span>
                          <span className="text-green-300">{formatNumber(prt.goodQty ?? 0)} kg</span>
                        </div>
                        {prt.wasteQty > 0 && (
                          <div className="flex justify-between text-red-400">
                            <span>✗ เศษเสีย</span>
                            <span>{formatNumber(prt.wasteQty)} kg</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between border-t border-slate-700 pt-2 font-medium">
                      <span className="text-green-400">รับเข้าคลัง{finalGoodRolls ? ` ${finalGoodRolls} ม้วน` : ''}</span>
                      <span className="text-green-300">{formatNumber(finalGoodQty)} kg</span>
                    </div>
                    {totalLoss > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>รวมเสียทั้งหมด</span>
                        <span>{formatNumber(totalLoss)} kg</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ประวัติการปล่อยของ */}
      {dispatchedReqs.length > 0 && (() => {
        // คำนวณยอดจาก items จริง (ไม่รวม placeholder)
        const getDispatchedQty = (r: typeof dispatchedReqs[0]) => {
          const items: { stock_id: string; qty: number }[] = (r as any).items ?? []
          const real = items.filter(i => i.stock_id !== '__stock_portion__' && !i.stock_id.startsWith('manual-'))
          // ถ้ามี real items ใช้ยอดจาก SO qty (เพราะ items เก็บ stock_id ไม่ใช่ qty จริง)
          return r.sale_order?.qty ?? 0
        }
        const totalDispatched = dispatchedReqs.reduce((s, r) => s + getDispatchedQty(r), 0)
        const uniqueCustomers = new Set(dispatchedReqs.map(r => r.sale_order?.customer?.name)).size

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Header + summary */}
            <div className="px-5 py-4 border-b border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium text-sm">ประวัติการปล่อยของ</span>
                <span className="text-slate-500 text-xs">{dispatchedReqs.length} ใบเบิก</span>
              </div>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800 rounded-lg px-4 py-3">
                  <p className="text-slate-400 text-xs">ปล่อยออกทั้งหมด</p>
                  <p className="text-white font-bold text-xl mt-1">{formatNumber(totalDispatched)} <span className="text-sm font-normal text-slate-400">kg</span></p>
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3">
                  <p className="text-slate-400 text-xs">SO ที่ส่งแล้ว</p>
                  <p className="text-green-300 font-bold text-xl mt-1">{dispatchedReqs.length} <span className="text-sm font-normal text-slate-400">ใบ</span></p>
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3">
                  <p className="text-slate-400 text-xs">ลูกค้า</p>
                  <p className="text-sky-300 font-bold text-xl mt-1">{uniqueCustomers} <span className="text-sm font-normal text-slate-400">ราย</span></p>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-2.5 text-slate-500 text-[10px] font-semibold uppercase">SO No.</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 text-[10px] font-semibold uppercase">ลูกค้า</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 text-[10px] font-semibold uppercase">สินค้า</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 text-[10px] font-semibold uppercase">จำนวน</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 text-[10px] font-semibold uppercase">วันที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dispatchedReqs.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium text-xs">{r.sale_order?.so_no}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.sale_order?.customer?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">{r.sale_order?.product?.part_name ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-xs text-white">{formatNumber(r.sale_order?.qty ?? 0)} {r.sale_order?.unit}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="bg-slate-800/50 border-t-2 border-slate-700">
                  <td colSpan={3} className="px-4 py-3 text-slate-400 text-xs font-medium">รวมทั้งหมด</td>
                  <td className="px-4 py-3 text-right text-green-300 font-bold text-sm">{formatNumber(totalDispatched)} kg</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Stock table — จัดกลุ่มตาม SO */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-white font-medium text-sm">สต็อกปัจจุบัน</span>
          <span className="text-slate-500 text-xs">{stock?.length ?? 0} Lot</span>
        </div>
        {stockLoading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : !stock?.length ? (
          <div className="py-10 text-center text-slate-500 text-sm">ยังไม่มีสต็อก</div>
        ) : (() => {
          // จัดกลุ่มตาม SO
          type Group = { soNo: string; productName: string; totalQty: number; unit: string; lots: typeof stock }
          const groups: Group[] = []
          stock.forEach(s => {
            const soFromJob = s.planning_job?.sale_order
            let soNo = soFromJob?.so_no ?? ''
            if (!soNo && s.lot_no.startsWith('STK-')) {
              const parts = s.lot_no.split('-'); if (parts.length >= 2) soNo = parts[1]
            }
            const key = soNo || `_${s.id}`
            const existing = groups.find(g => g.soNo === key)
            if (existing) { existing.lots.push(s); existing.totalQty += s.qty }
            else groups.push({ soNo: key, productName: s.product?.part_name ?? '-', unit: s.unit, totalQty: s.qty, lots: [s] })
          })
          return (
            <div className="divide-y divide-slate-800">
              {groups.map(g => (
                <div key={g.soNo} className="px-5 py-3">
                  {/* Group header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      {!g.soNo.startsWith('_') && <span className="text-white text-sm font-bold mr-2">{g.soNo}</span>}
                      <span className="text-slate-300 text-sm">{g.productName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold text-sm">{formatNumber(g.totalQty)} {g.unit}</span>
                      {g.lots.length > 1 && <span className="text-slate-500 text-xs ml-2">{g.lots.length} Lot</span>}
                    </div>
                  </div>
                  {/* Individual lots */}
                  <div className="space-y-0.5 pl-3 border-l-2 border-slate-700">
                    {g.lots.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-mono">{s.lot_no}</span>
                          {s.location && <span className="text-slate-600">{s.location}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{formatNumber(s.qty)} {s.unit}</span>
                          <span className="text-slate-600">{formatDate(s.received_at)}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            s.condition === 'good' ? 'bg-green-500/20 text-green-300' :
                            s.condition === 'hold' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>
                            {s.condition === 'good' ? 'ดี' : s.condition === 'hold' ? 'Hold' : 'Reject'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Dispatch Modal */}
      {dispatchModal && (() => {
        const r = dispatchModal
        const unit  = r.sale_order?.unit ?? 'kg'
        const items: { stock_id: string; qty: number }[] = (r as any).items ?? []
        // ตรวจว่าเป็นใบเบิกส่วนสต็อก (auto-created ตอน approve)
        const stockPortion = items.find(i => i.stock_id === '__stock_portion__')
        const isStockPortion = !!stockPortion
        // stock portion: target = ผลิตจริง (warehouse_stock) + stock_qty ใน SO
        // ไม่ใช้ยอด SO เพราะผลิตได้ +/- ได้
        const soQty = (() => {
          if (!isStockPortion) return r.sale_order?.qty ?? 0
          const soJobIds = new Set((jobs ?? []).filter(j => j.sale_order_id === r.sale_order_id).map(j => j.id))
          const prodTotal = (stock ?? []).filter(s => s.planning_job_id && soJobIds.has(s.planning_job_id)).reduce((sum, s) => sum + s.qty, 0)
          const soStockQty = (r.sale_order as any)?.stock_qty ?? 0
          return prodTotal + soStockQty
        })()
        // linkedStock เฉพาะ stock จริง (ไม่ใช่ placeholder)
        const realItems = items.filter(i => i.stock_id !== '__stock_portion__')
        const linkedStock = realItems.map(i => stock?.find(s => s.id === i.stock_id)).filter(Boolean)
        const mainQty = linkedStock.reduce((sum, s) => sum + (s?.qty ?? 0), 0)
        const suppQtyTotal = supplements.reduce((sum, s) => sum + s.qty, 0)
        const totalDispatch = mainQty + suppQtyTotal
        const shortfall = soQty - mainQty
        const mainStockIds = new Set(realItems.map(i => i.stock_id))
        // stock portion → แสดงทุก Lot ของ product นี้ | ปกติ → Lot อื่น
        const productId = r.sale_order?.product_id
        const availableSupp = isStockPortion
          ? goodStock.filter(s => s.product_id === productId && !mainStockIds.has(s.id) && !supplements.find(sup => sup.stock_id === s.id))
          : goodStock.filter(s => !mainStockIds.has(s.id) && !supplements.find(sup => sup.stock_id === s.id))
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-white font-semibold">ปล่อยของ — {r.sale_order?.so_no}</h2>
                  {isStockPortion && <p className="text-xs text-green-400 mt-0.5">ส่วนสต็อก (เบิกล่วงหน้า)</p>}
                </div>
                <button onClick={() => setDispatchModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-6 space-y-4">

                {/* Production chain breakdown (ส่วนสต็อกเท่านั้น) */}
                {isStockPortion && (() => {
                  const { ext, grd, prt, totalLoss } = getSoProductionSummary(r.sale_order_id)
                  const soStockQty = (r.sale_order as any)?.stock_qty ?? 0
                  const soPlanned  = r.sale_order?.qty ?? 0
                  const prodNeeded = soPlanned - soStockQty
                  return (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs space-y-2">
                      <p className="text-slate-300 font-semibold text-sm mb-1">สรุปการผลิต — {r.sale_order?.so_no}</p>

                      {/* SO plan */}
                      <div className="grid grid-cols-3 gap-1 text-center border border-slate-700 rounded-lg overflow-hidden">
                        <div className="bg-slate-700/50 px-2 py-2">
                          <p className="text-slate-400 text-[10px]">ลูกค้าสั่ง</p>
                          <p className="text-white font-bold text-sm">{formatNumber(soPlanned)}</p>
                          <p className="text-slate-500 text-[10px]">{unit}</p>
                        </div>
                        <div className="bg-green-500/10 px-2 py-2">
                          <p className="text-green-400 text-[10px]">สต็อกเดิม</p>
                          <p className="text-green-300 font-bold text-sm">{formatNumber(soStockQty)}</p>
                          <p className="text-slate-500 text-[10px]">{unit}</p>
                        </div>
                        <div className="bg-yellow-500/10 px-2 py-2">
                          <p className="text-yellow-400 text-[10px]">วางแผนผลิต</p>
                          <p className="text-yellow-300 font-bold text-sm">{formatNumber(prodNeeded)}</p>
                          <p className="text-slate-500 text-[10px]">{unit}</p>
                        </div>
                      </div>

                      {/* Production result */}
                      {ext.goodQty !== undefined && (
                        <div className="space-y-1 border-t border-slate-700 pt-2">
                          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">ผลการผลิต</p>
                          {ext.rawMaterial && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">วัตถุดิบเบิก</span>
                              <span className="text-slate-300">{formatNumber(ext.rawMaterial)} {unit}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-green-400">✓ เป่าได้{ext.goodRolls ? ` ${ext.goodRolls} ม้วน` : ''}</span>
                            <span className="text-green-300 font-medium">{formatNumber(ext.goodQty)} {unit}</span>
                          </div>
                          {ext.badQty > 0 && (
                            <div className="flex justify-between text-slate-500">
                              <span>⚙ ม้วนกรอ {ext.badRolls} ม้วน → กรอคืน</span>
                              <span>+{formatNumber(grd?.goodQty ?? 0)} {unit}</span>
                            </div>
                          )}
                          {ext.wasteQty > 0 && (
                            <div className="flex justify-between text-red-400">
                              <span>✗ เศษเป่า</span>
                              <span>{formatNumber(ext.wasteQty)} {unit}</span>
                            </div>
                          )}
                          {grd && grd.wasteQty > 0 && (
                            <div className="flex justify-between text-red-400">
                              <span>✗ เศษกรอ</span>
                              <span>{formatNumber(grd.wasteQty)} {unit}</span>
                            </div>
                          )}
                          {prt && (
                            <>
                              <div className="flex justify-between text-slate-400">
                                <span>🖨 พิมพ์ได้{prt.goodRolls ? ` ${prt.goodRolls} ม้วน` : ''}</span>
                                <span className="text-green-300">{formatNumber(prt.goodQty ?? 0)} {unit}</span>
                              </div>
                              {prt.wasteQty > 0 && (
                                <div className="flex justify-between text-red-400">
                                  <span>✗ เศษพิม</span>
                                  <span>{formatNumber(prt.wasteQty)} {unit}</span>
                                </div>
                              )}
                            </>
                          )}
                          {totalLoss > 0 && (
                            <div className="flex justify-between text-red-400 border-t border-slate-700 pt-1 font-medium">
                              <span>รวมเสีย</span>
                              <span>{formatNumber(totalLoss)} {unit}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Summary */}
                <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-slate-400 text-xs">{r.sale_order?.customer?.name} · {r.sale_order?.product?.part_name}</p>
                  <div className="border-t border-slate-700 pt-2 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{isStockPortion ? 'ยอดจริงที่จะส่ง (ผลิต + สต็อก)' : 'ยอด SO'}</span>
                      <span className="text-white font-medium">{formatNumber(soQty)} {unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lot หลัก (ผลิต)</span>
                      <span className="text-slate-300">{formatNumber(mainQty)} {unit}</span>
                    </div>
                    {supplements.map(s => {
                      const st = stock?.find(x => x.id === s.stock_id)
                      return (
                        <div key={s.stock_id} className="flex justify-between items-center">
                          <span className="text-blue-400 text-xs">+ เสริม {st?.lot_no ?? s.stock_id.slice(0,8)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-300">{formatNumber(s.qty)} {unit}</span>
                            <button onClick={() => setSupplements(prev => prev.filter(x => x.stock_id !== s.stock_id))} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                          </div>
                        </div>
                      )
                    })}
                    <div className={`flex justify-between font-medium border-t border-slate-700 pt-1.5 ${totalDispatch >= soQty ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span>รวมที่จะปล่อย</span>
                      <span>{formatNumber(totalDispatch)} {unit}</span>
                    </div>
                    {shortfall > 0 && suppQtyTotal === 0 && (
                      <p className="text-yellow-300 text-xs">ขาด {formatNumber(shortfall)} {unit} — เพิ่มสต็อกเสริมด้านล่าง</p>
                    )}
                  </div>
                </div>

                {/* เลือก Lot สต็อก */}
                <div className="space-y-3 border-t border-slate-700 pt-3">
                  <p className="text-slate-400 text-xs font-medium">
                    {isStockPortion ? 'เลือก Lot สต็อกที่จะนำมาจ่าย' : 'เพิ่มสต็อกเสริม (ถ้าของไม่ครบ)'}
                  </p>

                  {/* สต็อกของ product เดียวกัน (กรณีส่วนสต็อก) หรือสต็อกอื่น */}
                  {(() => {
                    const lotOptions = availableSupp
                    return lotOptions.length > 0 ? (
                      <div>
                        {!isStockPortion && <p className="text-slate-500 text-[10px] mb-1">จาก Lot ในระบบ</p>}
                        <div className="space-y-2">
                          {lotOptions.map(s => {
                            const already = supplements.find(x => x.stock_id === s.id)
                            return (
                              <div key={s.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                                <div>
                                  <p className="text-white text-xs font-mono">{s.lot_no}</p>
                                  <p className="text-slate-400 text-[10px]">มีอยู่ {formatNumber(s.qty)} {s.unit}</p>
                                </div>
                                {already ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-300 text-xs font-medium">{formatNumber(already.qty)} {unit}</span>
                                    <button onClick={() => setSupplements(prev => prev.filter(x => x.stock_id !== s.id))} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      defaultValue={Math.min(s.qty, Math.max(0, soQty - totalDispatch))}
                                      id={`lot-qty-${s.id}`}
                                      placeholder="kg"
                                      className="w-20 bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-brand-500"
                                    />
                                    <button
                                      onClick={() => {
                                        const el = document.getElementById(`lot-qty-${s.id}`) as HTMLInputElement
                                        const qty = parseFloat(el?.value || '0')
                                        if (qty > 0) setSupplements(prev => [...prev, { stock_id: s.id, qty, label: s.lot_no }])
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2.5 py-1 rounded transition-colors"
                                    >
                                      เลือก
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs">{isStockPortion ? 'ไม่พบสต็อกสินค้านี้ในคลัง' : 'ไม่มีสต็อกเสริม'}</p>
                    )
                  })()}

                  {/* กรอกเพิ่มเติมเอง (stock นอกระบบ) */}
                  <div>
                    <p className="text-slate-500 text-[10px] mb-1">กรอก kg ที่นำมาเติมเพิ่ม</p>
                    <div className="flex gap-2">
                      <input type="number" value={manualQty} onChange={e => setManualQty(e.target.value)}
                        placeholder={shortfall > 0 ? `ขาด ${formatNumber(shortfall - suppQtyTotal)} kg` : '0'}
                        className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 outline-none focus:border-brand-500" />
                      <button onClick={addManualSupplement} disabled={!manualQty || parseFloat(manualQty) <= 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs px-3 rounded-lg">เพิ่ม</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
                <button onClick={() => setDispatchModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm">ยกเลิก</button>
                <button
                  onClick={handleDispatchConfirm}
                  disabled={dispatchReq.isPending || totalDispatch === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {dispatchReq.isPending ? 'กำลังปล่อย...' : `ยืนยันปล่อย ${formatNumber(totalDispatch)} ${unit}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Receive Modal */}
      {receiveModal && (() => {
        const { ext, grd, prt, totalLoss } = getSoProductionSummary(receiveModal.sale_order_id)
        // ยอดรับ = input พิม - เศษพิม → good_qty พิม → (good เป่า + กรอคืน) → planned_qty
        const prtCalc = prt ? (prt.inputQty - prt.wasteQty) : undefined
        const receiveQty  = prtCalc ?? prt?.goodQty
          ?? ((ext.goodQty ?? 0) + (grd?.goodQty ?? 0) || receiveModal.planned_qty)
        const extRolls_ = (ext.goodRolls ?? 0) + (grd?.goodRolls ?? 0)
        const receiveRolls = prt?.goodRolls ?? (extRolls_ > 0 ? extRolls_ : undefined)
        const soPlanned   = receiveModal.sale_order?.qty ?? receiveModal.planned_qty
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-white font-semibold">รับเข้าคลัง</h2>
                <button onClick={() => setReceiveModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                {/* สรุปการผลิต */}
                <div className="bg-slate-800 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">SO {receiveModal.sale_order?.so_no}</span>
                    <span className="text-white">{formatNumber(soPlanned)} kg</span>
                  </div>
                  <p className="text-slate-500">Lot: {receiveModal.lot_no}</p>
                  <div className="border-t border-slate-700 pt-1.5 space-y-1">
                    {ext.goodQty !== undefined && <div className="flex justify-between"><span className="text-slate-400">เป่าได้{ext.goodRolls ? ` ${ext.goodRolls} ม้วน` : ''}</span><span className="text-slate-300">{formatNumber(ext.goodQty)} kg</span></div>}
                    {ext.badQty > 0 && <div className="flex justify-between"><span className="text-slate-500">⚙ กรอคืน</span><span className="text-slate-500">+{formatNumber(grd?.goodQty ?? 0)} kg</span></div>}
                    {ext.wasteQty > 0 && <div className="flex justify-between"><span className="text-red-400">✗ เศษเป่า</span><span className="text-red-300">{formatNumber(ext.wasteQty)} kg</span></div>}
                    {grd && grd.wasteQty > 0 && <div className="flex justify-between"><span className="text-red-400">✗ เศษกรอ</span><span className="text-red-300">{formatNumber(grd.wasteQty)} kg</span></div>}
                    {prt && prt.wasteQty > 0 && <div className="flex justify-between"><span className="text-red-400">✗ เศษพิม</span><span className="text-red-300">{formatNumber(prt.wasteQty)} kg</span></div>}
                    {totalLoss > 0 && <div className="flex justify-between text-red-400 border-t border-slate-700 pt-1"><span>รวมเสีย</span><span>{formatNumber(totalLoss)} kg</span></div>}
                  </div>
                </div>

                {/* ยอดรับ — อ้างอิงจากผลิตจริง */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-xs mb-1">รับเข้าคลัง (ยอดผลิตจริง)</p>
                  <p className="text-green-300 text-2xl font-bold">{formatNumber(receiveQty)} kg</p>
                  {receiveRolls && <p className="text-green-400 text-sm mt-0.5">{receiveRolls} ม้วน</p>}
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">ที่เก็บ (ไม่บังคับ)</label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="เช่น A-01, ชั้น 2"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setReceiveModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm">ยกเลิก</button>
                  <button onClick={handleReceive} disabled={receive.isPending} className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                    {receive.isPending ? 'กำลังบันทึก...' : `ยืนยันรับเข้า ${formatNumber(receiveQty)} kg`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
