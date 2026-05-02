import { useState, useEffect } from 'react'
import { Plus, Trash2, X, KeyRound, User, Users, Package, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { cn } from '../lib/utils'
import type { AppUser, UserRole } from '../types'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin', planner: 'Planner', operator: 'Operator',
  warehouse: 'Warehouse', sales: 'Sales',
}
const ROLE_COLOR: Record<UserRole, string> = {
  admin: 'bg-purple-500/20 text-purple-300',
  planner: 'bg-blue-500/20 text-blue-300',
  operator: 'bg-green-500/20 text-green-300',
  warehouse: 'bg-yellow-500/20 text-yellow-300',
  sales: 'bg-pink-500/20 text-pink-300',
}

const EMPTY_USER = { username: '', full_name: '', password: '', role: 'operator' as UserRole }

export default function Settings() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers]       = useState<(AppUser & { username: string })[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShow]    = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_USER })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // Change password
  const [showPwModal, setShowPw] = useState(false)
  const [pwTarget, setPwTarget]  = useState<string | null>(null)
  const [newPw, setNewPw]        = useState('')
  const [savingPw, setSavingPw]  = useState(false)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('id, username, full_name, role').order('role')
    setUsers((data as any) ?? [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.username || !form.full_name || !form.password) { setError('กรุณากรอกข้อมูลให้ครบ'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.rpc('create_user', {
      p_username:  form.username,
      p_password:  form.password,
      p_full_name: form.full_name,
      p_role:      form.role,
    })
    if (err) setError(err.message)
    else { setShow(false); setForm({ ...EMPTY_USER }); fetchUsers() }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (id === me?.id) return alert('ไม่สามารถลบตัวเองได้')
    if (!confirm(`ลบผู้ใช้ "${name}"?`)) return
    await supabase.from('users').delete().eq('id', id)
    fetchUsers()
  }

  async function handleChangePw() {
    if (!pwTarget || !newPw || newPw.length < 6) return
    setSavingPw(true)
    await supabase.rpc('change_password', { p_user_id: pwTarget, p_new_password: newPw })
    setShowPw(false); setPwTarget(null); setNewPw(''); setSavingPw(false)
  }

  if (me?.role !== 'admin') {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-slate-500">เฉพาะ Admin เท่านั้น</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">ตั้งค่า</h1>
          <p className="text-slate-400 text-sm mt-0.5">จัดการผู้ใช้งานระบบ</p>
        </div>
        <button onClick={() => { setShow(true); setError('') }} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus size={15} /> เพิ่มผู้ใช้
        </button>
      </div>

      {/* Role Access Map */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800">
          <span className="text-white font-medium text-sm">สิทธิ์การเข้าถึงตาม Role</span>
          <p className="text-slate-500 text-xs mt-0.5">สร้าง user แต่ละคนด้วย Role ด้านล่าง — ระบบจะแสดงเมนูเฉพาะที่เกี่ยวข้อง</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/40">
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">เมนู</th>
                {(['admin','sales','planner','operator','warehouse'] as UserRole[]).map(r => (
                  <th key={r} className={cn('px-3 py-2.5 text-center font-medium', ROLE_COLOR[r])}>{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[
                { menu: 'Dashboard',     roles: ['admin','planner','operator','warehouse','sales'] },
                { menu: 'Sale Order',    roles: ['admin','sales'] },
                { menu: 'Planning',      roles: ['admin','planner'] },
                { menu: 'Extrusion',     roles: ['admin','operator'] },
                { menu: 'Printing',      roles: ['admin','operator'] },
                { menu: 'Grinding',      roles: ['admin','operator'] },
                { menu: 'คลังสินค้า',   roles: ['admin','warehouse'] },
                { menu: 'Sales',         roles: ['admin','sales'] },
                { menu: 'Billing',       roles: ['admin','sales'] },
                { menu: 'Activity Log',  roles: ['admin','planner','operator','warehouse','sales'] },
                { menu: 'ตั้งค่า',      roles: ['admin'] },
              ].map(row => (
                <tr key={row.menu} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{row.menu}</td>
                  {(['admin','sales','planner','operator','warehouse'] as UserRole[]).map(r => (
                    <td key={r} className="px-3 py-2 text-center">
                      {row.roles.includes(r)
                        ? <span className="text-green-400 text-base">✓</span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Master Data */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800">
          <span className="text-white font-medium text-sm">ข้อมูลหลัก</span>
        </div>
        {[
          { to: '/customers', icon: <Users size={16} className="text-blue-400" />, label: 'ลูกค้า', desc: 'จัดการรายชื่อลูกค้า' },
          { to: '/products',  icon: <Package size={16} className="text-purple-400" />, label: 'สินค้า', desc: 'จัดการรายการสินค้า' },
        ].map(item => (
          <button key={item.to} onClick={() => navigate(item.to)}
            className="w-full flex items-center justify-between px-5 py-3.5 border-b border-slate-800 hover:bg-slate-800/50 transition-colors last:border-0 text-left"
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <div>
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-slate-500 text-xs">{item.desc}</p>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-500" />
          </button>
        ))}
      </div>

      {/* Users list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <User size={15} className="text-slate-400" />
          <span className="text-white font-medium text-sm">ผู้ใช้งาน ({users.length})</span>
        </div>
        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}</div>
          ) : users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {u.full_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{u.full_name}</p>
                  <p className="text-slate-500 text-xs">@{u.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-0.5 rounded-full', ROLE_COLOR[u.role as UserRole])}>{ROLE_LABEL[u.role as UserRole]}</span>
                <button
                  onClick={() => { setPwTarget(u.id); setNewPw(''); setShowPw(true) }}
                  title="เปลี่ยนรหัสผ่าน"
                  className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors"
                >
                  <KeyRound size={14} />
                </button>
                {u.id !== me?.id && (
                  <button onClick={() => handleDelete(u.id, u.full_name)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note: ต้อง run SQL เพิ่ม */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">หมายเหตุ — ต้อง run SQL ใน Supabase ก่อนสร้าง user ได้:</p>
        <pre className="bg-slate-900 rounded p-2 text-slate-400 text-xs overflow-x-auto">{`create or replace function create_user(p_username text, p_password text, p_full_name text, p_role text)
returns void language plpgsql security definer as $$
begin
  insert into users (username, password, full_name, role)
  values (p_username, crypt(p_password, gen_salt('bf')), p_full_name, p_role);
end;$$;

create or replace function change_password(p_user_id uuid, p_new_password text)
returns void language plpgsql security definer as $$
begin
  update users set password = crypt(p_new_password, gen_salt('bf')) where id = p_user_id;
end;$$;`}</pre>
      </div>

      {/* Add user modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">เพิ่มผู้ใช้ใหม่</h2>
              <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'ชื่อผู้ใช้ (username)', key: 'username', placeholder: 'planner01' },
                { label: 'ชื่อ-นามสกุล', key: 'full_name', placeholder: 'สมชาย ใจดี' },
                { label: 'รหัสผ่าน', key: 'password', placeholder: '••••••••', type: 'password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                  <input
                    type={f.type ?? 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-brand-500">
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShow(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm">ยกเลิก</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'กำลังสร้าง...' : 'เพิ่ม'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">เปลี่ยนรหัสผ่าน</h2>
              <button onClick={() => setShowPw(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowPw(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm">ยกเลิก</button>
                <button onClick={handleChangePw} disabled={newPw.length < 6 || savingPw} className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition-colors">
                  {savingPw ? 'กำลังบันทึก...' : 'เปลี่ยน'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
