import { cn } from '../../lib/utils'

interface Props {
  className?: string
  rows?: number
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-slate-800 rounded', className)} />
  )
}

export function TableSkeleton({ rows = 5 }: Props) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: Props) {
  return (
    <div className={cn('bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export default Skeleton
