import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

export const Op = {
  TRANSFER_OWNERSHIP: 0,
  DNS_UPDATE: 1,
  KEY_REPLACEMENT: 2,
  RECOVERY: 3,
  UNFREEZE: 4,
} as const;

export const Status = [
  "None",
  "Pending",
  "Approved",
  "Executed",
  "Rejected",
  "Vetoed",
  "Expired",
];

export const OpNames = [
  "TRANSFER_OWNERSHIP",
  "DNS_UPDATE",
  "KEY_REPLACEMENT",
  "RECOVERY",
  "UNFREEZE",
];

export const DEPLOYMENT_PATH = path.join(__dirname, "..", "deployments", "localhost.json");
export const FRONTEND_ABI_PATH = path.join(__dirname, "..", "frontend", "src", "contracts", "DomainGuard.json");
export const FRONTEND_DEPLOYMENT_PATH = path.join(__dirname, "..", "frontend", "src", "contracts", "localhost.json");

export function getDeployment() {
  if (!fs.existsSync(DEPLOYMENT_PATH)) {
    throw new Error(
      `Deployment file not found at ${DEPLOYMENT_PATH}. Please run 'npm run deploy:local' first.`
    );
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf-8"));
}

export async function advanceTime(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

export function logEvents(contract: any, receipt: any) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed) {
        console.log(`      • Decoded Event: [${parsed.name}]`);
        const argsObj = parsed.args.toObject ? parsed.args.toObject() : parsed.args;
        for (const [key, val] of Object.entries(argsObj)) {
          if (isNaN(Number(key))) {
            console.log(`        - ${key}: ${val}`);
          }
        }
      }
    } catch {
      // Ignored for non-contract logs
    }
  }
}

export function parseRevertReason(contract: any, err: any): string {
  const data = err.data || err.error?.data || err.info?.error?.data || err.receipt?.data;
  if (data && typeof data === "string") {
    try {
      const parsed = contract.interface.parseError(data);
      if (parsed) {
        return `${parsed.name}()`;
      }
    } catch {}
  }
  const knownErrors = [
    "NotAdmin", "NotGuardian", "NotAuthorized", "SelfApprovalForbidden",
    "AlreadyVoted", "QuorumNotReached", "TimelockActive", "RequestExpiredError",
    "NotExpired", "StaleRequest", "DomainFrozenError", "DomainNotFound",
    "DomainExists", "ZeroAddress", "ZeroHash", "InvalidRequest",
    "InvalidStatus", "InvalidConstructorArgs"
  ];
  const fullMsg = err.message || "";
  for (const name of knownErrors) {
    if (fullMsg.includes(name)) {
      return `${name}()`;
    }
  }
  return err.reason || err.shortMessage || err.message || "Unknown error";
}
