import React from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { formatNumber } from '../../lib/utils';

interface RollReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  rolls: any[];
}

export default function RollReportModal({ isOpen, onClose, job, rolls }: RollReportModalProps) {
  if (!isOpen) return null;

  const pageSize = 60;
  const pages = [];
  for (let i = 0; i < Math.max(rolls.length, 1); i += pageSize) {
    pages.push(rolls.slice(i, i + pageSize));
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl overflow-y-auto p-4 md:p-8 no-print-bg">
      {/* Print Controls */}
      <div className="fixed top-6 right-6 flex gap-4 print:hidden z-[120]">
        <button 
          onClick={handlePrint}
          className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-2xl transition-all active:scale-95"
        >
          <Printer size={24} /> พิมพ์รายงาน (A4)
        </button>
        <button 
          onClick={onClose}
          className="bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-2xl transition-all"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-col gap-16 my-12">
        {pages.map((pageRolls, pageIdx) => (
          <div 
            key={pageIdx}
            className="report-page bg-white text-slate-900 w-[210mm] h-[297mm] p-[10mm] shadow-2xl mx-auto relative flex flex-col print:shadow-none print:m-0"
            style={{ pageBreakAfter: 'always' }}
          >
            {/* Ultra-Compact Header */}
            <div className="border-b-[1.5pt] border-slate-900 pb-2 mb-4 flex justify-between items-end">
               <div>
                  <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">Production Roll Report</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[8px]">Precision Industrial Data Logging</p>
               </div>
               <div className="text-right leading-none">
                  <p className="text-[9px] font-black text-slate-300 mb-0.5 uppercase">Page</p>
                  <p className="text-lg font-black">{pageIdx + 1} / {pages.length}</p>
               </div>
            </div>

            {/* Compact Job Info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 bg-slate-50 p-3 px-4 rounded-lg border border-slate-100">
               <div className="flex flex-col">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                  <span className="font-bold text-sm truncate leading-tight">{job.sale_order?.customer?.name || '-'}</span>
               </div>
               <div className="flex flex-col text-right">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Product</span>
                  <span className="font-bold text-sm truncate leading-tight">{job.sale_order?.product?.part_name || '-'}</span>
               </div>
               <div className="grid grid-cols-3 col-span-2 gap-2 mt-1 pt-2 border-t border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">SO No.</span>
                    <span className="font-black text-base text-brand-600 leading-tight">{job.sale_order?.so_no || '-'}</span>
                  </div>
                  <div className="flex flex-col text-center">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Lot No.</span>
                    <span className="font-black text-base text-brand-600 leading-tight">{job.lot_no}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Machine</span>
                    <span className="font-black text-base leading-tight">{job.machine_no || '-'}</span>
                  </div>
               </div>
            </div>

            {/* High Density Data Table */}
            <div className="flex-1 grid grid-cols-2 gap-x-10 overflow-hidden mb-20">
               {[0, 1].map(colIdx => {
                  const colRolls = pageRolls.slice(colIdx * 30, (colIdx + 1) * 30);
                  return (
                    <div key={colIdx} className="flex flex-col">
                       <table className="w-full border-collapse">
                          <thead>
                             <tr className="border-b border-slate-900">
                                <th className="py-0.5 text-left text-[8px] font-black text-slate-400 uppercase w-6">#</th>
                                <th className="py-0.5 text-right text-[8px] font-black text-slate-400 uppercase px-1">Gross</th>
                                <th className="py-0.5 text-right text-[8px] font-black text-slate-400 uppercase px-1">Core</th>
                                <th className="py-0.5 text-right text-[8px] font-black bg-slate-900 text-white px-2 rounded-t-sm">Net (KG)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {colRolls.map(r => (
                               <tr key={r.id} className="text-[9.5px] leading-none">
                                  <td className="py-[1.5pt] font-bold text-slate-300 border-r border-slate-50">{r.roll_no}</td>
                                  <td className="py-[1.5pt] text-right font-medium text-slate-400 px-1">{(Number(r.weight) + Number(r.core_weight || 0)).toFixed(2)}</td>
                                  <td className="py-[1.5pt] text-right font-medium text-slate-300 px-1">{r.core_weight || 0}</td>
                                  <td className="py-[1.5pt] text-right font-black bg-slate-50 px-2 border-r border-l border-slate-100 text-brand-600">{Number(r.weight).toFixed(2)}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                  );
               })}
            </div>

            {/* Locked Bottom Summary Area */}
            <div className="absolute bottom-[10mm] left-[10mm] right-[10mm] border-t border-slate-900 pt-4 flex justify-between items-end">
               <div className="flex gap-12">
                  <div className="text-center w-32 border-b border-slate-300 pb-1">
                     <p className="text-[7px] font-black text-slate-300 uppercase mb-6 tracking-widest">Operator Signature</p>
                  </div>
                  <div className="text-center w-32 border-b border-slate-300 pb-1">
                     <p className="text-[7px] font-black text-slate-300 uppercase mb-6 tracking-widest">QA Verification</p>
                  </div>
               </div>

               <div className="flex flex-col items-end">
                  <div className="bg-slate-900 text-white p-3 px-5 rounded-xl flex flex-col items-end shadow-xl">
                     <p className="text-[7px] font-black uppercase tracking-[0.4em] opacity-40 mb-0.5">Total Page Weight</p>
                     <div className="flex items-baseline gap-1.5">
                       <p className="text-3xl font-black leading-none tracking-tighter">
                         {pageRolls.reduce((acc, r) => acc + Number(r.weight), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </p>
                       <span className="text-[9px] font-black opacity-40 uppercase">KG</span>
                     </div>
                  </div>
                  <p className="text-[7px] text-slate-400 font-medium italic mt-1.5">DOC: {job.lot_no}-P{pageIdx + 1} | TS: {new Date().toLocaleString('th-TH')}</p>
               </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          /* Hide everything by default */
          html, body, #root { 
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }
          
          /* Hide ALL elements except our report pages */
          body > *:not(.fixed) { display: none !important; }
          .fixed:not(.z-\\[110\\]) { display: none !important; }
          .fixed.z-\\[110\\] { 
            position: static !important; 
            padding: 0 !important; 
            background: white !important;
            overflow: visible !important;
            display: block !important;
            backdrop-filter: none !important;
          }
          
          .print\\:hidden { display: none !important; }
          
          .report-page {
            display: flex !important;
            visibility: visible !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always !important;
            width: 210mm !important;
            height: 296mm !important; /* Slightly less than 297 to avoid extra blank pages */
          }

          /* Ensure background colors (like Net KG column) appear */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
