import { useState, useEffect } from 'react'
import { History, ChevronDown, ChevronRight, Wind, Printer, Cog, Package, CheckCircle2, Clock, List, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import RollReportModal from './RollReportModal'
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

function RollLogTable({ jobId, onShowReport }: { jobId: string, onShowReport: (rolls: any[]) => void }) {
  const [rolls, setRolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRolls() {
      const { data } = await supabase
        .from('production_rolls')
        .select('*')
        .eq('job_id', jobId)
        .order('roll_no', { ascending: true })
      if (data) setRolls(data)
      setLoading(false)
    }
    fetchRolls()
  }, [jobId])

  if (loading) return <div className="text-[10px] text-slate-500 animate-pulse py-2 px-4">กำลังดึงข้อมูลม้วน...</div>
  if (rolls.length === 0) return <div className="text-[10px] text-slate-600 italic py-2 px-4">ไม่มีข้อมูลการชั่งม้วน</div>

  return (
    <div className="mt-4 border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/30">
      <div className="bg-slate-800/50 p-2 px-4 flex justify-between items-center border-b border-slate-700/50">
         <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Roll Details</span>
         <button 
           onClick={() => onShowReport(rolls)}
           className="text-[9px] font-black uppercase text-brand-400 hover:text-brand-300 flex items-center gap-2 transition-colors"
         >
           <FileText size={11} /> พิมพ์รายงาน A4
         </button>
      </div>
      <table className="w-full text-[10px]">
        <thead className="bg-slate-800 text-slate-500">
          <tr>
            <th className="p-2 text-left">ม้วน</th>
            <th className="p-2 text-right">ชั่ง (kg)</th>
            <th className="p-2 text-right">แกน</th>
            <th className="p-2 text-right text-brand-400">สุทธิ (kg)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rolls.map(r => (
            <tr key={r.id} className="hover:bg-slate-800 transition-colors">
              <td className="p-2 font-bold text-slate-300">#{r.roll_no}</td>
              <td className="p-2 text-right text-slate-500">{(Number(r.weight) + Number(r.core_weight || 0)).toFixed(2)}</td>
              <td className="p-2 text-right text-slate-500">{r.core_weight || 0}</td>
              <td className="p-2 text-right font-black text-brand-400">{r.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ProductionHistory({ dept, jobs, logs }: Props) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [expandedSOs, setExpandedSOs] = useState<Set<string>>(new Set())
  const [showRollLog, setShowRollLog] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [reportRolls, setReportRolls] = useState<any[]>([])
  const [reportJob, setReportJob] = useState<any>(null)

  function toggleSO(soId: string) {
    setExpandedSOs(prev => {
      const next = new Set(prev)
      next.has(soId) ? next.delete(soId) : next.add(soId)
      return next
    })
  }

  const doneJobs = jobs.filter(j => j.dept === dept && (j.status === 'done' || j.status === 'pending_receipt'))

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

            const totalPlanned = soJobs.reduce((s, j) => s + j.planned_qty, 0)
            const soLogs = soJobs.map(j => logs.find(l => l.planning_job_id === j.id))
            const totalGood  = soLogs.reduce((s, l) => s + (l?.good_qty   ?? 0), 0)
            const totalWaste = soLogs.reduce((s, l) => s + (l?.waste_qty  ?? 0), 0)
            const totalRolls = soLogs.reduce((s, l) => s + (l?.good_rolls ?? 0), 0)
            const allDone = soJobs.every(j => j.status === 'done')
            const yieldPct = totalGood > 0 && totalPlanned > 0 ? Math.round(totalGood / totalPlanned * 100) : null

            return (
              <div key={soId}>
                <button
                  onClick={() => toggleSO(soId)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-bold">{so?.so_no ?? '-'}</span>
                      <DeptBadge dept={dept} />
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">
                      {so?.customer?.name}{so?.product?.part_name ? ` · ${so.product.part_name}` : ''}
                    </p>
                  </div>
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
                  </div>
                </button>

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
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <StatusDot status={job.status} />
                              <span className="text-slate-500 text-xs font-mono">{job.lot_no}</span>
                              {job.machine_no && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{job.machine_no}</span>}
                            </div>
                            <span className="text-slate-500 text-[10px]">{formatTs(log?.finished_at ?? job.created_at)}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
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
                          </div>

                          <div className="mt-4 pt-4 border-t border-white/5">
                            <button 
                              onClick={() => setShowRollLog(showRollLog === job.id ? null : job.id)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 shadow-md",
                                showRollLog === job.id
                                  ? "bg-brand-500 text-white border-brand-400 shadow-brand-500/30"
                                  : "bg-brand-500/10 text-brand-400 border-brand-500/20 hover:bg-brand-500/20"
                              )}
                            >
                              <List size={12} /> {showRollLog === job.id ? 'ปิดรายละเอียดม้วน' : 'ดูประวัติม้วนรายตัว'}
                            </button>
                            {showRollLog === job.id && (
                              <RollLogTable 
                                jobId={job.id} 
                                onShowReport={(rolls) => {
                                  setReportRolls(rolls);
                                  setReportJob(job);
                                  setShowReport(true);
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showReport && (
        <RollReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          job={reportJob}
          rolls={reportRolls}
        />
      )}
    </div>
  )
}
