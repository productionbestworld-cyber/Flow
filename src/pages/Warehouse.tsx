import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X, PackagePlus, CheckCircle, ClipboardList, Truck, Wind, Printer, Download, Upload, FileText } from 'lucide-react'
import { downloadCSV, downloadTemplate, parseCSV, printDocument } from '../lib/csvUtils'
import { useWarehouseStock, useReceiveToStock, useAddManualStock } from '../hooks/useWarehouse'
import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import { useRequisitions, useApproveRequisition, useDispatchRequisition, useCancelRequisition } from '../hooks/useSales'
import { useAuth } from '../lib/AuthContext'
import { formatDate, formatNumber } from '../lib/utils'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import { useProducts } from '../hooks/useProducts'
import type { PlanningJob, Requisition } from '../types'

export default function Warehouse() {
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'pending'   // pending | production | old | flow
  const { user } = useAuth()
  const { data: stock, isLoading: stockLoading } = useWarehouseStock()
  const { data: jobs } = usePlanningJobs()
  const { data: logs } = useProductionLogs()
  const { data: reqs } = useRequisitions()
  const receive      = useReceiveToStock()
  const addManual    = useAddManualStock()
  const approveReq   = useApproveRequisition()
  const dispatchReq  = useDispatchRequisition()
  const cancelReq    = useCancelRequisition()
  const { data: products } = useProducts()

  const [receiveModal, setReceiveModal] = useState<PlanningJob | null>(null)

  // ── Manual stock modal ──────────────────────────────────────────────────────
  const [showManualModal, setShowManualModal] = useState(false)
  const [mProductId, setMProductId]   = useState('')
  const [mLotNo, setMLotNo]           = useState('')
  const [mQty, setMQty]               = useState('')
  const [mRolls, setMRolls]           = useState('')
  const [mUnit, setMUnit]             = useState('kg')
  const [mLocation, setMLocation]     = useState('')

  function openManualModal() {
    setMProductId(''); setMLotNo(''); setMQty(''); setMRolls(''); setMUnit('kg'); setMLocation('')
    setShowManualModal(true)
  }

  async function handleAddManual() {
    if (!mProductId || !mQty || parseFloat(mQty) <= 0) return
    const lotNo = mLotNo.trim() || `OLD-${Date.now().toString(36).toUpperCase()}`
    await addManual.mutateAsync({
      lot_no: lotNo,
      product_id: mProductId,
      qty: parseFloat(mQty),
      unit: mUnit,
      rolls: mRolls ? parseInt(mRolls) : undefined,
      location: mLocation || undefined,
      received_by: user?.id,
    })
    setShowManualModal(false)
  }
  const [location, setLocation] = useState('')
  const [dispatchModal, setDispatchModal] = useState<Requisition | null>(null)
  const [supplements, setSupplements] = useState<{ stock_id: string; qty: number; label: string }[]>([])

  const [manualQty, setManualQty] = useState('')
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [actualQty, setActualQty]     = useState('')   // ยอดจริงที่คลังนับได้
  const [actualRolls, setActualRolls] = useState('')   // ม้วนจริง

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
    const prtInputQty = ((ext.goodQty ?? 0) + (grd?.goodQty ?? 0)) || (prtJob?.planned_qty ?? 0)
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


  function openReceive(j: PlanningJob) {
    setReceiveModal(j)
    setLocation('')
    setActualQty('')
    setActualRolls('')
  }

  async function handleReceive(calcQty: number) {
    if (!receiveModal) return
    const job = receiveModal
    // ถ้าคลังกรอกยอดจริง ใช้ยอดนั้น มิฉะนั้นใช้ยอดที่คำนวณจากระบบ
    const finalQty = actualQty ? parseFloat(actualQty) : calcQty
    await receive.mutateAsync({
      planning_job_id: job.id,
      lot_no:          job.lot_no ?? '',
      product_id:      job.sale_order?.product_id ?? '',
      qty:             finalQty,
      unit:            job.sale_order?.unit ?? 'kg',
      location:        location || undefined,
      received_by:     user?.id,
    })
    setReceiveModal(null)
    setLocation('')
    setActualQty('')
    setActualRolls('')
  }

  async function handleApproveReq(id: string) {
    if (!user || !confirm('อนุมัติใบเบิกนี้?')) return
    await approveReq.mutateAsync({ id, approved_by: user.id })
  }

  function openDispatchModal(r: Requisition) {
    setDispatchModal(r)

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">คลังสินค้า</h1>
          <p className="text-slate-400 text-sm mt-0.5">รับสินค้าเข้าคลัง อนุมัติใบเบิก และดูสต็อกปัจจุบัน</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => downloadTemplate('warehouse_template.csv',
              ['Lot No.','Product Item Code','จำนวน (kg)','หน่วย','ตำแหน่งจัดเก็บ','หมายเหตุ'],
              ['LOT-001','ITEM001','1000','kg','A-01','สต็อกเดิม']
            )}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
            title="ดาวน์โหลด Template CSV"
          >
            <Download size={15} /> Template
          </button>
          <button
            onClick={openManualModal}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <PackagePlus size={15} /> เพิ่มสต็อกคลังเก่า
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Upload size={15} /> Import CSV
          </button>
          <input
            ref={csvInputRef} type="file" accept=".csv" className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return
              const text = await file.text()
              const rows = parseCSV(text)
              alert(`อ่านข้อมูล ${rows.length} รายการจาก CSV\n(ฟีเจอร์ import stock manual กำลังพัฒนา)`)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => {
              const headers = ['Lot No.','สินค้า','ประเภท','จำนวน (kg)','หน่วย','ตำแหน่ง','วันที่รับ','สถานะ']
              const rows = goodStock.map(s => [
                s.lot_no, s.planning_job?.sale_order?.product?.part_name ?? '',
                s.planning_job?.sale_order?.job_type ?? '',
                s.qty, s.unit ?? 'kg', s.location ?? '',
                s.received_at ? new Date(s.received_at).toLocaleDateString('th-TH') : '',
                s.condition ?? 'good',
              ])
              downloadCSV(`stock_${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => {
              const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
              printDocument('รายงานสต็อกสินค้าคงคลัง', `
                <h1>รายงานสต็อกสินค้าคงคลัง</h1>
                <p class="meta">วันที่พิมพ์: ${date} · รวม ${goodStock.length} Lot · ${formatNumber(totalQty)} kg</p>
                <table>
                  <thead><tr>
                    <th>Lot No.</th><th>สินค้า</th><th>ประเภท</th><th>จำนวน (kg)</th><th>หน่วย</th><th>ตำแหน่ง</th><th>วันที่รับ</th>
                  </tr></thead>
                  <tbody>${goodStock.map(s => `<tr>
                    <td>${s.lot_no}</td>
                    <td>${s.planning_job?.sale_order?.product?.part_name ?? '-'}</td>
                    <td>${s.planning_job?.sale_order?.job_type ?? '-'}</td>
                    <td style="text-align:right">${formatNumber(s.qty)}</td>
                    <td>${s.unit ?? 'kg'}</td>
                    <td>${s.location ?? '-'}</td>
                    <td>${s.received_at ? new Date(s.received_at).toLocaleDateString('th-TH') : '-'}</td>
                  </tr>`).join('')}
                  <tr class="total-row"><td colspan="3">รวมทั้งหมด</td><td style="text-align:right">${formatNumber(totalQty)}</td><td colspan="3"></td></tr>
                  </tbody>
                </table>
              `)
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <FileText size={15} /> พิมพ์
          </button>
        </div>
      </div>

      {/* Summary */}
      {(() => {
        function byJobType(types: string[]) {
          const items = goodStock.filter(s => {
            const jt = s.planning_job?.sale_order?.job_type ?? ''
            return types.some(t => jt === t)
          })
          return { qty: items.reduce((s, i) => s + i.qty, 0), lots: items.length }
        }
        function isPrint(s: typeof goodStock[0]) {
          const ptype = s.planning_job?.sale_order?.product?.type
          const jtype = s.planning_job?.sale_order?.job_type
          return ptype === 'print' || ptype === 'blow_print' || jtype === 'ฟิล์มพิมพ์' || s.lot_no.startsWith('PRI-')
        }

        const shrink      = byJobType(['Shrink Film'])
        const stretch     = byJobType(['Stretch Film'])
        const bagCover    = byJobType(['ถุงคลุม'])
        const sheet       = byJobType(['แผ่นชีส'])
        const tubeBag     = byJobType(['ถุงหลอด'])
        const printItems  = goodStock.filter(isPrint)
        const printQty    = printItems.reduce((s, i) => s + i.qty, 0)
        const printLots   = printItems.length

        const typeCards = [
          { label: 'Shrink Film',  qty: shrink.qty,   lots: shrink.lots,   color: 'text-brand-300',  border: 'border-brand-500/20',  icon: <Wind size={11} /> },
          { label: 'ฟิล์มพิมพ์', qty: printQty,     lots: printLots,     color: 'text-purple-300', border: 'border-purple-500/20', icon: <Printer size={11} /> },
          { label: 'Stretch Film', qty: stretch.qty,  lots: stretch.lots,  color: 'text-sky-300',    border: 'border-sky-500/20',    icon: <Wind size={11} /> },
          { label: 'ถุงคลุม',     qty: bagCover.qty, lots: bagCover.lots, color: 'text-teal-300',   border: 'border-teal-500/20',   icon: null },
          { label: 'แผ่นชีส',    qty: sheet.qty,    lots: sheet.lots,    color: 'text-amber-300',  border: 'border-amber-500/20',  icon: null },
          { label: 'ถุงหลอด',    qty: tubeBag.qty,  lots: tubeBag.lots,  color: 'text-rose-300',   border: 'border-rose-500/20',   icon: null },
        ]

        return (
          <div className="space-y-3">
            {/* แถวบน: สต็อกรวม + รอรับ */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-slate-400 text-xs">สต็อกรวม</p>
                <p className="text-2xl font-bold text-white mt-1">{formatNumber(totalQty)}</p>
                <p className="text-slate-500 text-[10px] mt-1">kg · {goodStock.length} Lot</p>
              </div>
              <div className="bg-slate-900 border border-yellow-500/20 rounded-xl p-4">
                <p className="text-slate-400 text-xs">รอรับ / ใบเบิกรอ</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{pendingReceiptBySo.length}</p>
                <p className="text-slate-500 text-[10px] mt-1">รับ · {pendingReqs.length} ใบเบิก</p>
              </div>
            </div>

            {/* แถวล่าง: แยกตามประเภทสินค้า */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {typeCards.map(c => (
                <div key={c.label} className={`bg-slate-900 border ${c.border} rounded-xl p-4`}>
                  <p className="text-slate-400 text-xs flex items-center gap-1">
                    {c.icon}{c.label}
                  </p>
                  <p className={`text-xl font-bold mt-1 ${c.color}`}>{formatNumber(c.qty)}</p>
                  <p className="text-slate-500 text-[10px] mt-1">kg · {c.lots} Lot</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ══ TAB: pending — รอรับ & ใบเบิก ══════════════════════════════ */}
      {activeTab === 'pending' && <>

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
                      {grd && grd.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษกรอ</span><span>{formatNumber(grd.wasteQty)} {unit}</span></div>}
                      {prt && <div className="flex justify-between"><span className="text-purple-400">🖨 พิมพ์ได้{prt.goodRolls ? ` ${prt.goodRolls} ม้วน` : ''}</span><span className="text-green-300">{formatNumber(prt.goodQty ?? 0)} {unit}</span></div>}
                      {prt && prt.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษพิม</span><span>{formatNumber(prt.wasteQty)} {unit}</span></div>}
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
                      {grd && grd.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษกรอ</span><span>{formatNumber(grd.wasteQty)} {unit}</span></div>}
                      {prt && <div className="flex justify-between"><span className="text-purple-400">🖨 พิมพ์ได้{prt.goodRolls ? ` ${prt.goodRolls} ม้วน` : ''}</span><span className="text-green-300">{formatNumber(prt.goodQty ?? 0)} {unit}</span></div>}
                      {prt && prt.wasteQty > 0 && <div className="flex justify-between text-red-400"><span>✗ เศษพิม</span><span>{formatNumber(prt.wasteQty)} {unit}</span></div>}
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
              const finalGoodQty   = (prt?.goodQty ?? ((ext.goodQty ?? 0) + (grd?.goodQty ?? 0))) || (j.planned_qty ?? 0)
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
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">Blow</p>
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

      </> /* end pending tab */}

      {/* ══ TAB: lots — Lot ทั้งหมด ══════════════════════════════════ */}
      {activeTab === 'lots' && (() => {
        const allLots = stock ?? []
        const totalKg = allLots.filter(s => s.condition === 'good').reduce((s,i) => s+i.qty, 0)
        const totalRolls = allLots.reduce((sum, s) => {
          const lp = (s.location ?? '').split(' | ')
          const rp = lp.find(p => /^\d+ม้วน$/.test(p))
          const logRolls = logs?.find(l => l.planning_job_id === s.planning_job_id)?.good_rolls ?? 0
          return sum + (rp ? parseInt(rp) : logRolls)
        }, 0)

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">Lot ทั้งหมดในระบบ</span>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{allLots.length} Lot</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>ม้วนรวม <span className="text-yellow-300 font-semibold ml-1">{totalRolls > 0 ? totalRolls.toLocaleString() : '—'}</span></span>
                <span>KG รวม <span className="text-green-300 font-semibold ml-1">{formatNumber(totalKg)}</span></span>
              </div>
            </div>
            {stockLoading ? (
              <div className="p-4"><TableSkeleton rows={5} /></div>
            ) : allLots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">ยังไม่มี Lot ในระบบ</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/40 text-xs text-slate-400 font-medium">
                      <th className="text-left px-4 py-2.5">Lot No.</th>
                      <th className="text-left px-4 py-2.5">สินค้า</th>
                      <th className="text-left px-4 py-2.5">Size</th>
                      <th className="text-left px-4 py-2.5">SO No.</th>
                      <th className="text-right px-4 py-2.5 text-yellow-400">ม้วน</th>
                      <th className="text-right px-4 py-2.5 text-green-400">KG</th>
                      <th className="text-left px-4 py-2.5">ตำแหน่ง</th>
                      <th className="text-left px-4 py-2.5">ประเภท</th>
                      <th className="text-left px-4 py-2.5">สภาพ</th>
                      <th className="text-left px-4 py-2.5">วันที่รับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {allLots.map(s => {
                      const so   = s.planning_job?.sale_order
                      const prod = so?.product ?? s.product
                      const size = prod?.width && prod?.thickness ? `${prod.width}×${prod.thickness}` : '—'
                      const isOld = !s.planning_job_id

                      // rolls: old stock → parse from location, production → from log
                      const locParts  = (s.location ?? '').split(' | ')
                      const rollsPart = locParts.find(p => /^\d+ม้วน$/.test(p))
                      const locPart   = locParts.filter(p => !/^\d+ม้วน$/.test(p)).join(' | ')
                      const oldRolls  = rollsPart ? parseInt(rollsPart) : null
                      const logRolls  = logs?.find(l => l.planning_job_id === s.planning_job_id)?.good_rolls ?? null
                      const rolls     = isOld ? oldRolls : logRolls

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`font-mono font-bold text-sm ${isOld ? 'text-amber-300' : 'text-brand-300'}`}>
                              {s.lot_no}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-200 text-sm max-w-[180px] truncate">
                            {prod?.part_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{size}</td>
                          <td className="px-4 py-3 text-slate-400 text-sm">{so?.so_no ?? '—'}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {rolls
                              ? <span className="text-yellow-300 font-semibold">{rolls.toLocaleString()} <span className="text-yellow-500/60 text-xs font-normal">ม้วน</span></span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="text-green-300 font-semibold">{formatNumber(s.qty)}</span>
                            <span className="text-green-500/60 text-xs ml-1">kg</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{locPart || '—'}</td>
                          <td className="px-4 py-3">
                            {isOld
                              ? <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">คลังเก่า</span>
                              : <span className="text-xs bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">สายผลิต</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              s.condition === 'good'     ? 'bg-green-500/20 text-green-300' :
                              s.condition === 'hold'     ? 'bg-yellow-500/20 text-yellow-300' :
                                                           'bg-red-500/20 text-red-300'
                            }`}>
                              {s.condition === 'good' ? 'ดี' : s.condition === 'hold' ? 'Hold' : 'Reject'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(s.received_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* ══ TAB: flow — ยอดรับ-ส่ง ══════════════════════════════════ */}
      {activeTab === 'flow' && <>

      {/* ── ตารางยอดรับ-ส่ง (Full Flow) ──────────────────────────────── */}
      {(() => {
        type RecRow = {
          soId: string
          soNo: string
          productName: string
          unit: string
          soQty: number          // ยอด SO (ลูกค้าสั่ง)
          plannedQty: number     // ยอดสั่งผลิต (planning job)
          stockQty: number       // มีในสต็อกแล้ว (stock_qty บน SO)
          blownQty: number       // เป่าส่งคลัง (good_qty จาก production log)
          warehouseQty: number   // คลังรับจริง (warehouse_stock)
          dispatchedQty: number  // ส่งออกจริง
          diff: number           // ผลต่าง (warehouseQty - dispatchedQty)
        }

        // รวบรวม SO id จากทุกแหล่ง
        const soIds = new Set<string>()
        goodStock.forEach(s => { if (s.planning_job?.sale_order_id) soIds.add(s.planning_job.sale_order_id) })
        dispatchedReqs.forEach(r => { if (r.sale_order_id) soIds.add(r.sale_order_id) })
        ;(jobs ?? []).filter(j => j.status === 'done' || j.status === 'pending_receipt').forEach(j => soIds.add(j.sale_order_id))

        const rows: RecRow[] = Array.from(soIds).map(soId => {
          // หา SO info
          const soJobs = (jobs ?? []).filter(j => j.sale_order_id === soId)
          const so = soJobs[0]?.sale_order ?? dispatchedReqs.find(r => r.sale_order_id === soId)?.sale_order

          // ยอดสั่งผลิต = extrusion job planned_qty
          const extJob = soJobs.find(j => j.dept === 'extrusion')
          const plannedQty = extJob?.planned_qty ?? 0

          // มีในสต็อก = stock_qty บน SO (กรอกตอนวางแผน)
          const stockQty = (so as any)?.stock_qty ?? 0

          // เป่าส่งคลัง = good output จาก production (ext + grd + prt)
          const { ext, grd, prt } = getSoProductionSummary(soId)
          const prtCalc  = prt ? (prt.inputQty - prt.wasteQty) : undefined
          const blownQty = prtCalc ?? prt?.goodQty ?? (((ext.goodQty ?? 0) + (grd?.goodQty ?? 0)) || plannedQty)

          // คลังรับจริง = ยังอยู่ในคลัง
          const warehouseQty = goodStock
            .filter(s => s.planning_job?.sale_order_id === soId)
            .reduce((s, w) => s + w.qty, 0)

          // ส่งออกจริง = dispatched req
          const dispReqs = dispatchedReqs.filter(r => r.sale_order_id === soId)
          const dispatchedQty = dispReqs.reduce((sum, r) => {
            const items: { stock_id: string; qty: number }[] = (r as any).items ?? []
            const real = items.filter(i => i.stock_id !== '__stock_portion__' && !i.stock_id.startsWith('manual-'))
            return sum + (real.length > 0 ? real.reduce((s, i) => s + (i.qty ?? 0), 0) : (r.sale_order?.qty ?? 0))
          }, 0)

          return {
            soId,
            soNo: so?.so_no ?? soId.slice(0, 8),
            productName: so?.product?.part_name ?? '-',
            unit: so?.unit ?? 'kg',
            soQty: so?.qty ?? 0,
            plannedQty,
            stockQty,
            blownQty,
            warehouseQty,
            dispatchedQty,
            diff: (so?.qty ?? 0) - dispatchedQty,   // ยอด SO − ส่งออกจริง = ยังค้างส่ง
          }
        }).filter(r => r.soQty > 0)

        if (rows.length === 0) return null

        const totals = rows.reduce((acc, r) => ({
          soQty: acc.soQty + r.soQty,
          plannedQty: acc.plannedQty + r.plannedQty,
          stockQty: acc.stockQty + r.stockQty,
          blownQty: acc.blownQty + r.blownQty,
          warehouseQty: acc.warehouseQty + r.warehouseQty,
          dispatchedQty: acc.dispatchedQty + r.dispatchedQty,
          diff: acc.diff + r.diff,
        }), { soQty: 0, plannedQty: 0, stockQty: 0, blownQty: 0, warehouseQty: 0, dispatchedQty: 0, diff: 0 })

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-white font-medium text-sm">ยอดรับ-ส่ง (Full Flow)</span>
              <span className="text-slate-500 text-xs">{rows.length} SO</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/40">
                    <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs whitespace-nowrap">SO No.</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs">สินค้า</th>
                    <th className="text-right px-4 py-2.5 text-slate-400 font-medium text-xs whitespace-nowrap">ยอด SO</th>
                    <th className="text-right px-4 py-2.5 text-sky-400 font-medium text-xs whitespace-nowrap">ยอดสั่งผลิต</th>
                    <th className="text-right px-4 py-2.5 text-slate-400 font-medium text-xs whitespace-nowrap">มีในสต็อก</th>
                    <th className="text-right px-4 py-2.5 text-brand-400 font-medium text-xs whitespace-nowrap">เป่าส่งคลัง</th>
                    <th className="text-right px-4 py-2.5 text-green-400 font-medium text-xs whitespace-nowrap">คลังรับจริง</th>
                    <th className="text-right px-4 py-2.5 text-blue-400 font-medium text-xs whitespace-nowrap">ส่งออกจริง</th>
                    <th className="text-right px-4 py-2.5 text-slate-400 font-medium text-xs whitespace-nowrap">ค้างส่ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map(r => (
                    <tr key={r.soId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-white font-semibold text-sm whitespace-nowrap">{r.soNo}</td>
                      <td className="px-4 py-2.5 text-slate-300 text-xs max-w-[160px] truncate">{r.productName}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 text-sm">{formatNumber(r.soQty)}</td>
                      <td className="px-4 py-2.5 text-right text-sky-300 text-sm">{r.plannedQty > 0 ? formatNumber(r.plannedQty) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{r.stockQty > 0 ? formatNumber(r.stockQty) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-brand-300 text-sm">{r.blownQty > 0 ? formatNumber(r.blownQty) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-green-300 font-semibold text-sm">{r.warehouseQty > 0 ? formatNumber(r.warehouseQty) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-blue-300 text-sm">{r.dispatchedQty > 0 ? formatNumber(r.dispatchedQty) : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-sm">
                        {r.diff === 0
                          ? <span className="text-slate-500">0</span>
                          : r.diff > 0
                            ? <span className="text-white">+{formatNumber(r.diff)}</span>
                            : <span className="text-red-400">{formatNumber(r.diff)}</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-800/60 border-t-2 border-slate-700 font-semibold">
                    <td colSpan={2} className="px-4 py-2.5 text-slate-300 text-sm">รวมทั้งหมด</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 text-sm">{formatNumber(totals.soQty)}</td>
                    <td className="px-4 py-2.5 text-right text-sky-300 text-sm">{formatNumber(totals.plannedQty)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400 text-sm">{formatNumber(totals.stockQty)}</td>
                    <td className="px-4 py-2.5 text-right text-brand-300 text-sm">{formatNumber(totals.blownQty)}</td>
                    <td className="px-4 py-2.5 text-right text-green-300 text-sm">{formatNumber(totals.warehouseQty)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-300 text-sm">{formatNumber(totals.dispatchedQty)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm ${totals.diff >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {totals.diff >= 0 ? '+' : ''}{formatNumber(totals.diff)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      </> /* end flow tab */}

      {/* ══ TAB: production — สต็อกสายผลิต ══════════════════════════════ */}
      {activeTab === 'production' && <>

      {/* ── สต็อกจากสายผลิต ─────────────────────────────────────────────── */}
      {(() => {
        const prodStock = goodStock.filter(s => !!s.planning_job_id)
        const totalProdQty = prodStock.reduce((s,i) => s + i.qty, 0)
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-white font-medium text-sm">สต็อกจากสายผลิต</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-300 text-sm font-semibold">{formatNumber(totalProdQty)} kg</span>
                <span className="text-slate-500 text-xs">{prodStock.length} Lot</span>
              </div>
            </div>
            {stockLoading ? (
              <div className="p-4"><TableSkeleton rows={3} /></div>
            ) : prodStock.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">ยังไม่มีสต็อกจากสายผลิต</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/40 text-xs text-slate-400 font-medium">
                      <th className="text-left px-4 py-2.5">Lot No.</th>
                      <th className="text-left px-4 py-2.5">สินค้า / Size</th>
                      <th className="text-left px-4 py-2.5">SO No.</th>
                      <th className="text-right px-4 py-2.5 text-yellow-400">ม้วน</th>
                      <th className="text-right px-4 py-2.5 text-green-400">KG</th>
                      <th className="text-left px-4 py-2.5">ตำแหน่ง</th>
                      <th className="text-left px-4 py-2.5">วันที่รับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {prodStock.map(s => {
                      const so = s.planning_job?.sale_order
                      const prod = so?.product ?? s.product
                      const size = prod?.width && prod?.thickness ? `${prod.width}×${prod.thickness}` : null
                      // หา rolls จาก production log
                      const job = s.planning_job
                      const log = logs?.find(l => l.planning_job_id === job?.id)
                      const rolls = log?.good_rolls ?? null
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-brand-300 font-semibold text-sm">{s.lot_no}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-200 text-sm">{prod?.part_name ?? '-'}</p>
                            {size && <p className="text-slate-500 text-xs mt-0.5">{size} มิล</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-sm">{so?.so_no ?? '-'}</td>
                          <td className="px-4 py-3 text-right">
                            {rolls
                              ? <span className="text-yellow-300 font-semibold">{rolls.toLocaleString()} <span className="text-yellow-500/60 text-xs font-normal">ม้วน</span></span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-green-300 font-semibold">{formatNumber(s.qty)}</span>
                            <span className="text-green-500/60 text-xs ml-1">kg</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{s.location ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(s.received_at)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-slate-800/60 border-t-2 border-slate-700 font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-2.5 text-slate-300">รวม</td>
                      <td className="px-4 py-2.5 text-right text-yellow-300">
                        {(() => { const t = prodStock.reduce((sum,s) => { const log = logs?.find(l=>l.planning_job_id===s.planning_job_id); return sum + (log?.good_rolls??0) },0); return t > 0 ? `${t.toLocaleString()} ม้วน` : '—' })()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-300">{formatNumber(totalProdQty)} kg</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      </> /* end production tab */}

      {/* ══ TAB: old — สต็อกคลังเก่า ═════════════════════════════════ */}
      {activeTab === 'old' && <>

      {/* ── สต็อกคลังเก่า (กรอกด้วยมือ) ──────────────────────────────────── */}
      {(() => {
        const oldStock = goodStock.filter(s => !s.planning_job_id)
        type OldGroup = { productName: string; totalQty: number; unit: string; lots: typeof oldStock }
        const groups: OldGroup[] = []
        oldStock.forEach(s => {
          const key = s.product?.part_name ?? s.product_id
          const existing = groups.find(g => g.productName === key)
          if (existing) { existing.lots.push(s); existing.totalQty += s.qty }
          else groups.push({ productName: s.product?.part_name ?? '-', unit: s.unit, totalQty: s.qty, lots: [s] })
        })
        return (
          <div className="bg-slate-900 border-2 border-amber-600/40 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-amber-600/30 flex items-center justify-between bg-amber-500/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-200 font-medium text-sm">สต็อกคลังเก่า</span>
                <span className="text-amber-400/60 text-xs">(กรอกโดยคลัง — วางแผนดึงใช้ได้)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-300 text-sm font-semibold">{formatNumber(oldStock.reduce((s,i)=>s+i.qty,0))} kg</span>
                <span className="text-slate-500 text-xs">{oldStock.length} Lot</span>
                <button
                  onClick={openManualModal}
                  className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <PackagePlus size={12} /> เพิ่ม
                </button>
              </div>
            </div>
            {stockLoading ? (
              <div className="p-4"><TableSkeleton rows={2} /></div>
            ) : oldStock.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-500 text-sm">ยังไม่มีสต็อกคลังเก่า</p>
                <button onClick={openManualModal} className="mt-3 flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg transition-colors mx-auto">
                  <PackagePlus size={14} /> เพิ่มสต็อกคลังเก่า
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-amber-600/20 bg-amber-500/5 text-xs text-amber-400/70 font-medium">
                      <th className="text-left px-4 py-2.5">Lot No.</th>
                      <th className="text-left px-4 py-2.5">สินค้า / Size</th>
                      <th className="text-right px-4 py-2.5 text-yellow-400">ม้วน</th>
                      <th className="text-right px-4 py-2.5 text-amber-300">KG</th>
                      <th className="text-left px-4 py-2.5">ตำแหน่ง</th>
                      <th className="text-left px-4 py-2.5">วันที่กรอก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-600/10">
                    {oldStock.map(s => {
                      const locParts = (s.location ?? '').split(' | ')
                      const rollsPart = locParts.find(p => /^\d+ม้วน$/.test(p))
                      const locPart   = locParts.filter(p => !/^\d+ม้วน$/.test(p)).join(' | ')
                      const rolls = rollsPart ? parseInt(rollsPart) : null
                      const prod = s.product
                      const size = prod?.width && prod?.thickness ? `${prod.width}×${prod.thickness}` : null
                      return (
                        <tr key={s.id} className="hover:bg-amber-500/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-amber-300 font-semibold text-sm">{s.lot_no}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-amber-100 text-sm">{prod?.part_name ?? '-'}</p>
                            {size && <p className="text-amber-600/70 text-xs mt-0.5">{size} มิล</p>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {rolls
                              ? <span className="text-yellow-300 font-semibold">{rolls.toLocaleString()} <span className="text-yellow-500/60 text-xs font-normal">ม้วน</span></span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-amber-300 font-semibold">{formatNumber(s.qty)}</span>
                            <span className="text-amber-500/60 text-xs ml-1">kg</span>
                          </td>
                          <td className="px-4 py-3 text-amber-600/70 text-xs">{locPart || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(s.received_at)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-amber-500/10 border-t-2 border-amber-600/30 font-semibold text-sm">
                      <td colSpan={2} className="px-4 py-2.5 text-amber-200">รวม</td>
                      <td className="px-4 py-2.5 text-right text-yellow-300">
                        {(() => {
                          const t = oldStock.reduce((sum,s) => {
                            const lp = (s.location??'').split(' | ')
                            const rp = lp.find(p=>/^\d+ม้วน$/.test(p))
                            return sum + (rp ? parseInt(rp) : 0)
                          },0)
                          return t > 0 ? `${t.toLocaleString()} ม้วน` : '—'
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-300">{formatNumber(oldStock.reduce((s,i)=>s+i.qty,0))} kg</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      </> /* end old tab */}

      {/* ── Manual Stock Modal ──────────────────────────────────────────── */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-amber-600/40 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-600/30 bg-amber-500/5 rounded-t-2xl">
              <div>
                <h2 className="text-amber-200 font-semibold">เพิ่มสต็อกคลังเก่า</h2>
                <p className="text-slate-400 text-xs mt-0.5">กรอกสินค้าที่มีอยู่ก่อนเข้าระบบ — วางแผนจะดึงไปใช้ได้</p>
              </div>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* สินค้า */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">สินค้า <span className="text-red-400">*</span></label>
                <select
                  value={mProductId}
                  onChange={e => setMProductId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="">-- เลือกสินค้า --</option>
                  {(products ?? []).map(p => (
                    <option key={p.id} value={p.id}>{p.part_name} {p.item_code ? `(${p.item_code})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Lot No. */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Lot No. <span className="text-slate-500">(ถ้าไม่กรอกระบบจะสร้างให้)</span></label>
                <input
                  value={mLotNo}
                  onChange={e => setMLotNo(e.target.value)}
                  placeholder="เช่น OLD-2024-001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              {/* KG + ม้วน */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">น้ำหนัก (KG) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      value={mQty}
                      onChange={e => setMQty(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">kg</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">จำนวนม้วน</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={mRolls}
                      onChange={e => setMRolls(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-12 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">ม้วน</span>
                  </div>
                </div>
              </div>

              {/* preview */}
              {(mQty || mRolls) && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-4 text-sm">
                  {mQty && <span className="text-amber-200 font-bold">{parseFloat(mQty).toLocaleString()} <span className="text-amber-400/70 font-normal text-xs">kg</span></span>}
                  {mQty && mRolls && <span className="text-slate-600">·</span>}
                  {mRolls && <span className="text-amber-200 font-bold">{parseInt(mRolls).toLocaleString()} <span className="text-amber-400/70 font-normal text-xs">ม้วน</span></span>}
                </div>
              )}

              {/* ตำแหน่ง */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">ตำแหน่งจัดเก็บ</label>
                <input
                  value={mLocation}
                  onChange={e => setMLocation(e.target.value)}
                  placeholder="เช่น A-01, ชั้น 2"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              {(!mProductId || !mQty || parseFloat(mQty) <= 0) && (
                <p className="text-amber-400/70 text-xs">* กรุณาเลือกสินค้าและกรอกจำนวน</p>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={() => setShowManualModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm">ยกเลิก</button>
              <button
                onClick={handleAddManual}
                disabled={addManual.isPending || !mProductId || !mQty || parseFloat(mQty) <= 0}
                className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {addManual.isPending ? 'กำลังบันทึก...' : 'เพิ่มสต็อกคลังเก่า'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        const prtCalc      = prt ? (prt.inputQty - prt.wasteQty) : undefined
        const calcQty      = prtCalc ?? prt?.goodQty
          ?? ((ext.goodQty ?? 0) + (grd?.goodQty ?? 0) || receiveModal.planned_qty)
        const extRolls_    = (ext.goodRolls ?? 0) + (grd?.goodRolls ?? 0)
        const calcRolls    = prt?.goodRolls ?? (extRolls_ > 0 ? extRolls_ : undefined)
        const soPlanned    = receiveModal.sale_order?.qty ?? receiveModal.planned_qty
        const finalQty     = actualQty ? parseFloat(actualQty) : calcQty
        const finalRolls   = actualRolls ? parseInt(actualRolls) : calcRolls
        const isDiff       = actualQty !== '' && Math.abs(parseFloat(actualQty) - calcQty) > 0.01

        function handlePrintInspection() {
          const date = new Date().toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          printDocument(`ใบตรวจรับสินค้า — ${receiveModal!.sale_order?.so_no}`, `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">
              <div><div style="font-size:16px;font-weight:800">FlowPro</div><div style="font-size:10px;color:#888">ระบบจัดการการผลิต</div></div>
              <div style="text-align:right">
                <div style="font-size:18px;font-weight:800">ใบตรวจรับสินค้า</div>
                <div style="font-size:10px;color:#888">พิมพ์เมื่อ: ${date}</div>
              </div>
            </div>
            <table style="margin-bottom:16px">
              <thead><tr><th colspan="2" style="background:#f8fafc;text-align:left;padding:6px 8px;font-size:11px">ข้อมูลการผลิต</th></tr></thead>
              <tbody>
                <tr><td style="width:40%;color:#888">SO No.</td><td style="font-weight:700">${receiveModal!.sale_order?.so_no ?? '-'}</td></tr>
                <tr><td style="color:#888">Lot No.</td><td style="font-weight:700">${receiveModal!.lot_no ?? '-'}</td></tr>
                <tr><td style="color:#888">ลูกค้า</td><td>${receiveModal!.sale_order?.customer?.name ?? '-'}</td></tr>
                <tr><td style="color:#888">สินค้า</td><td>${receiveModal!.sale_order?.product?.part_name ?? '-'}</td></tr>
                <tr><td style="color:#888">ยอด SO</td><td>${formatNumber(soPlanned)} ${receiveModal!.sale_order?.unit ?? 'kg'}</td></tr>
              </tbody>
            </table>
            <h2>สรุปผลการผลิต (จากระบบ)</h2>
            <table style="margin-bottom:16px">
              <thead><tr><th>รายการ</th><th style="text-align:right">จำนวน (kg)</th><th style="text-align:right">ม้วน</th></tr></thead>
              <tbody>
                ${ext.goodQty !== undefined ? `<tr><td>ม้วนดีจากเป่า</td><td style="text-align:right">${formatNumber(ext.goodQty)}</td><td style="text-align:right">${ext.goodRolls ?? '-'}</td></tr>` : ''}
                ${grd && grd.goodQty > 0 ? `<tr><td>กรอคืน</td><td style="text-align:right">+${formatNumber(grd.goodQty)}</td><td style="text-align:right">${grd.goodRolls ?? '-'}</td></tr>` : ''}
                ${prt && prt.goodQty !== undefined ? `<tr><td>ม้วนพิมพ์</td><td style="text-align:right">${formatNumber(prt.goodQty!)}</td><td style="text-align:right">${prt.goodRolls ?? '-'}</td></tr>` : ''}
                ${ext.wasteQty > 0 ? `<tr><td style="color:#dc2626">เศษเป่า</td><td style="text-align:right;color:#dc2626">${formatNumber(ext.wasteQty)}</td><td></td></tr>` : ''}
                ${grd && grd.wasteQty > 0 ? `<tr><td style="color:#dc2626">เศษกรอ</td><td style="text-align:right;color:#dc2626">${formatNumber(grd.wasteQty)}</td><td></td></tr>` : ''}
                ${prt && prt.wasteQty > 0 ? `<tr><td style="color:#dc2626">เศษพิมพ์</td><td style="text-align:right;color:#dc2626">${formatNumber(prt.wasteQty)}</td><td></td></tr>` : ''}
                <tr class="total-row"><td>ยอดรับเข้าคลัง (ระบบ)</td><td style="text-align:right">${formatNumber(calcQty)}</td><td style="text-align:right">${calcRolls ?? '-'}</td></tr>
              </tbody>
            </table>
            <h2>บันทึกการตรวจรับ (คลังกรอก)</h2>
            <table>
              <thead><tr><th>รายการ</th><th style="text-align:right">ตามระบบ</th><th style="text-align:right">นับจริง</th><th style="text-align:right">ผลต่าง</th><th>หมายเหตุ</th></tr></thead>
              <tbody>
                <tr>
                  <td>จำนวน (kg)</td>
                  <td style="text-align:right">${formatNumber(calcQty)}</td>
                  <td style="text-align:right;border-bottom:1px solid #111;min-width:80px">&nbsp;</td>
                  <td style="text-align:right;border-bottom:1px solid #111;min-width:60px">&nbsp;</td>
                  <td style="border-bottom:1px solid #111;min-width:120px">&nbsp;</td>
                </tr>
                <tr>
                  <td>จำนวนม้วน</td>
                  <td style="text-align:right">${calcRolls ?? '-'}</td>
                  <td style="text-align:right;border-bottom:1px solid #111">&nbsp;</td>
                  <td style="text-align:right;border-bottom:1px solid #111">&nbsp;</td>
                  <td style="border-bottom:1px solid #111">&nbsp;</td>
                </tr>
                <tr><td>ตำแหน่งจัดเก็บ</td><td colspan="4" style="border-bottom:1px solid #111">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>
              </tbody>
            </table>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:40px">
              ${['ผู้ตรวจรับ (คลัง)','ผู้ส่งมอบ (ผลิต)','ผู้อนุมัติ'].map(l => `
                <div style="text-align:center">
                  <div style="height:48px"></div>
                  <div style="border-top:1px solid #aaa;padding-top:4px;font-size:10px;color:#777">${l}</div>
                </div>`).join('')}
            </div>
          `)
        }

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h2 className="text-white font-semibold">รับเข้าคลัง</h2>
                  <p className="text-slate-400 text-xs mt-0.5">SO {receiveModal.sale_order?.so_no} · Lot {receiveModal.lot_no}</p>
                </div>
                <button onClick={() => setReceiveModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>

              <div className="p-5 space-y-4">
                {/* ── ขั้นตอนที่ 1: พิมพ์ใบตรวจ ── */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-300 text-sm font-semibold">ขั้นตอนที่ 1 — พิมพ์ใบตรวจรับ</p>
                      <p className="text-slate-400 text-xs mt-0.5">พิมพ์แล้วนำไปเช็คสินค้ากับของจริง</p>
                    </div>
                    <button
                      onClick={handlePrintInspection}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
                    >
                      <Printer size={14} /> พิมพ์ใบตรวจรับ
                    </button>
                  </div>
                </div>

                {/* ── สรุปการผลิตจากระบบ ── */}
                <div className="bg-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="text-slate-400 font-medium text-[11px] uppercase tracking-wider mb-2">ยอดจากระบบ (ผลผลิตจริง)</p>
                  <div className="space-y-1">
                    {ext.goodQty !== undefined && <div className="flex justify-between"><span className="text-slate-400">เป่าได้{ext.goodRolls ? ` ${ext.goodRolls} ม้วน` : ''}</span><span className="text-slate-300">{formatNumber(ext.goodQty)} kg</span></div>}
                    {ext.badQty > 0 && <div className="flex justify-between"><span className="text-slate-500">⚙ กรอคืน</span><span className="text-slate-500">+{formatNumber(grd?.goodQty ?? 0)} kg</span></div>}
                    {ext.wasteQty > 0 && <div className="flex justify-between"><span className="text-red-400">✗ เศษเป่า</span><span className="text-red-300">{formatNumber(ext.wasteQty)} kg</span></div>}
                    {grd && grd.wasteQty > 0 && <div className="flex justify-between"><span className="text-red-400">✗ เศษกรอ</span><span className="text-red-300">{formatNumber(grd.wasteQty)} kg</span></div>}
                    {prt && prt.wasteQty > 0 && <div className="flex justify-between"><span className="text-red-400">✗ เศษพิม</span><span className="text-red-300">{formatNumber(prt.wasteQty)} kg</span></div>}
                    {totalLoss > 0 && <div className="flex justify-between text-red-400 border-t border-slate-700 pt-1"><span>รวมเสีย</span><span>{formatNumber(totalLoss)} kg</span></div>}
                    <div className="flex justify-between text-green-300 border-t border-slate-700 pt-1 font-semibold">
                      <span>ยอดรับ (ระบบ)</span>
                      <span>{formatNumber(calcQty)} kg{calcRolls ? ` · ${calcRolls} ม้วน` : ''}</span>
                    </div>
                  </div>
                </div>

                {/* ── ขั้นตอนที่ 2: คีย์ยอดจริง ── */}
                <div className="space-y-2">
                  <p className="text-slate-300 text-sm font-semibold">ขั้นตอนที่ 2 — คีย์ยอดตามจริง <span className="text-slate-500 font-normal text-xs">(ถ้าไม่ตรง)</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">จำนวนจริง (kg)</label>
                      <input
                        type="number"
                        value={actualQty}
                        onChange={e => setActualQty(e.target.value)}
                        placeholder={calcQty.toFixed(2)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">จำนวนม้วนจริง</label>
                      <input
                        type="number"
                        value={actualRolls}
                        onChange={e => setActualRolls(e.target.value)}
                        placeholder={calcRolls?.toString() ?? '0'}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                  {isDiff && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs">
                      <span className="text-yellow-300 font-medium">ผลต่าง:</span>
                      <span className="text-yellow-200">{(parseFloat(actualQty) - calcQty).toFixed(2)} kg</span>
                      <span className="text-slate-500">จากระบบ {formatNumber(calcQty)} kg</span>
                    </div>
                  )}
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

                {/* ยอดที่จะบันทึก */}
                <div className={`rounded-xl px-4 py-3 text-center border ${isDiff ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                  <p className="text-slate-400 text-xs mb-1">
                    {isDiff ? 'ยอดที่จะบันทึก (ตามจริง)' : 'ยอดที่จะบันทึก (ตามระบบ)'}
                  </p>
                  <p className={`text-2xl font-bold ${isDiff ? 'text-yellow-300' : 'text-green-300'}`}>
                    {formatNumber(finalQty)} kg
                  </p>
                  {finalRolls && <p className={`text-sm mt-0.5 ${isDiff ? 'text-yellow-400' : 'text-green-400'}`}>{finalRolls} ม้วน</p>}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setReceiveModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm">ยกเลิก</button>
                  <button
                    onClick={() => handleReceive(calcQty)}
                    disabled={receive.isPending}
                    className={`flex-1 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors ${isDiff ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {receive.isPending ? 'กำลังบันทึก...' : `ยืนยันรับเข้า ${formatNumber(finalQty)} kg`}
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
