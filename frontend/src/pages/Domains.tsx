import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { fetchAllDomains, type DomainRecord } from '../services/contract';

export const Domains: React.FC = () => {
  const { readContract } = useWeb3();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainRecord | null>(null);

  const loadDomains = useCallback(async () => {
    if (!readContract) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllDomains(readContract);
      setDomains(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch domains from on-chain state.');
    } finally {
      setLoading(false);
    }
  }, [readContract]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Protected Domains</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time on-chain domain registry state, ownership, and zone-file hashes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDomains}
            disabled={loading}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link
            to="/new-request"
            className="px-4 py-2 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            Propose Operation
          </Link>
        </div>
      </div>

      {/* Info notice about registrar registry limitation */}
      <div className="mt-6 p-4 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
        <span className="text-teal-600 text-base">ℹ</span>
        <div>
          <strong className="text-slate-800">Registry Scope:</strong> In this deployment, domains are registered by the registrar admin under fixed multi-party governance rules. Domain names are stored solely as keccak256 hashes to preserve privacy and minimize on-chain footprint.
        </div>
      </div>

      {/* Loading state */}
      {loading && domains.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <span className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></span>
          <p className="mt-4 text-xs font-medium text-slate-500">Querying on-chain domain records...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <p className="font-semibold">Failed to load domain data</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={loadDomains}
            className="mt-3 px-3 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && domains.length === 0 && (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 mt-6">
          <p className="text-sm text-slate-600 font-medium">No protected domains discovered on this contract.</p>
          <p className="text-xs text-slate-400 mt-1">Please deploy and seed demo domains using the local deploy script.</p>
        </div>
      )}

      {/* Domains Grid */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {domains.map((dom) => (
          <div
            key={dom.domainId}
            className={`bg-white rounded-xl border transition shadow-sm flex flex-col justify-between ${
              dom.frozen ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg text-[#0B1F3A]">{dom.name}</span>
                {dom.frozen ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    FROZEN
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ACTIVE
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-2.5 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Owner</span>
                  <span className="font-mono text-slate-900 font-medium break-all">{dom.owner}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Domain ID (keccak256)</span>
                  <span className="font-mono text-slate-700 text-[11px] break-all">{dom.domainId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nonce / Nonce Replay Guard</span>
                  <span className="font-mono font-bold text-slate-900">{dom.nonce}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedDomain(dom)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Inspect Details
              </button>
              <Link
                to={`/new-request?domain=${encodeURIComponent(dom.name)}`}
                className="text-xs font-semibold text-[#0EA5A4] hover:text-[#0c8a89] cursor-pointer"
              >
                Propose Request →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Domain Details Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0B1F3A]">
                Domain State: {selectedDomain.name}
              </h2>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 text-[11px] font-semibold block">Fully Qualified Domain Name</span>
                <span className="font-semibold text-slate-900 text-sm">{selectedDomain.name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] font-semibold block">Domain ID (keccak256 hash)</span>
                <code className="bg-slate-100 p-1.5 rounded block text-[11px] font-mono break-all mt-0.5">
                  {selectedDomain.domainId}
                </code>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] font-semibold block">Zone Record Hash (dnsRecordHash)</span>
                <code className="bg-slate-100 p-1.5 rounded block text-[11px] font-mono break-all mt-0.5">
                  {selectedDomain.dnsRecordHash}
                </code>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] font-semibold block">Current On-Chain Owner</span>
                <code className="bg-slate-100 p-1.5 rounded block text-[11px] font-mono break-all mt-0.5">
                  {selectedDomain.owner}
                </code>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold block">Security Status</span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedDomain.frozen ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedDomain.frozen ? 'FROZEN' : 'ACTIVE / UNLOCKED'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold block">State Nonce</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 inline-block">
                    {selectedDomain.nonce}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedDomain(null)}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
              <Link
                to={`/new-request?domain=${encodeURIComponent(selectedDomain.name)}`}
                className="px-4 py-2 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-xs font-semibold text-white cursor-pointer"
              >
                Propose Operation on Domain
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
