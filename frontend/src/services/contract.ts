import { ethers, Interface, Contract } from 'ethers';
import { CHAIN_CONFIG, OP_NAMES, STATUS_NAMES } from '../config/chain';

const iface = new Interface(CHAIN_CONFIG.abi);

export interface DecodedEvent {
  name: string;
  args: Record<string, string>;
}

export interface TxReceiptSummary {
  txHash: string;
  blockNumber: number;
  events: DecodedEvent[];
}

export interface DomainRecord {
  name: string;
  domainId: string;
  owner: string;
  dnsRecordHash: string;
  frozen: boolean;
  nonce: number;
  exists: boolean;
}

export interface RequestRecord {
  id: number;
  domainId: string;
  domainName: string;
  op: number;
  opName: string;
  proposer: string;
  target: string;
  oldKey: string;
  newDnsHash: string;
  domainNonce: number;
  createdAt: number;
  eta: number;
  status: number;
  statusName: string;
  ownerApproved: boolean;
  guardianApprovals: number;
  guardianRejections: number;
  rejectionsNeeded?: number;
  hasVoted?: boolean;
  ownerRequired?: boolean;
  guardianThreshold?: number;
  domainOwner?: string;
}

export interface PolicyRecord {
  ownerRequired: boolean;
  guardianThreshold: number;
  delay: number;
}

export interface ActivityEvent {
  name: string;
  txHash: string;
  blockNumber: number;
  args: Record<string, string>;
}

export function parseContractError(err: any): string {
  if (!err) return 'An unknown error occurred.';

  // If already a processed string
  if (typeof err === 'string') return err;

  // Handle user wallet rejection / cancellation
  if (
    err.code === 'ACTION_REJECTED' ||
    err.code === 4001 ||
    err.info?.error?.code === 4001 ||
    err.message?.includes('user rejected') ||
    err.message?.includes('User rejected') ||
    err.message?.includes('User denied')
  ) {
    return 'Transaction was cancelled in wallet by user.';
  }

  // Handle RPC / network connectivity errors
  if (
    err.code === 'NETWORK_ERROR' ||
    err.message?.includes('could not detect network') ||
    err.message?.includes('Failed to fetch') ||
    err.message?.includes('ERR_CONNECTION_REFUSED')
  ) {
    return `Network Connection Error: Could not communicate with Ethereum RPC (${CHAIN_CONFIG.rpcUrl}). Verify local node is running (npm run node) or check network configuration.`;
  }

  if (err.message && (err.message.includes('SelfApprovalForbidden') || err.message.includes('Action blocked:') || err.message.includes('Access denied:'))) {
    if (!err.data && !err.revert) return err.message;
  }

  // 1. Direct Ethers v6 decoded revert name
  let errorName = err.revert?.name || '';

  // 2. Decode raw selector from contract revert data
  if (!errorName) {
    const data = err.data || err.error?.data || err.info?.error?.data || err.receipt?.data;
    if (typeof data === 'string' && data.startsWith('0x')) {
      try {
        const parsed = iface.parseError(data);
        if (parsed) {
          errorName = parsed.name;
        }
      } catch {
        // Could not parse raw selector
      }
    }
  }

  // 3. Fallback to error message string matching
  if (!errorName) {
    const knownErrors = [
      'SelfApprovalForbidden',
      'QuorumNotReached',
      'TimelockActive',
      'NotAuthorized',
      'NotAdmin',
      'NotGuardian',
      'DomainFrozenError',
      'StaleRequest',
      'RequestExpiredError',
      'NotExpired',
      'DomainExists',
      'DomainNotFound',
      'ZeroAddress',
      'ZeroHash',
      'AlreadyVoted',
      'InvalidRequest',
      'InvalidStatus',
      'InvalidConstructorArgs',
    ];
    const msg = `${err.message || ''} ${err.shortMessage || ''} ${JSON.stringify(err.info || {})}`;
    for (const name of knownErrors) {
      if (msg.includes(name)) {
        errorName = name;
        break;
      }
    }
  }

  switch (errorName) {
    case 'SelfApprovalForbidden':
      return 'SelfApprovalForbidden: The request proposer is strictly forbidden by smart contract rules from approving or rejecting their own request.';
    case 'QuorumNotReached':
      return 'QuorumNotReached: The required approvals or countersignatures have not been reached, or the request was vetoed.';
    case 'TimelockActive':
      return 'TimelockActive: The mandatory security delay has not elapsed yet. Execution must wait until countdown completes.';
    case 'NotAuthorized':
      return 'NotAuthorized: Connected account is not authorized. Only designated guardians or the domain owner can vote on this request.';
    case 'NotAdmin':
      return 'NotAdmin: Access denied. Only registrar administrators can perform this action.';
    case 'NotGuardian':
      return 'NotGuardian: Access denied. Only designated security guardians can perform this action.';
    case 'DomainFrozenError':
      return 'DomainFrozenError: Domain operations are locked due to an emergency freeze.';
    case 'StaleRequest':
      return 'StaleRequest: Domain nonce has changed. This request is invalidated on-chain.';
    case 'RequestExpiredError':
      return 'RequestExpiredError: Request exceeded its active lifetime window (TTL) and can no longer be executed.';
    case 'NotExpired':
      return 'NotExpired: The request has not exceeded its expiration window yet.';
    case 'DomainExists':
      return 'DomainExists: A domain with this identifier has already been registered.';
    case 'DomainNotFound':
      return 'DomainNotFound: No record matching this domain hash exists on the contract.';
    case 'AlreadyVoted':
      return 'AlreadyVoted: Connected address has already cast a vote (approval or rejection) on this request.';
    case 'InvalidRequest':
      return 'InvalidRequest: Proposal parameters failed contract policy validation.';
    case 'InvalidStatus':
      return 'InvalidStatus: The request is not in the appropriate lifecycle state for this operation.';
    default:
      if (err.reason) return err.reason;
      if (err.shortMessage) return err.shortMessage;
      return err.message || 'Transaction failed: The transaction reverted on-chain.';
  }
}

