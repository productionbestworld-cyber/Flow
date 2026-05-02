import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface SOProductionSummary {
  soId: string
  // extrusion
  extGoodRolls: number
  extGoodQty: number
  extBadRolls: number
  extBadQty: number
  extWaste: number
  // grinding
  grdRolls: number     // จำนวนม้วนที่ส่งกรอ
  grdGoodRolls: number // ม้วนที่กรอได้
  grdGoodQty: number   // น้ำหนักที่กรอได้
  grdWaste: number
  // printing
  prtGoodRolls: number
  prtGoodQty: number
  prtWaste: number
  // summary
  totalGoodQty: number  // รวมม้วนดีเข้าคลัง (ext + grd สำหรับม้วนใส, prt สำหรับม้วนพิมพ์)
  totalWaste: number
}

export function useSOSummary(soId: string | undefined) {
  return useQuery({
    queryKey: ['so_summary', soId],
    enabled: !!soId,
    queryFn: async () => {
      const { data: jobs } = await supabase
        .from('planning_jobs')
        .select('id, dept, planned_qty, status, route_after')
        .eq('sale_order_id', soId!)

      if (!jobs || jobs.length === 0) return null

      const jobIds = jobs.map(j => j.id)
      const { data: logs } = await supabase
        .from('production_logs')
        .select('planning_job_id, dept, good_rolls, good_qty, bad_rolls, waste_qty')
        .in('planning_job_id', jobIds)

      const getLog = (jobId: string) => logs?.find(l => l.planning_job_id === jobId)

      const summary: SOProductionSummary = {
        soId: soId!,
        extGoodRolls: 0, extGoodQty: 0, extBadRolls: 0, extBadQty: 0, extWaste: 0,
        grdRolls: 0,     grdGoodRolls: 0, grdGoodQty: 0, grdWaste: 0,
        prtGoodRolls: 0, prtGoodQty: 0,   prtWaste: 0,
        totalGoodQty: 0, totalWaste: 0,
      }

      for (const job of jobs) {
        const log = getLog(job.id)
        if (!log) continue

        if (job.dept === 'extrusion') {
          summary.extGoodRolls += log.good_rolls ?? 0
          summary.extGoodQty   += log.good_qty   ?? 0
          summary.extBadRolls  += log.bad_rolls  ?? 0
          summary.extWaste     += log.waste_qty  ?? 0
        }
        if (job.dept === 'grinding') {
          summary.grdRolls     += job.planned_qty ?? 0
          summary.grdGoodRolls += log.good_rolls ?? 0
          summary.grdGoodQty   += log.good_qty   ?? 0
          summary.grdWaste     += log.waste_qty  ?? 0
        }
        if (job.dept === 'printing') {
          summary.prtGoodRolls += log.good_rolls ?? 0
          summary.prtGoodQty   += log.good_qty   ?? 0
          summary.prtWaste     += log.waste_qty  ?? 0
        }
      }

      // ม้วนพิมพ์: ม้วนดีคือสิ่งที่ออกจาก printing
      // ม้วนใส: ม้วนดีคือ ext good + grd good
      const isPrintFlow = jobs.some(j => j.dept === 'printing')
      summary.totalGoodQty = isPrintFlow
        ? summary.prtGoodQty
        : summary.extGoodQty + summary.grdGoodQty

      summary.totalWaste = summary.extWaste + summary.grdWaste + summary.prtWaste

      return summary
    },
  })
}
