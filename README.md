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
| `npm test` | Run Hardhat test suite (all 69 tests pass) |
| `npm run node` | Start local Hardhat node on `127.0.0.1:8545` (chain ID 31337) |
| `npm run deploy:local` | Deploy DomainGuard contract & register 3 demo domains on localhost |
| `npm run demo:attack` | Run Hour-4 Rogue Admin Attack demo script |
| `npm run demo:collusion` | Run Collusion + Guardian Veto & Legitimate Transfer demo script |
| `npm run demo:keyloss` | Run Judging-time Guardian Key Loss Recovery demo script |
| `npm run demo:all` | Run all 3 demo scenarios in succession |
| `npm run frontend` | Start Vite dev server for the React frontend |
| `npm run frontend:build` | Build the frontend for production |

---

## Local Node & Demo Execution (Windows PowerShell)

Open PowerShell in the project directory `C:\Projects\chaintrust`:

### 1. Start the Local Hardhat Node (Terminal 1)
```powershell
npm run node
```
This runs `hardhat node` and binds to `http://127.0.0.1:8545` on Chain ID `31337`, providing 20 pre-funded test accounts. Keep this terminal running.

### 2. Deploy Contracts & Register Demo Domains (Terminal 2)
```powershell
npm run deploy:local
```
This deploys `DomainGuard` with named accounts (Alex = Admin, 5 Guardians including Priya and Rahul, Sarah = Domain Owner) and registers:
- `mybank.example`
- `harborline.example`
- `ledgerworks.example`

It writes `deployments/localhost.json` and copies the contract ABI to `frontend/src/contracts/DomainGuard.json`.

### 3. Run Demo Scripts
Each demo script runs independently against the local node:

```powershell
# Scenario A: Rogue Admin Attack (Hour-4 event)
npm run demo:attack

# Scenario B: Collusion & Guardian Veto + Legitimate Transfer
npm run demo:collusion

# Scenario C: Guardian Key Loss Recovery (Judging event)
npm run demo:keyloss

# Run all 3 demos in succession:
npm run demo:all
```

---

## Project Structure

```
chaintrust/
├── contracts/
│   └── DomainGuard.sol   # Core multi-party authorization contract (paris EVM, Solidity ^0.8.24)
├── test/
│   └── DomainGuard.test.ts # Hardhat unit tests (69 tests, 100% passing)
├── scripts/
│   ├── deploy.ts         # Local deployment and demo domain registration
│   ├── demo-attack.ts    # Hour-4 Rogue Admin attack scenario
│   ├── demo-collusion.ts # Collusion & Guardian Veto scenario
│   ├── demo-keyloss.ts   # Guardian Key Loss recovery scenario
│   └── helpers.ts        # Shared demo script utilities & log formatting
├── deployments/
│   └── localhost.json    # Local network deployment address, ABI references & named accounts
├── frontend/             # Vite + React + TypeScript frontend
│   └── src/contracts/    # DomainGuard ABI and localhost deployment exports
├── docs/
│   ├── ARCHITECTURE.md   # Full system design & Stage 3 deployment layout
│   └── DEFENSE.md        # 5-minute architecture defence
├── hardhat.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Stage Checklist

- [x] **Stage 1** — Project inspection, scaffold, and design lock (ARCHITECTURE.md + DEFENSE.md)
- [x] **Stage 2** — Core DomainGuard Solidity contract + full test suite (69 tests, 95.57% line coverage)
- [x] **Stage 3** — Local deployment & demo scripts (deploy.ts, demo-attack, demo-collusion, demo-keyloss, deployments/localhost.json)
- [ ] **Stage 4** — Frontend integration: React board, approval panel, no hardcoded addresses
- [ ] **Stage 5** — End-to-end demo run & presentation polish

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
