import { useState } from 'react'
import { Clock, Plus, Download, FileText } from 'lucide-react'
import { downloadCSV, printDocument } from '../lib/csvUtils'
import { usePlanningJobs, useAssignMachine, useUnassignMachine } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import ProductionJobCard from '../components/shared/ProductionJobCard'
import ProductionHistory from '../components/shared/ProductionHistory'
import DeptDashboard from '../components/shared/DeptDashboard'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import { cn } from '../lib/utils'
import type { PlanningJob } from '../types'

const GRINDING_MACHINES = ['G-01', 'G-02', 'G-03']

function formatJobQuantity(job: PlanningJob) {
  const qty = job.planned_qty?.toLocaleString() ?? '0'
  const perRoll = job.sale_order?.weight_per_roll
  if (perRoll && perRoll > 0) {
    const rolls = job.planned_qty / perRoll
    const formattedRolls = Number.isInteger(rolls) ? rolls.toLocaleString() : rolls.toFixed(2)
    return `${qty} kg · ${formattedRolls} ม้วน`
  }
  return `${qty} kg`
}

export default function Grinding() {
  const { data: jobs, isLoading: jobsLoading } = usePlanningJobs()
  const { data: grdLogs, isLoading: logsLoading } = useProductionLogs('grinding')
  const assignMachine   = useAssignMachine()
  const unassignMachine = useUnassignMachine()

  const [assigningId, setAssigningId] = useState<string | null>(null)

  const ongoingJobs = jobs?.filter(j => j.dept === 'grinding' && j.status === 'ongoing') ?? []
  const queuedJobs  = jobs?.filter(j => j.dept === 'grinding' && j.status === 'queued')  ?? []

  // แยกงานที่ยังไม่มีเครื่อง กับมีเครื่องแต่รอคิว
  const unassigned     = queuedJobs.filter(j => !j.machine_no)
  const assignedQueued = queuedJobs.filter(j => !!j.machine_no)

  async function handleAssign(jobId: string, machine: string) {
    await assignMachine.mutateAsync({ id: jobId, machine_no: machine })
    setAssigningId(null)
  }

  async function handleUnassign(jobId: string) {
    if (!confirm('ถอดงานออกจากเครื่อง?')) return
    await unassignMachine.mutateAsync({ id: jobId })
  }

  const deptJobs = jobs?.filter(j => j.dept === 'grinding') ?? []

  function handleExport() {
    const headers = ['Lot No.','SO No.','ลูกค้า','สินค้า','เครื่อง','รับม้วนกรอ (kg)','กรอคืน (ม้วน)','กรอคืน (kg)','เศษสแคป (kg)','สถานะ']
    const rows = deptJobs.map(j => {
      const log = grdLogs?.find(l => l.planning_job_id === j.id)
      return [j.lot_no ?? '', j.sale_order?.so_no ?? '', j.sale_order?.customer?.name ?? '',
        j.sale_order?.product?.part_name ?? '', j.machine_no ?? '',
        j.planned_qty, log?.good_rolls ?? '', log?.good_qty ?? '', log?.waste_qty ?? '', j.status]
    })
    downloadCSV(`grinding_log_${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    printDocument('บันทึกการผลิต Grinding', `
      <h1>บันทึกการผลิต Grinding</h1>
      <p class="meta">วันที่พิมพ์: ${date} · รวม ${deptJobs.length} งาน</p>
      <table>
        <thead><tr>
          <th>Lot No.</th><th>SO</th><th>ลูกค้า</th><th>สินค้า</th><th>เครื่อง</th>
          <th>รับกรอ (kg)</th><th>คืน (ม้วน)</th><th>คืน (kg)</th><th>เศษ (kg)</th><th>สถานะ</th>
        </tr></thead>
        <tbody>${deptJobs.map(j => {
          const log = grdLogs?.find(l => l.planning_job_id === j.id)
          return `<tr>
            <td>${j.lot_no ?? ''}</td><td>${j.sale_order?.so_no ?? ''}</td>
            <td>${j.sale_order?.customer?.name ?? ''}</td><td>${j.sale_order?.product?.part_name ?? ''}</td>
            <td>${j.machine_no ?? '-'}</td>
            <td style="text-align:right">${(j.planned_qty ?? 0).toLocaleString()}</td>
            <td style="text-align:right">${log?.good_rolls ?? '-'}</td>
            <td style="text-align:right">${log?.good_qty?.toLocaleString() ?? '-'}</td>
            <td style="text-align:right">${log?.waste_qty?.toLocaleString() ?? '-'}</td>
            <td>${j.status}</td>
          </tr>`
        }).join('')}</tbody>
      </table>
    `)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Grinding</h1>
          <p className="text-slate-400 text-sm mt-0.5">บันทึกข้อมูลการผลิต Grinding</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <Download size={15} /> Export
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
            <FileText size={15} /> พิมพ์
          </button>
        </div>
      </div>

      <DeptDashboard dept="grinding" jobs={jobs ?? []} logs={grdLogs ?? []} />

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">กำลังผลิต: <span className="text-green-400 font-bold">{ongoingJobs.length}</span></span>
        {queuedJobs.length > 0 && (
          <span className="text-slate-400">รอกำหนดเครื่อง: <span className="text-yellow-400 font-bold">{unassigned.length}</span></span>
        )}
      </div>

      {jobsLoading || logsLoading ? (
        <TableSkeleton rows={3} />
      ) : (
        <div className="space-y-6">

          {/* ── งานรอกำหนดเครื่อง ─────────────────────────── */}
          {unassigned.length > 0 && (
            <div className="bg-slate-900 border border-yellow-500/20 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
                <Clock size={13} className="text-yellow-400" />
                <span className="text-yellow-300 text-sm font-medium">
                  ม้วนเสียรอกรอ — ยังไม่มีเครื่อง ({unassigned.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="px-4 py-2 text-slate-500 text-[10px] uppercase tracking-wider">SO</th>
                      <th className="px-4 py-2 text-slate-500 text-[10px] uppercase tracking-wider">ลูกค้า</th>
                      <th className="px-4 py-2 text-slate-500 text-[10px] uppercase tracking-wider">สินค้า</th>
                      <th className="px-4 py-2 text-slate-500 text-[10px] uppercase tracking-wider">จำนวน</th>
                      <th className="px-4 py-2 text-slate-500 text-[10px] uppercase tracking-wider">ส่งต่อ</th>
                      <th className="px-4 py-2 text-slate-500 text-[10px] uppercase tracking-wider">Assign เครื่อง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassigned.map(j => (
                      <tr key={j.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-white text-xs font-semibold">{j.sale_order?.so_no}</span>
                          <p className="text-slate-500 text-[10px] font-mono">{j.lot_no}</p>
                        </td>
                        <td className="px-4 py-3 max-w-[140px]">
                          <span className="text-slate-300 text-xs truncate block">{j.sale_order?.customer?.name}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <span className="text-slate-300 text-xs truncate block">{j.sale_order?.product?.part_name}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-white text-xs font-medium">{formatJobQuantity(j)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {j.route_after === 'to_printing' && (
                            <span className="text-purple-300 text-[10px] bg-purple-500/10 px-2 py-0.5 rounded-full">→ Printing</span>
                          )}
                          {j.route_after === 'to_warehouse' && (
                            <span className="text-yellow-300 text-[10px] bg-yellow-500/10 px-2 py-0.5 rounded-full">→ คลัง</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {assigningId === j.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                defaultValue=""
                                onChange={e => e.target.value && handleAssign(j.id, e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none"
                              >
                                <option value="">— เลือกเครื่อง —</option>
                                {GRINDING_MACHINES.map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => setAssigningId(null)}
                                className="text-slate-400 text-xs px-2 py-1 rounded hover:bg-slate-700"
                              >ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningId(j.id)}
                              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Plus size={11} /> กำหนดเครื่อง
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── เครื่องที่มีงาน ongoing/queued ────────────────── */}
          {(ongoingJobs.length > 0 || assignedQueued.length > 0) && (
            <div className="space-y-4">
              <h2 className="text-white text-sm font-medium">เครื่อง Grinding</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/30">
                        <th className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider border-r border-slate-800">เครื่อง</th>
                        <th className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider">SO</th>
                        <th className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider">ลูกค้า</th>
                        <th className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider">จำนวน</th>
                        <th className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider">ส่งต่อ</th>
                        <th className="px-3 py-2 text-slate-500 text-[10px] uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {GRINDING_MACHINES.map(m => {
                        const active = ongoingJobs.find(j => j.machine_no === m)
                        const queued = assignedQueued.filter(j => j.machine_no === m)
                        if (!active && queued.length === 0) return null
                        const rows = [active, ...queued].filter(Boolean) as typeof ongoingJobs
                        return rows.map((j, i) => (
                          <tr key={j.id} className={cn('hover:bg-slate-800/30 transition-colors', i < rows.length - 1 ? 'border-b border-slate-700/30' : 'border-b border-slate-700/50')}>
                            {i === 0 && (
                              <td rowSpan={rows.length} className="px-3 py-2.5 border-r border-slate-800 align-top">
                                <div className="flex items-center gap-2 pt-0.5">
                                  <div className={cn('w-2 h-2 rounded-full shrink-0', active ? 'bg-green-400 animate-pulse' : 'bg-yellow-400')} />
                                  <span className="text-white font-bold text-sm">{m}</span>
                                </div>
                                <span className={cn('text-[10px] font-medium ml-4', active ? 'text-green-400' : 'text-yellow-400')}>
                                  {active ? 'กำลังผลิต' : 'มีคิวรอ'}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="text-white text-xs font-semibold">{j.sale_order?.so_no}</span>
                              {i > 0 && <span className="ml-2 text-yellow-400 text-[10px]">คิว {i}</span>}
                            </td>
                            <td className="px-3 py-2.5 max-w-[140px]">
                              <span className="text-slate-300 text-xs truncate block">{j.sale_order?.customer?.name}</span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="text-white text-xs">{formatJobQuantity(j)}</span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {j.route_after === 'to_printing' && (
                                <span className="text-purple-300 text-[10px] bg-purple-500/10 px-2 py-0.5 rounded-full">→ Printing</span>
                              )}
                              {j.route_after === 'to_warehouse' && (
                                <span className="text-yellow-300 text-[10px] bg-yellow-500/10 px-2 py-0.5 rounded-full">→ คลัง</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <button
                                onClick={() => handleUnassign(j.id)}
                                className="text-rose-400 text-[10px] px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                              >
                                ถอด
                              </button>
                            </td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── บันทึกการผลิต ──────────────────────────────────── */}
          {ongoingJobs.length > 0 && (
            <div>
              <h2 className="text-white text-sm font-medium mb-3">บันทึกการผลิต</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ongoingJobs.map(job => {
                  const log = grdLogs?.find(l => l.planning_job_id === job.id)
                  return <ProductionJobCard key={job.id} job={job} log={log} dept="grinding" />
                })}
              </div>
            </div>
          )}

          {ongoingJobs.length === 0 && queuedJobs.length === 0 && (
            <div className="text-center py-16 text-slate-500">ไม่มีงาน Grinding</div>
          )}
        </div>
      )}

      <ProductionHistory dept="grinding" jobs={jobs ?? []} logs={grdLogs ?? []} />
    </div>
  )
}
