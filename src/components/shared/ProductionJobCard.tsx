import { useState } from 'react'
import { Play, CheckCircle, Save, Cog, Edit2 } from 'lucide-react'
import { useUpsertProductionLog, useFinishProduction, useEditProductionLog } from '../../hooks/useProduction'
import { formatNumber, cn } from '../../lib/utils'
import type { PlanningJob, ProductionLog, PlanningDept } from '../../types'

interface Props {
  job: PlanningJob
  log?: ProductionLog
  dept: PlanningDept
}

export default function ProductionJobCard({ job, log, dept }: Props) {
  const upsert    = useUpsertProductionLog()
  const finish    = useFinishProduction()
  const editLog   = useEditProductionLog()

  const [goodRolls, setGoodRolls]  = useState(log?.good_rolls?.toString() ?? '')
  const [goodQty, setGoodQty]      = useState(log?.good_qty?.toString() ?? '')
  const [badRolls, setBadRolls]    = useState(log?.bad_rolls?.toString() ?? '')
  const [badQty, setBadQty]        = useState(log?.bad_qty?.toString() ?? '')
  const [wasteQty, setWasteQty]    = useState(log?.waste_qty?.toString() ?? '')
  const [saving, setSaving]        = useState(false)
  const [isEditing, setIsEditing]  = useState(false)

  const so = job.sale_order
  const isFinished = !!log?.finished_at

  const pct = goodQty && job.planned_qty
    ? Math.min(100, Math.round((parseFloat(goodQty) / job.planned_qty) * 100))
    : 0

  async function handleSave() {
    setSaving(true)
    try {
      await upsert.mutateAsync({
        planning_job_id: job.id,
        dept,
        good_rolls:  goodRolls ? parseFloat(goodRolls) : undefined,
        good_qty:    goodQty   ? parseFloat(goodQty)   : undefined,
        bad_rolls:   badRolls  ? parseFloat(badRolls)  : undefined,
        waste_qty:   wasteQty  ? parseFloat(wasteQty)  : undefined,
        started_at:  log?.started_at ?? new Date().toISOString(),
      })
    } catch (e) {
      console.error('บันทึกไม่สำเร็จ:', e)
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!log?.id) return
    if (!goodQty) { alert('กรุณาระบุจำนวนม้วนดี (kg)'); return }
    try {
      await editLog.mutateAsync({
        logId:      log.id,
        jobId:      job.id,
        jobStatus:  job.status,
        good_rolls: goodRolls ? parseFloat(goodRolls) : undefined,
        good_qty:   parseFloat(goodQty),
        bad_rolls:  badRolls  ? parseFloat(badRolls)  : undefined,
        bad_qty:    badQty    ? parseFloat(badQty)    : undefined,
        waste_qty:  wasteQty  ? parseFloat(wasteQty)  : undefined,
      })
      setIsEditing(false)
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const isPrintJob = job.route_after === 'to_printing'

  async function handleFinish() {
    // ใช้ค่าจาก input ปัจจุบัน (ไม่ต้องบันทึกก่อน)
    const finalGoodRolls = goodRolls ? parseFloat(goodRolls) : (log?.good_rolls ?? undefined)
    const finalGoodQty   = goodQty   ? parseFloat(goodQty)   : (log?.good_qty   ?? undefined)
    const finalBadRolls  = badRolls  ? parseFloat(badRolls)  : (log?.bad_rolls  ?? undefined)
    const finalBadQty    = badQty    ? parseFloat(badQty)    : (log?.bad_qty    ?? undefined)
    const finalWasteQty  = wasteQty  ? parseFloat(wasteQty)  : (log?.waste_qty  ?? undefined)

    if (!finalGoodQty) {
      alert('กรุณาระบุจำนวนม้วนดี (kg) ก่อนเสร็จสิ้น')
      return
    }

    const dest = (dept === 'extrusion' && isPrintJob) ? 'Printing' : 'คลัง'
    const lines: string[] = ['ยืนยันเสร็จสิ้นการผลิต?\n']
    lines.push(`✓ ม้วนดี ${finalGoodRolls ?? '-'} ม้วน · ${finalGoodQty} kg → ${dest}`)
    if (finalBadRolls && finalBadRolls > 0) {
      lines.push(`⚙ ม้วนเสีย ${finalBadRolls} ม้วน${finalBadQty ? ` · ${finalBadQty} kg` : ''} → Grinding`)
    }
    if (finalWasteQty && finalWasteQty > 0) {
      lines.push(`✗ เศษเสีย ${finalWasteQty} kg`)
    }
    if (!confirm(lines.join('\n'))) return

    // บันทึก log ก่อนถ้ายังไม่มี (หรือ update)
    let logId = log?.id
    try {
      const saved = await upsert.mutateAsync({
        planning_job_id: job.id,
        dept,
        good_rolls:  finalGoodRolls,
        good_qty:    finalGoodQty,
        bad_rolls:   finalBadRolls,
        bad_qty:     finalBadQty,
        waste_qty:   finalWasteQty,
        started_at:  log?.started_at ?? new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      logId = saved.id
    } catch (e) {
      console.error('บันทึก log ไม่สำเร็จ:', e)
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
      return
    }

    try {
      await finish.mutateAsync({
        jobId:    job.id,
        logId:    logId!,
        goodQty:  finalGoodQty,
        badRolls: finalBadRolls,
        badQty:   finalBadQty,
      })
    } catch (e) {
      console.error('เสร็จสิ้นไม่สำเร็จ:', e)
      alert('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div className={cn('bg-slate-900 border rounded-xl p-4 space-y-3', isFinished ? 'border-green-500/30' : 'border-slate-800')}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-medium text-sm">{so?.so_no}</p>
          <p className="text-slate-400 text-xs mt-0.5">{so?.customer?.name} · {so?.product?.part_name}</p>
          <p className="text-slate-500 text-xs">เครื่อง {job.machine_no} · {job.lot_no}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isFinished && !isEditing && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <CheckCircle size={14} /> เสร็จสิ้น
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <Edit2 size={9} /> แก้ไข
              </button>
            </div>
          )}
          {isEditing && (
            <span className="text-yellow-400 text-xs">โหมดแก้ไข</span>
          )}
          {!isFinished && log?.bad_rolls && log.bad_rolls > 0 && (
            <span className="flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] px-2 py-0.5 rounded-full">
              <Cog size={9} /> ม้วนเสีย {log.bad_rolls} ม้วน → กรอ
            </span>
          )}
        </div>
      </div>

      {/* Route summary — แสดงเฉพาะ extrusion */}
      {dept === 'extrusion' && (
        <div className="flex gap-2 flex-wrap">
          <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
            isPrintJob
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
          }`}>
            ม้วนดี → {isPrintJob ? 'Printing' : 'คลัง'}
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border bg-orange-500/10 border-orange-500/30 text-orange-300">
            <Cog size={9} /> ม้วนเสีย → Grinding
          </span>
        </div>
      )}

      {/* Material summary */}
      {(() => {
        const inputQty  = dept === 'grinding' ? job.planned_qty : job.raw_material_qty
        const inputLabel = dept === 'grinding' ? 'ม้วนเสียรับมา (input)' : 'วัตถุดิบเบิก (วางแผน)'
        const outputLabel = dept === 'grinding' ? 'กรอได้ (output)' : 'ผลิตได้ (ม้วนดี)'
        if (!inputQty && !log?.good_qty) return null
        return (
          <div className="bg-slate-800/60 rounded-lg px-3 py-2 space-y-1">
            {inputQty && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{inputLabel}</span>
                <span className="text-white">{formatNumber(inputQty)} kg</span>
              </div>
            )}
            {log?.good_qty && (
              <div className="flex justify-between text-xs">
                <span className="text-green-400">{outputLabel}</span>
                <span className="text-green-300">{formatNumber(log.good_qty)} kg</span>
              </div>
            )}
            {log?.waste_qty && log.waste_qty > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-orange-400">เศษสแคป</span>
                <span className="text-orange-300">{formatNumber(log.waste_qty)} kg</span>
              </div>
            )}
            {inputQty && log?.good_qty && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">สูญเสียรวม</span>
                  <span className="text-red-300">{formatNumber(inputQty - log.good_qty)} kg</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-700 pt-1">
                  <span className="text-slate-400">Yield</span>
                  <span className={`font-medium ${Math.round(log.good_qty / inputQty * 100) >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {Math.round(log.good_qty / inputQty * 100)}%
                  </span>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">ความคืบหน้า</span>
          <span className="text-white">{pct}% ({goodQty || 0} / {formatNumber(job.planned_qty)} kg)</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Inputs */}
      {(!isFinished || isEditing) && (
        <div className="grid gap-2">
          {dept === 'grinding' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">ม้วนที่กรอได้</label>
                <input
                  type="number"
                  value={goodRolls}
                  onChange={e => setGoodRolls(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">น้ำหนักที่กรอได้ (kg)</label>
                <input
                  type="number"
                  value={goodQty}
                  onChange={e => setGoodQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">เศษสแคป (kg)</label>
                <input
                  type="number"
                  value={wasteQty}
                  onChange={e => setWasteQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">ม้วนดี</label>
                <input
                  type="number"
                  value={goodRolls}
                  onChange={e => setGoodRolls(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ม้วนดี (kg)</label>
                <input
                  type="number"
                  value={goodQty}
                  onChange={e => setGoodQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              {dept !== 'printing' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">ม้วนกรอ</label>
                    <input
                      type="number"
                      value={badRolls}
                      onChange={e => setBadRolls(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">ม้วนกรอ (kg)</label>
                    <input
                      type="number"
                      value={badQty}
                      onChange={e => setBadQty(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                    />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">เศษเสีย (kg)</label>
                <input
                  type="number"
                  value={wasteQty}
                  onChange={e => setWasteQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isFinished && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Save size={13} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors ml-auto"
          >
            <Play size={13} /> เสร็จสิ้น
          </button>
        </div>
      )}
      {isEditing && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { setIsEditing(false); setGoodRolls(log?.good_rolls?.toString() ?? ''); setGoodQty(log?.good_qty?.toString() ?? ''); setBadRolls(log?.bad_rolls?.toString() ?? ''); setBadQty(log?.bad_qty?.toString() ?? ''); setWasteQty(log?.waste_qty?.toString() ?? '') }}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs py-1.5 rounded-lg transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={editLog.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg transition-colors"
          >
            <Save size={13} /> {editLog.isPending ? 'กำลังบันทึก...' : 'บันทึกแก้ไข'}
          </button>
        </div>
      )}
    </div>
  )
}
