import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { AppUser } from '../types'

const SESSION_KEY = 'flowpro_user'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { localStorage.removeItem(SESSION_KEY) }
    }
    setLoading(false)
  }, [])

  async function signIn(username: string, password: string) {
    const { data, error } = await supabase.rpc('login', {
      p_username: username,
      p_password: password,
    })

    if (error || !data || data.length === 0) {
      return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
    }

    const appUser: AppUser = data[0]
    setUser(appUser)
    localStorage.setItem(SESSION_KEY, JSON.stringify(appUser))
    return { error: null }
  }

  function signOut() {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
