import React, { useState } from 'react';
import { useWeb3 } from '../context/Web3Context';

export const RoleSwitcher: React.FC = () => {
  const { isLocalDev, namedAccounts, account, activeRole, selectNamedAccount } = useWeb3();
  const [isOpen, setIsOpen] = useState(false);

  // Hidden on non-local networks per spec
  if (!isLocalDev) return null;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-[#162E52] text-slate-100 hover:bg-[#1C3A66] border border-slate-700 transition cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="w-2 h-2 rounded-full bg-teal-400"></span>
        <span className="font-semibold text-teal-300">Active Role:</span>
        <span className="text-white max-w-[140px] truncate">{activeRole}</span>
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg bg-[#071528] border border-slate-700 shadow-2xl py-2 z-50">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-medium">
            Local Dev Signers (Chain 31337)
          </div>
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(namedAccounts).map(([key, item]) => {
              const isSelected = account?.toLowerCase() === item.address.toLowerCase();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    selectNamedAccount(key);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex flex-col transition cursor-pointer ${
                    isSelected ? 'bg-[#0E2A52] text-white font-semibold' : 'text-slate-300 hover:bg-[#0E223D]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100">{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                      {item.role}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                    {item.address}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
