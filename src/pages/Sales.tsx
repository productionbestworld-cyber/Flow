import { useState } from 'react'
import { Truck, X, Package, Clock, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { useRequisitions, useCreateRequisition } from '../hooks/useSales'
import { useSaleOrders } from '../hooks/useSaleOrders'
import { useWarehouseStock } from '../hooks/useWarehouse'
import { useAuth } from '../lib/AuthContext'
import { formatDate, formatNumber, cn } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import type { WarehouseStock } from '../types'

type ReqGroup = { lots: WarehouseStock[]; soId: string; soNo: string }

export default function Sales() {
  const { user } = useAuth()
  const { data: reqs, isLoading } = useRequisitions()
  const { data: orders } = useSaleOrders()
  const { data: stock } = useWarehouseStock()
  const createReq = useCreateRequisition()

  const [reqGroup, setReqGroup]   = useState<ReqGroup | null>(null)
  // qty per lot — keyed by stock_id
  const [lotQtys, setLotQtys]     = useState<Record<string, string>>({})

  const goodStock = stock?.filter(s => s.condition === 'good') ?? []
  const dispatchedSoIds = new Set(reqs?.filter(r => r.status === 'dispatched').map(r => r.sale_order_id) ?? [])
  // SO ที่มีใบเบิกอยู่แล้ว (pending/approved) — ซ่อนปุ่มเบิก
  const pendingSoIds = new Set(reqs?.filter(r => ['pending','approved'].includes(r.status)).map(r => r.sale_order_id) ?? [])
  const activeOrders = orders?.filter(o => !dispatchedSoIds.has(o.id) && ['approved','in_planning','in_production','completed'].includes(o.status)) ?? []

  const pendingCount    = reqs?.filter(r => r.status === 'pending').length ?? 0
  const approvedCount   = reqs?.filter(r => r.status === 'approved').length ?? 0
  const dispatchedCount = reqs?.filter(r => r.status === 'dispatched').length ?? 0

  function openReqGroup(lots: WarehouseStock[], soId: string, soNo: string) {
    setReqGroup({ lots, soId, soNo })
    // default qty = stock qty ของแต่ละ lot
    const init: Record<string, string> = {}
    lots.forEach(l => { init[l.id] = l.qty.toString() })
    setLotQtys(init)
  }

  async function handleSubmitReq() {
    if (!user || !reqGroup) return
    const items = reqGroup.lots
      .map(l => ({
        stock_id: l.id,
        qty: l.lot_no.startsWith('STK-') ? l.qty : (parseFloat(lotQtys[l.id] || '0') || 0),
      }))
      .filter(i => i.qty > 0)
    if (items.length === 0) return
    await createReq.mutateAsync({ sale_order_id: reqGroup.soId, items, requested_by: user.id })
    setReqGroup(null)
  }



  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sales</h1>
          <p className="text-slate-400 text-sm mt-0.5">จัดการใบเบิกสินค้า (Requisition)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'รออนุมัติ',  value: pendingCount,    color: 'text-yellow-400' },
          { label: 'อนุมัติแล้ว', value: approvedCount,  color: 'text-blue-400'   },
          { label: 'จัดส่งแล้ว', value: dispatchedCount, color: 'text-green-400'  },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* สต็อกพร้อมจ่าย — จัดกลุ่มตาม SO */}
      {goodStock.length > 0 && (() => {
        // จัดกลุ่ม lot ตาม SO no
        type StockGroup = { soNo: string; soId?: string; productName: string; unit: string; lots: typeof goodStock; totalQty: number }
        const groups: StockGroup[] = []


        goodStock.forEach(s => {
          // หา SO จาก planning_job หรือ lot_no prefix STK-{so_no}-
          const soFromJob = s.planning_job?.sale_order
          let soNo = soFromJob?.so_no ?? ''
          let soIdFound = soFromJob?.id

          if (!soNo && s.lot_no.startsWith('STK-')) {
            // STK-111111-260502 → so_no = 111111
            const parts = s.lot_no.split('-')
            if (parts.length >= 2) soNo = parts[1]
          }

          const key = soNo || s.id
          const existing = groups.find(g => g.soNo === key)
          if (existing) {
            existing.lots.push(s)
            existing.totalQty += s.qty
          } else {
            groups.push({ soNo: key, soId: soIdFound, productName: s.product?.part_name ?? '-', unit: s.unit, lots: [s], totalQty: s.qty })
          }
        })

        return (
          <div className="bg-slate-900 border border-green-500/20 rounded-xl">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
              <Package size={16} className="text-green-400" />
              <span className="text-white font-medium text-sm">สต็อกพร้อมจ่าย</span>
              <span className="ml-auto bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full">{groups.length} SO</span>
            </div>
            <div className="divide-y divide-slate-800">
              {groups.map(g => (
                <div key={g.soNo} className="px-5 py-4">
                  {/* SO header row */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {g.soNo && <span className="text-white text-sm font-bold">{g.soNo}</span>}
                        <span className="text-slate-300 text-sm truncate">{g.productName}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{g.lots.length} Lot{g.lots.length > 1 ? ` · รวม` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-white font-bold text-base">{formatNumber(g.totalQty)} {g.unit}</p>
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">พร้อมจ่าย</span>
                      </div>
                      {(() => {
                        const resolvedSoId = g.soId ?? activeOrders.find(o => o.so_no === g.soNo)?.id
                        if (!resolvedSoId) return <span className="text-slate-500 text-xs">ไม่พบ SO</span>
                        if (pendingSoIds.has(resolvedSoId)) return (
                          <span className="flex items-center gap-1 text-yellow-400 text-xs">
                            <Clock size={12} /> รอคลัง
                          </span>
                        )
                        return (
                          <button
                            onClick={() => openReqGroup(g.lots, resolvedSoId, g.soNo)}
                            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <ShoppingCart size={13} /> เบิก
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                  {/* individual lots */}
                  <div className="space-y-1 pl-2 border-l-2 border-slate-800">
                    {g.lots.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-mono">{s.lot_no}</span>
                        <span className="text-slate-400">{formatNumber(s.qty)} {s.unit} · {formatDate(s.received_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {goodStock.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-8 text-center text-slate-500 text-sm">
          ยังไม่มีสินค้าในคลัง
        </div>
      )}

      {/* ใบเบิกทั้งหมด */}
      {(reqs?.length ?? 0) > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <span className="text-white font-medium text-sm">ใบเบิกทั้งหมด</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">SO No.</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">ลูกค้า</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">สินค้า</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">วันที่</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">สถานะ</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="p-4"><TableSkeleton rows={4} /></td></tr>
              ) : reqs?.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{r.sale_order?.so_no}</td>
                  <td className="px-4 py-3 text-slate-300">{r.sale_order?.customer?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{r.sale_order?.product?.part_name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'pending' && (
                        <span className="flex items-center gap-1 text-yellow-400 text-xs">
                          <Clock size={12} /> รอคลังอนุมัติ
                        </span>
                      )}
                      {r.status === 'approved' && (
                        <span className="flex items-center gap-1 text-blue-300 text-xs">
                          <Clock size={12} /> รอคลังปล่อยของ
                        </span>
                      )}
                      {r.status === 'dispatched' && (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <Truck size={12} /> จัดส่งแล้ว
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Requisition Modal ─── */}
      {reqGroup && (() => {
        const so = orders?.find(o => o.id === reqGroup.soId)
        const totalReq = reqGroup.lots.reduce((s, l) => {
          if (l.lot_no.startsWith('STK-')) return s + l.qty  // STK = เต็มจำนวน
          return s + (parseFloat(lotQtys[l.id] || '0') || 0)
        }, 0)
        const unit = reqGroup.lots[0]?.unit ?? 'kg'
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-white font-semibold">สร้างใบเบิก</h2>
                  <p className="text-slate-400 text-xs mt-0.5">SO {reqGroup.soNo}</p>
                </div>
                <button onClick={() => setReqGroup(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* SO info */}
                {so && (
                  <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-base">{so.so_no}</span>
                      <StatusBadge status={so.status} />
                    </div>
                    <p className="text-slate-400 text-xs">{so.customer?.name}</p>
                    <p className="text-slate-300 text-xs">{so.product?.part_name}</p>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700 text-center text-xs">
                      <div><p className="text-slate-500">ลูกค้าสั่ง</p><p className="text-white font-bold">{formatNumber(so.qty)} {so.unit}</p></div>
                      <div><p className="text-green-500">สต็อกเดิม</p><p className="text-green-300 font-bold">{formatNumber((so as any).stock_qty ?? 0)} {so.unit}</p></div>
                      {so.delivery_date && <div><p className="text-slate-500">กำหนดส่ง</p><p className="text-slate-300">{formatDate(so.delivery_date)}</p></div>}
                    </div>
                  </div>
                )}

                {/* Lots + qty input */}
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">รายการ Lot</p>
                  {/* สต็อกเก่าก่อน (STK-) จากนั้นผลิตใหม่ */}
                  {[...reqGroup.lots].sort((a, b) => (b.lot_no.startsWith('STK-') ? 1 : 0) - (a.lot_no.startsWith('STK-') ? 1 : 0))
                    .map(l => {
                      const isStk = l.lot_no.startsWith('STK-')
                      return (
                        <div key={l.id} className={cn('rounded-lg px-4 py-3 border', isStk ? 'bg-green-500/8 border-green-500/25' : 'bg-slate-800 border-slate-700')}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', isStk ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300')}>
                                  {isStk ? '📦 สต็อกเก่า' : '🏭 ผลิตใหม่'}
                                </span>
                              </div>
                              <p className="text-slate-300 text-xs font-mono">{l.lot_no}</p>
                              <p className="text-slate-500 text-[10px]">มีในสต็อก {formatNumber(l.qty)} {l.unit}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isStk ? (
                                // สต็อกเก่า — ไม่ให้แก้
                                <div className="text-right">
                                  <p className="text-green-300 font-bold text-sm">{formatNumber(l.qty)}</p>
                                  <p className="text-slate-500 text-[10px]">{l.unit} (ส่งก่อน)</p>
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="number"
                                    value={lotQtys[l.id] ?? l.qty}
                                    onChange={e => setLotQtys(prev => ({ ...prev, [l.id]: e.target.value }))}
                                    max={l.qty}
                                    className={cn(
                                      'w-24 bg-slate-700 border rounded-lg px-2 py-1.5 text-sm text-white text-right outline-none focus:border-brand-500',
                                      parseFloat(lotQtys[l.id] || '0') > l.qty ? 'border-red-500' : 'border-slate-600'
                                    )}
                                  />
                                  <span className="text-slate-400 text-xs">{l.unit}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {!isStk && parseFloat(lotQtys[l.id] || '0') > l.qty && (
                            <p className="text-red-400 text-[10px] mt-1">เกินสต็อก ({formatNumber(l.qty)} {l.unit})</p>
                          )}
                        </div>
                      )
                    })
                  }
                </div>

                {/* Total */}
                <div className={cn('rounded-lg px-4 py-3 flex items-center justify-between', totalReq > 0 ? 'bg-green-500/10 border border-green-500/25' : 'bg-slate-800 border border-slate-700')}>
                  <span className="text-slate-300 text-sm font-medium">รวมที่จะเบิก</span>
                  <span className={cn('text-lg font-bold', totalReq > 0 ? 'text-green-300' : 'text-slate-500')}>
                    {formatNumber(totalReq)} {unit}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
                <button onClick={() => setReqGroup(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm">ยกเลิก</button>
                <button
                  onClick={handleSubmitReq}
                  disabled={createReq.isPending || totalReq === 0}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={15} />
                  {createReq.isPending ? 'กำลังสร้าง...' : `ยืนยันเบิก ${formatNumber(totalReq)} ${unit}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
