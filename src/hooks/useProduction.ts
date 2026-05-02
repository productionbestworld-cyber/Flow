import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { generateLotNo } from '../lib/utils'
import type { ProductionLog, PlanningDept } from '../types'

const QUERY_KEY = 'production_logs'

export function useProductionLogs(dept?: PlanningDept) {
  return useQuery({
    queryKey: [QUERY_KEY, dept],
    queryFn: async () => {
      let q = supabase
        .from('production_logs')
        .select(`*, planning_job:planning_jobs(*, sale_order:sale_orders(*, customer:customers(*), product:products(*)))`)
        .order('created_at', { ascending: false })
      if (dept) q = q.eq('dept', dept)
      const { data, error } = await q
      if (error) throw error
      return data as ProductionLog[]
    },
  })
}

export function useUpsertProductionLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<ProductionLog, 'id' | 'created_at' | 'planning_job'>) => {
      const payload = {
        planning_job_id: input.planning_job_id,
        dept:            input.dept,
        ...(input.good_rolls  !== undefined && { good_rolls:  input.good_rolls  }),
        ...(input.good_qty    !== undefined && { good_qty:    input.good_qty    }),
        ...(input.bad_rolls   !== undefined && { bad_rolls:   input.bad_rolls   }),
        ...(input.bad_qty     !== undefined && { bad_qty:     input.bad_qty     }),
        ...(input.waste_qty   !== undefined && { waste_qty:   input.waste_qty   }),
        ...(input.started_at  !== undefined && { started_at:  input.started_at  }),
        ...(input.finished_at !== undefined && { finished_at: input.finished_at }),
      }

      const { data: existing } = await supabase
        .from('production_logs')
        .select('id')
        .eq('planning_job_id', payload.planning_job_id)
        .maybeSingle()

      const { data, error } = existing
        ? await supabase.from('production_logs').update(payload).eq('id', existing.id).select().single()
        : await supabase.from('production_logs').insert(payload).select().single()

      if (error) throw error
      return data as ProductionLog
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useEditProductionLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      logId, jobId, jobStatus, actual_qty, good_rolls, good_qty, bad_rolls, bad_qty, waste_qty,
    }: {
      logId: string
      jobId: string
      jobStatus: string
      actual_qty?: number
      good_rolls?: number
      good_qty?: number
      bad_rolls?: number
      bad_qty?: number
      waste_qty?: number
    }) => {
      // อัพเดต production log
      const { error: logErr } = await supabase
        .from('production_logs')
        .update({ actual_qty, good_rolls, good_qty, bad_rolls, bad_qty, waste_qty })
        .eq('id', logId)
      if (logErr) throw logErr

      // ถ้า job อยู่ใน pending_receipt → sync planned_qty ด้วย
      if (jobStatus === 'pending_receipt' && good_qty !== undefined) {
        await supabase
          .from('planning_jobs')
          .update({ planned_qty: good_qty })
          .eq('id', jobId)
        qc.invalidateQueries({ queryKey: ['planning_jobs'] })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useFinishProduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ jobId, logId, goodQty, badRolls, badQty }: {
      jobId: string
      logId: string
      goodQty?: number   // ม้วนดี (kg) → printing job หรือ warehouse
      badRolls?: number  // ม้วนเสีย (จำนวนม้วน)
      badQty?: number    // ม้วนเสีย (kg) → planned_qty ของ grinding job
    }) => {
      // 1. mark log finished
      await supabase.from('production_logs')
        .update({ finished_at: new Date().toISOString() })
        .eq('id', logId)

      // 2. ดึง planning_job + product type
      const { data: job } = await supabase
        .from('planning_jobs')
        .select('*, sale_order:sale_orders(product:products(type))')
        .eq('id', jobId)
        .single()

      if (!job) throw new Error('ไม่พบ planning job')

      const productType = (job as any).sale_order?.product?.type as string | undefined
      const isPrint = productType === 'print' || productType === 'blow_print'

      // 3. route ม้วนดี
      // ส่งไป Printing เฉพาะเมื่อเป็น extrusion dept เท่านั้น
      const shouldGoToPrinting = job.dept === 'extrusion' && (job.route_after === 'to_printing' || isPrint)

      if (shouldGoToPrinting) {
        const addQty = goodQty ?? job.planned_qty

        // เช็คว่ามี printing job queued อยู่แล้วสำหรับ SO นี้ไหม
        const { data: existingPrt } = await supabase
          .from('planning_jobs')
          .select('id, planned_qty')
          .eq('sale_order_id', job.sale_order_id)
          .eq('dept', 'printing')
          .eq('status', 'queued')
          .maybeSingle()

        if (existingPrt) {
          await supabase.from('planning_jobs')
            .update({ planned_qty: (existingPrt.planned_qty ?? 0) + addQty })
            .eq('id', existingPrt.id)
        } else {
          await supabase.from('planning_jobs').insert({
            sale_order_id: job.sale_order_id,
            dept: 'printing',
            status: 'queued',
            planned_qty: addQty,
            lot_no: generateLotNo('printing'),
            route_after: 'to_warehouse',
          })
        }
        await supabase.from('planning_jobs').update({ status: 'done' }).eq('id', jobId)
      } else if (job.dept === 'grinding' && job.route_after === 'to_printing') {
        // Grinding → ได้ของกลับ บวกเข้า Printing job ที่มีอยู่
        const addQty = goodQty ?? job.planned_qty
        const { data: existingPrt } = await supabase
          .from('planning_jobs')
          .select('id, planned_qty')
          .eq('sale_order_id', job.sale_order_id)
          .eq('dept', 'printing')
          .in('status', ['queued', 'ongoing'])
          .maybeSingle()

        if (existingPrt) {
          await supabase.from('planning_jobs')
            .update({ planned_qty: (existingPrt.planned_qty ?? 0) + addQty })
            .eq('id', existingPrt.id)
        }
        // grinding job เสร็จสิ้น
        await supabase.from('planning_jobs')
          .update({ status: 'done' })
          .eq('id', jobId)
        qc.invalidateQueries({ queryKey: ['planning_jobs'] })
      } else {
        // Printing dept หรือ ฟิล์มใส extrusion → ม้วนดีไปคลัง
        // อัพเดต planned_qty เป็น goodQty จริง (ไม่รวมเศษ)
        const actualQty = goodQty ?? job.planned_qty
        await supabase.from('planning_jobs')
          .update({ status: 'pending_receipt', planned_qty: actualQty })
          .eq('id', jobId)
      }

      // 4. ม้วนเสีย → Grinding เสมอ ถ้ามี
      if (badRolls && badRolls > 0) {
        const grdQty = badQty ?? badRolls  // planned_qty = badQty (kg) ถ้ามี
        const grdRoute = (job.route_after === 'to_printing' || isPrint) ? 'to_printing' : 'to_warehouse'
        const grdPayload = {
          sale_order_id: job.sale_order_id,
          dept:          'grinding',
          status:        'queued',
          planned_qty:   grdQty,
          lot_no:        generateLotNo('grinding'),
          route_after:   grdRoute,
        }
        const { error: grdErr } = await supabase.from('planning_jobs').insert(grdPayload)
        if (grdErr) throw new Error('สร้าง Grinding job ไม่สำเร็จ: ' + grdErr.message)
      }

      // 5. ถ้าเครื่องนี้มีงานรออยู่ → เลื่อนงานถัดไปเป็น ongoing อัตโนมัติ
      if (job.machine_no) {
        const { data: nextJob } = await supabase
          .from('planning_jobs')
          .select('id, sale_order_id')
          .eq('machine_no', job.machine_no)
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextJob) {
          await supabase.from('planning_jobs')
            .update({ status: 'ongoing' })
            .eq('id', nextJob.id)
          // update SO status → in_production
          await supabase.from('sale_orders')
            .update({ status: 'in_production' })
            .eq('id', nextJob.sale_order_id)
        }
      }

      qc.invalidateQueries({ queryKey: ['planning_jobs'] })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
