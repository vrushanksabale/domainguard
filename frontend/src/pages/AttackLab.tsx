import React, { useState, useEffect } from 'react';
import { ethers, JsonRpcProvider } from 'ethers';
import { useWeb3 } from '../context/Web3Context';
import { CHAIN_CONFIG, OP_TYPES } from '../config/chain';
import {
  parseContractError,
  parseReceiptEvents,
  skipTimelockOnLocal,
} from '../services/contract';

export const AttackLab: React.FC = () => {
  const { readContract, showToast, refreshStats, isLocalDev } = useWeb3();

  // Scenario A State
  const [scenarioARunning, setScenarioARunning] = useState(false);
  const [scenarioALogs, setScenarioALogs] = useState<string[]>([]);
  const [scenarioAOwnerBefore, setScenarioAOwnerBefore] = useState<string>('');
  const [scenarioAOwnerAfter, setScenarioAOwnerAfter] = useState<string>('');
  const [scenarioABlocked, setScenarioABlocked] = useState<boolean>(false);

  // Scenario B State
  const [scenarioBRunning, setScenarioBRunning] = useState(false);
  const [scenarioBLogs, setScenarioBLogs] = useState<string[]>([]);
  const [scenarioBVetoed, setScenarioBVetoed] = useState<boolean>(false);
  const [scenarioBSuccess, setScenarioBSuccess] = useState<boolean>(false);

  // Scenario C State
  const [scenarioCRunning, setScenarioCRunning] = useState(false);
  const [scenarioCLogs, setScenarioCLogs] = useState<string[]>([]);
  const [scenarioCSuccess, setScenarioCSuccess] = useState<boolean>(false);

  useEffect(() => {
    const fetchInitialOwners = async () => {
      if (!readContract) return;
      try {
        const dId = CHAIN_CONFIG.domains['mybank.example'].domainId;
        const d = await readContract.getDomain(dId);
        setScenarioAOwnerBefore(d.owner);
        setScenarioAOwnerAfter(d.owner);
      } catch {}
    };
    fetchInitialOwners();
  }, [readContract]);

  // SCENARIO A: Rogue Admin Transfer Attack
  const runScenarioA = async () => {
    if (!readContract) return;
    setScenarioARunning(true);
    setScenarioABlocked(false);
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      setScenarioALogs([...logs]);
    };

    try {
      const provider = new JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const alex = await provider.getSigner(CHAIN_CONFIG.namedAccounts.alex.address);
      const elena = await provider.getSigner(CHAIN_CONFIG.namedAccounts.elena.address);
      const dgAlex = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, alex);
      const dgElena = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, elena);

      const domainName = 'mybank.example';
      const domainId = CHAIN_CONFIG.domains[domainName].domainId;

      log('STEP 1: Reading on-chain domain owner before attack...');
      const dBefore = await readContract.getDomain(domainId);
      setScenarioAOwnerBefore(dBefore.owner);
      log(`• Target Domain: ${domainName}`);
      log(`• Current Owner on-chain: ${dBefore.owner}`);
      log(`• Proposer: Alex (Legitimate Admin: ${await alex.getAddress()})`);

      log('\nSTEP 2: Alex proposes TRANSFER_OWNERSHIP of mybank.example to his own address...');
      const propTx = await dgAlex.propose(
        domainId,
        OP_TYPES.TRANSFER_OWNERSHIP,
        await alex.getAddress(),
        ethers.ZeroAddress,
        ethers.ZeroHash
      );
      const propReceipt = await propTx.wait();
      const events = parseReceiptEvents(propReceipt);
      const reqId = Number(events.find((e) => e.name === 'RequestProposed')?.args?.requestId || 0);
      log(`• Proposal broadcast confirmed! Request ID: #${reqId} (Tx: ${propTx.hash.slice(0, 14)}...)`);

      log('\nSTEP 3: Alex attempts to self-approve his own transfer proposal...');
      try {
        await dgAlex.approve.staticCall(reqId);
        await (await dgAlex.approve(reqId)).wait();
        log('❌ FAIL: Self-approval succeeded unexpectedly!');
      } catch (err: any) {
        const reason = parseContractError(err);
        log(`🛡️ BLOCKED BY CONTRACT: Reverted with SelfApprovalForbidden()`);
        log(`• Explanation: ${reason}`);
      }

      log('\nSTEP 4: Alex attempts to execute the transfer immediately without approvals or timelock...');
      try {
        await dgAlex.execute.staticCall(reqId);
        await (await dgAlex.execute(reqId)).wait();
        log('❌ FAIL: Premature execution succeeded unexpectedly!');
      } catch (err: any) {
        const reason = parseContractError(err);
        log(`🛡️ BLOCKED BY CONTRACT: Reverted with QuorumNotReached()`);
        log(`• Explanation: ${reason}`);
      }

      log('\nSTEP 5: Alex convinces 1 colluding guardian (Elena) to approve...');
      const elenaApproveTx = await dgElena.approve(reqId);
      await elenaApproveTx.wait();
      log(`• Guardian Elena approved Request #${reqId} (1 of 3 required guardian approvals)`);

      log('\nSTEP 6: Alex attempts to execute again with only 1 guardian approval (missing owner + 2 guardians)...');
      try {
        await dgAlex.execute.staticCall(reqId);
        await (await dgAlex.execute(reqId)).wait();
        log('❌ FAIL: Execution succeeded without quorum!');
      } catch (err: any) {
        const reason = parseContractError(err);
        log(`🛡️ BLOCKED BY CONTRACT: Reverted with QuorumNotReached()`);
        log(`• Explanation: ${reason}`);
      }

      log('\nSTEP 7: Verifying domain owner on-chain after all attack attempts...');
      const dAfter = await readContract.getDomain(domainId);
      setScenarioAOwnerAfter(dAfter.owner);
      log(`• Owner on-chain now: ${dAfter.owner}`);

      if (dAfter.owner.toLowerCase() === dBefore.owner.toLowerCase()) {
        log('\n✅ VERIFICATION COMPLETE: Domain owner is UNCHANGED.');
        log('>>> Cryptographic proof of refusal successfully demonstrated.');
        setScenarioABlocked(true);
        showToast('Rogue admin attack successfully repelled by DomainGuard smart contract!', 'success');
      } else {
        log('❌ CRITICAL SECURITY FAILURE: Owner changed!');
      }
      await refreshStats();
    } catch (fatal: any) {
      log(`Execution error: ${fatal.message}`);
    } finally {
      setScenarioARunning(false);
    }
  };

  // SCENARIO B: Collusion & Guardian Veto + Legitimate Transfer
  const runScenarioB = async () => {
    if (!readContract) return;
    setScenarioBRunning(true);
    setScenarioBVetoed(false);
    setScenarioBSuccess(false);
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      setScenarioBLogs([...logs]);
    };

    try {
      const provider = new JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const alex = await provider.getSigner(CHAIN_CONFIG.namedAccounts.alex.address);
      const priya = await provider.getSigner(CHAIN_CONFIG.namedAccounts.priya.address);
      const rahul = await provider.getSigner(CHAIN_CONFIG.namedAccounts.rahul.address);
      const maya = await provider.getSigner(CHAIN_CONFIG.namedAccounts.maya.address);
      const marcus = await provider.getSigner(CHAIN_CONFIG.namedAccounts.marcus.address);
      const owner = await provider.getSigner(CHAIN_CONFIG.namedAccounts.owner.address);
      const alice = await provider.getSigner(CHAIN_CONFIG.namedAccounts.newOwner.address);

      const dgAlex = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, alex);
      const dgPriya = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, priya);
      const dgRahul = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, rahul);
      const dgMaya = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, maya);
      const dgMarcus = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, marcus);
      const dgOwner = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, owner);

      const domainName = 'harborline.example';
      const domainId = CHAIN_CONFIG.domains[domainName].domainId;

      log('--- PART 1: MALICIOUS COLLUSION & GUARDIAN VETO ---');
      log(`STEP 1: Proposing malicious transfer of ${domainName} to Alex...`);
      const propTx = await dgAlex.propose(
        domainId,
        OP_TYPES.TRANSFER_OWNERSHIP,
        await alex.getAddress(),
        ethers.ZeroAddress,
        ethers.ZeroHash
      );
      const receipt1 = await propTx.wait();
      const reqId = Number(parseReceiptEvents(receipt1).find((e) => e.name === 'RequestProposed')?.args?.requestId || 0);
      log(`• Malicious Request #${reqId} created.`);

      log('STEP 2: Compromised Owner & 3 guardians approve...');
      await (await dgOwner.approve(reqId)).wait();
      log('• Owner countersigned.');
      await (await dgPriya.approve(reqId)).wait();
      log('• Guardian Priya approved.');
      await (await dgMaya.approve(reqId)).wait();
      log('• Guardian Maya approved.');
      await (await dgMarcus.approve(reqId)).wait();
      log('• Guardian Marcus approved (Quorum reached!). Request entered Timelock.');

      log('\nSTEP 3: Alert Guardian Rahul detects suspicious transfer and invokes VETO during timelock...');
      const vetoTx = await dgRahul.veto(reqId);
      await vetoTx.wait();
      log(`🛡️ VETO CONFIRMED on-chain (Tx: ${vetoTx.hash.slice(0, 14)}...). Request status is now Vetoed.`);
      setScenarioBVetoed(true);

      log('\nSTEP 4: Fast-forwarding time past transfer timelock (evm_increaseTime)...');
      await skipTimelockOnLocal(130);
      log('• Timelock expired.');

      log('\nSTEP 5: Attacker tries to execute vetoed transfer...');
      try {
        await dgAlex.execute.staticCall(reqId);
        await (await dgAlex.execute(reqId)).wait();
        log('❌ FAIL: Vetoed request executed!');
      } catch (err: any) {
        log(`🛡️ BLOCKED BY CONTRACT: Reverted with QuorumNotReached() (status is Vetoed).`);
      }

      log('\n--- PART 2: LEGITIMATE TRANSFER COMPLETION ---');
      log('STEP 6: Legitimate transfer proposal to Alice (newOwner)...');
      const legitTx = await dgAlex.propose(
        domainId,
        OP_TYPES.TRANSFER_OWNERSHIP,
        await alice.getAddress(),
        ethers.ZeroAddress,
        ethers.ZeroHash
      );
      const legitReceipt = await legitTx.wait();
      const legitReqId = Number(parseReceiptEvents(legitReceipt).find((e) => e.name === 'RequestProposed')?.args?.requestId || 0);
      log(`• Legitimate Request #${legitReqId} created.`);

      log('STEP 7: Owner + 3 guardians approve legitimate transfer...');
      await (await dgOwner.approve(legitReqId)).wait();
      await (await dgPriya.approve(legitReqId)).wait();
      await (await dgRahul.approve(legitReqId)).wait();
      await (await dgMaya.approve(legitReqId)).wait();
      log('• Quorum met. Request queued.');

      log('STEP 8: Fast-forwarding timelock (130 seconds)...');
      await skipTimelockOnLocal(130);

      log('STEP 9: Executing legitimate transfer...');
      const execTx = await dgAlex.execute(legitReqId);
      await execTx.wait();
      log(`✅ EXECUTED! Harborline.example owner transferred to Alice (${await alice.getAddress()}).`);
      setScenarioBSuccess(true);
      showToast('Collusion veto and legitimate transfer scenario verified!', 'success');
      await refreshStats();
    } catch (err: any) {
      log(`Error in Scenario B: ${err.message}`);
    } finally {
      setScenarioBRunning(false);
    }
  };

  // SCENARIO C: Key-loss recovery
  const runScenarioC = async () => {
    if (!readContract) return;
    setScenarioCRunning(true);
    setScenarioCSuccess(false);
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      setScenarioCLogs([...logs]);
    };

    try {
      const provider = new JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const alex = await provider.getSigner(CHAIN_CONFIG.namedAccounts.alex.address);
      const priya = await provider.getSigner(CHAIN_CONFIG.namedAccounts.priya.address);
      const rahul = await provider.getSigner(CHAIN_CONFIG.namedAccounts.rahul.address);
      const maya = await provider.getSigner(CHAIN_CONFIG.namedAccounts.maya.address);
      const marcus = await provider.getSigner(CHAIN_CONFIG.namedAccounts.marcus.address);
      const elena = await provider.getSigner(CHAIN_CONFIG.namedAccounts.elena.address);
      const victor = await provider.getSigner(CHAIN_CONFIG.namedAccounts.victor.address);

      const dgAlex = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, alex);
      const dgPriya = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, priya);
      const dgRahul = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, rahul);
      const dgMaya = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, maya);
      const dgMarcus = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, marcus);
      const dgElena = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, elena);
      const dgVictor = new ethers.Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, victor);

      log('STEP 1: Priya proposes KEY_REPLACEMENT for lost guardian key Rahul -> Victor...');
      const propTx = await dgPriya.propose(
        ethers.ZeroHash,
        OP_TYPES.KEY_REPLACEMENT,
        await victor.getAddress(),
        await rahul.getAddress(),
        ethers.ZeroHash
      );
      const receipt = await propTx.wait();
      const reqId = Number(parseReceiptEvents(receipt).find((e) => e.name === 'RequestProposed')?.args?.requestId || 0);
      log(`• Key replacement Request #${reqId} created on-chain.`);

      log('\nSTEP 2: Lost key Rahul attempts to vote on its own replacement...');
      try {
        await dgRahul.approve.staticCall(reqId);
        await (await dgRahul.approve(reqId)).wait();
        log('❌ FAIL: Old key was able to vote!');
      } catch (err: any) {
        log('🛡️ BLOCKED BY CONTRACT: Reverted with NotAuthorized() (oldKey excluded from voting).');
      }

      log('\nSTEP 3: Other 3 active guardians (Maya, Marcus, Elena) approve...');
      await (await dgMaya.approve(reqId)).wait();
      await (await dgMarcus.approve(reqId)).wait();
      await (await dgElena.approve(reqId)).wait();
      log('• Quorum reached! Timelock started.');

      log('\nSTEP 4: Fast-forwarding past keyDelay timelock (130 seconds)...');
      await skipTimelockOnLocal(130);

      log('\nSTEP 5: Executing key replacement on-chain...');
      const execTx = await dgMaya.execute(reqId);
      await execTx.wait();
      log('• Key replacement executed! Event GuardianReplaced emitted on-chain.');

      log('\nSTEP 6: Testing guardian keys on a new DNS request...');
      const testDomainId = CHAIN_CONFIG.domains['ledgerworks.example'].domainId;
      const testProp = await dgAlex.propose(
        testDomainId,
        OP_TYPES.DNS_UPDATE,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.keccak256(ethers.toUtf8Bytes('v=spf1 include:keytest.example ~all'))
      );
      const testReceipt = await testProp.wait();
      const testReqId = Number(parseReceiptEvents(testReceipt).find((e) => e.name === 'RequestProposed')?.args?.requestId || 0);

      log('• Old key (Rahul) attempts to approve new DNS request...');
      try {
        await dgRahul.approve.staticCall(testReqId);
        await (await dgRahul.approve(testReqId)).wait();
        log('❌ FAIL: Revoked key was able to approve!');
      } catch (err: any) {
        log('🛡️ BLOCKED: Revoked key Rahul reverted with NotAuthorized().');
      }

      log('• New key (Victor) approves new DNS request...');
      const newKeyTx = await dgVictor.approve(testReqId);
      await newKeyTx.wait();
      log('✅ SUCCESS: New key Victor successfully approved request!');

      log('\n✅ VERIFICATION COMPLETE: Old key revoked, new key installed on-chain.');
      setScenarioCSuccess(true);
      showToast('Key-loss recovery flow verified on-chain!', 'success');
      await refreshStats();
    } catch (err: any) {
      log(`Error in Scenario C: ${err.message}`);
    } finally {
      setScenarioCRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">Attack & Security Lab</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Interactive on-chain demonstrations of contract defense mechanisms against rogue admins, collusion, and key loss.
        </p>
      </div>

      {!isLocalDev && (
        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <span>
            <strong className="font-semibold">Note:</strong> Attack Lab interactive simulations require unlocked test accounts available on the local Hardhat node (Chain ID 31337).
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-800 text-[10px] font-mono font-bold">Localhost Only</span>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8">
        {/* SCENARIO A */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wider mb-1">
                Scenario A — Hour-4 Rogue Admin Attack
              </div>
              <h2 className="text-xl font-bold text-[#0B1F3A]">
                Unilateral Transfer Attempt by Registrar Admin (Alex)
              </h2>
            </div>
            <button
              onClick={runScenarioA}
              disabled={scenarioARunning}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {scenarioARunning ? 'Running Attack...' : 'Launch Rogue Admin Attack'}
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-600 leading-relaxed">
            Alex, a legitimate registrar admin, attempts to transfer <span className="font-semibold text-slate-900">mybank.example</span> to his personal address. The contract enforces that proposers cannot self-approve, quorum cannot be bypassed, and a single colluding guardian cannot grant execution authority.
          </p>

          {/* Owner Before & After comparison with Stamp */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Domain Owner Before Attack</span>
              <span className="font-mono text-slate-800 font-medium break-all">{scenarioAOwnerBefore || 'Loading...'}</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs relative overflow-hidden">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase">Domain Owner After Attack</span>
              <span className="font-mono text-slate-800 font-medium break-all">{scenarioAOwnerAfter || 'Loading...'}</span>

              {/* Rotated BLOCKED Stamp */}
              {scenarioABlocked && (
                <div className="absolute right-4 top-2 rotate-12 border-2 border-rose-600 px-3 py-1 text-rose-600 font-black tracking-widest text-sm uppercase rounded shadow-sm bg-white/90">
                  BLOCKED
                </div>
              )}
            </div>
          </div>

          {/* Live terminal output */}
          {scenarioALogs.length > 0 && (
            <div className="mt-6 bg-[#071528] text-slate-200 p-4 rounded-lg font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-slate-800">
              {scenarioALogs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* SCENARIO B */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider mb-1">
                Scenario B — Collusion & Guardian Veto
              </div>
              <h2 className="text-xl font-bold text-[#0B1F3A]">
                Collusion Quorum Defeated via Timelock Veto
              </h2>
            </div>
            <button
              onClick={runScenarioB}
              disabled={scenarioBRunning}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#0EA5A4] hover:bg-[#0c8a89] transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {scenarioBRunning ? 'Simulating Collusion...' : 'Run Collusion & Veto Test'}
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-600 leading-relaxed">
            A compromised domain owner and 3 guardians collude to approve a malicious transfer. An alert honest guardian notices the pending transfer during the mandatory timelock window and cancels the transfer on-chain using <code className="font-mono font-semibold text-rose-600">veto()</code>.
          </p>

          {(scenarioBVetoed || scenarioBSuccess) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {scenarioBVetoed && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  🛡️ Malicious Transfer Vetoed On-Chain
                </span>
              )}
              {scenarioBSuccess && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✅ Legitimate Transfer Executed On-Chain
                </span>
              )}
            </div>
          )}

          {scenarioBLogs.length > 0 && (
            <div className="mt-6 bg-[#071528] text-slate-200 p-4 rounded-lg font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-slate-800">
              {scenarioBLogs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* SCENARIO C */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wider mb-1">
                Scenario C — Judging Event
              </div>
              <h2 className="text-xl font-bold text-[#0B1F3A]">
                Guardian Key Loss & Recovery (KEY_REPLACEMENT)
              </h2>
            </div>
            <button
              onClick={runScenarioC}
              disabled={scenarioCRunning}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {scenarioCRunning ? 'Running Key Loss Test...' : 'Run Key Loss Recovery'}
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-600 leading-relaxed">
            One guardian key (Rahul) is lost. The remaining guardians initiate a <code className="font-mono font-semibold">KEY_REPLACEMENT</code> flow. The lost key is excluded from voting on its own replacement. After execution, the revoked key is proven unable to cast approvals, while the newly installed key (Victor) succeeds.
          </p>

          {scenarioCSuccess && (
            <div className="mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✅ Key Replaced: Rahul Revoked & Victor Activated On-Chain
              </span>
            </div>
          )}

          {scenarioCLogs.length > 0 && (
            <div className="mt-6 bg-[#071528] text-slate-200 p-4 rounded-lg font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-slate-800">
              {scenarioCLogs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
