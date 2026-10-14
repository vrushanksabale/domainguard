import React, { useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';

export const Toast: React.FC = () => {
  const { toastMessage, setToastMessage, toastType } = useWeb3();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, setToastMessage]);

  if (!toastMessage) return null;

  const bgStyles = {
    success: 'bg-emerald-950/90 border-emerald-500 text-emerald-100',
    error: 'bg-rose-950/90 border-rose-500 text-rose-100',
    info: 'bg-[#0B1F3A]/95 border-teal-500 text-slate-100',
  }[toastType];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-slide-up"
    >
      <div className={`border rounded-lg p-4 shadow-xl flex items-start justify-between gap-3 ${bgStyles}`}>
        <div className="flex items-start gap-2.5">
          <span className="text-lg">
            {toastType === 'success' && '✓'}
            {toastType === 'error' && '⚠'}
            {toastType === 'info' && 'ℹ'}
          </span>
          <p className="text-xs leading-relaxed font-medium">{toastMessage}</p>
        </div>
        <button
          onClick={() => setToastMessage(null)}
          className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
