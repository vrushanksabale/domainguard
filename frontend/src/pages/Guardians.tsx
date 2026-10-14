import React, { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG } from '../config/chain';
import {
  fetchGuardiansList,
  parseContractError,
  parseReceiptEvents,
} from '../services/contract';

export const Guardians: React.FC = () => {
  const { readContract, account, getWriteContract, showToast, setReceiptSummary, refreshStats } = useWeb3();
  const [guardians, setGuardians] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDomainToFreeze, setSelectedDomainToFreeze] = useState<string>('mybank.example');
  const [freezing, setFreezing] = useState<boolean>(false);
  const [freezeError, setFreezeError] = useState<string | null>(null);

  const loadGuardians = useCallback(async () => {
    if (!readContract) return;
    setLoading(true);
    try {
      const list = await fetchGuardiansList(readContract);
      setGuardians(list);
    } catch (err) {
      console.error('Failed to load guardians:', err);
    } finally {
      setLoading(false);
    }
  }, [readContract]);

  useEffect(() => {
    loadGuardians();
  }, [loadGuardians]);

  const isCurrentGuardian = guardians.some(
    (g) => g.toLowerCase() === (account || '').toLowerCase()
  );

  const handleEmergencyFreeze = async () => {
    setFreezeError(null);
    if (!selectedDomainToFreeze) return;

    const domainMeta = CHAIN_CONFIG.domains[selectedDomainToFreeze];
    if (!domainMeta) return;

    try {
      setFreezing(true);
      const writeContract = await getWriteContract();

      // Preflight
      try {
        await writeContract.freezeDomain.staticCall(domainMeta.domainId);
      } catch (err: any) {
        throw new Error(parseContractError(err));
      }

      const tx = await writeContract.freezeDomain(domainMeta.domainId);
      showToast(`Emergency Freeze broadcast for ${selectedDomainToFreeze}...`, 'error');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);

      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });

      showToast(`EMERGENCY FREEZE CONFIRMED! ${selectedDomainToFreeze} is now frozen on-chain.`, 'error');
      await refreshStats();
    } catch (err: any) {
      setFreezeError(parseContractError(err));
    } finally {
      setFreezing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Guardian Network</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Independent security entities authorized to countersign high-impact registrar operations and trigger emergency freezes.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block font-semibold text-[10px] uppercase">Active Guardians</span>
          <span className="text-2xl font-black text-[#0B1F3A] mt-1 block">{guardians.length}</span>
          <span className="text-xs text-slate-500 mt-1 block">Fixed multi-party governance topology</span>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block font-semibold text-[10px] uppercase">Quorum Threshold</span>
          <span className="text-2xl font-black text-teal-600 mt-1 block">3 of 5</span>
          <span className="text-xs text-slate-500 mt-1 block">Required for transfers, key swaps & recoveries</span>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block font-semibold text-[10px] uppercase">Active Wallet Status</span>
          <span className={`text-base font-bold mt-2 block ${isCurrentGuardian ? 'text-emerald-700' : 'text-slate-700'}`}>
            {isCurrentGuardian ? 'Verified Guardian Key ✓' : 'Not an on-chain guardian'}
          </span>
          <span className="text-xs text-slate-400 mt-1 block font-mono truncate">{account || 'No wallet connected'}</span>
        </div>
      </div>

      {/* Emergency Freeze Action */}
      <div className="mt-8 bg-rose-50/70 border border-rose-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-rose-900">Instant Emergency Freeze (Guardian Authority)</h2>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">
              Any single guardian may immediately freeze a domain without waiting for quorum. This halts all transfers and DNS changes in the safe direction, invalidating existing queued requests.
            </p>
          </div>
        </div>

        {freezeError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-100 border border-rose-300 text-xs text-rose-900 font-medium">
            {freezeError}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedDomainToFreeze}
            onChange={(e) => setSelectedDomainToFreeze(e.target.value)}
            className="px-3 py-2 border border-rose-300 rounded-lg text-xs font-semibold text-rose-900 bg-white"
          >
            {Object.keys(CHAIN_CONFIG.domains).map((dName) => (
              <option key={dName} value={dName}>{dName}</option>
            ))}
          </select>

          <button
            type="button"
            disabled={freezing}
            onClick={handleEmergencyFreeze}
            className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {freezing ? 'Broadcasting Freeze...' : '🚨 Execute Emergency Freeze on Domain'}
          </button>
        </div>
      </div>

      {/* Live Guardian Addresses List */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#0B1F3A] pb-3 border-b border-slate-100">
          On-Chain Guardian Registry (getGuardians)
        </h2>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Querying guardian array...</div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {guardians.map((addr, index) => {
              const named = Object.values(CHAIN_CONFIG.namedAccounts).find(
                (n) => n.address.toLowerCase() === addr.toLowerCase()
              );
              const isYou = account?.toLowerCase() === addr.toLowerCase();

              return (
                <div key={addr} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px]">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">{named ? named.name : `Guardian #${index + 1}`}</span>
                      <span className="font-mono text-slate-500 block text-[11px] break-all">{addr}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isYou && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                        Current Wallet
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      Authorized
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
