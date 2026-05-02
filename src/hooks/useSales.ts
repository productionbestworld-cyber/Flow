import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Requisition } from '../types'

const QUERY_KEY = 'requisitions'

export function useRequisitions() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requisitions')
        .select(`*, sale_order:sale_orders(*, customer:customers(*), product:products(*))`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Requisition[]
    },
  })
}

export function useCreateRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<Requisition, 'sale_order_id' | 'items' | 'requested_by'>) => {
      const { data, error } = await supabase
        .from('requisitions')
        .insert({ ...input, status: 'pending' })
        .select(`*, sale_order:sale_orders(*, customer:customers(*), product:products(*))`)
        .single()
      if (error) throw error
      return data as Requisition
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useApproveRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approved_by }: { id: string; approved_by: string }) => {
      const { data, error } = await supabase
        .from('requisitions')
        .update({ status: 'approved', approved_by })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Requisition
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useCancelRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('requisitions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useDispatchRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, extraItems }: { id: string; extraItems?: { stock_id: string; qty: number }[] }) => {
      const { data: req, error: fetchErr } = await supabase
        .from('requisitions')
        .select('*')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr

      const baseItems: { stock_id: string; qty: number }[] = req.items ?? []
      const allItems = [...baseItems, ...(extraItems ?? [])]
      const realItems = allItems.filter(i =>
        i.stock_id !== '__stock_portion__' && !i.stock_id.startsWith('manual-')
      )

      const { data, error } = await supabase
        .from('requisitions')
        .update({ status: 'dispatched', items: allItems })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      if (realItems.length > 0) {
        const stockIds = realItems.map(i => i.stock_id)
        await supabase.from('warehouse_stock').delete().in('id', stockIds)
        qc.invalidateQueries({ queryKey: ['warehouse_stock'] })
      }

      if (req.sale_order_id) {
        await supabase
          .from('sale_orders')
          .update({ status: 'completed' })
          .eq('id', req.sale_order_id)
        qc.invalidateQueries({ queryKey: ['sale_orders'] })
      }

      return data as Requisition
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
