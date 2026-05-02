import { Wind, Printer, Cog } from 'lucide-react'
import { formatNumber, cn } from '../../lib/utils'
import type { PlanningJob, ProductionLog, PlanningDept } from '../../types'

interface Props {
  dept: PlanningDept
  jobs: PlanningJob[]
  logs: ProductionLog[]
}

function StatCell({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-xl font-bold', color ?? 'text-white')}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {sub && <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DeptDashboard({ dept, jobs, logs }: Props) {
  const deptJobs = jobs.filter(j => j.dept === dept)
  const deptLogs = logs.filter(l => deptJobs.some(j => j.id === l.planning_job_id))

  if (dept === 'extrusion') {
    const rawMat   = deptJobs.reduce((s, j) => s + (j.raw_material_qty ?? 0), 0)
    const goodQty  = deptLogs.reduce((s, l) => s + (l.good_qty   ?? 0), 0)
    const goodRoll = deptLogs.reduce((s, l) => s + (l.good_rolls ?? 0), 0)
    const badQty   = deptLogs.reduce((s, l) => s + (l.bad_qty    ?? 0), 0)
    const badRoll  = deptLogs.reduce((s, l) => s + (l.bad_rolls  ?? 0), 0)
    const waste    = deptLogs.reduce((s, l) => s + (l.waste_qty  ?? 0), 0)
    const active   = deptJobs.filter(j => j.status === 'ongoing').length
    const yld      = rawMat > 0 ? Math.round(goodQty / rawMat * 100) : null

    return (
      <div className="bg-slate-900 border border-brand-500/20 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wind size={15} className="text-brand-400" />
            <span className="text-white font-semibold text-sm">สถิติ Extrusion</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-xs">งาน active <span className="text-sky-300 font-bold">{active}</span></span>
            {yld !== null && (
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', yld >= 95 ? 'bg-green-500/20 text-green-300' : yld >= 90 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300')}>
                Yield {yld}%
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-800">
          <StatCell label="วัตถุดิบเบิก"                                 value={rawMat}  sub="kg"                            color="text-slate-300" />
          <StatCell label={`ม้วนดี${goodRoll ? ` ${goodRoll} ม้วน` : ''}`} value={goodQty} sub="kg"                          color="text-green-300" />
          <StatCell label={`ม้วนกรอ${badRoll ? ` ${badRoll} ม้วน` : ''}`}  value={badQty}  sub="kg → ส่ง Grinding"           color="text-orange-300" />
          <StatCell label="เศษเป่า"                                       value={waste}   sub="kg"                            color="text-red-300" />
          <StatCell label="รวมผลิต (กรอ+ดี)"                             value={goodQty + badQty} sub="kg"                   color="text-sky-300" />
        </div>
      </div>
    )
  }

  if (dept === 'printing') {
    const inputQty = deptJobs.reduce((s, j) => s + j.planned_qty, 0)
    const goodQty  = deptLogs.reduce((s, l) => s + (l.good_qty   ?? 0), 0)
    const goodRoll = deptLogs.reduce((s, l) => s + (l.good_rolls ?? 0), 0)
    const waste    = deptLogs.reduce((s, l) => s + (l.waste_qty  ?? 0), 0)
    const active   = deptJobs.filter(j => j.status === 'ongoing').length
    const yld      = inputQty > 0 ? Math.round(goodQty / inputQty * 100) : null

    return (
      <div className="bg-slate-900 border border-purple-500/20 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Printer size={15} className="text-purple-400" />
            <span className="text-white font-semibold text-sm">สถิติ Printing</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-xs">งาน active <span className="text-sky-300 font-bold">{active}</span></span>
            {yld !== null && (
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', yld >= 95 ? 'bg-green-500/20 text-green-300' : yld >= 90 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300')}>
                Yield {yld}%
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-800">
          <StatCell label="รับจากผลิต"                                     value={inputQty} sub="kg"                          color="text-slate-300" />
          <StatCell label={`พิมได้${goodRoll ? ` ${goodRoll} ม้วน` : ''}`} value={goodQty}  sub="kg"                          color="text-purple-300" />
          <StatCell label="เศษพิมพ์"                                        value={waste}    sub="kg"                          color="text-red-300" />
        </div>
      </div>
    )
  }

  if (dept === 'grinding') {
    const inputQty = deptJobs.reduce((s, j) => s + j.planned_qty, 0)
    const goodQty  = deptLogs.reduce((s, l) => s + (l.good_qty   ?? 0), 0)
    const goodRoll = deptLogs.reduce((s, l) => s + (l.good_rolls ?? 0), 0)
    const waste    = deptLogs.reduce((s, l) => s + (l.waste_qty  ?? 0), 0)
    const active   = deptJobs.filter(j => j.status === 'ongoing').length
    const recovery = inputQty > 0 ? Math.round(goodQty / inputQty * 100) : null

    return (
      <div className="bg-slate-900 border border-orange-500/20 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cog size={15} className="text-orange-400" />
            <span className="text-white font-semibold text-sm">สถิติ Grinding</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-xs">งาน active <span className="text-sky-300 font-bold">{active}</span></span>
            {recovery !== null && (
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', recovery >= 90 ? 'bg-green-500/20 text-green-300' : recovery >= 80 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300')}>
                Recovery {recovery}%
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-800">
          <StatCell label={`รับม้วนกรอ · ${deptJobs.length} งาน`}          value={inputQty} sub="kg"                         color="text-slate-300" />
          <StatCell label={`กรอคืน${goodRoll ? ` ${goodRoll} ม้วน` : ''}`} value={goodQty}  sub="kg → คืนสายผลิต"            color="text-green-300" />
          <StatCell label="เศษสแคป"                                          value={waste}    sub="kg"                         color="text-red-300" />
        </div>
      </div>
    )
  }

  return null
}
