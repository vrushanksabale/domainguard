import React, { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG } from '../config/chain';
import { fetchActivityTimeline, type ActivityEvent } from '../services/contract';

export const Activity: React.FC = () => {
  const { readContract } = useWeb3();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const loadEvents = useCallback(async () => {
    if (!readContract) return;
    setLoading(true);
    try {
      const fromBlock = CHAIN_CONFIG.deploymentBlock || 0;
      const data = await fetchActivityTimeline(readContract, fromBlock);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load activity timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [readContract]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = events.filter((e) => {
    if (filterType === 'ALL') return true;
    return e.name === filterType;
  });

  const exportCSV = () => {
    const headers = ['BlockNumber', 'EventName', 'TransactionHash', 'Details'];
    const rows = filteredEvents.map((e) => [
      e.blockNumber,
      e.name,
      e.txHash,
      `"${JSON.stringify(e.args).replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `domainguard-audit-log-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventBadge = (name: string) => {
    if (name.includes('Executed') || name.includes('Approved') || name.includes('Recovered')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{name}</span>;
    }
    if (name.includes('Vetoed') || name.includes('Rejected') || name.includes('Frozen')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">{name}</span>;
    }
    if (name.includes('Queued')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">{name}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">{name}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Activity & Audit Log</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tamper-proof event logs queried directly from contract deployment block #{CHAIN_CONFIG.deploymentBlock}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={filteredEvents.length === 0}
            className="px-3.5 py-1.5 rounded-md border border-slate-300 text-xs text-slate-700 bg-white hover:bg-slate-50 font-semibold cursor-pointer disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 font-semibold mr-1">Filter Event:</span>
        {['ALL', 'RequestProposed', 'RequestApproved', 'RequestQueued', 'RequestVetoed', 'RequestExecuted', 'DomainFrozen'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
              filterType === type
                ? 'bg-[#0B1F3A] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-20 text-center text-xs text-slate-500">Querying on-chain event logs...</div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 mt-6 text-xs text-slate-500">
          No events match the selected filter.
        </div>
      )}

      {/* Timeline List */}
      <div className="mt-6 space-y-3">
        {filteredEvents.map((evt, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-start sm:items-center gap-3">
              <span className="font-mono text-slate-400 font-semibold text-[11px]">#{evt.blockNumber}</span>
              <div>
                <div className="flex items-center gap-2">
                  {getEventBadge(evt.name)}
                  <span className="font-mono text-slate-500 text-[11px] truncate max-w-[200px] sm:max-w-xs">
                    Tx: {evt.txHash}
                  </span>
                </div>
                <div className="mt-1.5 text-slate-700 font-mono text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(evt.args).map(([k, v]) => (
                    <span key={k}>
                      <span className="text-slate-400">{k}:</span> <span className="font-semibold text-slate-900">{v}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
