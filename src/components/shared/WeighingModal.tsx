import React, { useState, useEffect } from 'react';
import { X, Scale, Printer, Save, History, Box, ChevronRight, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUpsertProductionLog } from '../../hooks/useProduction';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';

interface WeighingModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
}

export default function WeighingModal({ isOpen, onClose, job }: WeighingModalProps) {
  const [weight, setWeight] = useState(0);
  const [coreWeight, setCoreWeight] = useState(1.5);
  const [rolls, setRolls] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const upsert = useUpsertProductionLog();

  // Simulate scale data
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setWeight(prev => {
        const target = 25.50 + (Math.random() * 0.1);
        return parseFloat(target.toFixed(2));
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) fetchRolls();
  }, [isOpen, job.id]);

  async function fetchRolls() {
    const { data } = await supabase
      .from('production_rolls')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(6);
    if (data) setRolls(data);
  }

  const netWeight = Math.max(0, weight - coreWeight);
  const totalProduced = rolls.length > 0 ? job.production_logs?.[0]?.good_rolls || 0 : 0;
  const currentTotalQty = job.production_logs?.[0]?.good_qty || 0;
  const progressPct = Math.min(100, Math.round((currentTotalQty / job.planned_qty) * 100));

  async function handleSave() {
    setSaving(true);
    try {
      const nextRollNo = (job.production_logs?.[0]?.good_rolls || 0) + 1;
      
      const { error: rollError } = await supabase
        .from('production_rolls')
        .insert({
          job_id: job.id,
          roll_no: nextRollNo,
          weight: netWeight,
          core_weight: coreWeight,
          gross_weight: weight,
        });

      if (rollError) throw rollError;

      const newTotalQty = currentTotalQty + netWeight;
      await upsert.mutateAsync({
        planning_job_id: job.id,
        dept: 'extrusion',
        good_rolls: nextRollNo,
        good_qty: newTotalQty,
      });

      fetchRolls();
      alert(`บันทึกม้วนที่ ${nextRollNo} สำเร็จ!`);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-4 md:p-8 overflow-y-auto">
      <div className="bg-[#0f172a] w-full max-w-6xl rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px]" />

        {/* Top Header */}
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.1)]">
              <Scale className="text-cyan-400" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Siamscales Pro</h2>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] font-black bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md border border-white/5 uppercase tracking-widest flex items-center gap-1">
                  <Zap size={10} /> Lot: {job.lot_no}
                </span>
                <span className="text-[10px] font-black bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md border border-white/5 uppercase tracking-widest flex items-center gap-1">
                  <Box size={10} /> MC: {job.machine_no}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Total Produced</p>
              <p className="text-4xl font-black text-white leading-none">
                {totalProduced} <small className="text-sm opacity-30 font-normal italic tracking-normal">ROLLS</small>
              </p>
            </div>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-white/5 active:scale-95">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-8 grid grid-cols-12 gap-8">
          
          {/* LEFT: Live Weight & Specs */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Job Details Dashboard */}
            <div className="grid grid-cols-3 gap-4">
               <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Customer / ลูกค้า</p>
                  <p className="font-bold text-white truncate text-sm">{job.sale_order?.customer?.name || '-'}</p>
               </div>
               <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Product / รายการ</p>
                  <p className="font-bold text-white truncate text-sm">{job.sale_order?.product?.part_name || '-'}</p>
               </div>
               <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Specs / ขนาด</p>
                  <p className="font-bold text-cyan-400 text-sm">
                    {job.sale_order?.product?.width && `${job.sale_order.product.width} x `}
                    {job.sale_order?.product?.thickness && `${job.sale_order.product.thickness} `}
                    {job.sale_order?.product?.unit || ''}
                  </p>
               </div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-[2rem] p-10 relative overflow-hidden group shadow-inner">
               <div className="absolute top-6 left-8 flex items-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em]">Live Data Stream</span>
               </div>
               
               <div className="text-center py-12">
                  <div className="relative inline-block">
                    <span className="text-[12rem] font-black text-white leading-none tracking-tighter tabular-nums drop-shadow-[0_0_40px_rgba(255,255,255,0.1)]" style={{ fontFamily: 'Orbitron' }}>
                      {weight.toFixed(2)}
                    </span>
                    <span className="absolute -right-24 bottom-6 text-4xl font-black text-cyan-500/40 uppercase tracking-[0.5em] italic">KG</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-800/40 border border-white/5 rounded-3xl p-6 transition-all hover:border-white/10 group/card">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Core Weight (KG)</p>
                    <div className="flex items-center justify-between">
                      <input 
                        type="number" 
                        value={coreWeight} 
                        onChange={e => setCoreWeight(parseFloat(e.target.value) || 0)}
                        className="bg-transparent text-3xl font-black text-white outline-none w-full"
                        style={{ fontFamily: 'Orbitron' }}
                      />
                      <EditIcon className="text-slate-600 group-hover/card:text-cyan-400 transition-colors" size={20} />
                    </div>
                  </div>
                  <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-3xl p-6 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]">
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3">Net Weight (สุทธิ)</p>
                    <p className="text-5xl font-black text-cyan-400" style={{ fontFamily: 'Orbitron' }}>{netWeight.toFixed(2)}</p>
                  </div>
               </div>
            </div>

            {/* Batch Progress */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8">
               <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Batch Progress</p>
                    <p className="text-2xl font-black text-white">
                      {currentTotalQty.toLocaleString()} <span className="text-slate-600 text-sm font-normal">/ {job.planned_qty.toLocaleString()} KG</span>
                    </p>
                  </div>
                  <p className="text-5xl font-black text-cyan-400 italic">{progressPct}%</p>
               </div>
               <div className="h-4 bg-slate-800 rounded-full overflow-hidden p-1 border border-white/5 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                    style={{ width: `${progressPct}%` }}
                  />
               </div>
            </div>
          </div>

          {/* RIGHT: Sequential Log & Controls */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            
            {/* Log Section */}
            <div className="bg-black/20 border border-white/5 rounded-[2rem] flex flex-col h-[400px]">
               <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <History size={14} /> Sequential Log
                  </h3>
                  <span className="text-[9px] font-black bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 uppercase">
                    {totalProduced} Rolls
                  </span>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {rolls.map((r, i) => (
                    <div key={r.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                       <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-slate-500 group-hover:text-cyan-500 transition-colors">#{r.roll_no}</span>
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Gross</p>
                            <p className="text-xs font-black text-slate-400 tracking-wider">{r.gross_weight || '-'}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[8px] font-bold text-cyan-500/50 uppercase tracking-widest">Net (สุทธิ)</p>
                          <p className="text-lg font-black text-cyan-400 tracking-tighter" style={{ fontFamily: 'Orbitron' }}>{r.weight}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* ACTION CARD: Save & Print */}
            <div className="bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
               
               <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Roll Label</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ready to sync</p>
                  </div>
                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-2 rounded-xl text-cyan-400">
                    <span className="text-xs font-black">#{ (totalProduced + 1).toString().padStart(3, '0') }</span>
                  </div>
               </div>

               <div className="space-y-6">
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#020617] p-6 rounded-3xl flex items-center justify-center gap-4 transition-all shadow-[0_10px_40px_rgba(6,182,212,0.3)] active:scale-95 group/btn overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                    <div className="relative flex items-center gap-4">
                      {saving ? (
                        <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        <div className="flex items-center gap-4 font-black uppercase text-lg tracking-widest">
                          <Save size={24} /> SAVE & PRINT
                        </div>
                      )}
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    <button className="bg-white/5 hover:bg-white/10 text-slate-400 p-4 rounded-2xl flex flex-col items-center gap-2 border border-white/5 transition-all text-[9px] font-black uppercase tracking-widest">
                      <Printer size={18} /> Print Last
                    </button>
                    <button className="bg-white/5 hover:bg-white/10 text-slate-400 p-4 rounded-2xl flex flex-col items-center gap-2 border border-white/5 transition-all text-[9px] font-black uppercase tracking-widest">
                       <History size={18} /> Logs
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-cyan {
          0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.1); }
          50% { box-shadow: 0 0 40px rgba(6,182,212,0.3); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

function EditIcon({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
