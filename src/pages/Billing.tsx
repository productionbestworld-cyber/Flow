import { useState, useRef } from 'react'
import { Plus, FileText, X, Printer, Download } from 'lucide-react'
import { downloadCSV } from '../lib/csvUtils'
import { useInvoices, useCreateInvoice, useUpdateInvoiceStatus } from '../hooks/useBilling'
import { useRequisitions } from '../hooks/useSales'
import { useSaleOrders } from '../hooks/useSaleOrders'
import { formatDate, formatNumber } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import type { Invoice } from '../types'

// ─── Print Invoice ────────────────────────────────────────────────────────────

function PrintInvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)
  const so       = inv.sale_order
  const qty      = so?.qty ?? 0
  const unit     = so?.unit ?? 'kg'
  const unitPrice = qty > 0 ? inv.amount / qty : 0

  const invoiceNo = `INV-${inv.id.slice(0,8).toUpperCase()}`

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=794,height=1123')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/><title>Invoice ${invoiceNo}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Sarabun','Tahoma',sans-serif;font-size:12px;color:#000;background:#fff}
        .page{width:210mm;min-height:297mm;padding:8mm 12mm}
        table{width:100%;border-collapse:collapse}
        td,th{padding:3px 5px;font-size:11px}
        .border{border:1px solid #333}
        .border-t{border-top:1px solid #333}
        .border-b{border-bottom:1px solid #333}
        .border-l{border-left:1px solid #333}
        .border-r{border-right:1px solid #333}
        .center{text-align:center}
        .right{text-align:right}
        .bold{font-weight:700}
        .box{border:1px solid #333;padding:4px 8px}
        @media print{@page{size:A4;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style>
    </head><body><div class="page">${content}</div></body></html>`)
    win.document.close(); win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl shrink-0">
          <span className="font-semibold text-slate-700">ตัวอย่าง Invoice {invoiceNo}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
              <Printer size={15} /> พิมพ์
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="overflow-y-auto flex-1 bg-slate-100 p-4">
          <div style={{ transform: 'scale(0.83)', transformOrigin: 'top center', marginBottom: 'calc((794px * 0.83) - 794px)' }}>
          <div ref={printRef} style={{ width: 794, minHeight: '1123px', padding: '28px 34px', fontFamily: 'Sarabun, Tahoma, sans-serif', fontSize: 12, color: '#000', background: '#fff', display: 'flex', flexDirection: 'column' }}>

            {/* ── Header ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
              <tbody>
                <tr>
                  {/* Logo + Company */}
                  <td style={{ width: '55%', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 64, height: 64, border: '2px solid #003087', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#003087', flexShrink: 0 }}>BWP</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>BESTWORLD INTERPLAS CO.,LTD.</div>
                        <div style={{ fontSize: 10, marginTop: 2 }}>สำนักงานใหญ่ : 328 หมู่ 6 ต.คลองนิยมยาตรา อ.บางบ่อ จ.สมุทรปราการ 10560</div>
                        <div style={{ fontSize: 10 }}>TEL. : 0-2317-5470-3&nbsp;&nbsp;FAX : 0-2317-5474</div>
                        <div style={{ fontSize: 10 }}>เลขประจำตัวผู้เสียภาษี 0115545001637&nbsp;&nbsp;<span style={{ fontWeight: 700 }}>เอกสารออกเป็นชุด</span></div>
                      </div>
                    </div>
                  </td>
                  {/* Title */}
                  <td style={{ width: '45%', verticalAlign: 'top', textAlign: 'right' }}>
                    <div style={{ border: '2px solid #333', padding: '8px 12px', display: 'inline-block', textAlign: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>ใบกำกับภาษี/ใบส่งของ/ใบแจ้งหนี้</div>
                      <div style={{ fontSize: 11, borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>TAX INVOICE / DELIVERY ORDER / INVOICE</div>
                    </div>
                    <br />
                    <div style={{ border: '1px solid #333', padding: '6px 20px', display: 'inline-block', fontSize: 14, fontWeight: 700 }}>สำเนา<br />COPY</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Customer + Invoice Info ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: 4 }}>
              <tbody>
                <tr>
                  <td style={{ width: '55%', verticalAlign: 'top', padding: '4px 8px', borderRight: '1px solid #333' }}>
                    <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>ลูกค้า / Customer</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{so?.customer?.name ?? '-'}</div>
                    {so?.customer?.address && <div style={{ fontSize: 10 }}>{so.customer.address}</div>}
                    <div style={{ fontSize: 10, marginTop: 4 }}>
                      เลขประจำตัวผู้เสียภาษี {so?.customer?.contact ?? '........................'}
                      &nbsp;&nbsp;สาขางานใหญ่ ✓
                    </div>
                  </td>
                  <td style={{ width: '45%', verticalAlign: 'top', padding: '4px 8px' }}>
                    <table style={{ width: '100%', fontSize: 10 }}>
                      <tbody>
                        {[
                          ['เลขที่ใบกำกับ / Invoice No.', invoiceNo],
                          ['วันที่ / Date', formatDate(inv.issued_at ?? inv.created_at)],
                          ['เครดิต / Payment Term', ''],
                          ['ครบกำหนด / Due Date', ''],
                          ['เลขที่ใบส่งขาย / Sales Order No.', so?.so_no ?? ''],
                          ['พนักงานขาย / Salesman', ''],
                          ['เลขที่ใบสั่งซื้อ / Purchase Order No.', so?.po_no ?? ''],
                        ].map(([l, v]) => (
                          <tr key={l}>
                            <td style={{ color: '#555', paddingRight: 4 }}>{l}</td>
                            <td style={{ fontWeight: 600, borderBottom: '1px dotted #aaa' }}>{v || ' '}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid #333' }}>
                  <td style={{ padding: '3px 8px', borderRight: '1px solid #333', fontSize: 10 }}>
                    <span style={{ color: '#555' }}>สถานที่ส่ง / Delivery To : </span>
                    <span style={{ fontWeight: 600 }}>{so?.ship_to || 'โรงงาน'}</span>
                  </td>
                  <td style={{ padding: '3px 8px', fontSize: 10 }}>
                    <span style={{ color: '#555' }}>โทรศัพท์ / Telephone : </span>
                    <span>{so?.customer?.contact ?? ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Items Table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: 0 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {[
                    ['ลำดับ\nItem', '4%', 'center'],
                    ['รหัสสินค้า\nProduct Code', '14%', 'center'],
                    ['รายละเอียดสินค้า\nDescription', '38%', 'center'],
                    ['จำนวน\nQuantity', '14%', 'center'],
                    ['ราคา/หน่วย\nUnit Price', '15%', 'right'],
                    ['จำนวนเงิน\nAmount (Baht)', '15%', 'right'],
                  ].map(([h, w, align]) => (
                    <th key={h as string} style={{ width: w as string, border: '1px solid #333', padding: '3px 5px', textAlign: align as any, fontSize: 10, whiteSpace: 'pre-line' }}>{h as string}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #333', padding: '10px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: 12 }}>1</td>
                  <td style={{ border: '1px solid #333', padding: '10px 6px', verticalAlign: 'top', fontSize: 12 }}>
                    {so?.item_code || so?.product?.item_code || '-'}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '10px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{so?.product?.part_name}</div>
                    {so?.product?.width && so.product.thickness && (
                      <div style={{ fontSize: 11 }}>ขนาด {so.product.width} cm.x {so.product.thickness} mc.</div>
                    )}
                    {so?.length_per_roll && <div style={{ fontSize: 11 }}>{so.length_per_roll} mc.</div>}
                    {so?.rolls_per_bundle && <div style={{ fontSize: 11 }}>[ {so.rolls_per_bundle} Rolls ]</div>}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '10px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: 12 }}>
                    {formatNumber(qty, 2)} {unit}.
                  </td>
                  <td style={{ border: '1px solid #333', padding: '10px 6px', textAlign: 'right', verticalAlign: 'top', fontSize: 12 }}>
                    {formatNumber(unitPrice, 3)}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '10px 6px', textAlign: 'right', verticalAlign: 'top', fontSize: 12 }}>
                    {formatNumber(inv.amount, 2)}
                  </td>
                </tr>
                {/* Empty rows — enough to push totals near bottom */}
                {[...Array(11)].map((_, i) => (
                  <tr key={i}>
                    <td style={{ border: '1px solid #333', height: 28 }}></td>
                    <td style={{ border: '1px solid #333' }}></td>
                    <td style={{ border: '1px solid #333' }}></td>
                    <td style={{ border: '1px solid #333' }}></td>
                    <td style={{ border: '1px solid #333' }}></td>
                    <td style={{ border: '1px solid #333' }}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Notes + Totals ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', borderTop: 'none' }}>
              <tbody>
                <tr>
                  <td style={{ width: '60%', verticalAlign: 'top', padding: '5px 8px', borderRight: '1px solid #333', fontSize: 9 }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>หมายเหตุ :</div>
                    {[
                      '1. เมื่อสินค้าระส่งมอบแล้วถือว่าตกเป็นกรรมสิทธิ์ของผู้ซื้อ จนกว่าผู้ซื้อได้ชำระเงินเรียบร้อยแล้ว',
                      '2. ในกรณีรับสินค้าแบบนับจะสะสมมูลค่าเมื่อ ได้รับการชำระเงินตัวแทนสหรัฐที่ที่ระบุเงื่อนไขในใบรับมอบสินค้าแล้ว',
                      '3. บริษัทฯ จะคิดค่าปรับในอัตรา 1.5% ต่อเดือน เมื่อเกินกำหนดเวลาการชำระเงิน',
                      '4. โปรดสั่งจ่ายเงินนาม " บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด " เท่านั้น และขีดคร่อมหน้าตั๋ว',
                    ].map((n, i) => <div key={i} style={{ marginBottom: 2 }}>{n}</div>)}
                  </td>
                  <td style={{ width: '40%', verticalAlign: 'top', padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      {[
                        ['ราคาสินค้า / Sub Total', formatNumber(inv.amount, 2)],
                        [`ภาษีมูลค่าเพิ่ม / Value Added Tax 7%`, formatNumber(inv.tax, 2)],
                        ['รวมทั้งสิ้น / Total Amount', formatNumber(inv.total, 2)],
                      ].map(([l, v], i) => (
                        <tr key={l} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '5px 8px', color: '#444', borderRight: '1px solid #333' }}>{l}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: i === 2 ? 700 : 400 }}>{v}</td>
                        </tr>
                      ))}
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Remarks line ── */}
            <div style={{ border: '1px solid #333', borderTop: 'none', padding: '4px 8px', fontSize: 10 }}>
              <span style={{ fontWeight: 600 }}>ตัวอักษร : </span>
              <span>{numberToThaiText(inv.total)}</span>
            </div>

            {/* ── Signatures ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', borderTop: 'none', marginBottom: 4 }}>
              <tbody>
                <tr>
                  <td style={{ width: '33%', padding: '12px 8px 6px', borderRight: '1px solid #333', fontSize: 10, textAlign: 'center' }}>
                    <div style={{ marginBottom: 2 }}>ได้รับสินค้าตามรายการข้างบน ไร้ข้อคัดแย้ง</div>
                    <div style={{ height: 28, borderBottom: '1px solid #555', marginBottom: 4 }}></div>
                    <div>ผู้รับสินค้า ________________________</div>
                    <div style={{ marginTop: 4 }}>วันที่ ___________________________</div>
                  </td>
                  <td style={{ width: '33%', padding: '12px 8px 6px', borderRight: '1px solid #333', fontSize: 10, textAlign: 'center' }}>
                    <div style={{ height: 28, borderBottom: '1px solid #555', marginBottom: 4 }}></div>
                    <div>ผู้ส่งสินค้า ________________________</div>
                    <div style={{ marginTop: 4 }}>วันที่ ___________________________</div>
                  </td>
                  <td style={{ width: '34%', padding: '12px 8px 6px', fontSize: 10, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</div>
                    <div style={{ height: 28, borderBottom: '1px solid #555', marginBottom: 4 }}></div>
                    <div>ผู้มีอำนาจลงนาม</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: 10, color: '#555' }}>สำหรับลูกค้า</div>

          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Thai number to text (simplified)
function numberToThaiText(n: number): string {
  const f = Math.floor(n)
  const d = Math.round((n - f) * 100)
  const ones = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']

  function u(x: number): string {
    if (x === 0) return 'ศูนย์'
    const parts: string[] = []
    const digits = [1e6, 1e5, 1e4, 1e3, 100, 10, 1]
    const names  = ['ล้าน', 'แสน', 'หมื่น', 'พัน', 'ร้อย', '', '']
    let rem = x
    digits.forEach((d, i) => {
      const q = Math.floor(rem / d)
      rem %= d
      if (q) {
        if (i === 5) parts.push(q === 1 ? 'สิบ' : q === 2 ? 'ยี่สิบ' : `${ones[q]}สิบ`)
        else parts.push(`${ones[q]}${names[i]}`)
      }
    })
    return parts.join('')
  }
  return `${u(f)}บาท${d > 0 ? `${u(d)}สตางค์` : 'ถ้วน'}`
}

// ─── Main Billing Page ────────────────────────────────────────────────────────

export default function Billing() {
  const { data: invoices, isLoading } = useInvoices()
  const { data: reqs }   = useRequisitions()
  const { data: orders } = useSaleOrders()
  const createInv    = useCreateInvoice()
  const updateStatus = useUpdateInvoiceStatus()

  const [showForm, setShowForm]    = useState(false)
  const [printInv, setPrintInv]    = useState<Invoice | null>(null)

  // Form state — editable fields
  const [soId, setSoId]            = useState('')
  const [unitPrice, setUnitPrice]  = useState('')
  const [taxPct, setTaxPct]        = useState('7')
  const [overrideCustomer, setOC]  = useState('')
  const [overrideAddress, setOA]   = useState('')
  const [overrideTel, setOT]       = useState('')
  const [overrideDelivery, setOD]  = useState('')
  const [overrideDesc, setODesc]   = useState('')
  const [overrideQty, setOQty]     = useState('')
  const [overrideRemark, setORem]  = useState('')

  const so         = orders?.find(o => o.id === soId)
  const qty        = parseFloat(overrideQty) || so?.qty || 0
  const subTotal   = qty > 0 && unitPrice ? qty * parseFloat(unitPrice) : 0
  const taxAmount  = subTotal * (parseFloat(taxPct) / 100)
  const total      = subTotal + taxAmount

  const dispatchedReqs  = reqs?.filter(r => r.status === 'dispatched') ?? []
  const invoicedSoIds   = new Set(invoices?.filter(i => i.status !== 'cancelled').map(i => i.sale_order_id) ?? [])
  const completedOrders = orders?.filter(o => o.status === 'completed' && !invoicedSoIds.has(o.id)) ?? []
  const totalRevenue    = invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0) ?? 0
  const pendingRevenue  = invoices?.filter(i => i.status === 'issued').reduce((s, i) => s + i.total, 0) ?? 0

  function openForm() {
    setSoId(''); setUnitPrice(''); setTaxPct('7')
    setOC(''); setOA(''); setOT(''); setOD(''); setODesc(''); setOQty(''); setORem('')
    setShowForm(true)
  }

  function handleSoChange(id: string) {
    setSoId(id)
    const o = orders?.find(x => x.id === id)
    if (!o) return
    setOC(o.customer?.name ?? '')
    setOA(o.customer?.address ?? '')
    setOD(o.ship_to ?? 'โรงงาน')
    setOT(o.customer?.contact ?? '')
    setODesc(o.product?.part_name ?? '')
    setOQty(o.qty.toString())
    setORem(o.remark ?? '')
  }

  async function handleCreate() {
    if (!soId || !unitPrice) return
    const reqId = dispatchedReqs.find(r => r.sale_order_id === soId)?.id
    const inv = await createInv.mutateAsync({ sale_order_id: soId, requisition_id: reqId, amount: subTotal, tax: taxAmount })
    await updateStatus.mutateAsync({ id: inv.id, status: 'issued' })
    setShowForm(false)
    setPrintInv(inv)
  }



  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Billing</h1>
          <p className="text-slate-400 text-sm mt-0.5">ใบแจ้งหนี้และการชำระเงิน</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => {
              const headers = ['Invoice No.','SO No.','ลูกค้า','ยอดก่อน VAT','VAT 7%','ยอดรวม','วันที่ออก','สถานะ']
              const rows = (invoices ?? []).map(inv => [
                inv.id.slice(0,8), inv.sale_order?.so_no ?? '', inv.sale_order?.customer?.name ?? '',
                inv.amount ?? '', inv.tax ?? '', inv.total ?? '',
                formatDate(inv.issued_at), inv.status,
              ])
              downloadCSV(`invoices_${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> Export
          </button>
          <button onClick={openForm} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> ออกใบแจ้งหนี้
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-sm">รายได้รวม (ชำระแล้ว)</p>
          <p className="text-2xl font-bold text-green-400 mt-1">฿{formatNumber(totalRevenue)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-sm">รอชำระ</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">฿{formatNumber(pendingRevenue)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">SO No.</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">ลูกค้า</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">ก่อน VAT</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">VAT 7%</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">รวม</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">วันที่</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">สถานะ</th>
              <th className="px-4 py-3 w-36" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              <tr><td colSpan={8} className="p-4"><TableSkeleton rows={4} /></td></tr>
            ) : !invoices?.length ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-500">ยังไม่มีใบแจ้งหนี้</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{inv.sale_order?.so_no}</td>
                <td className="px-4 py-3 text-slate-300">{inv.sale_order?.customer?.name ?? '-'}</td>
                <td className="px-4 py-3 text-right text-slate-300">฿{formatNumber(inv.amount)}</td>
                <td className="px-4 py-3 text-right text-slate-400">฿{formatNumber(inv.tax)}</td>
                <td className="px-4 py-3 text-right text-white font-medium">฿{formatNumber(inv.total)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(inv.issued_at ?? inv.created_at)}</td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setPrintInv(inv)} title="พิมพ์ Invoice" className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"><Printer size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <h2 className="text-white font-semibold">ออกใบแจ้งหนี้</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* SO selection */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Sale Order *</label>
                <select value={soId} onChange={e => handleSoChange(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500">
                  <option value="">-- เลือก SO --</option>
                  {completedOrders.map(o => <option key={o.id} value={o.id}>{o.so_no} — {o.customer?.name} ({formatNumber(o.qty)} {o.unit})</option>)}
                </select>
              </div>

              {soId && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">ชื่อลูกค้า</label>
                      <input value={overrideCustomer} onChange={e => setOC(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">โทรศัพท์</label>
                      <input value={overrideTel} onChange={e => setOT(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">ที่อยู่ลูกค้า</label>
                    <input value={overrideAddress} onChange={e => setOA(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">สถานที่ส่ง</label>
                    <input value={overrideDelivery} onChange={e => setOD(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                  </div>

                  <div className="border-t border-slate-800 pt-3">
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">รายละเอียดสินค้า</label>
                    <input value={overrideDesc} onChange={e => setODesc(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">จำนวน ({so?.unit})</label>
                      <input type="number" value={overrideQty} onChange={e => setOQty(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">ราคา/หน่วย (บาท) *</label>
                      <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.000" className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">VAT</label>
                      <select value={taxPct} onChange={e => setTaxPct(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500">
                        <option value="0">0%</option>
                        <option value="7">7%</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">หมายเหตุ</label>
                    <input value={overrideRemark} onChange={e => setORem(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500" />
                  </div>

                  {/* Summary */}
                  {subTotal > 0 && (
                    <div className="bg-slate-800 rounded-lg p-4 space-y-1.5 text-sm border border-slate-700">
                      <div className="flex justify-between text-slate-400"><span>{formatNumber(qty)} {so?.unit} × {formatNumber(parseFloat(unitPrice), 3)} บาท</span><span>฿{formatNumber(subTotal, 2)}</span></div>
                      <div className="flex justify-between text-slate-400"><span>VAT {taxPct}%</span><span>฿{formatNumber(taxAmount, 2)}</span></div>
                      <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2"><span>รวมทั้งสิ้น</span><span className="text-green-300">฿{formatNumber(total, 2)}</span></div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm">ยกเลิก</button>
              <button onClick={handleCreate} disabled={!soId || !unitPrice || createInv.isPending} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <FileText size={15} /> {createInv.isPending ? 'กำลังออก...' : 'ออกใบแจ้งหนี้ + พิมพ์'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Invoice Modal */}
      {printInv && <PrintInvoiceModal inv={printInv} onClose={() => setPrintInv(null)} />}
    </div>
  )
}
