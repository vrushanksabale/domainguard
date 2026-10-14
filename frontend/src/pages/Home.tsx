import React from 'react';
import { Link } from 'react-router-dom';
import { CHAIN_CONFIG } from '../config/chain';

export const Home: React.FC = () => {

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-[#0B1F3A] text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#162E52] text-teal-300 border border-teal-500/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
            <span>BlockHack PS-08 Decentralized Registrar Governance</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Cryptographic Multi-Party Authorization
            <span className="block text-[#0EA5A4] mt-2 font-bold">
              for High-Value Domain Registry Operations
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            DomainGuard eliminates single-point-of-failure administration. Every ownership transfer,
            DNS record change, and key recovery requires domain owner countersignature, a 3-of-5
            independent guardian quorum, and a mandatory on-chain timelock.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/attack-lab"
              className="px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#0EA5A4] hover:bg-[#0c8a89] transition glow-teal cursor-pointer"
            >
              Test Rogue Admin Attack Lab
            </Link>
            <Link
              to="/domains"
              className="px-6 py-3 rounded-lg text-sm font-semibold text-slate-200 bg-[#162E52] hover:bg-[#1C3A66] border border-slate-700 transition cursor-pointer"
            >
              View Protected Domains
            </Link>
          </div>
        </div>
      </section>

      {/* Live System Guarantees Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-[#0B1F3A]">Core On-Chain Security Guarantees</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enforced directly in EVM bytecode on contract {CHAIN_CONFIG.contractAddress.slice(0, 8)}...{CHAIN_CONFIG.contractAddress.slice(-6)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">3-of-5 Guardian Quorum</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Critical operations cannot execute without affirmative approvals from at least 3 distinct guardian organizations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-teal-600 font-semibold">
              Policy: 3 approvals required
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">Enforced Timelocks</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Approved requests enter a mandatory countdown window during which any guardian or domain owner can cancel the request via veto.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-teal-600 font-semibold">
              Delay: {CHAIN_CONFIG.delays.transferDelay}s transfer / {CHAIN_CONFIG.delays.dnsDelay}s DNS
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">Proposer Self-Approval Ban</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                An administrator or guardian who submits a proposal is cryptographically barred from approving their own request.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-rose-600 font-semibold">
              Reverts: SelfApprovalForbidden
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">Instant Emergency Freeze</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Any individual guardian can immediately halt operations on an attacked domain in a single transaction without waiting for quorum.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-teal-600 font-semibold">
              Function: freezeDomain(domainId)
            </div>
          </div>
        </div>

        {/* Live Seeded Domains Overview */}
        <div className="mt-14 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-[#0B1F3A]">Protected Domains in Demo Registry</h3>
              <p className="text-xs text-slate-500">Live records registered under contract governance</p>
            </div>
            <Link
              to="/domains"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 underline"
            >
              View detailed state & history →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {Object.values(CHAIN_CONFIG.domains).map((dom) => (
              <div key={dom.domainId} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#0B1F3A]">{dom.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    Protected
                  </span>
                </div>
                <div className="mt-3 text-[11px] text-slate-500 space-y-1">
                  <div>Owner: <span className="font-mono text-slate-700">{dom.owner.slice(0, 10)}...{dom.owner.slice(-6)}</span></div>
                  <div>Domain ID: <span className="font-mono text-slate-700">{dom.domainId.slice(0, 10)}...</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B1F3A] text-slate-400 py-10 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <span className="font-bold text-sm">DomainGuard</span>
            <span className="text-slate-500">|</span>
            <span className="text-xs text-slate-300">BlockHack PS-08 "The Rogue Admin"</span>
          </div>

          <div className="text-center md:text-right text-[11px] space-y-1">
            <p>Smart contract authority layer for ICANN registrars and corporate registries.</p>
            <p className="text-slate-500 font-mono">Contract: {CHAIN_CONFIG.contractAddress} • Chain: {CHAIN_CONFIG.chainId}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
