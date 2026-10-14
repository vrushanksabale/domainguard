import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG } from '../config/chain';

export const Security: React.FC = () => {
  const { chainId, targetChainId, isLocalDev } = useWeb3();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Security & Threat Architecture</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Cryptographic enforcement rules protecting registered domains against single-point-of-failure administration.
        </p>
      </div>

      {/* Deployment & Authority Specs */}
      <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[#0B1F3A]">Smart Contract Ground Truth</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase">Contract Address</span>
            <span className="font-mono text-slate-900 break-all font-semibold">{CHAIN_CONFIG.contractAddress}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block font-semibold text-[10px] uppercase">Chain ID & Environment</span>
            <span className="font-mono text-slate-900 font-semibold">
              {chainId || targetChainId} {isLocalDev ? '(Localhost Development)' : '(Public Network)'}
            </span>
          </div>
        </div>
      </div>

      {/* The 5 Key Guarantees */}
      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-bold text-[#0B1F3A]">Enforced Security Invariants</h2>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[11px]">1</span>
            <h3 className="font-bold text-sm text-[#0B1F3A]">Proposer Self-Approval Ban</h3>
          </div>
          <p className="text-slate-600 pl-7">
            The administrator or guardian who submits a proposal is strictly barred from voting in its favor. This prevents an unauthorized or compromised administrator from completing an attack unilaterally.
          </p>
          <div className="pl-7 font-mono text-[11px] text-teal-700">Contract revert: SelfApprovalForbidden()</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[11px]">2</span>
            <h3 className="font-bold text-sm text-[#0B1F3A]">Independent 3-of-5 Guardian Quorum</h3>
          </div>
          <p className="text-slate-600 pl-7">
            Guardians represent distinct external trust anchors (registry, auditor, escrow, legal counsel). A minimum of 3 independent guardian approvals is required for transfers, recoveries, and key changes.
          </p>
          <div className="pl-7 font-mono text-[11px] text-teal-700">Contract check: guardianApprovals &gt;= threshold (3)</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[11px]">3</span>
            <h3 className="font-bold text-sm text-[#0B1F3A]">Mandatory On-Chain Timelock & Veto Window</h3>
          </div>
          <p className="text-slate-600 pl-7">
            Even after meeting quorum, an approved operation enters a queue with a mandatory delay ({CHAIN_CONFIG.delays.transferDelay}s for transfer, {CHAIN_CONFIG.delays.dnsDelay}s for DNS, {CHAIN_CONFIG.delays.recoveryDelay}s for recovery). Any guardian or domain owner can veto during this window.
          </p>
          <div className="pl-7 font-mono text-[11px] text-teal-700">Function: veto(requestId) &gt; status = Vetoed</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[11px]">4</span>
            <h3 className="font-bold text-sm text-[#0B1F3A]">Single-Guardian Emergency Freeze</h3>
          </div>
          <p className="text-slate-600 pl-7">
            Freezing operates in the safe direction (locking state). Therefore, any individual guardian can instantly freeze a domain without waiting for quorum, instantly invalidating any queued transfer proposals by bumping the domain state nonce.
          </p>
          <div className="pl-7 font-mono text-[11px] text-teal-700">Function: freezeDomain(domainId) &gt; d.frozen = true, d.nonce++</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[11px]">5</span>
            <h3 className="font-bold text-sm text-[#0B1F3A]">State Nonce Staleness Protection</h3>
          </div>
          <p className="text-slate-600 pl-7">
            Every request binds to the domain's state nonce at the exact time it was proposed. If any other state change or emergency freeze happens before execution, the nonce increments, rendering the outstanding proposal permanently stale.
          </p>
          <div className="pl-7 font-mono text-[11px] text-teal-700">Contract revert: StaleRequest()</div>
        </div>
      </div>
    </div>
  );
};
