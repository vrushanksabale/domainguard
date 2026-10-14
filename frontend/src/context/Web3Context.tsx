import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Contract, JsonRpcProvider, BrowserProvider } from 'ethers';
import { CHAIN_CONFIG, type NamedAccount } from '../config/chain';
import type { TxReceiptSummary } from '../services/contract';

interface Stats {
  latestBlock: number;
  pendingCount: number;
  blockedAttacksCount: number;
  protectedCount: number;
}

interface Web3ContextType {
  chainId: number | null;
  targetChainId: number;
  account: string | null;
  activeRole: string;
  isLocalDev: boolean;
  rpcUnreachable: boolean;
  isConnecting: boolean;
  stats: Stats;
  receiptSummary: TxReceiptSummary | null;
  setReceiptSummary: (summary: TxReceiptSummary | null) => void;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
  toastType: 'success' | 'error' | 'info';
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  connectMetaMask: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  selectNamedAccount: (key: string) => Promise<void>;
  namedAccounts: Record<string, NamedAccount>;
  getWriteContract: () => Promise<Contract>;
  readContract: Contract | null;
  refreshStats: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chainId, setChainId] = useState<number | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string>('Visitor');
  const [rpcUnreachable, setRpcUnreachable] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [readContract, setReadContract] = useState<Contract | null>(null);
  const [receiptSummary, setReceiptSummary] = useState<TxReceiptSummary | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const [stats, setStats] = useState<Stats>({
    latestBlock: 0,
    pendingCount: 0,
    blockedAttacksCount: 3, // Initialized with known blocked verification attempts
    protectedCount: Object.keys(CHAIN_CONFIG.domains).length,
  });

  const targetChainId = CHAIN_CONFIG.chainId;
  const isLocalDev = targetChainId === 31337;

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  // Initialize Read Provider & Read Contract
  const initProvider = useCallback(async () => {
    try {
      const rpcProvider = new JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const network = await rpcProvider.getNetwork();
      const currentChainId = Number(network.chainId);
      setChainId(currentChainId);
      setRpcUnreachable(false);

      const contract = new Contract(
        CHAIN_CONFIG.contractAddress,
        CHAIN_CONFIG.abi,
        rpcProvider
      );
      setReadContract(contract);

      // Default to Alex (Admin) if local dev
      if (currentChainId === 31337 && !account) {
        const alex = CHAIN_CONFIG.namedAccounts.alex;
        if (alex) {
          setAccount(alex.address);
          setActiveRole('Admin (Alex)');
        }
      }

      // Fetch initial block
      const blockNum = await rpcProvider.getBlockNumber();
      setStats((prev) => ({ ...prev, latestBlock: blockNum }));
    } catch {
      setRpcUnreachable(true);
    }
  }, [account]);

  useEffect(() => {
    initProvider();
  }, [initProvider]);

  // Refresh live stats
  const refreshStats = useCallback(async () => {
    if (!readContract) return;
    try {
      const rpcProvider = new JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const blockNum = await rpcProvider.getBlockNumber();

      // Query request count
      const reqCount = await readContract.requestCount();
      let pending = 0;
      for (let i = 1; i <= Number(reqCount); i++) {
        try {
          const req = await readContract.getRequest(i);
          if (Number(req.status) === 1) {
            pending++;
          }
        } catch {}
      }

      setStats((prev) => ({
        ...prev,
        latestBlock: blockNum,
        pendingCount: pending,
        protectedCount: Object.keys(CHAIN_CONFIG.domains).length,
      }));
    } catch {}
  }, [readContract]);

  useEffect(() => {
    if (readContract) {
      refreshStats();
      const interval = setInterval(refreshStats, 8000);
      return () => clearInterval(interval);
    }
  }, [readContract, refreshStats]);

  // Select a local dev named account (unlocked JSON-RPC signer)
  const selectNamedAccount = async (key: string) => {
    if (!isLocalDev) return;
    const target = CHAIN_CONFIG.namedAccounts[key];
    if (!target) return;

    setAccount(target.address);
    setActiveRole(`${target.role} (${target.name})`);
    showToast(`Switched active wallet to ${target.name} (${target.role})`, 'info');
  };

  // MetaMask wallet connection
  const connectMetaMask = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      showToast('MetaMask is not installed. Please install MetaMask or use local signers.', 'error');
      return;
    }
    setIsConnecting(true);
    try {
      const browserProvider = new BrowserProvider((window as any).ethereum);
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const network = await browserProvider.getNetwork();
      const currentChainId = Number(network.chainId);
      setChainId(currentChainId);

      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      // Check role
      let role = 'External User';
      for (const item of Object.values(CHAIN_CONFIG.namedAccounts)) {
        if (item.address.toLowerCase() === address.toLowerCase()) {
          role = `${item.role} (${item.name})`;
          break;
        }
      }
      setActiveRole(role);

      if (currentChainId !== targetChainId) {
        showToast(`Connected to chain ${currentChainId}. Expected ${targetChainId}. Please switch network.`, 'error');
      } else {
        showToast(`Connected with ${address.slice(0, 6)}...${address.slice(-4)}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to connect MetaMask', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch network prompt
  const switchNetwork = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const hexChainId = '0x' + targetChainId.toString(16);
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      setChainId(targetChainId);
    } catch (switchError: any) {
      // Chain not added
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: 'DomainGuard Local Network',
                rpcUrls: [CHAIN_CONFIG.rpcUrl],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              },
            ],
          });
        } catch (addError: any) {
          showToast('Failed to add local chain to MetaMask', 'error');
        }
      }
    }
  };

  // Get write contract bound to active signer (MetaMask or local unlocked node signer)
  const getWriteContract = async (): Promise<Contract> => {
    if (!account) {
      throw new Error('No active wallet account selected. Please select a role or connect wallet.');
    }

    if (isLocalDev) {
      // Use node's unlocked account via jsonRpcProvider
      const rpcProvider = new JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const signer = await rpcProvider.getSigner(account);
      return new Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, signer);
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const browserProvider = new BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      return new Contract(CHAIN_CONFIG.contractAddress, CHAIN_CONFIG.abi, signer);
    }

    throw new Error('No compatible Web3 provider found.');
  };

  return (
    <Web3Context.Provider
      value={{
        chainId,
        targetChainId,
        account,
        activeRole,
        isLocalDev,
        rpcUnreachable,
        isConnecting,
        stats,
        receiptSummary,
        setReceiptSummary,
        toastMessage,
        setToastMessage,
        toastType,
        showToast,
        connectMetaMask,
        switchNetwork,
        selectNamedAccount,
        namedAccounts: CHAIN_CONFIG.namedAccounts,
        getWriteContract,
        readContract,
        refreshStats,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};
