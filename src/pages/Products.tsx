import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts'
import { cn, formatNumber } from '../lib/utils'
import { TableSkeleton } from '../components/shared/LoadingSkeleton'
import type { Product, ProductType } from '../types'

const TYPE_LABEL: Record<ProductType, string> = { blow: 'Blow', print: 'Print', blow_print: 'Blow+Print' }
const TYPE_COLOR: Record<ProductType, string> = {
  blow: 'bg-blue-500/20 text-blue-300',
  print: 'bg-purple-500/20 text-purple-300',
  blow_print: 'bg-green-500/20 text-green-300',
}

function extractSize(width?: number, thickness?: number): string {
  if (width && thickness) return `${width}x${thickness}`
  return '-'
}

const EMPTY = { item_code: '', part_name: '', type: 'blow' as ProductType, width: '', thickness: '', unit: 'kg' }

export default function Products() {
  const { data: products, isLoading } = useProducts()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const remove = useDeleteProduct()

  const [search, setSearch]   = useState('')
  const [typeFilter, setType] = useState<ProductType | 'all'>('all')
  const [showModal, setShow]  = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm]       = useState({ ...EMPTY })
  const [errors, setErrors]   = useState<Partial<typeof EMPTY>>({})

  const filtered = products?.filter(p =>
    (typeFilter === 'all' || p.type === typeFilter) &&
    (p.item_code.toLowerCase().includes(search.toLowerCase()) ||
     p.part_name.toLowerCase().includes(search.toLowerCase()))
  ) ?? []

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setErrors({}); setShow(true) }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({ item_code: p.item_code, part_name: p.part_name, type: p.type, width: p.width?.toString() ?? '', thickness: p.thickness?.toString() ?? '', unit: p.unit })
    setErrors({})
    setShow(true)
  }
  function close() { setShow(false); setEditing(null) }

  function validate() {
    const e: Partial<typeof EMPTY> = {}
    if (!form.item_code.trim()) e.item_code = 'กรุณาใส่รหัสสินค้า'
    if (!form.part_name.trim()) e.part_name = 'กรุณาใส่ชื่อสินค้า'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const payload = {
      item_code: form.item_code.trim(),
      part_name: form.part_name.trim(),
      type: form.type,
      width: form.width ? parseFloat(form.width) : undefined,
      thickness: form.thickness ? parseFloat(form.thickness) : undefined,
      unit: form.unit,
    }
    if (editing) await update.mutateAsync({ id: editing.id, ...payload })
    else await create.mutateAsync(payload)
    close()
  }

  async function handleDelete(p: Product) {
    if (!confirm(`ลบสินค้า "${p.part_name}"?`)) return
    await remove.mutateAsync(p.id)
  }

  const saving = create.isPending || update.isPending

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">สินค้า</h1>
          <p className="text-slate-400 text-sm mt-0.5">{products?.length ?? 0} รายการ</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus size={15} /> เพิ่มสินค้า
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหารหัส หรือชื่อสินค้า..." className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500" />
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
          {(['all', 'blow', 'print', 'blow_print'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors', typeFilter === t ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white')}>
              {t === 'all' ? 'ทั้งหมด' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">รหัสสินค้า</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">ชื่อสินค้า</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Size</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">ประเภท</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium hidden md:table-cell">กว้าง (cm)</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium hidden md:table-cell">หนา (mc)</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">หน่วย</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              <tr><td colSpan={8} className="p-4"><TableSkeleton rows={6} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-500">ไม่พบข้อมูล</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 text-brand-400 font-mono text-xs">{p.item_code}</td>
                <td className="px-4 py-3 text-white">{p.part_name}</td>
                <td className="px-4 py-3 text-slate-400">{extractSize(p.width, p.thickness)}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', TYPE_COLOR[p.type])}>{TYPE_LABEL[p.type]}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400 hidden md:table-cell">{p.width ? formatNumber(p.width) : '-'}</td>
                <td className="px-4 py-3 text-right text-slate-400 hidden md:table-cell">{p.thickness ? formatNumber(p.thickness) : '-'}</td>
                <td className="px-4 py-3 text-slate-400">{p.unit}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button>
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
              <h2 className="text-white font-semibold">{editing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
              <button onClick={close} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">รหัสสินค้า *</label>
                  <input value={form.item_code} onChange={e => setForm(f => ({ ...f, item_code: e.target.value }))} placeholder="01FXX-XXX001" className={cn('w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500', errors.item_code ? 'border-red-500' : 'border-slate-700')} />
                  {errors.item_code && <p className="text-red-400 text-xs mt-0.5">{errors.item_code}</p>}
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ประเภท</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ProductType }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500">
                    <option value="blow">Blow only</option>
                    <option value="print">Print only</option>
                    <option value="blow_print">Blow + Print</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">ชื่อสินค้า *</label>
                <input value={form.part_name} onChange={e => setForm(f => ({ ...f, part_name: e.target.value }))} placeholder="Plastic Shrink Film..." className={cn('w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500', errors.part_name ? 'border-red-500' : 'border-slate-700')} />
                {errors.part_name && <p className="text-red-400 text-xs mt-0.5">{errors.part_name}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">กว้าง (cm)</label>
                  <input type="number" value={form.width} onChange={e => setForm(f => ({ ...f, width: e.target.value }))} placeholder="0" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">หนา (mc)</label>
                  <input type="number" value={form.thickness} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))} placeholder="0" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">หน่วย</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500">
                    <option value="kg">kg</option>
                    <option value="ถุง">ถุง</option>
                    <option value="ม้วน">ม้วน</option>
                  </select>
                </div>
              </div>
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