export function parseReceiptEvents(receipt: ethers.TransactionReceipt | null): DecodedEvent[] {
  if (!receipt) return [];
  const events: DecodedEvent[] = [];

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed) {
        const cleanArgs: Record<string, string> = {};
        const rawArgs = parsed.args.toObject ? parsed.args.toObject() : parsed.args;
        for (const [key, val] of Object.entries(rawArgs)) {
          if (isNaN(Number(key))) {
            cleanArgs[key] = String(val);
          }
        }
        events.push({
          name: parsed.name,
          args: cleanArgs,
        });
      }
    } catch {
      // Skip non-contract or unparsed logs
    }
  }

  return events;
}

export function getDomainId(name: string): string {
  const normalized = name.trim().toLowerCase();
  return ethers.id(normalized);
}

export async function fetchAllDomains(contract: Contract): Promise<DomainRecord[]> {
  const domains: DomainRecord[] = [];
  for (const [name, meta] of Object.entries(CHAIN_CONFIG.domains)) {
    try {
      const d = await contract.getDomain(meta.domainId);
      if (d && d.exists) {
        domains.push({
          name,
          domainId: meta.domainId,
          owner: d.owner,
          dnsRecordHash: d.dnsRecordHash,
          frozen: Boolean(d.frozen),
          nonce: Number(d.nonce),
          exists: Boolean(d.exists),
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch domain ${name}:`, err);
    }
  }
  return domains;
}

export async function fetchAllRequests(contract: Contract, userAddress?: string | null): Promise<RequestRecord[]> {
  const count = await contract.requestCount();
  const total = Number(count);
  const requests: RequestRecord[] = [];

  for (let i = 1; i <= total; i++) {
    try {
      const req = await contract.getRequest(i);
      if (!req || Number(req.status) === 0) continue;

      let hasVoted = false;
      if (userAddress) {
        try {
          hasVoted = await contract.hasVoted(i, userAddress);
        } catch {}
      }

      // Resolve domain name
      let domainName = 'Global (Guardian Set)';
      if (req.domainId !== ethers.ZeroHash) {
        for (const [dName, dMeta] of Object.entries(CHAIN_CONFIG.domains)) {
          if (dMeta.domainId.toLowerCase() === req.domainId.toLowerCase()) {
            domainName = dName;
            break;
          }
        }
        if (domainName.startsWith('Global')) {
          domainName = `${req.domainId.slice(0, 10)}...`;
        }
      }

      const opNum = Number(req.op);
      const statusNum = Number(req.status);

      let ownerRequired = false;
      let guardianThreshold = 3;
      try {
        const pol = await contract.policy(opNum);
        ownerRequired = Boolean(pol[0]);
        guardianThreshold = Number(pol[1]);
      } catch {}

      let domainOwner = '';
      if (req.domainId !== ethers.ZeroHash) {
        try {
          const d = await contract.getDomain(req.domainId);
          if (d && d.exists) {
            domainOwner = d.owner;
          }
        } catch {}
      }

      let eligibleGuardians = 5;
      try {
        const isPropGuardian = await contract.isGuardian(req.proposer);
        if (isPropGuardian) eligibleGuardians -= 1;
        if (opNum === 2 && req.oldKey && req.oldKey !== ethers.ZeroAddress && req.oldKey.toLowerCase() !== req.proposer.toLowerCase()) {
          const isOldGuardian = await contract.isGuardian(req.oldKey);
          if (isOldGuardian) eligibleGuardians -= 1;
        }
      } catch {}
      const rejectionsNeeded = Math.max(1, eligibleGuardians - guardianThreshold + 1);

      requests.push({
        id: i,
        domainId: req.domainId,
        domainName,
        op: opNum,
        opName: OP_NAMES[opNum] || `Op #${opNum}`,
        proposer: req.proposer,
        target: req.target,
        oldKey: req.oldKey,
        newDnsHash: req.newDnsHash,
        domainNonce: Number(req.domainNonce),
        createdAt: Number(req.createdAt),
        eta: Number(req.eta),
        status: statusNum,
        statusName: STATUS_NAMES[statusNum] || `Status #${statusNum}`,
        ownerApproved: Boolean(req.ownerApproved),
        guardianApprovals: Number(req.guardianApprovals),
        guardianRejections: Number(req.guardianRejections),
        rejectionsNeeded,
        hasVoted,
        ownerRequired,
        guardianThreshold,
        domainOwner,
      });
    } catch (err) {
      console.warn(`Failed to fetch request #${i}:`, err);
    }
  }

  // Reverse so newest request is first
  return requests.reverse();
}

export async function fetchGuardiansList(contract: Contract): Promise<string[]> {
  try {
    return await contract.getGuardians();
  } catch (err) {
    console.error('Failed to fetch guardians:', err);
    return [];
  }
}

export async function fetchPolicyForOp(contract: Contract, op: number): Promise<PolicyRecord> {
  const p = await contract.policy(op);
  return {
    ownerRequired: Boolean(p[0]),
    guardianThreshold: Number(p[1]),
    delay: Number(p[2]),
  };
}

export async function skipTimelockOnLocal(seconds: number): Promise<void> {
  const provider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine', []);
}

export async function fetchActivityTimeline(contract: Contract, fromBlock = 0): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];
  const eventNames = [
    'DomainRegistered',
    'RequestProposed',
    'RequestApproved',
    'RequestRejected',
    'RequestQueued',
    'RequestVetoed',
    'RequestExecuted',
    'RequestExpired',
    'DomainFrozen',
    'DomainUnfrozen',
    'GuardianReplaced',
    'OwnerRecovered',
  ];

  for (const name of eventNames) {
    try {
      const filter = contract.filters[name]();
      const logs = await contract.queryFilter(filter, fromBlock);
      for (const log of logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed) {
            const cleanArgs: Record<string, string> = {};
            const rawArgs = parsed.args.toObject ? parsed.args.toObject() : parsed.args;
            for (const [key, val] of Object.entries(rawArgs)) {
              if (isNaN(Number(key))) {
                cleanArgs[key] = String(val);
              }
            }
            events.push({
              name: parsed.name,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              args: cleanArgs,
            });
          }
        } catch {}
      }
    } catch (err) {
      console.warn(`Query filter failed for ${name}:`, err);
    }
  }

  // Sort by blockNumber desc
  return events.sort((a, b) => b.blockNumber - a.blockNumber);
}
