import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DomainGuard } from "../typechain-types";

const DOMAIN_NAME = "mybank.example";
const DOMAIN_ID = ethers.keccak256(ethers.toUtf8Bytes(DOMAIN_NAME));
const DNS_HASH_1 = ethers.keccak256(ethers.toUtf8Bytes("v=spf1 include:mybank.example ~all"));
const DNS_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes("v=spf1 include:new.mybank.example ~all"));

const DNS_DELAY = 60;
const TRANSFER_DELAY = 120;
const KEY_DELAY = 120;
const RECOVERY_DELAY = 180;

const Op = {
  TRANSFER_OWNERSHIP: 0n,
  DNS_UPDATE: 1n,
  KEY_REPLACEMENT: 2n,
  RECOVERY: 3n,
  UNFREEZE: 4n,
} as const;

const Status = {
  None: 0n,
  Pending: 1n,
  Approved: 2n,
  Executed: 3n,
  Rejected: 4n,
  Vetoed: 5n,
  Expired: 6n,
} as const;

async function deployFixture() {
  const [
    alex,     // Admin (Account #0)
    priya,    // Guardian 1 (Account #1)
    rahul,    // Guardian 2 (Account #2)
    maya,     // Guardian 3 (Account #3)
    marcus,   // Guardian 4 (Account #4)
    elena,    // Guardian 5 (Account #5)
    owner,    // Domain Owner Sarah (Account #6)
    victor,   // New Guardian Key (Account #7)
    alice,    // New Owner (Account #8)
    stranger, // Unauthorized outsider (Account #9)
  ] = await ethers.getSigners();

  const admins = [alex.address];
  const guardians = [
    priya.address,
    rahul.address,
    maya.address,
    marcus.address,
    elena.address,
  ];

  const DomainGuardFactory = await ethers.getContractFactory("DomainGuard");
  const dg = (await DomainGuardFactory.deploy(
    admins,
    guardians,
    DNS_DELAY,
    TRANSFER_DELAY,
    KEY_DELAY,
    RECOVERY_DELAY
  )) as DomainGuard;
  await dg.waitForDeployment();

  await dg.connect(alex).registerDomain(DOMAIN_ID, owner.address, DNS_HASH_1);

  return {
    dg,
    alex,
    priya,
    rahul,
    maya,
    marcus,
    elena,
    owner,
    victor,
    alice,
    stranger,
  };
}

