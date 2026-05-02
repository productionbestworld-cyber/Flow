import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatNumber(n: number | null | undefined, decimals?: number): string {
  if (n == null) return '-'
  if (decimals !== undefined) {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
  }
  return new Intl.NumberFormat('th-TH').format(n)
}

export function generateSoNo(lastNo: number): string {
  return `SO-${String(lastNo + 1).padStart(5, '0')}`
}

export function generateLotNo(dept: string): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const t = String(now.getTime()).slice(-4)
  return `${dept.toUpperCase().slice(0, 3)}-${y}${m}${d}-${t}`
}
