import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG } from '../config/chain';
import { parseContractError, parseReceiptEvents } from '../services/contract';

export const NewRequest: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { account, activeRole, getWriteContract, showToast, setReceiptSummary, refreshStats } = useWeb3();

  const domainFromQuery = searchParams.get('domain') || 'mybank.example';

  const [selectedDomain, setSelectedDomain] = useState<string>(domainFromQuery);
  const [selectedOp, setSelectedOp] = useState<number>(0); // 0 = TRANSFER_OWNERSHIP
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [oldKeyAddress, setOldKeyAddress] = useState<string>('');
  const [rawDnsRecord, setRawDnsRecord] = useState<string>('v=spf1 include:updated.example ~all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReqId, setSubmittedReqId] = useState<number | null>(null);

  useEffect(() => {
    if (domainFromQuery && CHAIN_CONFIG.domains[domainFromQuery]) {
      setSelectedDomain(domainFromQuery);
    }
  }, [domainFromQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmittedReqId(null);

    if (!account) {
      setSubmitError('Please connect a wallet or choose a local role.');
      return;
    }

    try {
      setIsSubmitting(true);
      const writeContract = await getWriteContract();

      let domainId = ethers.ZeroHash;
      let target = ethers.ZeroAddress;
      let oldKey = ethers.ZeroAddress;
      let newDnsHash = ethers.ZeroHash;

      // Op specific parameter construction
      if (selectedOp === 0) {
        // TRANSFER_OWNERSHIP
        if (!ethers.isAddress(targetAddress)) throw new Error('Please enter a valid target recipient address.');
        domainId = CHAIN_CONFIG.domains[selectedDomain]?.domainId || ethers.id(selectedDomain.trim().toLowerCase());
        target = ethers.getAddress(targetAddress);
      } else if (selectedOp === 1) {
        // DNS_UPDATE
        domainId = CHAIN_CONFIG.domains[selectedDomain]?.domainId || ethers.id(selectedDomain.trim().toLowerCase());
        if (!rawDnsRecord.trim()) throw new Error('Please enter the new DNS zone record.');
        newDnsHash = ethers.keccak256(ethers.toUtf8Bytes(rawDnsRecord.trim()));
      } else if (selectedOp === 2) {
        // KEY_REPLACEMENT (Global op, domainId = bytes32(0))
        domainId = ethers.ZeroHash;
        if (!ethers.isAddress(oldKeyAddress)) throw new Error('Please enter a valid current guardian address to replace.');
        if (!ethers.isAddress(targetAddress)) throw new Error('Please enter a valid replacement guardian address.');
        oldKey = ethers.getAddress(oldKeyAddress);
        target = ethers.getAddress(targetAddress);
      } else if (selectedOp === 3) {
        // RECOVERY
        if (!ethers.isAddress(targetAddress)) throw new Error('Please enter a valid new owner address for recovery.');
        domainId = CHAIN_CONFIG.domains[selectedDomain]?.domainId || ethers.id(selectedDomain.trim().toLowerCase());
        target = ethers.getAddress(targetAddress);
      } else if (selectedOp === 4) {
        // UNFREEZE
        domainId = CHAIN_CONFIG.domains[selectedDomain]?.domainId || ethers.id(selectedDomain.trim().toLowerCase());
      }

      // 1. Static preflight call to catch contract reverts before sending transaction
      try {
        await writeContract.propose.staticCall(domainId, selectedOp, target, oldKey, newDnsHash);
      } catch (preflightErr: any) {
        const parsedReason = parseContractError(preflightErr);
        throw new Error(parsedReason);
      }

      // 2. Submit transaction
      const tx = await writeContract.propose(domainId, selectedOp, target, oldKey, newDnsHash);
      showToast(`Transaction broadcast: ${tx.hash.slice(0, 10)}... Waiting for block confirmation...`, 'info');

      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);

      // Find proposed request ID
      const propEvt = events.find((ev) => ev.name === 'RequestProposed');
      const reqId = propEvt?.args?.requestId ? Number(propEvt.args.requestId) : null;
      if (reqId) setSubmittedReqId(reqId);

      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });

      showToast(`Proposal #${reqId || ''} created on-chain!`, 'success');
      await refreshStats();
    } catch (err: any) {
      setSubmitError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Propose Operation Request</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Initiate a new multi-party authorization lifecycle. Proposing does NOT execute changes immediately.
        </p>
      </div>

      {/* Security notice */}
      <div className="mt-6 p-4 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 leading-relaxed">
        <strong>Contract Security Guarantee:</strong> Submitting a proposal only creates a Pending request on-chain. Domain ownership, DNS zone content, and guardian membership remain completely unchanged until the required independent guardian quorum, owner countersignature (if required), and timelock window have passed.
      </div>

      {submitError && (
        <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <p className="font-semibold">Transaction Blocked by Contract Policy</p>
          <p className="mt-1">{submitError}</p>
        </div>
      )}

      {submittedReqId && (
        <div className="mt-6 p-5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          <p className="font-bold text-sm">Request #{submittedReqId} Successfully Proposed On-Chain!</p>
          <p className="mt-1">
            The proposal is now in <span className="font-semibold">Pending</span> state. You can now gather approvals or vote in the Approvals queue.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Link
              to="/approvals"
              className="px-4 py-2 rounded bg-[#0EA5A4] hover:bg-[#0c8a89] text-white font-semibold text-xs transition"
            >
              Go to Approvals Queue →
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmittedReqId(null);
                setTargetAddress('');
              }}
              className="px-3 py-2 rounded bg-white border border-slate-300 text-slate-700 text-xs font-medium"
            >
              Propose Another
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
        {/* Connected caller info */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
          <span className="text-slate-500">Active Proposer:</span>
          <span className="font-mono text-slate-800 font-medium">
            {account || 'No wallet connected'} ({activeRole})
          </span>
        </div>

        {/* Operation selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Operation Type
          </label>
          <select
            value={selectedOp}
            onChange={(e) => setSelectedOp(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-800 bg-white"
          >
            <option value={0}>Transfer Domain Ownership (requires Owner + 3 Guardians, 120s delay)</option>
            <option value={1}>DNS Record Update (requires Owner + 2 Guardians, 60s delay)</option>
            <option value={2}>Guardian Key Replacement (requires 3 Guardians, 120s delay)</option>
            <option value={3}>Owner Key Recovery (requires 3 Guardians, 180s delay)</option>
            <option value={4}>Unfreeze Frozen Domain (requires 3 Guardians, 120s delay)</option>
          </select>
        </div>

        {/* Domain selector (not needed for KEY_REPLACEMENT which is global) */}
        {selectedOp !== 2 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Target Domain
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-800 bg-white"
            >
              {Object.keys(CHAIN_CONFIG.domains).map((dName) => (
                <option key={dName} value={dName}>
                  {dName} (Current Owner: {CHAIN_CONFIG.domains[dName].owner.slice(0, 10)}...)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Fields: TRANSFER_OWNERSHIP or RECOVERY */}
        {(selectedOp === 0 || selectedOp === 3) && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              New Owner Address (Target)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              The recipient address that will gain ownership of the domain after quorum and timelock.
            </p>
            <input
              type="text"
              required
              placeholder="0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        )}

        {/* Dynamic Fields: DNS_UPDATE */}
        {selectedOp === 1 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              New Zone Record / DNS Content
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              The content will be hashed with keccak256 before proposal. The raw string is never stored on-chain.
            </p>
            <textarea
              rows={3}
              required
              value={rawDnsRecord}
              onChange={(e) => setRawDnsRecord(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <div className="mt-2 text-[11px] text-slate-500">
              Computed keccak256 hash: <code className="font-mono text-slate-800 break-all">{ethers.keccak256(ethers.toUtf8Bytes(rawDnsRecord.trim()))}</code>
            </div>
          </div>
        )}

        {/* Dynamic Fields: KEY_REPLACEMENT */}
        {selectedOp === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Old Guardian Address to Invalidate
              </label>
              <input
                type="text"
                required
                placeholder="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                value={oldKeyAddress}
                onChange={(e) => setOldKeyAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Guardian Address to Install
              </label>
              <input
                type="text"
                required
                placeholder="0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        {/* Dynamic Fields: UNFREEZE */}
        {selectedOp === 4 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            Note: Unfreezing a domain requires a 3-guardian quorum and a 120-second timelock. The domain must currently be in a FROZEN state for this proposal to be valid.
          </div>
        )}

        {/* Submit button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link to="/domains" className="text-xs text-slate-500 hover:text-slate-800">
            ← Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#0EA5A4] hover:bg-[#0c8a89] shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Validating On-Chain...' : 'Submit Proposal to Blockchain'}
          </button>
        </div>
      </form>
    </div>
  );
};
