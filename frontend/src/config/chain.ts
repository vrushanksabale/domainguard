import deploymentData from '../contracts/localhost.json';
import domainGuardArtifact from '../contracts/DomainGuard.json';

export interface NamedAccount {
  name: string;
  role: string;
  address: string;
}

export interface DomainMetadata {
  name: string;
  domainId: string;
  owner: string;
  dnsRecordHash: string;
}

export const CHAIN_CONFIG = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID) || deploymentData.chainId || 31337,
  rpcUrl: import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545',
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || deploymentData.address,
  deploymentBlock: deploymentData.deploymentBlock || 0,
  delays: deploymentData.delays || {
    dnsDelay: 60,
    transferDelay: 120,
    keyDelay: 120,
    recoveryDelay: 180,
  },
  namedAccounts: (deploymentData.namedAccounts || {}) as Record<string, NamedAccount>,
  domains: (deploymentData.domains || {}) as Record<string, DomainMetadata>,
  abi: domainGuardArtifact.abi,
};

export const OP_TYPES = {
  TRANSFER_OWNERSHIP: 0,
  DNS_UPDATE: 1,
  KEY_REPLACEMENT: 2,
  RECOVERY: 3,
  UNFREEZE: 4,
} as const;

export const OP_NAMES = [
  'Transfer Ownership',
  'DNS Record Update',
  'Guardian Key Replacement',
  'Owner Recovery',
  'Unfreeze Domain',
];

export const STATUS_NAMES = [
  'None',
  'Pending',
  'Approved',
  'Executed',
  'Rejected',
  'Vetoed',
  'Expired',
];
