import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import ProductionJobCard from '../components/shared/ProductionJobCard'
import ProductionHistory from '../components/shared/ProductionHistory'
import DeptDashboard from '../components/shared/DeptDashboard'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import { Clock, Cog } from 'lucide-react'

export default function Printing() {
  const { data: jobs,     isLoading: jobsLoading } = usePlanningJobs()
  const { data: prtLogs,  isLoading: logsLoading  } = useProductionLogs('printing')
  const { data: grdLogs }                           = useProductionLogs('grinding')

  const ongoingJobs = jobs?.filter(j => j.dept === 'printing' && j.status === 'ongoing') ?? []
  const queuedJobs  = jobs?.filter(j => j.dept === 'printing' && j.status === 'queued')  ?? []

  // สำหรับแต่ละ SO — รวมข้อมูล grinding jobs ที่เสร็จแล้ว
  function getGrindingInfo(soId: string) {
    const grdJobs = jobs?.filter(j => j.dept === 'grinding' && j.sale_order_id === soId) ?? []
    const doneGrdJobs = grdJobs.filter(j => j.status === 'done' || j.status === 'pending_receipt')
    if (doneGrdJobs.length === 0) return null

    // rolls และ kg มาจาก production log (ของที่กรอได้จริง)
    const totalRolls = doneGrdJobs.reduce((s, j) => {
      const log = grdLogs?.find(l => l.planning_job_id === j.id)
      return s + (log?.good_rolls ?? 0)
    }, 0)
    const totalKg = doneGrdJobs.reduce((s, j) => {
      const log = grdLogs?.find(l => l.planning_job_id === j.id)
      return s + (log?.good_qty ?? j.planned_qty ?? 0)
    }, 0)

    return { rolls: totalRolls, kg: totalKg }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Printing</h1>
        <p className="text-slate-400 text-sm mt-0.5">บันทึกข้อมูลการผลิต Printing</p>
      </div>

      <DeptDashboard dept="printing" jobs={jobs ?? []} logs={prtLogs ?? []} />

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">กำลังผลิต: <span className="text-green-400 font-bold">{ongoingJobs.length}</span></span>
        {queuedJobs.length > 0 && (
          <span className="text-slate-400">รอกำหนดเครื่อง: <span className="text-yellow-400 font-bold">{queuedJobs.length}</span></span>
        )}
      </div>

      {jobsLoading || logsLoading ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          {/* งานรอกำหนดเครื่อง */}
          {queuedJobs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-yellow-400" />
                <h2 className="text-yellow-400 text-sm font-medium">รอกำหนดเครื่อง ({queuedJobs.length})</h2>
              </div>
              <div className="bg-slate-900 border border-yellow-500/20 rounded-xl divide-y divide-slate-800">
                {queuedJobs.map(job => {
                  const grdInfo = getGrindingInfo(job.sale_order_id)
                  return (
                    <div key={job.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-semibold">{job.sale_order?.so_no}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{job.sale_order?.customer?.name}</p>
                          <p className="text-slate-400 text-xs truncate">{job.sale_order?.product?.part_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm font-medium">{job.planned_qty?.toLocaleString()} kg</p>
                          <p className="text-slate-500 text-xs font-mono mt-0.5">{job.lot_no}</p>
                        </div>
                      </div>

                      {/* Grinding info */}
                      {grdInfo && grdInfo.rolls > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
                          <Cog size={11} className="text-orange-400 shrink-0" />
                          <span className="text-orange-300 text-xs">
                            กรอมา {grdInfo.rolls} ม้วน
                            {grdInfo.kg > 0 && ` · ${grdInfo.kg.toLocaleString()} kg`}
                          </span>
                        </div>
                      )}

                      <p className="text-yellow-400 text-xs mt-2">→ ไปกำหนดเครื่องใน Planning เพื่อเริ่มผลิต</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* งานกำลังผลิต */}
          {ongoingJobs.length > 0 ? (
            <div>
              <h2 className="text-white text-sm font-medium mb-3">กำลังผลิต</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ongoingJobs.map(job => {
                  const log = prtLogs?.find(l => l.planning_job_id === job.id)
                  const grdInfo = getGrindingInfo(job.sale_order_id)
                  return (
                    <div key={job.id} className="space-y-2">
                      {grdInfo && grdInfo.rolls > 0 && (
                        <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
                          <Cog size={11} className="text-orange-400 shrink-0" />
                          <span className="text-orange-300 text-xs">
                            กรอมา {grdInfo.rolls} ม้วน
                            {grdInfo.kg > 0 && ` · ${grdInfo.kg.toLocaleString()} kg`}
                          </span>
                        </div>
                      )}
                      <ProductionJobCard job={job} log={log} dept="printing" />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : queuedJobs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">ไม่มีงาน Printing</div>
          ) : null}
        </div>
      )}

      <ProductionHistory dept="printing" jobs={jobs ?? []} logs={prtLogs ?? []} />
    </div>
  )
}
