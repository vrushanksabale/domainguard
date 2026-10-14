import React from 'react';
import { Link } from 'react-router-dom';
import { CHAIN_CONFIG } from '../config/chain';

export const DomainsPlaceholder: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-[#0B1F3A]">Protected Domains</h1>
        <p className="text-xs text-slate-500 mt-1">On-chain domain state, ownership, and zone hashes</p>
      </div>
      <Link to="/new-request" className="px-4 py-2 rounded-md bg-[#0EA5A4] hover:bg-[#0c8a89] text-white text-xs font-semibold">
        Propose Operation
      </Link>
    </div>
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {Object.values(CHAIN_CONFIG.domains).map((dom) => (
        <div key={dom.domainId} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-bold text-base text-[#0B1F3A]">{dom.name}</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium">Active</span>
          </div>
          <div className="mt-4 text-xs text-slate-600 space-y-1.5">
            <div>Owner: <span className="font-mono text-slate-900">{dom.owner}</span></div>
            <div>Domain ID: <span className="font-mono text-slate-900">{dom.domainId.slice(0, 16)}...</span></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const NewRequestPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Propose Operation Request</h1>
    <p className="text-xs text-slate-500 mt-1">Select operation type and domain. Proposing does not change domain state until quorum and timelock pass.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Core page template ready for Sub-stage 4B implementation.
    </div>
  </div>
);

export const ApprovalsPlaceholder: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Governance Approvals & Queue</h1>
    <p className="text-xs text-slate-500 mt-1">Vote on pending proposals, inspect quorum progress, or execute timelocked actions.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Core page template ready for Sub-stage 4B implementation.
    </div>
  </div>
);

export const AttackLabPlaceholder: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Rogue Admin Attack Lab</h1>
    <p className="text-xs text-slate-500 mt-1">Interactive demonstration of contract-enforced attack defenses.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Core page template ready for Sub-stage 4B implementation.
    </div>
  </div>
);

export const RecoveryPlaceholder: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Guardian Key Loss & Recovery</h1>
    <p className="text-xs text-slate-500 mt-1">KEY_REPLACEMENT procedure bypassing lost guardian keys.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Core page template ready for Sub-stage 4B implementation.
    </div>
  </div>
);

export const GuardiansPlaceholder: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Guardian Network</h1>
    <p className="text-xs text-slate-500 mt-1">Designated guardian organizations and instant emergency freeze controls.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Secondary page ready for Sub-stage 4C implementation.
    </div>
  </div>
);

export const ActivityPlaceholder: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Activity & Audit Log</h1>
    <p className="text-xs text-slate-500 mt-1">Immutable on-chain event log queried from contract deployment block.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Secondary page ready for Sub-stage 4C implementation.
    </div>
  </div>
);

export const SecurityPlaceholder: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-bold text-[#0B1F3A]">Security & Threat Model</h1>
    <p className="text-xs text-slate-500 mt-1">Detailed breakdown of contract authority rules and cryptographic proofs of refusal.</p>
    <div className="mt-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
      Security overview ready for Sub-stage 4C implementation.
    </div>
  </div>
);

export const NotFound: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
    <h1 className="text-5xl font-extrabold text-[#0B1F3A]">404</h1>
    <p className="mt-2 text-sm text-slate-600">The requested page does not exist.</p>
    <Link to="/" className="mt-4 px-4 py-2 rounded bg-[#0EA5A4] text-white text-xs font-semibold">
      Return to Home
    </Link>
  </div>
);
