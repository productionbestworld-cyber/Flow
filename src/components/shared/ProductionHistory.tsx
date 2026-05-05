import { useState } from 'react'
import { History, ChevronDown, ChevronRight, Wind, Printer, Cog, Package, CheckCircle2, Clock } from 'lucide-react'
import { formatNumber, cn } from '../../lib/utils'
import type { PlanningJob, ProductionLog, PlanningDept } from '../../types'

interface Props {
  dept: PlanningDept
  jobs: PlanningJob[]
  logs: ProductionLog[]
}

function formatTs(ts?: string) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function DeptBadge({ dept }: { dept: PlanningDept }) {
  if (dept === 'printing') return <span className="flex items-center gap-1 text-purple-300 text-[10px] bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded"><Printer size={9} /> Printing</span>
  if (dept === 'grinding') return <span className="flex items-center gap-1 text-orange-300 text-[10px] bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.5 rounded"><Cog size={9} /> Grinding</span>
  return <span className="flex items-center gap-1 text-brand-300 text-[10px] bg-brand-500/15 border border-brand-500/30 px-1.5 py-0.5 rounded"><Wind size={9} /> Blow</span>
}

function StatusDot({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 size={13} className="text-green-400 shrink-0" />
  if (status === 'pending_receipt') return <Package size={13} className="text-yellow-400 shrink-0" />
  return <Clock size={13} className="text-slate-500 shrink-0" />
}

export default function ProductionHistory({ dept, jobs, logs }: Props) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [expandedSOs, setExpandedSOs] = useState<Set<string>>(new Set())

  function toggleSO(soId: string) {
    setExpandedSOs(prev => {
      const next = new Set(prev)
      next.has(soId) ? next.delete(soId) : next.add(soId)
      return next
    })
  }

  // งานที่เสร็จแล้วของ dept นี้
  const doneJobs = jobs.filter(j => j.dept === dept && (j.status === 'done' || j.status === 'pending_receipt'))

  // จัดกลุ่มตาม SO
  const grouped = doneJobs.reduce<Record<string, PlanningJob[]>>((acc, j) => {
    const key = j.sale_order_id
    if (!acc[key]) acc[key] = []
    acc[key].push(j)
    return acc
  }, {})

  const soIds = Object.keys(grouped).sort((a, b) => {
    const latestA = Math.max(...grouped[a].map(j => new Date(j.created_at).getTime()))
    const latestB = Math.max(...grouped[b].map(j => new Date(j.created_at).getTime()))
    return latestB - latestA
  })

  if (soIds.length === 0) return null

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Panel header */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History size={15} className="text-slate-400" />
          <span className="text-slate-300 font-medium text-sm">ประวัติการผลิต</span>
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{soIds.length} SO</span>
        </div>
        {panelOpen ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
      </button>

      {panelOpen && (
        <div className="border-t border-slate-800 divide-y divide-slate-800">
          {soIds.map(soId => {
            const soJobs  = grouped[soId]
            const so      = soJobs[0]?.sale_order
            const isOpen  = expandedSOs.has(soId)

            // สรุปยอดรวมของ SO นี้ใน dept นี้
            const totalPlanned = soJobs.reduce((s, j) => s + j.planned_qty, 0)
            const soLogs = soJobs.map(j => logs.find(l => l.planning_job_id === j.id))
            const totalGood  = soLogs.reduce((s, l) => s + (l?.good_qty   ?? 0), 0)
            const totalWaste = soLogs.reduce((s, l) => s + (l?.waste_qty  ?? 0), 0)
            const totalRolls = soLogs.reduce((s, l) => s + (l?.good_rolls ?? 0), 0)
            const allDone = soJobs.every(j => j.status === 'done')
            const yieldPct = totalGood > 0 && totalPlanned > 0 ? Math.round(totalGood / totalPlanned * 100) : null

            return (
              <div key={soId}>
                {/* SO row — คลิกเพื่อขยาย */}
                <button
                  onClick={() => toggleSO(soId)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors text-left"
                >
                  {isOpen
                    ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
                    : <ChevronRight size={14} className="text-slate-500 shrink-0" />
                  }

                  {/* SO info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-bold">{so?.so_no ?? '-'}</span>
                      <DeptBadge dept={dept} />
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', allDone ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300')}>
                        {allDone ? 'เสร็จแล้ว' : 'รอรับคลัง'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">
                      {so?.customer?.name}{so?.product?.part_name ? ` · ${so.product.part_name}` : ''}
                    </p>
                  </div>

                  {/* Summary numbers */}
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div>
                      <p className="text-slate-500 text-[10px]">วางแผน</p>
                      <p className="text-slate-300 text-xs font-medium">{formatNumber(totalPlanned)} kg</p>
                    </div>
                    {totalGood > 0 && (
                      <div>
                        <p className="text-slate-500 text-[10px]">ดีได้จริง</p>
                        <p className="text-green-300 text-xs font-bold">{formatNumber(totalGood)} kg</p>
                      </div>
                    )}
                    {yieldPct !== null && (
                      <div className={cn('text-xs font-bold px-2 py-0.5 rounded', yieldPct >= 95 ? 'bg-green-500/20 text-green-300' : yieldPct >= 90 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300')}>
                        {yieldPct}%
                      </div>
                    )}
                  </div>
                </button>

                {/* Process detail — accordion */}
                {isOpen && (
                  <div className="bg-slate-800/30 border-t border-slate-800/60 px-5 py-4 space-y-3">
                    {soJobs.map((job) => {
                      const log = logs.find(l => l.planning_job_id === job.id)
                      const goodQty   = log?.good_qty   ?? 0
                      const goodRolls = log?.good_rolls  ?? 0
                      const badQty    = log?.bad_qty     ?? 0
                      const badRolls  = log?.bad_rolls   ?? 0
                      const wasteQty  = log?.waste_qty   ?? 0
                      const rawMat    = job.raw_material_qty
                      const jYield    = goodQty > 0 && job.planned_qty > 0 ? Math.round(goodQty / job.planned_qty * 100) : null

                      return (
                        <div key={job.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                          {/* Job header */}
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <StatusDot status={job.status} />
                              <span className="text-slate-500 text-xs font-mono">{job.lot_no}</span>
                              {job.machine_no && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{job.machine_no}</span>}
                            </div>
                            <span className="text-slate-500 text-[10px]">{formatTs(log?.finished_at ?? job.created_at)}</span>
                          </div>

                          {/* Production chain */}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                            {rawMat != null && (
                              <div className="flex justify-between col-span-2 border-b border-slate-700 pb-2 mb-1">
                                <span className="text-slate-400">วัตถุดิบเบิก</span>
                                <span className="text-slate-300 font-medium">{formatNumber(rawMat)} kg</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-400">วางแผน</span>
                              <span className="text-slate-300">{formatNumber(job.planned_qty)} kg</span>
                            </div>
                            {goodQty > 0 && (
                              <div className="flex justify-between">
                                <span className="text-green-400">✓ ดีได้{goodRolls > 0 ? ` ${goodRolls} ม้วน` : ''}</span>
                                <span className="text-green-300 font-semibold">{formatNumber(goodQty)} kg</span>
                              </div>
                            )}
                            {badQty > 0 && (
                              <div className="flex justify-between">
                                <span className="text-orange-400">⚙ กรอ{badRolls > 0 ? ` ${badRolls} ม้วน` : ''}</span>
                                <span className="text-orange-300">{formatNumber(badQty)} kg</span>
                              </div>
                            )}
                            {wasteQty > 0 && (
                              <div className="flex justify-between">
                                <span className="text-red-400">✗ เศษเสีย</span>
                                <span className="text-red-300">{formatNumber(wasteQty)} kg</span>
                              </div>
                            )}
                          </div>

                          {/* Yield bar */}
                          {jYield !== null && (
                            <div className="mt-3">
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-500">Yield</span>
                                <span className={cn('font-bold', jYield >= 95 ? 'text-green-300' : jYield >= 90 ? 'text-yellow-300' : 'text-red-300')}>{jYield}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', jYield >= 95 ? 'bg-green-500' : jYield >= 90 ? 'bg-yellow-500' : 'bg-red-500')}
                                  style={{ width: `${Math.min(jYield, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* SO total summary */}
                    {soJobs.length > 1 && (
                      <div className="bg-slate-700/40 rounded-lg px-4 py-3 flex items-center justify-between text-xs border border-slate-700">
                        <span className="text-slate-400 font-medium">รวมทั้งหมด ({soJobs.length} Lot)</span>
                        <div className="flex gap-4">
                          <span className="text-slate-300">วางแผน {formatNumber(totalPlanned)} kg</span>
                          <span className="text-green-300 font-bold">ดี {formatNumber(totalGood)} kg{totalRolls > 0 ? ` · ${totalRolls} ม้วน` : ''}</span>
                          {totalWaste > 0 && <span className="text-red-400">เศษ {formatNumber(totalWaste)} kg</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
