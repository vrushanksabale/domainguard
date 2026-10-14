import React from 'react';
import { useWeb3 } from '../context/Web3Context';

export const AnnouncementBar: React.FC = () => {
  const { stats, rpcUnreachable, targetChainId, chainId, switchNetwork } = useWeb3();

  return (
    <div className="bg-[#071528] text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Left: Live status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${rpcUnreachable ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${rpcUnreachable ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span>{rpcUnreachable ? 'Network Disconnected' : 'Live Node'}</span>
          </div>

          <span className="text-slate-600">|</span>
          <span>Latest Block: <strong className="text-white font-mono">{stats.latestBlock || '—'}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Pending Requests: <strong className="text-teal-400">{stats.pendingCount}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Blocked Attacks: <strong className="text-rose-400 font-semibold">{stats.blockedAttacksCount}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Domains Protected: <strong className="text-white">{stats.protectedCount}</strong></span>
        </div>

        {/* Right: Chain indicator or warning */}
        <div>
          {rpcUnreachable ? (
            <span className="text-rose-400 font-medium flex items-center gap-1.5">
              <span>⚠ Local RPC unreachable. Start node with <code>npm run node</code></span>
            </span>
          ) : chainId && chainId !== targetChainId ? (
            <button
              onClick={switchNetwork}
              className="text-amber-300 hover:text-amber-200 underline font-medium cursor-pointer"
            >
              Wrong network (Chain {chainId}). Switch to {targetChainId}
            </button>
          ) : (
            <span className="text-slate-400">
              Chain ID: <span className="font-mono text-slate-200">{targetChainId}</span> (Localhost)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
