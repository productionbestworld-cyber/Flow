import { Download, FileText } from 'lucide-react'
import { usePlanningJobs } from '../hooks/usePlanning'
import { useProductionLogs } from '../hooks/useProduction'
import ProductionJobCard from '../components/shared/ProductionJobCard'
import ProductionHistory from '../components/shared/ProductionHistory'
import DeptDashboard from '../components/shared/DeptDashboard'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import { downloadCSV, printDocument } from '../lib/csvUtils'

export default function Blow() {
  const { data: jobs,  isLoading: jobsLoading  } = usePlanningJobs()
  const { data: logs,  isLoading: logsLoading  } = useProductionLogs('extrusion')

  const activeJobs = jobs?.filter(j => j.dept === 'extrusion' && j.status === 'ongoing') ?? []
  const deptJobs   = jobs?.filter(j => j.dept === 'extrusion') ?? []

  function handleExport() {
    const headers = ['Lot No.','SO No.','ลูกค้า','สินค้า','เครื่อง','จำนวนวางแผน (kg)','วัตถุดิบ (kg)','ม้วนดี (ม้วน)','ม้วนดี (kg)','ม้วนกรอ (kg)','เศษ (kg)','สถานะ']
    const rows = deptJobs.map(j => {
      const log = logs?.find(l => l.planning_job_id === j.id)
      return [j.lot_no ?? '', j.sale_order?.so_no ?? '', j.sale_order?.customer?.name ?? '',
        j.sale_order?.product?.part_name ?? '', j.machine_no ?? '',
        j.planned_qty, j.raw_material_qty ?? '',
        log?.good_rolls ?? '', log?.good_qty ?? '', log?.bad_qty ?? '', log?.waste_qty ?? '', j.status]
    })
    downloadCSV(`blow_log_${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    printDocument('บันทึกการผลิต Blow', `
      <h1>บันทึกการผลิต Blow</h1>
      <p class="meta">วันที่พิมพ์: ${date} · รวม ${deptJobs.length} งาน</p>
      <table>
        <thead><tr>
          <th>Lot No.</th><th>SO</th><th>ลูกค้า</th><th>สินค้า</th><th>เครื่อง</th>
          <th>แผน (kg)</th><th>วัตถุดิบ (kg)</th><th>ม้วนดี</th><th>ดี (kg)</th><th>กรอ (kg)</th><th>เศษ (kg)</th><th>สถานะ</th>
        </tr></thead>
        <tbody>${deptJobs.map(j => {
          const log = logs?.find(l => l.planning_job_id === j.id)
          return `<tr>
            <td>${j.lot_no ?? ''}</td><td>${j.sale_order?.so_no ?? ''}</td>
            <td>${j.sale_order?.customer?.name ?? ''}</td><td>${j.sale_order?.product?.part_name ?? ''}</td>
            <td>${j.machine_no ?? '-'}</td>
            <td style="text-align:right">${(j.planned_qty ?? 0).toLocaleString()}</td>
            <td style="text-align:right">${j.raw_material_qty?.toLocaleString() ?? '-'}</td>
            <td style="text-align:right">${log?.good_rolls ?? '-'}</td>
            <td style="text-align:right">${log?.good_qty?.toLocaleString() ?? '-'}</td>
            <td style="text-align:right">${log?.bad_qty?.toLocaleString() ?? '-'}</td>
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
          <h1 className="text-xl font-bold text-white">Blow</h1>
          <p className="text-slate-400 text-sm mt-0.5">บันทึกข้อมูลการผลิต Blow</p>
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

      <DeptDashboard dept="extrusion" jobs={jobs ?? []} logs={logs ?? []} />

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">งาน active: <span className="text-white font-bold">{activeJobs.length}</span></span>
      </div>

      {jobsLoading || logsLoading ? (
        <TableSkeleton rows={4} />
      ) : activeJobs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">ไม่มีงาน Blow ที่กำลังผลิต</div>
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
