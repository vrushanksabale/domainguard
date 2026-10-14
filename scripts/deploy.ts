import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  DEPLOYMENT_PATH,
  FRONTEND_ABI_PATH,
  FRONTEND_DEPLOYMENT_PATH,
  logEvents,
} from "./helpers";

async function main() {
  console.log("===============================================================================");
  console.log("  DomainGuard – Local Deployment & Configuration (BlockHack PS-08)");
  console.log("===============================================================================\n");

  const signers = await ethers.getSigners();
  const [
    alex,     // Admin / Deployer (Account #0)
    priya,    // Guardian 1 (Account #1)
    rahul,    // Guardian 2 (Account #2)
    maya,     // Guardian 3 (Account #3)
    marcus,   // Guardian 4 (Account #4)
    elena,    // Guardian 5 (Account #5)
    owner,    // Domain Owner Sarah (Account #6)
    victor,   // Key Replacement Guardian (Account #7)
    newOwner, // Legitimate New Domain Owner Alice (Account #8)
  ] = signers;

  console.log("Named Hardhat Accounts:");
  console.log(`  • Alex (Admin & Deployer):          ${alex.address}`);
  console.log(`  • Priya (Guardian 1):               ${priya.address}`);
  console.log(`  • Rahul (Guardian 2):               ${rahul.address}`);
  console.log(`  • Maya (Guardian 3):                ${maya.address}`);
  console.log(`  • Marcus (Guardian 4):              ${marcus.address}`);
  console.log(`  • Elena (Guardian 5):               ${elena.address}`);
  console.log(`  • Sarah (Domain Owner):             ${owner.address}`);
  console.log(`  • Victor (Replacement Guardian):    ${victor.address}`);
  console.log(`  • Alice (Legit New Domain Owner):   ${newOwner.address}`);
  console.log("");

  const admins = [alex.address];
  const guardians = [
    priya.address,
    rahul.address,
    maya.address,
    marcus.address,
    elena.address,
  ];

  // Delays for local development demo
  const dnsDelay = 60;        // 60 seconds
  const transferDelay = 120;  // 120 seconds
  const keyDelay = 120;       // 120 seconds
  const recoveryDelay = 180;  // 180 seconds

  console.log("1. Deploying DomainGuard contract...");
  const DomainGuardFactory = await ethers.getContractFactory("DomainGuard", alex);
  const domainGuard = await DomainGuardFactory.deploy(
    admins,
    guardians,
    dnsDelay,
    transferDelay,
    keyDelay,
    recoveryDelay
  );

  const deploymentTx = domainGuard.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found");
  }

  const deployReceipt = await deploymentTx.wait();
  if (!deployReceipt) {
    throw new Error("Deployment receipt not found");
  }

  const contractAddress = await domainGuard.getAddress();
  const deploymentBlock = deployReceipt.blockNumber;

  console.log(`   Contract Address:  ${contractAddress}`);
  console.log(`   Deployer:          ${alex.address}`);
  console.log(`   Deployment Tx:     ${deploymentTx.hash}`);
  console.log(`   Block Number:      ${deploymentBlock}`);
  console.log("   Status:            Deployed successfully\n");

  // Register 3 demo domains
  console.log("2. Registering demo domains under DomainGuard governance...");
  const demoDomainNames = [
    "mybank.example",
    "harborline.example",
    "ledgerworks.example",
  ];

  const registeredDomains: Record<
    string,
    { name: string; domainId: string; owner: string; dnsRecordHash: string; txHash: string; blockNumber: number }
  > = {};

  for (const name of demoDomainNames) {
    const domainId = ethers.keccak256(ethers.toUtf8Bytes(name));
    const dnsRecordHash = ethers.keccak256(
      ethers.toUtf8Bytes(`v=spf1 include:${name} ~all`)
    );

    console.log(`   Registering "${name}" (Owner: ${owner.address})...`);
    const regTx = await domainGuard
      .connect(alex)
      .registerDomain(domainId, owner.address, dnsRecordHash);
    const regReceipt = await regTx.wait();

    console.log(`     • Domain ID:      ${domainId}`);
    console.log(`     • Tx Hash:        ${regTx.hash}`);
    console.log(`     • Block Number:   ${regReceipt?.blockNumber}`);
    logEvents(domainGuard, regReceipt);

    registeredDomains[name] = {
      name,
      domainId,
      owner: owner.address,
      dnsRecordHash,
      txHash: regTx.hash,
      blockNumber: regReceipt?.blockNumber ?? 0,
    };
  }
  console.log("");

  // Export for the frontend & local scripts
  console.log("3. Exporting deployment artifact and ABI for frontend and scripts...");
  const deploymentData = {
    chainId: 31337,
    address: contractAddress,
    deployer: alex.address,
    deploymentBlock,
    transactionHash: deploymentTx.hash,
    delays: {
      dnsDelay,
      transferDelay,
      keyDelay,
      recoveryDelay,
    },
    namedAccounts: {
      alex: { name: "Alex", role: "Admin", address: alex.address },
      priya: { name: "Priya", role: "Guardian 1", address: priya.address },
      rahul: { name: "Rahul", role: "Guardian 2", address: rahul.address },
      maya: { name: "Maya", role: "Guardian 3", address: maya.address },
      marcus: { name: "Marcus", role: "Guardian 4", address: marcus.address },
      elena: { name: "Elena", role: "Guardian 5", address: elena.address },
      owner: { name: "Sarah", role: "Domain Owner", address: owner.address },
      victor: { name: "Victor", role: "New Guardian Key", address: victor.address },
      newOwner: { name: "Alice", role: "Legit New Domain Owner", address: newOwner.address },
    },
    domains: registeredDomains,
  };

  const deploymentsDir = path.dirname(DEPLOYMENT_PATH);
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(DEPLOYMENT_PATH, JSON.stringify(deploymentData, null, 2));
  console.log(`   Wrote ${DEPLOYMENT_PATH}`);

  // Copy ABI from hardhat artifacts
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "DomainGuard.sol",
    "DomainGuard.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact file not found at ${artifactPath}. Run 'npm run compile' first.`);
  }
  const artifactJson = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  const frontendContractsDir = path.dirname(FRONTEND_ABI_PATH);
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }
  fs.writeFileSync(FRONTEND_ABI_PATH, JSON.stringify(artifactJson, null, 2));
  console.log(`   Wrote ${FRONTEND_ABI_PATH}`);

  fs.writeFileSync(FRONTEND_DEPLOYMENT_PATH, JSON.stringify(deploymentData, null, 2));
  console.log(`   Wrote ${FRONTEND_DEPLOYMENT_PATH}`);

  console.log("\n===============================================================================");
  console.log("  Deployment complete! Local environment ready for demo scenarios.");
  console.log("===============================================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
