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
  console.log("  DEMO: Guardian Key Loss Recovery (Judging Event)");
  console.log("  Scenario: Guardian Rahul's key is lost/compromised. Guardians initiate");
  console.log("            KEY_REPLACEMENT to replace Rahul with Victor, bypassing the lost key.");
  console.log("===============================================================================\n");

  const deployment = getDeployment();
  const domainGuard = await ethers.getContractAt("DomainGuard", deployment.address);

  const signers = await ethers.getSigners();
  const [
    alex,     // Admin
    priya,    // Guardian 1
    rahul,    // Guardian 2 (Lost Key)
    maya,     // Guardian 3
    marcus,   // Guardian 4
    elena,    // Guardian 5
    owner,    // Domain Owner
    victor,   // Replacement Guardian Key
  ] = signers;

  console.log("STEP 0: Initial Guardian Set on-chain");
  const initialGuardians = await domainGuard.getGuardians();
  console.log("  Current Guardian Addresses:");
  for (let i = 0; i < initialGuardians.length; i++) {
    console.log(`    [${i}] ${initialGuardians[i]}`);
  }
  console.log(`  • Lost Guardian Key:       Rahul  (${rahul.address})`);
  console.log(`  • Replacement Guardian Key: Victor (${victor.address})\n`);

  // Step 1: Propose KEY_REPLACEMENT
  console.log("STEP 1: Priya (Guardian) proposes KEY_REPLACEMENT for lost key Rahul -> Victor");
  const proposeTx = await domainGuard
    .connect(priya)
    .propose(
      ethers.ZeroHash,
      Op.KEY_REPLACEMENT,
      victor.address,
      rahul.address,
      ethers.ZeroHash
    );
  const proposeReceipt = await proposeTx.wait();
  console.log(`  • Tx Hash:            ${proposeTx.hash}`);
  console.log(`  • Block Number:       ${proposeReceipt?.blockNumber}`);
  logEvents(domainGuard, proposeReceipt);

  const reqId = await domainGuard.requestCount();
  console.log(`  -> Key Replacement Request ID: #${reqId}\n`);

  // Step 2: Show lost/old key cannot vote on its own replacement
  console.log("STEP 2: Lost key Rahul attempts to vote on its own replacement");
  try {
    const tx = await domainGuard.connect(rahul).approve(reqId);
    await tx.wait();
    console.log("  [FAIL] Old key was able to vote on its own replacement!");
  } catch (err: any) {
    const reason = parseRevertReason(domainGuard, err);
    console.log(`  • Result: REVERTED with ${reason}`);
    console.log("  • Security Guarantee: Contract forbids oldKey from voting on KEY_REPLACEMENT.");
  }
  console.log("");

  // Step 3: Quorum met by other 3 guardians (Maya, Marcus, Elena)
  console.log("STEP 3: Other 3 active guardians approve key replacement");
  console.log("  (a) Maya approves:");
  const app1 = await domainGuard.connect(maya).approve(reqId);
  const app1Receipt = await app1.wait();
  console.log(`      • Tx Hash:        ${app1.hash} (Block: ${app1Receipt?.blockNumber})`);
  logEvents(domainGuard, app1Receipt);

  console.log("  (b) Marcus approves:");
  const app2 = await domainGuard.connect(marcus).approve(reqId);
  const app2Receipt = await app2.wait();
  console.log(`      • Tx Hash:        ${app2.hash} (Block: ${app2Receipt?.blockNumber})`);
  logEvents(domainGuard, app2Receipt);

  console.log("  (c) Elena approves (Reaching Quorum):");
  const app3 = await domainGuard.connect(elena).approve(reqId);
  const app3Receipt = await app3.wait();
  console.log(`      • Tx Hash:        ${app3.hash} (Block: ${app3Receipt?.blockNumber})`);
  logEvents(domainGuard, app3Receipt);

  const reqAfterQuorum = await domainGuard.getRequest(reqId);
  console.log(`  -> Request #${reqId} Status: Approved, eta: ${reqAfterQuorum.eta}\n`);

  // Step 4: Fast-forward past key replacement timelock
  console.log("STEP 4: Fast-forwarding time past key replacement timelock using evm_increaseTime & evm_mine");
  const keyDelay = Number(deployment.delays.keyDelay);
  await advanceTime(keyDelay + 10);
  console.log(`  • [TIME ADVANCED] Skipped forward ${keyDelay + 10} seconds via evm_increaseTime / evm_mine.\n`);

  // Step 5: Execute KEY_REPLACEMENT
  console.log("STEP 5: Executing KEY_REPLACEMENT");
  const execTx = await domainGuard.connect(maya).execute(reqId);
  const execReceipt = await execTx.wait();
  console.log(`  • Exec Tx Hash:       ${execTx.hash}`);
  console.log(`  • Block Number:       ${execReceipt?.blockNumber}`);
  logEvents(domainGuard, execReceipt);

  console.log(`\n  Is Rahul still a guardian?  ${await domainGuard.isGuardian(rahul.address)}`);
  console.log(`  Is Victor now a guardian?   ${await domainGuard.isGuardian(victor.address)}\n`);

  // Step 6: Verify old key fails on any subsequent request
  console.log("STEP 6: Alex proposes DNS update on ledgerworks.example to test guardian keys");
  const domainId = ethers.keccak256(ethers.toUtf8Bytes("ledgerworks.example"));
  const newDnsHash = ethers.keccak256(ethers.toUtf8Bytes("v=spf1 include:new.ledgerworks.example ~all"));

  const testPropTx = await domainGuard
    .connect(alex)
    .propose(domainId, Op.DNS_UPDATE, ethers.ZeroAddress, ethers.ZeroAddress, newDnsHash);
  const testPropReceipt = await testPropTx.wait();
  const testReqId = await domainGuard.requestCount();
  console.log(`  • Test Request #${testReqId} created (Tx: ${testPropTx.hash}, Block: ${testPropReceipt?.blockNumber})\n`);

  console.log("STEP 7: Old key (Rahul) attempts to approve the new DNS request");
  try {
    const oldTx = await domainGuard.connect(rahul).approve(testReqId);
    await oldTx.wait();
    console.log("  [FAIL] Revoked key Rahul was able to approve!");
  } catch (err: any) {
    const reason = parseRevertReason(domainGuard, err);
    console.log(`  • Result: REVERTED with ${reason}`);
    console.log("  • Security Guarantee: Replaced key has been stripped of guardian role on-chain.");
  }
  console.log("");

  // Step 8: Verify new key (Victor) succeeds in approving
  console.log("STEP 8: New key (Victor) approves the DNS request");
  const newKeyTx = await domainGuard.connect(victor).approve(testReqId);
  const newKeyReceipt = await newKeyTx.wait();
  console.log(`  • Result: SUCCESSFUL APPROVAL`);
  console.log(`  • Tx Hash:            ${newKeyTx.hash}`);
  console.log(`  • Block Number:       ${newKeyReceipt?.blockNumber}`);
  logEvents(domainGuard, newKeyReceipt);

  // Step 9: Final on-chain guardian list verification
  console.log("\nSTEP 9: Final on-chain guardian list verification");
  const finalGuardians = await domainGuard.getGuardians();
  console.log("  Updated Guardian Addresses:");
  for (let i = 0; i < finalGuardians.length; i++) {
    console.log(`    [${i}] ${finalGuardians[i]}`);
  }

  const rahulFound = finalGuardians.some(
    (g) => g.toLowerCase() === rahul.address.toLowerCase()
  );
  const victorFound = finalGuardians.some(
    (g) => g.toLowerCase() === victor.address.toLowerCase()
  );

  if (!rahulFound && victorFound) {
    console.log("\n===============================================================================");
    console.log(">>> VERIFICATION: Key replacement confirmed on-chain!");
    console.log(">>> Old key (Rahul) successfully revoked and unable to approve.");
    console.log(">>> New key (Victor) successfully installed and active.");
    console.log("===============================================================================");
  } else {
    throw new Error("Key replacement verification failed!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