async function proposeTransfer(
  dg: DomainGuard,
  proposer: any,
  targetAddr: string
): Promise<bigint> {
  const tx = await dg.connect(proposer).propose(
    DOMAIN_ID,
    Op.TRANSFER_OWNERSHIP,
    targetAddr,
    ethers.ZeroAddress,
    ethers.ZeroHash
  );
  const receipt = await tx.wait();
  const event = receipt!.logs
    .map((l) => {
      try {
        return dg.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "RequestProposed");
  return event!.args.requestId as bigint;
}

describe("Approve and Reject Workflow & Invariants Suite (PS-08 Audit)", () => {
  // -------------------------------------------------------------------------
  // 1. APPROVE WORKFLOW TESTS
  // -------------------------------------------------------------------------
  describe("1. Approve Request Workflows", () => {
    it("proposer self-approval strictly reverts SelfApprovalForbidden", async () => {
      const { dg, alex, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(alex).approve(reqId))
        .to.be.revertedWithCustomError(dg, "SelfApprovalForbidden");
    });

    it("guardian proposer self-approval strictly reverts SelfApprovalForbidden", async () => {
      const { dg, priya, alice } = await loadFixture(deployFixture);
      // Guardian Priya proposes
      const reqId = await proposeTransfer(dg, priya, alice.address);

      await expect(dg.connect(priya).approve(reqId))
        .to.be.revertedWithCustomError(dg, "SelfApprovalForbidden");
    });

    it("domain owner can countersign owner-required transfer request and emits RequestApproved", async () => {
      const { dg, alex, owner, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(owner).approve(reqId))
        .to.emit(dg, "RequestApproved")
        .withArgs(reqId, owner.address);

      const req = await dg.getRequest(reqId);
      expect(req.ownerApproved).to.be.true;
      expect(req.guardianApprovals).to.equal(0);
      expect(req.status).to.equal(Status.Pending);
    });

    it("guardians can cast approval votes incrementing guardianApprovals", async () => {
      const { dg, alex, priya, rahul, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(priya).approve(reqId))
        .to.emit(dg, "RequestApproved")
        .withArgs(reqId, priya.address);

      let req = await dg.getRequest(reqId);
      expect(req.guardianApprovals).to.equal(1);
      expect(req.status).to.equal(Status.Pending);

      await dg.connect(rahul).approve(reqId);
      req = await dg.getRequest(reqId);
      expect(req.guardianApprovals).to.equal(2);
      expect(req.status).to.equal(Status.Pending);
    });

    it("reaching quorum (Owner + 3 Guardians) queues request into Timelock (Approved)", async () => {
      const { dg, alex, owner, priya, rahul, maya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);

      const tx = await dg.connect(maya).approve(reqId);
      const receipt = await tx.wait();
      const queuedEvent = receipt!.logs
        .map((l) => {
          try {
            return dg.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "RequestQueued");

      expect(queuedEvent).to.not.be.undefined;
      expect(queuedEvent!.args.requestId).to.equal(reqId);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Approved);
      expect(req.guardianApprovals).to.equal(3);
      expect(req.ownerApproved).to.equal(true);
      expect(req.eta).to.be.gt(0);
    });

    it("duplicate approval vote reverts AlreadyVoted", async () => {
      const { dg, alex, priya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(priya).approve(reqId);
      await expect(dg.connect(priya).approve(reqId))
        .to.be.revertedWithCustomError(dg, "AlreadyVoted");
    });

    it("unauthorized stranger approval reverts NotAuthorized", async () => {
      const { dg, alex, stranger, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(stranger).approve(reqId))
        .to.be.revertedWithCustomError(dg, "NotAuthorized");
    });

    it("non-guardian pure admin approval reverts NotAuthorized", async () => {
      const { dg, priya, alex, alice } = await loadFixture(deployFixture);
      // Priya proposes, Alex is Admin (not owner, not guardian)
      const reqId = await proposeTransfer(dg, priya, alice.address);

      await expect(dg.connect(alex).approve(reqId))
        .to.be.revertedWithCustomError(dg, "NotAuthorized");
    });

    it("cannot approve a request that is already Approved", async () => {
      const { dg, alex, owner, priya, rahul, maya, marcus, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId); // Quorum reached!

      // Marcus tries to approve an already approved request
      await expect(dg.connect(marcus).approve(reqId))
        .to.be.revertedWithCustomError(dg, "InvalidStatus");
    });

    it("hasVoted accurately reflects vote state on-chain", async () => {
      const { dg, alex, priya, rahul, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      expect(await dg.hasVoted(reqId, priya.address)).to.be.false;
      await dg.connect(priya).approve(reqId);
      expect(await dg.hasVoted(reqId, priya.address)).to.be.true;
      expect(await dg.hasVoted(reqId, rahul.address)).to.be.false;
    });
  });

  // -------------------------------------------------------------------------
  // 2. REJECT WORKFLOW TESTS
  // -------------------------------------------------------------------------
  describe("2. Reject Request Workflows", () => {
    it("guardian can reject a pending request, recording rejection vote and emitting RequestRejected", async () => {
      const { dg, alex, priya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(priya).reject(reqId))
        .to.emit(dg, "RequestRejected")
        .withArgs(reqId, priya.address);

      const req = await dg.getRequest(reqId);
      expect(req.guardianRejections).to.equal(1);
      expect(req.status).to.equal(Status.Pending); // Not yet mathematically impossible
      expect(await dg.hasVoted(reqId, priya.address)).to.be.true;
    });

    it("single guardian rejection does not block remaining guardians from approving to reach quorum", async () => {
      const { dg, alex, owner, priya, rahul, maya, marcus, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      // Priya rejects
      await dg.connect(priya).reject(reqId);

      // Owner + remaining 3 guardians approve
      await dg.connect(owner).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId);
      await dg.connect(marcus).approve(reqId);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Approved);
      expect(req.guardianApprovals).to.equal(3);
      expect(req.guardianRejections).to.equal(1);
    });

    it("enough guardian rejections make quorum impossible and transition status to Rejected", async () => {
      const { dg, alex, priya, rahul, maya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      // For transfer (threshold 3, 5 eligible guardians), rejections needed > (5 - 3) = 2, so 3 rejections
      await dg.connect(priya).reject(reqId);
      await dg.connect(rahul).reject(reqId);
      expect((await dg.getRequest(reqId)).status).to.equal(Status.Pending);

      // 3rd rejection makes quorum mathematically impossible (only 2 guardians left, but 3 needed)
      await dg.connect(maya).reject(reqId);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Rejected);
      expect(req.guardianRejections).to.equal(3);
    });

    it("domain owner rejection immediately short-circuits to Rejected status on owner-required requests", async () => {
      const { dg, alex, owner, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(owner).reject(reqId))
        .to.emit(dg, "RequestRejected")
        .withArgs(reqId, owner.address);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Rejected);
    });

    it("proposer self-rejection strictly reverts SelfApprovalForbidden", async () => {
      const { dg, alex, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(alex).reject(reqId))
        .to.be.revertedWithCustomError(dg, "SelfApprovalForbidden");
    });

    it("guardian proposer cannot reject their own proposal", async () => {
      const { dg, priya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, priya, alice.address);

      await expect(dg.connect(priya).reject(reqId))
        .to.be.revertedWithCustomError(dg, "SelfApprovalForbidden");
    });

    it("cannot vote after already rejecting (AlreadyVoted)", async () => {
      const { dg, alex, priya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(priya).reject(reqId);
      await expect(dg.connect(priya).reject(reqId))
        .to.be.revertedWithCustomError(dg, "AlreadyVoted");
      await expect(dg.connect(priya).approve(reqId))
        .to.be.revertedWithCustomError(dg, "AlreadyVoted");
    });

    it("cannot vote after already approving (AlreadyVoted)", async () => {
      const { dg, alex, priya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(priya).approve(reqId);
      await expect(dg.connect(priya).reject(reqId))
        .to.be.revertedWithCustomError(dg, "AlreadyVoted");
    });

    it("unauthorized stranger rejection reverts NotAuthorized", async () => {
      const { dg, alex, stranger, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await expect(dg.connect(stranger).reject(reqId))
        .to.be.revertedWithCustomError(dg, "NotAuthorized");
    });

    it("a Rejected request cannot subsequently be approved or executed", async () => {
      const { dg, alex, owner, priya, rahul, maya, marcus, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      // Owner rejects
      await dg.connect(owner).reject(reqId);

      // Priya attempts to approve
      await expect(dg.connect(priya).approve(reqId))
        .to.be.revertedWithCustomError(dg, "InvalidStatus");

      // Attacker attempts to execute
      await expect(dg.connect(alex).execute(reqId))
        .to.be.revertedWithCustomError(dg, "QuorumNotReached");
    });
  });

  // -------------------------------------------------------------------------
  // 3. VETO & TIMELOCK TESTS
  // -------------------------------------------------------------------------
  describe("3. Veto & Timelock Enforcement", () => {
    it("domain owner can veto an Approved request during timelock", async () => {
      const { dg, alex, owner, priya, rahul, maya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId); // Approved!

      await expect(dg.connect(owner).veto(reqId))
        .to.emit(dg, "RequestVetoed")
        .withArgs(reqId, owner.address);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Vetoed);
    });

    it("any guardian can veto an Approved request during timelock", async () => {
      const { dg, alex, owner, priya, rahul, maya, elena, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId); // Approved!

      // Elena (honest guardian) vetoes
      await expect(dg.connect(elena).veto(reqId))
        .to.emit(dg, "RequestVetoed")
        .withArgs(reqId, elena.address);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Vetoed);
    });

    it("a Vetoed request cannot be executed even after timelock elapses", async () => {
      const { dg, alex, owner, priya, rahul, maya, elena, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId);

      await dg.connect(elena).veto(reqId);

      // Advance time past timelock
      await time.increase(TRANSFER_DELAY + 10);

      await expect(dg.connect(alex).execute(reqId))
        .to.be.revertedWithCustomError(dg, "QuorumNotReached");

      // Verify domain owner unchanged
      const dom = await dg.getDomain(DOMAIN_ID);
      expect(dom.owner).to.equal(owner.address);
    });

    it("premature execution before timelock expiry reverts TimelockActive", async () => {
      const { dg, alex, owner, priya, rahul, maya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId);

      await expect(dg.connect(alex).execute(reqId))
        .to.be.revertedWithCustomError(dg, "TimelockActive");
    });

    it("legitimate execution after timelock succeeds and updates owner and nonce", async () => {
      const { dg, alex, owner, priya, rahul, maya, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId);

      await time.increase(TRANSFER_DELAY + 1);

      await expect(dg.connect(alex).execute(reqId))
        .to.emit(dg, "RequestExecuted")
        .withArgs(reqId, DOMAIN_ID, Op.TRANSFER_OWNERSHIP);

      const dom = await dg.getDomain(DOMAIN_ID);
      expect(dom.owner).to.equal(alice.address);
      expect(dom.nonce).to.equal(1);

      const req = await dg.getRequest(reqId);
      expect(req.status).to.equal(Status.Executed);
    });
  });

  // -------------------------------------------------------------------------
  // 4. GUARDIAN REPLACEMENT & REVOCATION INVARIANTS
  // -------------------------------------------------------------------------
  describe("4. Guardian Replacement & Revocation", () => {
    it("old guardian key cannot vote on its own replacement", async () => {
      const { dg, priya, rahul, victor } = await loadFixture(deployFixture);

      const tx = await dg.connect(priya).propose(
        ethers.ZeroHash,
        Op.KEY_REPLACEMENT,
        victor.address,
        rahul.address,
        ethers.ZeroHash
      );
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try {
            return dg.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "RequestProposed");
      const reqId = event!.args.requestId as bigint;

      // Rahul (oldKey) tries to approve
      await expect(dg.connect(rahul).approve(reqId))
        .to.be.revertedWithCustomError(dg, "NotAuthorized");

      // Rahul tries to reject
      await expect(dg.connect(rahul).reject(reqId))
        .to.be.revertedWithCustomError(dg, "NotAuthorized");
    });

    it("after replacement is executed, old key loses voting privileges and new key gains them", async () => {
      const { dg, priya, rahul, maya, marcus, elena, victor, alice, owner } = await loadFixture(deployFixture);

      const tx = await dg.connect(priya).propose(
        ethers.ZeroHash,
        Op.KEY_REPLACEMENT,
        victor.address,
        rahul.address,
        ethers.ZeroHash
      );
      const receipt = await tx.wait();
      const reqId = (
        receipt!.logs
          .map((l) => {
            try {
              return dg.interface.parseLog(l);
            } catch {
              return null;
            }
          })
          .find((e) => e?.name === "RequestProposed")!.args.requestId as bigint
      );

      // Maya, Marcus, Elena approve (3 of remaining 4 guardians)
      await dg.connect(maya).approve(reqId);
      await dg.connect(marcus).approve(reqId);
      await dg.connect(elena).approve(reqId);

      await time.increase(KEY_DELAY + 1);
      await dg.connect(maya).execute(reqId);

      expect(await dg.isGuardian(rahul.address)).to.be.false;
      expect(await dg.isGuardian(victor.address)).to.be.true;

      // New test request on domain
      const newReqId = await proposeTransfer(dg, priya, alice.address);

      // Rahul cannot vote anymore
      await expect(dg.connect(rahul).approve(newReqId))
        .to.be.revertedWithCustomError(dg, "NotAuthorized");

      // Victor can vote
      await expect(dg.connect(victor).approve(newReqId))
        .to.emit(dg, "RequestApproved")
        .withArgs(newReqId, victor.address);
    });
  });

  // -------------------------------------------------------------------------
  // 5. EMERGENCY FREEZE INVARIANTS
  // -------------------------------------------------------------------------
  describe("5. Emergency Freeze & Nonce Invalidation", () => {
    it("emergency freeze by single guardian blocks outstanding queued requests via StaleRequest", async () => {
      const { dg, alex, owner, priya, rahul, maya, elena, alice } = await loadFixture(deployFixture);
      const reqId = await proposeTransfer(dg, alex, alice.address);

      await dg.connect(owner).approve(reqId);
      await dg.connect(priya).approve(reqId);
      await dg.connect(rahul).approve(reqId);
      await dg.connect(maya).approve(reqId); // Approved at nonce 0

      // Elena freezes domain -> increments domain.nonce to 1
      await dg.connect(elena).freezeDomain(DOMAIN_ID);

      await time.increase(TRANSFER_DELAY + 1);

      // Attempt to execute should revert StaleRequest
      await expect(dg.connect(alex).execute(reqId))
        .to.be.revertedWithCustomError(dg, "StaleRequest");
    });
  });
});
