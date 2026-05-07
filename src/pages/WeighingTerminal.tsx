import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Scale, Printer, Tag, Clock, RefreshCcw, 
  Cpu, Package, CheckCircle2, AlertCircle
} from 'lucide-react';

import ReactBarcode from 'react-barcode';
import ReactQRCode from 'react-qr-code';

const isComponent = (c: any) => typeof c === 'function' || (typeof c === 'object' && c !== null && !!c.render);

export default function WeighingTerminal() {
  const [currentWeight, setCurrentWeight] = useState(0.00);
  const [tareWeight, setTareWeight] = useState(0.00);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [totalWeight, setTotalWeight] = useState(0);

  const MACHINES = ['B-01','B-02','B-03','B-04','B-05','B-06','B-07','B-08','B-09','B-10','B-11', 'P-01', 'P-02', 'P-03'];

  const BarcodeComp: any = (ReactBarcode as any).default || ReactBarcode;
  const QRCodeComp: any = (ReactQRCode as any).default || ReactQRCode;

  // 1. Fetch Ongoing Jobs
  useEffect(() => {
    async function fetchJobs() {
      if (!selectedMachine) return;
      const { data } = await supabase.from('planning_jobs').select('*, sale_order:sale_orders(*, customer:customers(name), product:products(part_name))').eq('machine_no', selectedMachine).eq('status', 'ongoing');
      if (data) setActiveJobs(data);
    }
    fetchJobs();
  }, [selectedMachine]);

  // 2. Fetch Roll History when Job is selected
  useEffect(() => {
    async function fetchHistory() {
      if (!selectedJob) {
        setHistory([]);
        setTotalWeight(0);
        return;
      }
      const { data } = await supabase
        .from('production_rolls')
        .select('*')
        .eq('job_id', selectedJob.id)
        .order('created_at', { ascending: false });

      if (data) {
        setHistory(data);
        const sum = data.reduce((acc: number, item: any) => acc + Number(item.weight), 0);
        setTotalWeight(sum);
      }
    }
    fetchHistory();
  }, [selectedJob]);

  // Simulate Scale
  useEffect(() => {
    const interval = setInterval(() => setCurrentWeight(25.50 + (Math.random() - 0.5) * 0.05), 500);
    return () => clearInterval(interval);
  }, []);

  const netWeight = Math.max(0, currentWeight - tareWeight);

  const handleSave = async () => {
    if (!selectedJob) return alert("กรุณาเลือกงานจากแผนก่อนครับ");
    
    // บันทึกน้ำหนักลงในตาราง production_rolls
    const { data, error } = await supabase.from('production_rolls').insert({
      job_id: selectedJob.id,
      roll_no: history.length + 1,
      weight: Number(netWeight.toFixed(2))
    }).select().single();

    if (error) {
       alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
       return;
    }

    // Update Local State
    setHistory([data, ...history]);
    setTotalWeight(prev => prev + Number(netWeight.toFixed(2)));
    alert("บันทึกม้วนที่ " + (history.length + 1) + " เรียบร้อย!");
  };

  const progress = selectedJob ? (totalWeight / selectedJob.planned_qty) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 space-y-6 overflow-y-auto">
      {/* Header Selection */}
      <div className="grid grid-cols-12 gap-6 items-center bg-slate-900/80 p-6 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
        <div className="col-span-3">
           <label className="text-[10px] font-black text-brand-500 uppercase mb-2 block tracking-widest">Selected Machine</label>
           <select className="w-full bg-slate-950 border border-slate-700 text-white p-4 rounded-2xl font-black outline-none focus:ring-2 ring-brand-500" value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)}>
             <option value="">-- Machine --</option>
             {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
           </select>
        </div>
        <div className="col-span-6">
           <label className="text-[10px] font-black text-brand-500 uppercase mb-2 block tracking-widest">Active Production Plan (Ongoing)</label>
           <select className="w-full bg-slate-950 border border-slate-700 text-white p-4 rounded-2xl font-black outline-none focus:ring-2 ring-brand-500" value={selectedJob?.id || ''} onChange={(e) => setSelectedJob(activeJobs.find(j => j.id === e.target.value))}>
             <option value="">-- Select Active Job --</option>
             {activeJobs.map(j => <option key={j.id} value={j.id}>LOT: {j.lot_no} | SO: {j.sale_order?.so_no} | {j.sale_order?.customer?.name}</option>)}
           </select>
        </div>
        <div className="col-span-3 text-right">
           <div className="flex items-center justify-end gap-3">
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Weight Indicator</div>
                <div className="text-emerald-400 font-black text-xs flex items-center justify-end gap-1">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> READY
                </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 flex-1 overflow-hidden">
        {/* Left: Indicator & Info */}
        <div className="col-span-8 flex flex-col gap-6 h-full">
          {/* Main Weight Display */}
          <div className="bg-black rounded-[3rem] p-12 border-[12px] border-slate-800 text-center shadow-2xl flex-1 flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute top-8 left-12 flex items-center gap-2 text-slate-800 font-black text-2xl italic tracking-tighter uppercase opacity-30 group-hover:opacity-100 transition-opacity">
                Siamscales Industrial
             </div>
             <div className="text-[12rem] font-mono leading-none text-brand-500 drop-shadow-[0_0_40px_rgba(var(--brand-500),0.6)] tracking-tighter">
              {currentWeight.toFixed(2)}
            </div>
            <div className="text-brand-800 text-5xl font-black italic mt-4">KILOGRAMS</div>
            
            <div className="grid grid-cols-2 gap-8 mt-12 px-12">
               <button onClick={()=>setTareWeight(currentWeight)} className="bg-slate-800 hover:bg-slate-700 text-white p-6 rounded-3xl font-black text-2xl border border-slate-700 transition-all active:scale-95">SET TARE ({tareWeight.toFixed(2)})</button>
               <div className="bg-brand-950/20 p-6 rounded-3xl border border-brand-500/30 flex justify-between items-center px-12">
                  <span className="text-brand-500 text-xs font-black uppercase tracking-widest">Net Weight</span>
                  <span className="text-7xl font-black text-brand-500">{netWeight.toFixed(2)}</span>
               </div>
            </div>
          </div>
          
          {/* Production Progress & Info */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 grid grid-cols-3 gap-8 shadow-xl">
             <div className="col-span-2 space-y-4">
                <div className="flex justify-between items-end">
                   <span className="text-slate-500 text-xs font-black uppercase">Production Progress</span>
                   <span className="text-white font-black text-xl">{totalWeight.toLocaleString()} / {selectedJob?.planned_qty?.toLocaleString() || 0} kg</span>
                </div>
                <div className="h-4 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                   <div 
                     className="h-full bg-brand-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(var(--brand-500),0.5)]"
                     style={{ width: `${Math.min(100, progress)}%` }}
                   />
                </div>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-center text-center">
                <span className="text-slate-500 text-[10px] font-black uppercase mb-1 tracking-widest">Completion</span>
                <span className={`text-3xl font-black ${progress >= 100 ? 'text-green-500' : 'text-brand-500'}`}>{Math.round(progress)}%</span>
             </div>
          </div>
        </div>

        {/* Right: Roll Details & History */}
        <div className="col-span-4 flex flex-col gap-6 h-full">
           <div className="bg-white rounded-[3rem] p-10 shadow-2xl text-slate-900 text-center space-y-6 relative flex-1 flex flex-col">
              <div className="absolute top-0 right-12 bg-slate-900 text-white px-6 py-2 rounded-b-2xl font-black text-[10px] tracking-[0.2em]">ROLL #{history.length + 1}</div>
              <h2 className="text-4xl font-black border-b-4 border-slate-900 pb-4 italic tracking-tighter">ROLL LABEL</h2>
              
              <div className="text-left text-xs space-y-3 bg-slate-50 p-6 rounded-[2rem] font-bold uppercase border border-slate-100 flex-1">
                 <div className="flex justify-between border-b pb-2"><span>Client:</span> <span className="font-black truncate">{selectedJob?.sale_order?.customer?.name || '-'}</span></div>
                 <div className="flex justify-between border-b pb-2"><span>Product:</span> <span className="font-black truncate">{selectedJob?.sale_order?.product?.part_name || '-'}</span></div>
                 <div className="flex justify-between items-center pt-4"><span className="text-xl font-black text-slate-400 uppercase">Weight</span> <span className="text-5xl font-black">{netWeight.toFixed(2)} KG</span></div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-center bg-white p-2 rounded-3xl border shadow-inner min-h-[100px] items-center">
                   {isComponent(QRCodeComp) ? <QRCodeComp value={(selectedJob?.lot_no || 'N/A') + '-' + (history.length + 1)} size={100} /> : <div>QR Error</div>}
                </div>
                <div className="flex justify-center min-h-[60px] items-center">
                   {isComponent(BarcodeComp) ? <BarcodeComp value={(selectedJob?.lot_no || '00000') + '-' + (history.length + 1)} width={1.5} height={40} fontSize={12} /> : <div>Barcode Error</div>}
                </div>
              </div>

              <button 
                onClick={handleSave} 
                disabled={!selectedJob}
                className="w-full bg-slate-900 hover:bg-brand-600 disabled:opacity-20 text-white p-6 rounded-3xl font-black text-2xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl"
              >
                <Printer size={32} /> SAVE & PRINT
              </button>
           </div>

           {/* Real-time History from Database */}
           <div className="bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-800 overflow-hidden flex flex-col h-72">
              <div className="bg-slate-800 p-4 text-white font-black text-[10px] flex justify-between items-center uppercase tracking-widest">
                 <span className="flex items-center gap-2"><Clock size={14}/> Job History Log</span>
                 <span className="text-brand-500 font-bold">{history.length} Rolls</span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                 <table className="w-full text-[10px]">
                    <thead className="bg-slate-950/50 sticky top-0 text-slate-500">
                       <tr><th className="p-3 text-left">Roll No</th><th className="p-3 text-right">Weight</th><th className="p-3 text-right">Time</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                       {history.map(h => (
                         <tr key={h.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-bold text-slate-300">#{h.roll_no}</td>
                            <td className="p-3 text-right font-black text-brand-500">{h.weight} kg</td>
                            <td className="p-3 text-right text-slate-500 italic">{new Date(h.created_at).toLocaleTimeString()}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 {history.length === 0 && (
                   <div className="text-center py-10 text-slate-600 italic">No rolls recorded for this job.</div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
