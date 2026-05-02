import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import ProductionJobCard from '../components/shared/ProductionJobCard'
import ProductionHistory from '../components/shared/ProductionHistory'
import DeptDashboard from '../components/shared/DeptDashboard'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'

export default function Extrusion() {
  const { data: jobs,  isLoading: jobsLoading  } = usePlanningJobs()
  const { data: logs,  isLoading: logsLoading  } = useProductionLogs('extrusion')

  const activeJobs = jobs?.filter(j => j.dept === 'extrusion' && j.status === 'ongoing') ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Extrusion</h1>
        <p className="text-slate-400 text-sm mt-0.5">บันทึกข้อมูลการผลิต Extrusion</p>
      </div>

      <DeptDashboard dept="extrusion" jobs={jobs ?? []} logs={logs ?? []} />

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">งาน active: <span className="text-white font-bold">{activeJobs.length}</span></span>
      </div>

      {jobsLoading || logsLoading ? (
        <TableSkeleton rows={4} />
      ) : activeJobs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">ไม่มีงาน Extrusion ที่กำลังผลิต</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeJobs.map(job => {
            const log = logs?.find(l => l.planning_job_id === job.id)
            return <ProductionJobCard key={job.id} job={job} log={log} dept="extrusion" />
          })}
        </div>
      )}

      <ProductionHistory dept="extrusion" jobs={jobs ?? []} logs={logs ?? []} />
    </div>
  )
}
