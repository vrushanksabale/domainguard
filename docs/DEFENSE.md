# ChainTrust – DomainGuard: Architecture Defense
**5-Minute Defense Script | BlockHack PS-08 "The Rogue Admin"**

---

## Question 1: Why does this system need a blockchain?

A domain registrar faces a specific trust problem: the parties who need to authorise sensitive operations—owners, guardians, admins—do **not** share a common trust anchor. They belong to different organisations with potentially adversarial interests. A blockchain provides a **replicated, append-only, publicly verifiable state machine** that none of them controls unilaterally. The DomainGuard contract encodes the authorisation policy in bytecode that is immutable after deployment; every party independently verifies that the rules are being followed without relying on anyone else's word. Critically, a failed transaction is a **cryptographic proof of refusal**—the rogue admin's attempt to bypass quorum produces a revert that is permanently recorded on-chain, not merely logged by a system they could also tamper with.

---

## Question 2: What happens if we replace the blockchain with PostgreSQL + digital signatures?

In a PostgreSQL setup, the database server is a single point of trust: a sufficiently privileged DBA, or a compromised sysadmin, can alter rows, modify stored procedures, or disable signature-verification triggers—and the guardians have no way to detect it. The critical difference is **where the rules live and who enforces them**. On the blockchain, the `execute()` function's validation logic is compiled into EVM bytecode deployed to a shared, replicated ledger; every guardian's node re-executes the code and reaches the same conclusion independently. In a database, the "rules" are just data—they can be edited. Even with cryptographic signatures on every row, the *verification code* itself is modifiable by whoever controls the database engine, making the system ultimately centralised. Blockchain moves trust from "trust the database admin" to "trust the mathematics and the consensus rules."

---

## Question 3: Who are the trust participants?

There are four distinct trust roles in DomainGuard:

1. **Registrar Admins (Proposers):** Employees of the domain registrar. They have the narrowest privilege—they may only *propose* operations, never approve or execute their own proposals. This scopes their blast radius even if one goes rogue.
2. **Domain Owner:** The registrant. They hold the ultimate beneficial interest in the domain and must countersign sensitive operations on their own domain. Their signature represents "the customer consented."
3. **Guardians (× 5 in demo):** Independent external organisations—e.g., the registry operator, an auditor, a legal escrow agent. They represent cross-organisational oversight. No single organisation controls a majority.
4. **The Contract Itself:** After deployment, the smart contract is a trust participant with no human behind it. It enforces the rules deterministically; it cannot be bribed, pressured, or overridden.

---

## Question 4: What happens when one participant becomes malicious?

The system is designed to **tolerate one corrupt participant per role category** without any breach:

- **Rogue Admin:** Cannot approve or self-execute. Even colluding with one guardian, they can reach at most 1 of the 3 required guardian approvals. The request simply never reaches quorum and eventually expires.
- **Malicious Guardian:** One corrupt guardian approval counts for 1 of 5. Quorum for the most sensitive operation (transfer) requires 3 of 5. The malicious guardian cannot force execution alone. They *can* abuse the emergency freeze, but that is the **safe direction**—a freeze harms no one; unfreezing then requires 3 honest guardians.
- **Malicious Owner:** Can veto their own domain's legitimate operations by calling `vetoRequest()` during the timelock window. This is the safe default (no state change rather than a forced hostile change). The `RECOVERY` operation type allows guardians to recover from a hostile or non-cooperative owner.

In all cases, the system's default behaviour under attack is **inaction**, which preserves the status quo—the safest possible outcome for a domain registry.

---

## Question 5: What happens when two honest participants disagree?

Disagreement means the quorum threshold is not met. The request sits in `Proposed` state collecting votes. If no quorum is reached before `expiresAt`, the contract allows anyone to call `expireRequest(requestId)` and the status becomes `Expired`. **The safe default is no state change.** The domain remains in its current state. This is deliberate: in a registry, maintaining the current state is always safer than applying an unendorsed change. Disagreement is not a deadlock—it is the system working correctly. For true emergencies where inaction is dangerous (e.g., an active attack), any single guardian can invoke `emergencyFreeze()` instantly; that one action stops damage without requiring consensus, while unfreezing later still requires a quorum of 3.

---

## Question 6: What information must actually be on-chain, and why?

Only the minimum necessary to enforce the policy is stored on-chain:

| On-Chain | Why |
|----------|-----|
| `bytes32 domainId` (hash of name) | Identifies the subject of operations without leaking the WHOIS record or any PII |
| `address owner` | Needed to validate the owner's countersignature and to update ownership on `TRANSFER_OWNERSHIP` |
| `bytes32 dnsRecordHash` | Cryptographic commitment to the zone-file; allows anyone to verify that an off-chain file matches the authorised version without storing the file itself |
| `bool frozen` | The authoritative freeze state; must be on-chain so every node enforces it independently |
| `uint64 nonce` | Prevents replay attacks across requests for the same domain |
| Guardian addresses | Must be on-chain so the contract can validate who is authorised to approve |
| Approval records (`hasVoted` mapping) | Must be on-chain to enforce one-vote-per-participant without relying on off-chain coordination |

Everything else—WHOIS data, contact emails, billing history, actual zone-file content—stays off-chain. This satisfies GDPR data-minimisation principles and keeps gas costs proportional to what is strictly necessary.

---

## Section 7: Honest Limitations

This demonstration runs on a **single local Hardhat node**, which means all "guardian nodes" are accounts on the same process with a shared in-memory state. This is sufficient to demonstrate and test the smart contract logic, but it does not represent production decentralisation.

In a production deployment:
- Each guardian organisation would run its own Ethereum-compatible node (or connect to a shared private network).
- The network would use a validator set (e.g., proof-of-authority with one node per guardian) so no single party can rewrite history.
- Key management would use hardware security modules (HSMs) or MPC wallets; no private key would reside on a general-purpose server.
- The timelock constants would be in hours or days, not seconds.
- The `evm_increaseTime` trick used in demos is only available on development nodes; on a real network you simply wait out the clock.

We acknowledge these gaps openly. The purpose of this hackathon submission is to demonstrate that the **contract logic is correct and the attack scenarios behave as specified**; the infrastructure to make it production-grade is a separate and well-understood engineering problem.
