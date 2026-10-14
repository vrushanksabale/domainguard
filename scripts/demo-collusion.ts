import { ethers } from "hardhat";
import {
  Op,
  advanceTime,
  getDeployment,
  logEvents,
  parseRevertReason,
} from "./helpers";

async function main() {
  console.log("===============================================================================");
  console.log("  DEMO: Collusion Attack & Guardian Veto + Legitimate Transfer");
  console.log("  Scenario: Compromised owner & guardians approve transfer; an alert guardian");
  console.log("            vetoes during timelock. Followed by a successful legitimate transfer.");
  console.log("===============================================================================\n");

  const deployment = getDeployment();
  const domainGuard = await ethers.getContractAt("DomainGuard", deployment.address);

  const signers = await ethers.getSigners();
  const [
    alex,     // Admin / Attacker target
    priya,    // Guardian 1
    rahul,    // Guardian 2 (Honest guardian who vetoes)
    maya,     // Guardian 3
    marcus,   // Guardian 4
    elena,    // Guardian 5
    owner,    // Domain Owner Sarah
    victor,   // Replacement Guardian
    newOwner, // Legitimate New Owner Alice
  ] = signers;

  const targetDomainName = "harborline.example";
  const domainId = ethers.keccak256(ethers.toUtf8Bytes(targetDomainName));

  console.log("--- PART 1: COLLUSION ATTEMPT & GUARDIAN VETO ---------------------------------");
  const initialDomain = await domainGuard.getDomain(domainId);
  console.log(`  Target Domain:        ${targetDomainName}`);
  console.log(`  Domain ID:            ${domainId}`);
  console.log(`  Initial Owner:        ${initialDomain.owner}`);
  console.log(`  Initial Nonce:        ${initialDomain.nonce}\n`);

  // Step 1: Propose malicious transfer
  console.log("STEP 1: Attacker proposes transfer of harborline.example to Alex");
  const proposeTx = await domainGuard
    .connect(alex)
    .propose(domainId, Op.TRANSFER_OWNERSHIP, alex.address, ethers.ZeroAddress, ethers.ZeroHash);
  const proposeReceipt = await proposeTx.wait();
  console.log(`  • Propose Tx Hash:    ${proposeTx.hash}`);
  console.log(`  • Block Number:       ${proposeReceipt?.blockNumber}`);
  logEvents(domainGuard, proposeReceipt);

  const reqId = await domainGuard.requestCount();
  console.log(`  -> Malicious Request ID: #${reqId}\n`);

  // Step 2: Colluding approvals (Owner + 3 guardians)
  console.log("STEP 2: Colluding parties approve the malicious transfer");

  // Owner approves
  console.log("  (a) Compromised Owner approves:");
  const ownerAppTx = await domainGuard.connect(owner).approve(reqId);
  const ownerAppReceipt = await ownerAppTx.wait();
  console.log(`      • Tx Hash:        ${ownerAppTx.hash} (Block: ${ownerAppReceipt?.blockNumber})`);
  logEvents(domainGuard, ownerAppReceipt);

  // Priya approves
  console.log("  (b) Guardian Priya approves:");
  const priyaAppTx = await domainGuard.connect(priya).approve(reqId);
  const priyaAppReceipt = await priyaAppTx.wait();
  console.log(`      • Tx Hash:        ${priyaAppTx.hash} (Block: ${priyaAppReceipt?.blockNumber})`);
  logEvents(domainGuard, priyaAppReceipt);

  // Maya approves
  console.log("  (c) Guardian Maya approves:");
  const mayaAppTx = await domainGuard.connect(maya).approve(reqId);
  const mayaAppReceipt = await mayaAppTx.wait();
  console.log(`      • Tx Hash:        ${mayaAppTx.hash} (Block: ${mayaAppReceipt?.blockNumber})`);
  logEvents(domainGuard, mayaAppReceipt);

  // Marcus approves (hits 3-guardian quorum)
  console.log("  (d) Guardian Marcus approves (Reaching Quorum):");
  const marcusAppTx = await domainGuard.connect(marcus).approve(reqId);
  const marcusAppReceipt = await marcusAppTx.wait();
  console.log(`      • Tx Hash:        ${marcusAppTx.hash} (Block: ${marcusAppReceipt?.blockNumber})`);
  logEvents(domainGuard, marcusAppReceipt);

  const reqAfterQuorum = await domainGuard.getRequest(reqId);
  console.log(`  -> Request #${reqId} Status: Approved (Status code: ${reqAfterQuorum.status})`);
  console.log(`  -> Timelock active until timestamp: ${reqAfterQuorum.eta}\n`);

  // Step 3: Honest Guardian Rahul detects the collusion and vetoes during timelock
  console.log("STEP 3: Honest Guardian Rahul notices rogue transfer and invokes VETO during timelock");
  const vetoTx = await domainGuard.connect(rahul).veto(reqId);
  const vetoReceipt = await vetoTx.wait();
  console.log(`  • Veto Tx Hash:       ${vetoTx.hash}`);
  console.log(`  • Block Number:       ${vetoReceipt?.blockNumber}`);
  logEvents(domainGuard, vetoReceipt);

  const reqAfterVeto = await domainGuard.getRequest(reqId);
  console.log(`  -> Request #${reqId} Status: Vetoed (Status code: ${reqAfterVeto.status})\n`);

  // Step 4: Advance time past the timelock window
  console.log("STEP 4: Fast-forwarding time past timelock window using evm_increaseTime & evm_mine");
  const transferDelay = Number(deployment.delays.transferDelay);
  await advanceTime(transferDelay + 10);
  console.log(`  • [TIME ADVANCED] Skipped forward ${transferDelay + 10} seconds via evm_increaseTime / evm_mine.\n`);

  // Step 5: Attacker attempts to execute the vetoed transfer
  console.log("STEP 5: Attacker attempts to execute the vetoed transfer");
  try {
    const execTx = await domainGuard.connect(alex).execute(reqId);
    await execTx.wait();
    console.log("  [FAIL] Vetoed request executed! Security violation!");
  } catch (err: any) {
    const reason = parseRevertReason(domainGuard, err);
    console.log(`  • Result: REVERTED with ${reason}`);
    console.log("  • Security Guarantee: Vetoed request status is not Approved; execution cannot proceed.");
  }

  const domainAfterAttack = await domainGuard.getDomain(domainId);
  console.log(`  Current Owner on-chain: ${domainAfterAttack.owner}`);
  console.log(`  Initial Owner:          ${initialDomain.owner}`);
  if (domainAfterAttack.owner === initialDomain.owner) {
    console.log("\n>>> VERIFICATION: Domain owner on-chain is " + domainAfterAttack.owner);
    console.log(">>> owner unchanged");
  } else {
    throw new Error("CRITICAL: Domain owner was changed in malicious collusion!");
  }

  console.log("\n--- PART 2: LEGITIMATE TRANSFER COMPLETING AFTER TIMELOCK ---------------------");

  // Step 6: Propose legitimate transfer to Alice (newOwner)
  console.log("STEP 6: Legitimate transfer proposal for harborline.example to Alice (newOwner)");
  console.log(`  Proposer:             Alex (Admin)`);
  console.log(`  Target Recipient:     Alice (${newOwner.address})`);
  const legitProposeTx = await domainGuard
    .connect(alex)
    .propose(domainId, Op.TRANSFER_OWNERSHIP, newOwner.address, ethers.ZeroAddress, ethers.ZeroHash);
  const legitProposeReceipt = await legitProposeTx.wait();
  console.log(`  • Tx Hash:            ${legitProposeTx.hash}`);
  console.log(`  • Block Number:       ${legitProposeReceipt?.blockNumber}`);
  logEvents(domainGuard, legitProposeReceipt);

  const legitReqId = await domainGuard.requestCount();
  console.log(`  -> Legitimate Request ID: #${legitReqId}\n`);

  // Step 7: Legitimate approvals
  console.log("STEP 7: Legitimate approvals (Domain Owner + Priya + Rahul + Maya)");
  const app1 = await domainGuard.connect(owner).approve(legitReqId);
  await app1.wait();
  console.log(`  • Owner approved:     ${owner.address}`);

  const app2 = await domainGuard.connect(priya).approve(legitReqId);
  await app2.wait();
  console.log(`  • Guardian Priya:     ${priya.address}`);

  const app3 = await domainGuard.connect(rahul).approve(legitReqId);
  await app3.wait();
  console.log(`  • Guardian Rahul:     ${rahul.address}`);

  const app4 = await domainGuard.connect(maya).approve(legitReqId);
  const app4Receipt = await app4.wait();
  console.log(`  • Guardian Maya:      ${maya.address} (Quorum reached!)`);
  logEvents(domainGuard, app4Receipt);

  const legitReqQueued = await domainGuard.getRequest(legitReqId);
  console.log(`  -> Request #${legitReqId} Status: Approved, eta: ${legitReqQueued.eta}\n`);

  // Step 8: Fast-forward timelock for legitimate transfer
  console.log("STEP 8: Fast-forwarding time past timelock window using evm_increaseTime & evm_mine");
  await advanceTime(transferDelay + 10);
  console.log(`  • [TIME ADVANCED] Skipped forward ${transferDelay + 10} seconds via evm_increaseTime / evm_mine.\n`);

  // Step 9: Execute legitimate transfer
  console.log("STEP 9: Executing legitimate transfer");
  const legitExecTx = await domainGuard.connect(newOwner).execute(legitReqId);
  const legitExecReceipt = await legitExecTx.wait();
  console.log(`  • Exec Tx Hash:       ${legitExecTx.hash}`);
  console.log(`  • Block Number:       ${legitExecReceipt?.blockNumber}`);
  logEvents(domainGuard, legitExecReceipt);

  // Step 10: Final state check
  console.log("\nSTEP 10: Verifying updated domain ownership on-chain");
  const finalDomain = await domainGuard.getDomain(domainId);
  console.log(`  New Owner on-chain:   ${finalDomain.owner}`);
  console.log(`  Expected New Owner:   ${newOwner.address}`);
  console.log(`  New Nonce on-chain:   ${finalDomain.nonce}`);

  if (finalDomain.owner.toLowerCase() === newOwner.address.toLowerCase()) {
    console.log("\n===============================================================================");
    console.log(">>> VERIFICATION: Legitimate transfer successfully executed!");
    console.log(`>>> harborline.example new owner is: ${finalDomain.owner}`);
    console.log("===============================================================================");
  } else {
    throw new Error("Legitimate transfer failed to update owner!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
