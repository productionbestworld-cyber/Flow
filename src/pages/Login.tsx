import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { cn } from '../lib/utils'

const schema = z.object({
  username: z.string().min(1, 'กรุณาใส่ชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณาใส่รหัสผ่าน'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const { user, signIn } = useAuth()
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  if (user) return <Navigate to="/" replace />

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { error } = await signIn(data.username, data.password)
    if (error) setServerError(error)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 mb-4">
            <span className="text-white font-bold text-xl">FP</span>
          </div>
          <h1 className="text-2xl font-bold text-white">FlowPro v2</h1>
          <p className="text-slate-400 text-sm mt-1">ระบบจัดการการผลิต</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">ชื่อผู้ใช้</label>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                placeholder="กรอกชื่อผู้ใช้"
                className={cn(
                  'w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-sm text-white',
                  'placeholder-slate-500 outline-none transition-colors focus:border-brand-500',
                  errors.username ? 'border-red-500' : 'border-slate-700'
                )}
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  className={cn(
                    'w-full bg-slate-800 border rounded-lg px-3 py-2.5 pr-10 text-sm text-white',
                    'placeholder-slate-500 outline-none transition-colors focus:border-brand-500',
                    errors.password ? 'border-red-500' : 'border-slate-700'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm mt-2"
            >
              {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          FlowPro v2 — Production Management System
        </p>
      </div>
    </div>
  )
}
