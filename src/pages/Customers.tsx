import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin } from 'lucide-react'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useCustomers'
import { cn } from '../lib/utils'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import type { Customer } from '../types'

function Field({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input {...props} className={cn('w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500 transition-colors', error ? 'border-red-500' : 'border-slate-700')} />
      {error && <p className="text-red-400 text-xs mt-0.5">{error}</p>}
    </div>
  )
}

const EMPTY: Omit<Customer, 'id' | 'created_at'> = { code: '', name: '', address: '', contact: '' }

export default function Customers() {
  const { data: customers, isLoading } = useCustomers()
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const remove = useDeleteCustomer()

  const [search, setSearch]   = useState('')
  const [showModal, setShow]  = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm]       = useState({ ...EMPTY })
  const [errors, setErrors]   = useState<Partial<typeof EMPTY>>({})

  const filtered = customers?.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setErrors({}); setShow(true) }
  function openEdit(c: Customer) { setEditing(c); setForm({ code: c.code, name: c.name, address: c.address ?? '', contact: c.contact ?? '' }); setErrors({}); setShow(true) }
  function close() { setShow(false); setEditing(null) }

  function validate() {
    const e: Partial<typeof EMPTY> = {}
    if (!form.code.trim()) e.code = 'กรุณาใส่รหัสลูกค้า'
    if (!form.name.trim()) e.name = 'กรุณาใส่ชื่อลูกค้า'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const payload = { code: form.code.trim(), name: form.name.trim(), address: form.address || undefined, contact: form.contact || undefined }
    if (editing) await update.mutateAsync({ id: editing.id, ...payload })
    else await create.mutateAsync(payload)
    close()
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`ลบลูกค้า "${c.name}"?`)) return
    await remove.mutateAsync(c.id)
  }

  const saving = create.isPending || update.isPending

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">ลูกค้า</h1>
          <p className="text-slate-400 text-sm mt-0.5">{customers?.length ?? 0} รายการ</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus size={15} /> เพิ่มลูกค้า
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหารหัส หรือชื่อลูกค้า..." className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">รหัส</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">ชื่อลูกค้า</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">ที่อยู่</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">เบอร์โทร</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              <tr><td colSpan={5} className="p-4"><TableSkeleton rows={6} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-500">ไม่พบข้อมูล</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 text-brand-400 font-mono text-xs font-medium">{c.code}</td>
                <td className="px-4 py-3 text-white">{c.name}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell max-w-xs truncate">
                  {c.address ? <span className="flex items-center gap-1"><MapPin size={11} />{c.address}</span> : '-'}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                  {c.contact ? <span className="flex items-center gap-1"><Phone size={11} />{c.contact}</span> : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">{editing ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h2>
              <button onClick={close} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="รหัสลูกค้า *" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="ก001" error={errors.code} />
                <Field label="ชื่อลูกค้า *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="บริษัท..." error={errors.name} />
              </div>
              <Field label="ที่อยู่" value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="ที่อยู่จัดส่ง..." />
              <Field label="เบอร์โทร / ผู้ติดต่อ" value={form.contact ?? ''} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="02-xxx-xxxx" />
              <div className="flex gap-3 pt-2">
                <button onClick={close} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'กำลังบันทึก...' : editing ? 'บันทึก' : 'เพิ่ม'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
