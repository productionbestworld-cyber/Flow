import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { generateSoNo } from '../lib/utils'
import type { SaleOrder, SaleOrderInsert } from '../types'

const QUERY_KEY = 'sale_orders'

export function useSaleOrders() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_orders')
        .select(`*, customer:customers(*), product:products(*)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SaleOrder[]
    },
  })
}

export function useCreateSaleOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<SaleOrderInsert, 'so_no'> & { so_no?: string }) => {
      const { data: last } = await supabase
        .from('sale_orders')
        .select('so_no')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastNum = last?.so_no ? parseInt(last.so_no.replace('SO-', '')) : 0
      const so_no = input.so_no && input.so_no.trim() !== '' ? input.so_no : generateSoNo(isNaN(lastNum) ? 0 : lastNum)

      const { data, error } = await supabase
        .from('sale_orders')
        .insert({ ...input, so_no })
        .select(`*, customer:customers(*), product:products(*)`)
        .single()
      if (error) throw error
      return data as SaleOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useUpdateSaleOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SaleOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('sale_orders')
        .update(updates)
        .eq('id', id)
        .select(`*, customer:customers(*), product:products(*)`)
        .single()
      if (error) throw error

      // sync planned_qty ของ planning jobs ที่ยังไม่เสร็จ
      if (updates.qty !== undefined) {
        const { error: jobErr, data: updatedJobs } = await supabase
          .from('planning_jobs')
          .update({ planned_qty: updates.qty })
          .eq('sale_order_id', id)
          .in('status', ['queued', 'ongoing', 'pending_receipt'])
          .select('id, planned_qty, status')
        if (jobErr) throw new Error(`sync planning_jobs failed: ${jobErr.message}`)
        console.log('[SO update] synced planning_jobs:', updatedJobs)
        qc.invalidateQueries({ queryKey: ['planning_jobs'] })
      }

      return data as SaleOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useDeleteSaleOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // ดึง so_no ก่อนลบ เพื่อลบ STK lot ที่เกี่ยวข้อง
      const { data: so } = await supabase.from('sale_orders').select('so_no').eq('id', id).single()

      // ลบ warehouse_stock ที่เป็น STK lot ของ SO นี้
      if (so?.so_no) {
        await supabase
          .from('warehouse_stock')
          .delete()
          .like('lot_no', `STK-${so.so_no}-%`)
      }

      // ลบ requisitions ที่เกี่ยวข้อง
      await supabase.from('requisitions').delete().eq('sale_order_id', id)

      // ลบ planning jobs (และ production logs จะถูกลบ cascade ถ้า set ไว้)
      await supabase.from('planning_jobs').delete().eq('sale_order_id', id)

      const { error } = await supabase.from('sale_orders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: ['warehouse_stock'] })
      qc.invalidateQueries({ queryKey: ['requisitions'] })
      qc.invalidateQueries({ queryKey: ['planning_jobs'] })
    },
  })
}
