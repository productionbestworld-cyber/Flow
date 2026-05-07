import { useState, useEffect } from 'react'
import { Play, CheckCircle, Save, Cog, Edit2, Scale, List, Clock, FileText } from 'lucide-react'
import { useUpsertProductionLog, useFinishProduction, useEditProductionLog } from '../../hooks/useProduction'
import { supabase } from '../../lib/supabase'
import WeighingModal from './WeighingModal'
import RollReportModal from './RollReportModal'
import { formatNumber, cn } from '../../lib/utils'
import type { PlanningJob, ProductionLog, PlanningDept } from '../../types'

interface Props {
  job: PlanningJob
  log?: ProductionLog
  dept: PlanningDept
}

function RollLogTable({ jobId }: { jobId: string }) {
  const [rolls, setRolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRolls() {
      const { data } = await supabase
        .from('production_rolls')
        .select('*')
        .eq('job_id', jobId)
        .order('roll_no', { ascending: true })
      if (data) setRolls(data)
      setLoading(false)
    }
    fetchRolls()
  }, [jobId])

  if (loading) return <div className="text-[10px] text-slate-500 animate-pulse py-2">กำลังดึงข้อมูลม้วน...</div>
  if (rolls.length === 0) return <div className="text-[10px] text-slate-600 italic py-2">ไม่มีข้อมูลการชั่งม้วน</div>

  return (
    <div className="mt-4 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50">
      <div className="bg-slate-800 p-2 px-4 flex justify-between items-center">
         <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Roll History</span>
         <button 
           onClick={() => (window as any).showReport(rolls)}
           className="text-[10px] font-black uppercase text-brand-400 hover:text-brand-300 flex items-center gap-2"
         >
           <FileText size={12} /> ดูแบบฟอร์ม A4
         </button>
      </div>
      <table className="w-full text-[10px]">
        <thead className="bg-slate-800 text-slate-500 uppercase tracking-widest text-[9px]">
          <tr>
            <th className="p-2 text-left">ม้วน</th>
            <th className="p-2 text-right">ชั่งดิบ</th>
            <th className="p-2 text-right">แกน</th>
            <th className="p-2 text-right text-brand-400 font-black">สุทธิ (kg)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rolls.map(r => (
            <tr key={r.id} className="hover:bg-slate-800 transition-colors">
              <td className="p-2 font-bold text-slate-300">#{r.roll_no}</td>
              <td className="p-2 text-right text-slate-500">{(Number(r.weight) + Number(r.core_weight || 0)).toFixed(2)}</td>
              <td className="p-2 text-right text-slate-500">{r.core_weight || 0}</td>
              <td className="p-2 text-right font-black text-brand-400 text-sm">{r.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
  const [showWeighModal, setShowWeighModal] = useState(false)
  const [showRollLog, setShowRollLog] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportRolls, setReportRolls] = useState<any[]>([])

  // Global hook for child component to trigger report
  useEffect(() => {
    (window as any).showReport = (rolls: any[]) => {
      setReportRolls(rolls);
      setShowReport(true);
    };
  }, []);

  // Sync state with props when data changes
  useEffect(() => {
    if (log) {
      setGoodRolls(log.good_rolls?.toString() ?? '')
      setGoodQty(log.good_qty?.toString() ?? '')
      setBadRolls(log.bad_rolls?.toString() ?? '')
      setBadQty(log.bad_qty?.toString() ?? '')
      setWasteQty(log.waste_qty?.toString() ?? '')
    }
  }, [log])

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
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-3">
        <div className="flex justify-between text-xs mb-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">ความคืบหน้า</span>
            <button 
              onClick={() => {
                console.log('Toggling roll log for:', job.id);
                setShowRollLog(!showRollLog);
              }}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-2 border active:scale-95 shadow-lg",
                showRollLog 
                  ? "bg-brand-500 text-white border-brand-400 shadow-brand-500/40" 
                  : "bg-brand-500/10 text-brand-400 border-brand-500/20 hover:bg-brand-500/20"
              )}
            >
              <List size={12} /> {showRollLog ? 'ปิดรายการ' : `ชั่งแล้ว ${log?.good_rolls || 0} ม้วน`}
            </button>

            {/* NEW: Direct Print A4 Button */}
            <button 
              onClick={async () => {
                const { data } = await supabase.from('production_rolls').select('*').eq('job_id', job.id).order('roll_no', { ascending: true });
                if (data) {
                  setReportRolls(data);
                  setShowReport(true);
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-brand-400 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-slate-700 active:scale-95"
            >
              <FileText size={12} /> รายงาน A4
            </button>
          </div>
          <span className="text-white font-black">{pct}% <small className="opacity-40 font-normal">({formatNumber(parseFloat(goodQty || '0'))} / {formatNumber(job.planned_qty)} kg)</small></span>
        </div>
        
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(var(--brand-500),0.5)]" style={{ width: `${pct}%` }} />
        </div>

        {/* Real-time Roll Log */}
        {showRollLog && <RollLogTable jobId={job.id} />}
      </div>

      {/* Inputs */}
      {(!isFinished || isEditing) && (
        <div className="grid gap-2 border-t border-slate-800 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest text-center">ม้วนดี (Rolls)</label>
                <input type="number" value={goodRolls} onChange={e => setGoodRolls(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500 text-center font-black" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-widest text-center">น้ำหนักดี (kg)</label>
                <input type="number" value={goodQty} onChange={e => setGoodQty(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500 text-center font-black" />
              </div>
            </div>
        </div>
      )}

      {/* Actions */}
      {!isFinished && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
             <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg transition-colors font-bold"><Save size={14} /> บันทึกยอด</button>
             <button onClick={handleFinish} className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-lg transition-colors font-bold"><Play size={14} /> เสร็จสิ้น</button>
          </div>
          
          <button
            onClick={() => setShowWeighModal(true)}
            className="flex items-center justify-center gap-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-black p-4 rounded-xl transition-all shadow-lg shadow-brand-500/20 active:scale-95 border-b-4 border-brand-800"
          >
            <Scale size={20} /> เริ่มชั่งน้ำหนักม้วน
          </button>

          <WeighingModal 
            isOpen={showWeighModal} 
            onClose={() => { setShowWeighModal(false); window.location.reload(); }} 
            job={job}
          />

          <RollReportModal
            isOpen={showReport}
            onClose={() => setShowReport(false)}
            job={job}
            rolls={reportRolls}
          />
        </div>
      )}
      
      {isEditing && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs py-2 rounded-lg transition-colors font-bold">ยกเลิก</button>
          <button onClick={handleSaveEdit} disabled={editLog.isPending} className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs py-2 rounded-lg transition-colors font-bold"><Save size={14} /> บันทึกแก้ไข</button>
        </div>
      )}
    </div>
  )
}
