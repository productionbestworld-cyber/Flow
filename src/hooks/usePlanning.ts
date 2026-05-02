import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { generateLotNo } from '../lib/utils'
import type { PlanningJob, PlanningJobInsert, RouteAfter } from '../types'

const QUERY_KEY = 'planning_jobs'

export function usePlanningJobs() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_jobs')
        .select(`*, sale_order:sale_orders(id,so_no,customer_id,product_id,qty,unit,status,po_no,ship_to,delivery_date,remark,weight_per_roll,created_at, customer:customers(*), product:products(*))`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PlanningJob[]
    },
  })
}

export function useCreatePlanningJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<PlanningJobInsert, 'lot_no' | 'status'> & { machine_no?: string; route_after?: RouteAfter; raw_material_qty?: number }) => {
      // ทุก job ส่งไป extrusion เสมอ — route_after กำหนดจาก product type
      const lot_no = generateLotNo(input.dept)

      // ถ้าเครื่องมี ongoing หรือ queued อยู่แล้ว ให้งานใหม่ต่อท้ายคิวเสมอ
      let status: 'ongoing' | 'queued' = 'queued'
      if (input.machine_no) {
        const { data: existing } = await supabase
          .from('planning_jobs')
          .select('id')
          .eq('machine_no', input.machine_no)
          .in('status', ['ongoing', 'queued'])
          .limit(1)
          .maybeSingle()
        status = existing ? 'queued' : 'ongoing'
      }

      const { data, error } = await supabase
        .from('planning_jobs')
        .insert({ ...input, lot_no, status })
        .select(`*, sale_order:sale_orders(id,so_no,customer_id,product_id,qty,unit,status,po_no,ship_to,delivery_date,remark,created_at, customer:customers(*), product:products(*))`)
        .single()
      if (error) throw error

      await supabase
        .from('sale_orders')
        .update({ status: 'in_planning' })
        .eq('id', input.sale_order_id)
      qc.invalidateQueries({ queryKey: ['sale_orders'] })

      return data as PlanningJob
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useAssignMachine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, machine_no }: { id: string; machine_no: string }) => {
      // ถ้าเครื่องมี ongoing หรือ queued อยู่แล้ว ให้ใหม่ต่อท้ายคิวเสมอ
      const { data: existing } = await supabase
        .from('planning_jobs')
        .select('id')
        .eq('machine_no', machine_no)
        .in('status', ['ongoing', 'queued'])
        .limit(1)
        .maybeSingle()
      const status = existing ? 'queued' : 'ongoing'

      const { data, error } = await supabase
        .from('planning_jobs')
        .update({ machine_no, status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await supabase.from('sale_orders')
        .update({ status: status === 'ongoing' ? 'in_production' : 'in_planning' })
        .eq('id', data.sale_order_id)
      qc.invalidateQueries({ queryKey: ['sale_orders'] })

      return data as PlanningJob
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useUnassignMachine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase
        .from('planning_jobs')
        .update({ machine_no: null, status: 'queued' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await supabase.from('sale_orders')
        .update({ status: 'in_planning' })
        .eq('id', data.sale_order_id)
      qc.invalidateQueries({ queryKey: ['sale_orders'] })

      return data as PlanningJob
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function usePromoteQueuedJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (jobs: PlanningJob[]) => {
      // หาเครื่องที่ไม่มี ongoing แต่มี queued → promote ตัวแรก
      const machineMap: Record<string, { hasOngoing: boolean; queued: PlanningJob[] }> = {}
      for (const j of jobs) {
        if (!j.machine_no) continue
        if (!machineMap[j.machine_no]) machineMap[j.machine_no] = { hasOngoing: false, queued: [] }
        if (j.status === 'ongoing') machineMap[j.machine_no].hasOngoing = true
        if (j.status === 'queued')  machineMap[j.machine_no].queued.push(j)
      }
      const toPromote = Object.values(machineMap)
        .filter(m => !m.hasOngoing && m.queued.length > 0)
        .map(m => m.queued.sort((a, b) => a.created_at.localeCompare(b.created_at))[0])

      for (const job of toPromote) {
        await supabase.from('planning_jobs').update({ status: 'ongoing' }).eq('id', job.id)
        await supabase.from('sale_orders').update({ status: 'in_production' }).eq('id', job.sale_order_id)
      }
      if (toPromote.length > 0) {
        qc.invalidateQueries({ queryKey: ['planning_jobs'] })
        qc.invalidateQueries({ queryKey: ['sale_orders'] })
      }
    },
  })
}

export function useDeletePlanningJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, sale_order_id }: { id: string; sale_order_id: string }) => {
      const { error } = await supabase.from('planning_jobs').delete().eq('id', id)
      if (error) throw error

      // ตรวจว่ายังมี planning job อื่นของ SO นี้อยู่ไหม
      const { data: remaining } = await supabase
        .from('planning_jobs')
        .select('id')
        .eq('sale_order_id', sale_order_id)
        .in('status', ['queued', 'ongoing', 'pending_receipt'])

      // ถ้าไม่มีแล้ว revert SO กลับเป็น approved
      if (!remaining?.length) {
        await supabase
          .from('sale_orders')
          .update({ status: 'approved' })
          .eq('id', sale_order_id)
        qc.invalidateQueries({ queryKey: ['sale_orders'] })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useUpdatePlanningJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, planned_qty, route_after, raw_material_qty }: { id: string; planned_qty?: number; route_after?: RouteAfter; raw_material_qty?: number }) => {
      const patch: Record<string, unknown> = {}
      if (planned_qty       !== undefined) patch.planned_qty       = planned_qty
      if (route_after       !== undefined) patch.route_after       = route_after
      if (raw_material_qty  !== undefined) patch.raw_material_qty  = raw_material_qty
      const { data, error } = await supabase
        .from('planning_jobs')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PlanningJob
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useSetRouteAfter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, route_after }: { id: string; route_after: RouteAfter }) => {
      // mark extrusion job done
      const { data: job, error } = await supabase
        .from('planning_jobs')
        .update({ route_after, status: 'done' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      if (route_after === 'to_printing') {
        // สร้าง Printing job ใหม่อัตโนมัติ
        const lot_no = generateLotNo('printing')
        await supabase.from('planning_jobs').insert({
          sale_order_id: job.sale_order_id,
          dept:          'printing',
          status:        'queued',
          planned_qty:   job.planned_qty,
          lot_no,
        })
      } else {
        // to_warehouse — รอรับเข้าคลัง
        await supabase
          .from('planning_jobs')
          .update({ status: 'pending_receipt' })
          .eq('id', id)
      }

      return job as PlanningJob
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
