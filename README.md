# ChainTrust – DomainGuard

> **BlockHack PS-08 "The Rogue Admin"** — A decentralised multi-party authorisation system for critical domain-registrar operations.

## What is DomainGuard?

DomainGuard is a smart-contract-enforced authorisation layer for sensitive domain registry operations: ownership transfer, DNS record updates, key recovery, emergency freeze, and guardian replacement. **No single participant can unilaterally perform any critical operation.** The contract is the sole authority over domain state; there is no admin override, no backdoor, and no central kill-switch.

The system is designed to defeat the "rogue admin" threat model: even a legitimate registrar employee with full system access cannot transfer a domain they don't own, because the smart contract enforces a quorum of independent guardians plus the domain owner before any state change is executed on-chain.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design and [`docs/DEFENSE.md`](docs/DEFENSE.md) for the 5-minute architecture defence.

---

## Prerequisites

| Tool | Required Version |
|------|-----------------|
| Node.js | ≥ 18 (tested on v24.13.1) |
| npm | ≥ 9 (tested on 11.8.0) |
| Git | Any recent version |

---

## Install

```bash
# Clone / enter the workspace
cd chaintrust

# Install root (Hardhat) dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install
```

---

## Run Commands

| Command | What it does |
|---------|-------------|
| `npm run compile` | Compile Solidity contracts with Hardhat |
| `npm test` | Run Hardhat test suite |
| `npm run node` | Start local Hardhat node on `127.0.0.1:8545` (chain ID 31337) |
| `npm run frontend` | Start Vite dev server for the React frontend |
| `npm run frontend:build` | Build the frontend for production |

---

## Verify the Scaffold

```bash
npx hardhat compile       # "Compiled 0 Solidity files" — OK at Stage 1
npx hardhat test          # No tests — exit 0
npm run frontend:build    # Vite build succeeds
npm run node              # Hardhat node starts on 127.0.0.1:8545 with 20 accounts
```

---

## Project Structure

```
chaintrust/
├── contracts/            # Solidity smart contracts (populated Stage 2)
├── test/                 # Hardhat tests (populated Stage 3)
├── scripts/              # Deploy & interaction scripts (populated Stage 4)
├── frontend/             # Vite + React + TypeScript + ethers@6 (populated Stage 5)
├── docs/
│   ├── ARCHITECTURE.md   # Full system design (Stage 1)
│   └── DEFENSE.md        # 5-minute architecture defence (Stage 1)
├── hardhat.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Stage Checklist

- [x] **Stage 1** — Project inspection, scaffold, and design lock (ARCHITECTURE.md + DEFENSE.md)
- [x] **Stage 2** — Core DomainGuard Solidity contract + full test suite (69 tests, 95.57% line coverage)
- [ ] **Stage 3** — Full Hardhat test suite (all 4 demo scenarios, reverts, edge cases)
- [ ] **Stage 4** — Deploy & demo scripts
- [ ] **Stage 5** — React frontend: proposal board and approval panel
- [ ] **Stage 6** — End-to-end demo run (all 4 scenarios, captured output)
- [ ] **Stage 7** — Polish: error messages, frontend UX, README demo walkthrough
- [ ] **Stage 8** — Final review and presentation prep

---

## Chain Configuration

| Parameter | Value |
|-----------|-------|
| Network | `localhost` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Solidity | `0.8.24` (evmVersion: `paris`) |
| Ethers | `v6` |

---

## Honest Limitations

This project runs on a **single local Hardhat node** (development environment only). All guardian "organisations" are represented by deterministic Hardhat test accounts on the same node. Time control via `evm_increaseTime`/`evm_mine` is a local-dev-chain feature. See [`docs/ARCHITECTURE.md §3.9`](docs/ARCHITECTURE.md) and [`docs/DEFENSE.md §7`](docs/DEFENSE.md) for the full REAL vs MOCK table and production caveats.
