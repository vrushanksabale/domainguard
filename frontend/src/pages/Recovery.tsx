import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG, OP_TYPES } from '../config/chain';
import {
  fetchAllRequests,
  parseContractError,
  parseReceiptEvents,
  type RequestRecord,
} from '../services/contract';

export const Recovery: React.FC = () => {
  const { readContract, getWriteContract, showToast, setReceiptSummary, refreshStats } = useWeb3();

  const [activeTab, setActiveTab] = useState<'guardian' | 'owner'>('guardian');
  const [recoveryRequests, setRecoveryRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Guardian replacement form fields
  const [oldGuardianKey, setOldGuardianKey] = useState<string>('');
  const [newGuardianKey, setNewGuardianKey] = useState<string>('');

  // Owner recovery form fields
  const [recoveryDomain, setRecoveryDomain] = useState<string>('mybank.example');
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRecoveryRequests = useCallback(async () => {
    if (!readContract) return;
    setLoading(true);
    try {
      const allReqs = await fetchAllRequests(readContract);
      const filtered = allReqs.filter((r) => r.op === OP_TYPES.KEY_REPLACEMENT || r.op === OP_TYPES.RECOVERY);
      setRecoveryRequests(filtered);
    } catch (err) {
      console.error('Failed to load recovery requests:', err);
    } finally {
      setLoading(false);
    }
  }, [readContract]);

  useEffect(() => {
    loadRecoveryRequests();
  }, [loadRecoveryRequests]);

  const handleProposeGuardianReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (!ethers.isAddress(oldGuardianKey)) throw new Error('Invalid old guardian address.');
      if (!ethers.isAddress(newGuardianKey)) throw new Error('Invalid new guardian address.');

      setSubmitting(true);
      const writeContract = await getWriteContract();

      // Preflight
      try {
        await writeContract.propose.staticCall(
          ethers.ZeroHash,
          OP_TYPES.KEY_REPLACEMENT,
          ethers.getAddress(newGuardianKey),
          ethers.getAddress(oldGuardianKey),
          ethers.ZeroHash
        );
      } catch (err: any) {
        throw new Error(parseContractError(err));
      }

      const tx = await writeContract.propose(
        ethers.ZeroHash,
        OP_TYPES.KEY_REPLACEMENT,
        ethers.getAddress(newGuardianKey),
        ethers.getAddress(oldGuardianKey),
        ethers.ZeroHash
      );

      showToast(`Key replacement proposed (Tx: ${tx.hash.slice(0, 10)}...). Waiting confirmation...`, 'info');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);

      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });

      showToast('Key replacement proposal registered on-chain!', 'success');
      setOldGuardianKey('');
      setNewGuardianKey('');
      await loadRecoveryRequests();
      await refreshStats();
    } catch (err: any) {
      setErrorMsg(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProposeOwnerRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (!ethers.isAddress(newOwnerAddress)) throw new Error('Invalid new owner address.');
      const domainMeta = CHAIN_CONFIG.domains[recoveryDomain];
      if (!domainMeta) throw new Error('Unknown domain');

      setSubmitting(true);
      const writeContract = await getWriteContract();

      // Preflight
      try {
        await writeContract.propose.staticCall(
          domainMeta.domainId,
          OP_TYPES.RECOVERY,
          ethers.getAddress(newOwnerAddress),
          ethers.ZeroAddress,
          ethers.ZeroHash
        );
      } catch (err: any) {
        throw new Error(parseContractError(err));
      }

      const tx = await writeContract.propose(
        domainMeta.domainId,
        OP_TYPES.RECOVERY,
        ethers.getAddress(newOwnerAddress),
        ethers.ZeroAddress,
        ethers.ZeroHash
      );

      showToast(`Owner recovery proposed (Tx: ${tx.hash.slice(0, 10)}...). Waiting confirmation...`, 'info');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);

      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });

      showToast('Owner recovery proposal registered on-chain!', 'success');
      setNewOwnerAddress('');
      await loadRecoveryRequests();
      await refreshStats();
    } catch (err: any) {
      setErrorMsg(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Key Loss & Disaster Recovery</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Cryptographic workflows for replacing compromised guardian keys or recovering domains whose owner keys were lost.
        </p>
      </div>

      {errorMsg && (
        <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <p className="font-semibold">Contract Revert</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8 flex items-center border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('guardian')}
          className={`py-3 px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'guardian'
              ? 'border-teal-500 text-teal-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Guardian Key Loss (KEY_REPLACEMENT)
        </button>
        <button
          onClick={() => setActiveTab('owner')}
          className={`py-3 px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'owner'
              ? 'border-teal-500 text-teal-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Domain Owner Key Loss (RECOVERY)
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
          {activeTab === 'guardian' ? (
            <form onSubmit={handleProposeGuardianReplacement} className="space-y-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Replace Lost Guardian Key</h2>
              <p className="text-xs text-slate-500">
                Requires 3 active guardians to approve. The lost key is automatically barred from voting on its own replacement.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Old Guardian Address</label>
                <input
                  type="text"
                  required
                  placeholder="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                  value={oldGuardianKey}
                  onChange={(e) => setOldGuardianKey(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Replacement Guardian Address</label>
                <input
                  type="text"
                  required
                  placeholder="0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"
                  value={newGuardianKey}
                  onChange={(e) => setNewGuardianKey(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Proposing...' : 'Propose Key Replacement'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleProposeOwnerRecovery} className="space-y-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Recover Lost Owner Key</h2>
              <p className="text-xs text-slate-500">
                Restores domain governance when owner credentials are irrecoverably lost. Bypasses owner approval; requires 3-guardian quorum + 180s delay.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Domain</label>
                <select
                  value={recoveryDomain}
                  onChange={(e) => setRecoveryDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-medium"
                >
                  {Object.keys(CHAIN_CONFIG.domains).map((dName) => (
                    <option key={dName} value={dName}>{dName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Verified Owner Address</label>
                <input
                  type="text"
                  required
                  placeholder="0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Proposing...' : 'Propose Owner Recovery'}
              </button>
            </form>
          )}
        </div>

        {/* Existing Recovery Queue Column */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-[#0B1F3A]">Active Recovery Lifecycle Requests</h2>

          {loading && (
            <div className="py-12 text-center text-xs text-slate-500">Loading recovery proposals...</div>
          )}

          {!loading && recoveryRequests.length === 0 && (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No active key replacement or owner recovery requests in progress.
            </div>
          )}

          {recoveryRequests.map((req) => (
            <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold font-mono text-slate-800">Request #{req.id}</span>
                <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{req.opName}</span>
                <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100">{req.statusName}</span>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                {req.domainId !== ethers.ZeroHash && <div>Domain: <span className="font-semibold">{req.domainName}</span></div>}
                {req.oldKey !== ethers.ZeroAddress && <div>Lost Key: <span className="font-mono text-slate-900">{req.oldKey}</span></div>}
                <div>Target / New Key: <span className="font-mono text-slate-900">{req.target}</span></div>
                <div>Guardian Approvals: <span className="font-mono font-bold text-slate-900">{req.guardianApprovals} / 3</span></div>
                {req.eta > 0 && <div>Timelock ETA: <span className="font-mono text-slate-800">{req.eta}</span></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
