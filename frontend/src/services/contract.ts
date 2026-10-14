import { ethers, Interface } from 'ethers';
import { CHAIN_CONFIG } from '../config/chain';

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

export function parseContractError(err: any): string {
  if (!err) return 'An unknown error occurred.';

  // Check data from contract revert
  const data = err.data || err.error?.data || err.info?.error?.data || err.receipt?.data;
  let errorName = '';

  if (typeof data === 'string') {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        errorName = parsed.name;
      }
    } catch {
      // Could not parse raw selector
    }
  }

  // Fallback to error message string matching
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
    const msg = err.message || '';
    for (const name of knownErrors) {
      if (msg.includes(name)) {
        errorName = name;
        break;
      }
    }
  }

  switch (errorName) {
    case 'SelfApprovalForbidden':
      return 'Action blocked: The request proposer is strictly forbidden from approving their own request.';
    case 'QuorumNotReached':
      return 'Execution rejected: The required approvals or countersignatures have not been reached, or the request was vetoed.';
    case 'TimelockActive':
      return 'Timelock active: The mandatory security delay has not elapsed yet. Execution must wait until countdown completes.';
    case 'NotAuthorized':
      return 'Access denied: The active wallet address is not authorized for this operation.';
    case 'NotAdmin':
      return 'Access denied: Only registrar administrators can perform this action.';
    case 'NotGuardian':
      return 'Access denied: Only designated security guardians can perform this action.';
    case 'DomainFrozenError':
      return 'Domain frozen: Operations on this domain are locked. Only emergency recovery or unfreeze proposals are permitted.';
    case 'StaleRequest':
      return 'Request invalidated: The domain state or nonce changed after proposal. A new request must be proposed.';
    case 'RequestExpiredError':
      return 'Request expired: The operation exceeded its active lifetime window and can no longer be processed.';
    case 'NotExpired':
      return 'Action rejected: The request has not exceeded its expiration window yet.';
    case 'DomainExists':
      return 'Registration rejected: A domain with this identifier has already been registered.';
    case 'DomainNotFound':
      return 'Domain not found: No record matching this domain hash exists on the contract.';
    case 'AlreadyVoted':
      return 'Duplicate vote: This address has already voted on this request.';
    case 'InvalidRequest':
      return 'Invalid parameters: The proposal arguments failed contract policy validation.';
    case 'InvalidStatus':
      return 'Invalid state: The request is not in the appropriate state for this operation.';
    default:
      if (err.reason) return err.reason;
      if (err.shortMessage) return err.shortMessage;
      return 'Transaction failed: The transaction reverted on-chain.';
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
