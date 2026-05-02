import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { WarehouseStock } from '../types'

const QUERY_KEY = 'warehouse_stock'

export function useWarehouseStock() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`*, product:products(*), planning_job:planning_jobs(*, sale_order:sale_orders(id,so_no,customer_id,product_id,qty,unit,status,po_no,ship_to,delivery_date,remark,created_at, customer:customers(*), product:products(*)))`)
        .order('received_at', { ascending: false })
      if (error) throw error
      return data as WarehouseStock[]
    },
  })
}

export function useReceiveToStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      planning_job_id, lot_no, product_id, qty, unit, location, received_by,
    }: Omit<WarehouseStock, 'id' | 'received_at' | 'condition' | 'product' | 'planning_job'>) => {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .insert({ planning_job_id, lot_no, product_id, qty, unit, location, received_by, condition: 'good' })
        .select()
        .single()
      if (error) throw error

      // mark planning job done
      const { data: job } = await supabase
        .from('planning_jobs')
        .update({ status: 'done' })
        .eq('id', planning_job_id)
        .select('sale_order_id')
        .single()

      // mark sale order completed เฉพาะเมื่อไม่มีใบเบิกส่วนสต็อกรออยู่
      if (job?.sale_order_id) {
        const { data: pendingStockReqs } = await supabase
          .from('requisitions')
          .select('id, items')
          .eq('sale_order_id', job.sale_order_id)
          .in('status', ['pending', 'approved'])
        const hasStockPortion = (pendingStockReqs ?? []).some((r: any) =>
          (r.items ?? []).some((i: any) => i.stock_id === '__stock_portion__')
        )
        if (!hasStockPortion) {
          await supabase
            .from('sale_orders')
            .update({ status: 'completed' })
            .eq('id', job.sale_order_id)
          qc.invalidateQueries({ queryKey: ['sale_orders'] })
        }
      }

      qc.invalidateQueries({ queryKey: ['planning_jobs'] })

      return data as WarehouseStock
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useAddManualStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      lot_no, product_id, qty, unit, received_by,
    }: { lot_no: string; product_id: string; qty: number; unit: string; received_by?: string }) => {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .insert({ lot_no, product_id, qty, unit, received_by, condition: 'good', planning_job_id: null })
        .select()
        .single()
      if (error) throw error
      return data as WarehouseStock
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
