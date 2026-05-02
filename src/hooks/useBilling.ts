import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Invoice } from '../types'

const QUERY_KEY = 'invoices'

export function useInvoices() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`*, sale_order:sale_orders(*, customer:customers(*), product:products(*))`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Invoice[]
    },
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<Invoice, 'sale_order_id' | 'requisition_id' | 'amount' | 'tax'>) => {
      const total = input.amount + input.tax
      const { data, error } = await supabase
        .from('invoices')
        .insert({ ...input, total, status: 'draft' })
        .select(`*, sale_order:sale_orders(*, customer:customers(*), product:products(*))`)
        .single()
      if (error) throw error
      return data as Invoice
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice['status'] }) => {
      const updates: Partial<Invoice> = { status }
      if (status === 'issued') updates.issued_at = new Date().toISOString()
      if (status === 'paid')   updates.paid_at   = new Date().toISOString()
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Invoice
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
