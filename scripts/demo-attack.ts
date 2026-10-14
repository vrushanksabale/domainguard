import { ethers } from "hardhat";
import {
  Op,
  getDeployment,
  logEvents,
  parseRevertReason,
} from "./helpers";

async function main() {
  console.log("===============================================================================");
  console.log("  DEMO: Rogue Admin Attack (Hour-4 Event)");
  console.log("  Scenario: Alex (legitimate admin) attempts unilateral transfer of mybank.example");
  console.log("===============================================================================\n");

  const deployment = getDeployment();
  const domainGuard = await ethers.getContractAt("DomainGuard", deployment.address);

  const signers = await ethers.getSigners();
  const alex = signers[0];   // Admin
  const elena = signers[5];  // Guardian 5

  const targetDomainName = "mybank.example";
  const domainId = ethers.keccak256(ethers.toUtf8Bytes(targetDomainName));

  console.log("STEP 0: Inspecting initial state on-chain");
  const initialDomain = await domainGuard.getDomain(domainId);
  console.log(`  Target Domain:       ${targetDomainName}`);
  console.log(`  Domain ID:           ${domainId}`);
  console.log(`  Current Owner:       ${initialDomain.owner}`);
  console.log(`  Current Nonce:       ${initialDomain.nonce}`);
  console.log(`  Is Frozen:           ${initialDomain.frozen}`);
  console.log(`  Is Alex Admin?       ${await domainGuard.isAdmin(alex.address)}`);
  console.log("");

  // Step 1: Alex proposes transfer to his own address
  console.log("STEP 1: Alex proposes TRANSFER_OWNERSHIP of mybank.example to his own address");
  console.log(`  Proposer:            Alex (${alex.address})`);
  console.log(`  Proposed New Owner:  Alex (${alex.address})`);

  const proposeTx = await domainGuard
    .connect(alex)
    .propose(domainId, Op.TRANSFER_OWNERSHIP, alex.address, ethers.ZeroAddress, ethers.ZeroHash);
  const proposeReceipt = await proposeTx.wait();

  console.log(`  • Tx Hash:           ${proposeTx.hash}`);
  console.log(`  • Block Number:      ${proposeReceipt?.blockNumber}`);
  logEvents(domainGuard, proposeReceipt);

  const reqCount = await domainGuard.requestCount();
  const reqId = reqCount;
  console.log(`  -> Created Request ID: #${reqId}\n`);

  // Step 2: Alex attempts to self-approve his own proposal
  console.log("STEP 2: Alex attempts to approve his own transfer proposal");
  try {
    const tx = await domainGuard.connect(alex).approve(reqId);
    await tx.wait();
    console.log("  [FAIL] Alex was able to approve! Security policy violated!");
  } catch (err: any) {
    const reason = parseRevertReason(domainGuard, err);
    console.log(`  • Result: REVERTED with ${reason}`);
    console.log("  • Security Guarantee: Proposer self-approval strictly forbidden by contract logic.");
  }
  console.log("");

  // Step 3: Alex attempts to execute immediately without approvals or timelock
  console.log("STEP 3: Alex attempts to execute the transfer immediately");
  try {
    const tx = await domainGuard.connect(alex).execute(reqId);
    await tx.wait();
    console.log("  [FAIL] Alex was able to execute! Security policy violated!");
  } catch (err: any) {
    const reason = parseRevertReason(domainGuard, err);
    console.log(`  • Result: REVERTED with ${reason}`);
    console.log("  • Security Guarantee: execute() requires status == Approved (quorum met + timelock elapsed).");
  }
  console.log("");

  // Step 4: Alex convinces 1 guardian (Elena) to approve, then tries to execute again
  console.log("STEP 4: Elena (single colluding guardian) approves request");
  const elenaTx = await domainGuard.connect(elena).approve(reqId);
  const elenaReceipt = await elenaTx.wait();
  console.log(`  • Tx Hash:           ${elenaTx.hash}`);
  console.log(`  • Block Number:      ${elenaReceipt?.blockNumber}`);
  logEvents(domainGuard, elenaReceipt);

  console.log("\nSTEP 5: Alex attempts to execute with only 1 guardian approval (policy requires 3 + owner)");
  try {
    const tx = await domainGuard.connect(alex).execute(reqId);
    await tx.wait();
    console.log("  [FAIL] Executed without quorum!");
  } catch (err: any) {
    const reason = parseRevertReason(domainGuard, err);
    console.log(`  • Result: REVERTED with ${reason}`);
    console.log("  • Security Guarantee: Transfer requires 3 guardian approvals AND domain owner countersignature.");
  }
  console.log("");

  // Step 6: Verify domain owner is unchanged on chain
  console.log("STEP 6: Final on-chain state verification");
  const currentDomain = await domainGuard.getDomain(domainId);
  console.log(`  Current Owner on-chain: ${currentDomain.owner}`);
  console.log(`  Initial Owner:          ${initialDomain.owner}`);

  if (currentDomain.owner === initialDomain.owner) {
    console.log("\n===============================================================================");
    console.log(">>> VERIFICATION: Domain owner on-chain is " + currentDomain.owner);
    console.log(">>> owner unchanged");
    console.log("===============================================================================");
  } else {
    throw new Error("CRITICAL FAILURE: Owner was changed during attack!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
