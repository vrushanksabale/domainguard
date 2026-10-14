import React, { useState } from 'react';
import { useWeb3 } from '../context/Web3Context';

export const ReceiptStrip: React.FC = () => {
  const { receiptSummary, setReceiptSummary } = useWeb3();
  const [copied, setCopied] = useState(false);

  if (!receiptSummary) return null;

  const copyHash = () => {
    navigator.clipboard.writeText(receiptSummary.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside aria-label="Transaction Receipt" className="bg-[#0B1F3A] border-b border-teal-500/30 text-white px-4 py-3 shadow-md animate-fade-in">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Summary info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-teal-300">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>On-Chain Receipt Confirmed</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tx:</span>
            <span className="font-mono text-slate-200 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700">
              {receiptSummary.txHash.slice(0, 10)}...{receiptSummary.txHash.slice(-8)}
            </span>
            <button
              onClick={copyHash}
              className="text-slate-400 hover:text-white text-[11px] underline cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Block:</span>
            <strong className="font-mono text-white">#{receiptSummary.blockNumber}</strong>
          </div>
        </div>

        {/* Right: Decoded events summary */}
        <div className="flex items-center gap-3">
          {receiptSummary.events.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Decoded Events:</span>
              {receiptSummary.events.map((evt, idx) => (
                <span
                  key={idx}
                  className="text-[10px] bg-teal-900/40 text-teal-300 border border-teal-600/40 rounded px-2 py-0.5 font-mono"
                  title={JSON.stringify(evt.args, null, 2)}
                >
                  {evt.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">Execution successful</span>
          )}

          <button
            onClick={() => setReceiptSummary(null)}
            className="text-slate-400 hover:text-slate-200 text-sm p-1 cursor-pointer"
            title="Dismiss receipt"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
};
