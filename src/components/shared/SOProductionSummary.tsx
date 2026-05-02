import { useSOSummary } from '../../hooks/useSOSummary'

interface Props {
  soId: string
  isPrint?: boolean
}

export default function SOProductionSummary({ soId, isPrint }: Props) {
  const { data: s } = useSOSummary(soId)
  if (!s) return null

  const hasActivity = s.extGoodQty > 0 || s.extBadRolls > 0 || s.grdGoodQty > 0 || s.prtGoodQty > 0

  if (!hasActivity) return null

  return (
    <div className="mt-3 bg-slate-800/60 rounded-lg px-4 py-3 space-y-2">
      <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">สรุปการผลิต</p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {/* Extrusion */}
        {s.extGoodRolls > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">ม้วนดี (เป่า)</span>
            <span className="text-white">{s.extGoodRolls} ม้วน · {s.extGoodQty.toLocaleString()} kg</span>
          </div>
        )}

        {/* Grinding */}
        {s.grdRolls > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">ส่งกรอ</span>
            <span className="text-orange-300">{s.grdRolls} ม้วน</span>
          </div>
        )}
        {s.grdGoodQty > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">กรอได้</span>
            <span className="text-white">{s.grdGoodRolls} ม้วน · {s.grdGoodQty.toLocaleString()} kg</span>
          </div>
        )}

        {/* Printing */}
        {isPrint && s.prtGoodQty > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">พิมพ์ได้</span>
            <span className="text-white">{s.prtGoodRolls} ม้วน · {s.prtGoodQty.toLocaleString()} kg</span>
          </div>
        )}

        {/* เศษ */}
        {s.totalWaste > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">เศษเสียรวม</span>
            <span className="text-slate-300">{s.totalWaste.toLocaleString()} kg</span>
          </div>
        )}
      </div>

      {/* รวม */}
      {s.totalGoodQty > 0 && (
        <div className="border-t border-slate-700 pt-2 flex justify-between text-xs font-semibold">
          <span className="text-green-400">รวมเข้าคลัง</span>
          <span className="text-green-400">{s.totalGoodQty.toLocaleString()} kg</span>
        </div>
      )}
    </div>
  )
}
