import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG } from '../config/chain';
import {
  fetchAllRequests,
  parseContractError,
  parseReceiptEvents,
  skipTimelockOnLocal,
  type RequestRecord,
} from '../services/contract';

export const Approvals: React.FC = () => {
  const {
    readContract,
    account,
    activeRole,
    selectNamedAccount,
    getWriteContract,
    showToast,
    setReceiptSummary,
    refreshStats,
    isLocalDev,
  } = useWeb3();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionPendingId, setActionPendingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null);

  const loadRequests = useCallback(async () => {
    if (!readContract) return;
    setLoading(true);
    try {
      const data = await fetchAllRequests(readContract, account);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }, [readContract, account]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (id: number) => {
    setActionError(null);
    setActionPendingId(id);
    try {
      const writeContract = await getWriteContract();
      // Preflight on-chain check
      await writeContract.approve.staticCall(id);

      const tx = await writeContract.approve(id);
      showToast(`Vote broadcast for Request #${id}...`, 'info');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);
      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });
      showToast(`Request #${id} approved on-chain!`, 'success');
      await loadRequests();
      await refreshStats();
    } catch (err: any) {
      setActionError({ id, message: parseContractError(err) });
    } finally {
      setActionPendingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionError(null);
    setActionPendingId(id);
    try {
      const writeContract = await getWriteContract();
      // Preflight on-chain check
      await writeContract.reject.staticCall(id);

      const tx = await writeContract.reject(id);
      showToast(`Rejection broadcast for Request #${id}...`, 'info');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);
      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });
      showToast(`Request #${id} rejected on-chain!`, 'info');
      await loadRequests();
      await refreshStats();
    } catch (err: any) {
      setActionError({ id, message: parseContractError(err) });
    } finally {
      setActionPendingId(null);
    }
  };

  const handleVeto = async (id: number) => {
    setActionError(null);
    setActionPendingId(id);
    try {
      const writeContract = await getWriteContract();
      // Preflight on-chain check
      await writeContract.veto.staticCall(id);

      const tx = await writeContract.veto(id);
      showToast(`VETO broadcast for Request #${id}...`, 'info');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);
      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });
      showToast(`Request #${id} VETOED! Operation cancelled on-chain.`, 'error');
      await loadRequests();
      await refreshStats();
    } catch (err: any) {
      setActionError({ id, message: parseContractError(err) });
    } finally {
      setActionPendingId(null);
    }
  };

  const handleExecute = async (id: number) => {
    setActionError(null);
    setActionPendingId(id);
    try {
      const writeContract = await getWriteContract();
      // Preflight on-chain check
      await writeContract.execute.staticCall(id);

      const tx = await writeContract.execute(id);
      showToast(`Execution broadcast for Request #${id}...`, 'info');
      const receipt = await tx.wait();
      const events = parseReceiptEvents(receipt);
      setReceiptSummary({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        events,
      });
      showToast(`Request #${id} EXECUTED! Domain state updated on-chain.`, 'success');
      await loadRequests();
      await refreshStats();
    } catch (err: any) {
      setActionError({ id, message: parseContractError(err) });
    } finally {
      setActionPendingId(null);
    }
  };

  const handleFastForward = async (seconds: number) => {
    try {
      await skipTimelockOnLocal(seconds);
      showToast(`Fast-forwarded local EVM time by ${seconds} seconds via evm_increaseTime.`, 'info');
      await loadRequests();
      await refreshStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to fast forward time', 'error');
    }
  };

  const getStatusBadge = (status: number, statusName: string) => {
    switch (status) {
      case 1: // Pending
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
      case 2: // Approved (Timelock running)
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Approved (Timelock Running)</span>;
      case 3: // Executed
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Executed</span>;
      case 4: // Rejected
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      case 5: // Vetoed
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">VETOED</span>;
      case 6: // Expired
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Expired</span>;
      default:
        return <span>{statusName}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Governance Approvals Queue</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time on-chain proposals awaiting quorum, under timelock delay, or ready for execution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLocalDev && (
            <button
              onClick={() => handleFastForward(130)}
              className="px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-semibold cursor-pointer"
              title="Advances chain clock past timelock (evm_increaseTime + evm_mine)"
            >
              ⏩ Skip Timelock (Local Demo)
            </button>
          )}
          <button
            onClick={loadRequests}
            disabled={loading}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link
            to="/new-request"
            className="px-4 py-2 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-white text-xs font-semibold shadow-sm transition"
          >
            New Request
          </Link>
        </div>
      </div>

      {loading && requests.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <span className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></span>
          <p className="mt-4 text-xs font-medium text-slate-500">Querying requests from contract storage...</p>
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 mt-6 p-8">
          <p className="text-sm font-semibold text-[#0B1F3A]">No proposals have been registered yet.</p>
          <p className="text-xs text-slate-500 mt-1">Use the "New Request" button to create an on-chain operation proposal.</p>
          <Link
            to="/new-request"
            className="mt-4 inline-block px-4 py-2 rounded bg-[#0EA5A4] text-white text-xs font-semibold"
          >
            Propose First Request
          </Link>
        </div>
      )}

      {/* Requests List */}
      <div className="mt-8 space-y-6">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  Request #{req.id}
                </span>
                <span className="font-extrabold text-base text-[#0B1F3A]">{req.domainName}</span>
                <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                  {req.opName}
                </span>
              </div>
              <div>{getStatusBadge(req.status, req.statusName)}</div>
            </div>

            {/* Error banner for this specific request action */}
            {actionError && actionError.id === req.id && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                <span className="font-bold">Contract Blocked:</span> {actionError.message}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Proposer</span>
                <span className="font-mono text-slate-900 break-all">{req.proposer}</span>
              </div>
              {req.target !== '0x0000000000000000000000000000000000000000' && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Target Address</span>
                  <span className="font-mono text-slate-900 break-all">{req.target}</span>
                </div>
              )}
              {req.oldKey !== '0x0000000000000000000000000000000000000000' && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Old Key Being Replaced</span>
                  <span className="font-mono text-slate-900 break-all">{req.oldKey}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Guardian Approvals</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {req.guardianApprovals} / {req.guardianThreshold ?? 3} required
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Owner Countersignature</span>
                {req.ownerRequired ? (
                  <span className={`font-semibold ${req.ownerApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {req.ownerApproved ? 'Approved ✓' : 'Required (Pending)'}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">Not Required</span>
                )}
              </div>
              {req.eta > 0 && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Timelock Expiry (ETA)</span>
                  <span className="font-mono text-slate-800">Timestamp: {req.eta}</span>
                </div>
              )}
            </div>

            {/* Role eligibility context */}
            {(() => {
              const guardianAddresses = [
                CHAIN_CONFIG.namedAccounts.priya?.address?.toLowerCase(),
                CHAIN_CONFIG.namedAccounts.rahul?.address?.toLowerCase(),
                CHAIN_CONFIG.namedAccounts.maya?.address?.toLowerCase(),
                CHAIN_CONFIG.namedAccounts.marcus?.address?.toLowerCase(),
                CHAIN_CONFIG.namedAccounts.elena?.address?.toLowerCase(),
              ].filter(Boolean);

              const isProposer = account?.toLowerCase() === req.proposer.toLowerCase();
              const isOwner = Boolean(req.domainOwner && account?.toLowerCase() === req.domainOwner.toLowerCase());
              const isGuardian = account ? guardianAddresses.includes(account.toLowerCase()) : false;

              let approveLabel = 'Approve Request';
              if (isOwner && req.ownerRequired && !req.ownerApproved) {
                approveLabel = 'Countersign as Owner';
              } else if (isGuardian) {
                approveLabel = 'Approve as Guardian';
              }

              return (
                <>
                  {req.status === 1 && isProposer && (
                    <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] flex items-center justify-between">
                      <span>
                        ⚠️ <strong>Proposer Self-Approval Blocked:</strong> Connected as {activeRole} (Proposer). Contract security invariant strictly forbids self-approval.
                      </span>
                    </div>
                  )}

                  {req.status === 1 && !isProposer && !isGuardian && !isOwner && (
                    <div className="mt-3 p-2.5 bg-slate-100 border border-slate-200 rounded text-slate-700 text-[11px] flex items-center justify-between">
                      <span>
                        ℹ️ <strong>Voting Restricted:</strong> Connected as {activeRole}. On-chain policy requires an authorized Guardian or Domain Owner vote.
                      </span>
                    </div>
                  )}

                  {isLocalDev && req.status === 1 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-500">Quick-switch signer for judging:</span>
                      {req.ownerRequired && !req.ownerApproved && (
                        <button
                          type="button"
                          onClick={() => selectNamedAccount('sarah')}
                          className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium cursor-pointer"
                          title="Switch to Domain Owner Sarah"
                        >
                          Switch to Owner (Sarah)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => selectNamedAccount('priya')}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-medium cursor-pointer"
                        title="Switch to Guardian Priya"
                      >
                        Switch to Guardian (Priya)
                      </button>
                      <button
                        type="button"
                        onClick={() => selectNamedAccount('rahul')}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-medium cursor-pointer"
                        title="Switch to Guardian Rahul"
                      >
                        Switch to Guardian (Rahul)
                      </button>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {req.hasVoted && (
                        <span className="text-purple-700 font-semibold">
                          Your active wallet ({activeRole}) has already voted on this request.
                        </span>
                      )}
                      {!req.hasVoted && req.status === 1 && (
                        <span>
                          {isGuardian && 'Guardian approval ready to submit.'}
                          {isOwner && req.ownerRequired && !req.ownerApproved && 'Domain owner countersignature ready to submit.'}
                          {!isGuardian && !isOwner && !isProposer && 'Active account is not an authorized voter on this request.'}
                          {isProposer && 'Proposer cannot vote on own request.'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Pending Actions: Approve & Reject */}
                      {req.status === 1 && (
                        <>
                          {req.hasVoted ? (
                            <span className="px-3 py-1.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Already Voted ✓
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={actionPendingId === req.id}
                                onClick={() => handleApprove(req.id)}
                                className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer disabled:opacity-50"
                              >
                                {actionPendingId === req.id ? 'Processing...' : approveLabel}
                              </button>
                              <button
                                type="button"
                                disabled={actionPendingId === req.id}
                                onClick={() => handleReject(req.id)}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer disabled:opacity-50"
                              >
                                {actionPendingId === req.id ? 'Processing...' : 'Reject'}
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {/* Approved Actions: Veto & Execute */}
                      {req.status === 2 && (
                        <>
                          <button
                            type="button"
                            disabled={actionPendingId === req.id}
                            onClick={() => handleVeto(req.id)}
                            className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer disabled:opacity-50"
                          >
                            {actionPendingId === req.id ? 'Vetoing...' : 'Veto Request'}
                          </button>
                          <button
                            type="button"
                            disabled={actionPendingId === req.id}
                            onClick={() => handleExecute(req.id)}
                            className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#0EA5A4] hover:bg-[#0c8a89] text-white transition cursor-pointer disabled:opacity-50"
                          >
                            {actionPendingId === req.id ? 'Executing...' : 'Execute Request'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
};
