// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DomainGuard
 * @author ChainTrust – BlockHack PS-08 "The Rogue Admin"
 * @notice Multi-party authorisation system for critical domain-registrar operations.
 *         This contract is the SOLE authority over domain state. There is no admin setter,
 *         no owner override, no upgrade path, and no backdoor of any kind. Domain state
 *         changes only inside execute() (plus registerDomain for new names and freezeDomain
 *         for emergency freeze). All rules are encoded in immutable EVM bytecode.
 * @dev Solidity ^0.8.24, evmVersion paris. No OpenZeppelin, no payable, no delegatecall,
 *      no tx.origin, no selfdestruct.
 */
contract DomainGuard {
    // =========================================================================
    //  Custom Errors
    // =========================================================================

    error NotAdmin();
    error NotGuardian();
    error NotAuthorized();
    error SelfApprovalForbidden();
    error AlreadyVoted();
    error QuorumNotReached();
    error TimelockActive();
    error RequestExpiredError();
    error NotExpired();
    error StaleRequest();
    error DomainFrozenError();
    error DomainNotFound();
    error DomainExists();
    error ZeroAddress();
    error ZeroHash();
    error InvalidRequest();
    error InvalidStatus();
    error InvalidConstructorArgs();

    // =========================================================================
    //  Enums
    // =========================================================================

    /// @notice The type of operation being requested.
    enum Op {
        TRANSFER_OWNERSHIP, // 0
        DNS_UPDATE,         // 1
        KEY_REPLACEMENT,    // 2 – global; domainId = bytes32(0)
        RECOVERY,           // 3 – owner key lost; no owner countersig required
        UNFREEZE            // 4 – unfreeze a frozen domain
    }

    /// @notice Lifecycle status of a request.
    enum Status {
        None,     // 0 – does not exist
        Pending,  // 1 – collecting approvals
        Approved, // 2 – quorum met; timelock running
        Executed, // 3 – domain state has been changed
        Rejected, // 4 – rejection threshold met
        Vetoed,   // 5 – vetoed by owner or guardian during timelock
        Expired   // 6 – timed out before quorum or execution window passed
    }

    // =========================================================================
    //  Structs
    // =========================================================================

    struct Domain {
        address owner;
        bytes32 dnsRecordHash;
        bool    frozen;
        uint64  nonce;
        bool    exists;
    }

    struct Request {
        uint256 id;
        bytes32 domainId;
        Op      op;
        address proposer;
        address target;       // new owner (TRANSFER/RECOVERY) or new guardian (KEY_REPLACEMENT)
        address oldKey;       // old guardian (KEY_REPLACEMENT)
        bytes32 newDnsHash;   // DNS_UPDATE
        uint64  domainNonce;  // snapshot of domain.nonce at proposal time; 0 for global ops
        uint64  createdAt;
        uint64  eta;          // block.timestamp when Approved + delay; 0 while Pending
        Status  status;
        bool    ownerApproved;
        uint8   guardianApprovals;
        uint8   guardianRejections;
    }

    // =========================================================================
    //  Constants
    // =========================================================================

    /// @notice A Pending request must reach Approved within this window after creation.
    uint64 public constant REQUEST_TTL = 1 days;

    /// @notice An Approved request must be executed within this window after eta.
    uint64 public constant EXEC_WINDOW = 1 days;

    // =========================================================================
    //  Immutable delays (set at construction; not changeable afterward)
    // =========================================================================

    /// @notice Timelock for DNS_UPDATE operations.
    uint32 public immutable dnsDelay;
    /// @notice Timelock for TRANSFER_OWNERSHIP operations.
    uint32 public immutable transferDelay;
    /// @notice Timelock for KEY_REPLACEMENT and UNFREEZE operations.
    uint32 public immutable keyDelay;
    /// @notice Timelock for RECOVERY operations.
    uint32 public immutable recoveryDelay;

    // =========================================================================
    //  State
    // =========================================================================
    /// @notice Admin addresses set in the constructor; there is no admin setter, so the admin set is fixed post-deployment.
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isGuardian;
    address[] private _guardianList;

    mapping(bytes32 => Domain) private _domains;

    mapping(uint256 => Request) private _requests;
    /// @dev hasVoted[requestId][voter] — prevents double voting
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    uint256 public requestCount;

    // =========================================================================
    //  Events
    // =========================================================================

    event DomainRegistered(bytes32 indexed domainId, address indexed owner);

    event RequestProposed(
        uint256 indexed requestId,
        bytes32 indexed domainId,
        uint8   opType,
        address indexed proposer,
        uint256 expiresAt
    );

    event RequestApproved(uint256 indexed requestId, address indexed approver);
    event RequestRejected(uint256 indexed requestId, address indexed rejecter);

    event RequestQueued(uint256 indexed requestId, uint256 timelockEndsAt);
    event RequestVetoed(uint256 indexed requestId, address indexed vetoer);

    event RequestExecuted(
        uint256 indexed requestId,
        bytes32 indexed domainId,
        uint8   opType
    );

    event RequestExpired(uint256 indexed requestId);

    event DomainFrozen(bytes32 indexed domainId, address indexed frozenBy);
    event DomainUnfrozen(bytes32 indexed domainId);

    event GuardianReplaced(
        address indexed oldGuardian,
        address indexed newGuardian
    );

    event OwnerRecovered(
        bytes32 indexed domainId,
        address indexed oldOwner,
        address indexed newOwner
    );

    // =========================================================================
    //  Constructor
    // =========================================================================

    /**
     * @notice Deploy DomainGuard with a fixed set of admins and guardians.
     * @dev    No owner or superuser exists after deployment. The admin set is fixed forever.
     * @param  admins_        At least 1 admin address; no zero, no duplicates.
     * @param  guardians_     Exactly 5 guardian addresses; no zero, no duplicates,
     *                        none may also be an admin.
     * @param  dnsDelay_      Timelock (seconds) for DNS_UPDATE. Must be > 0.
     * @param  transferDelay_ Timelock (seconds) for TRANSFER_OWNERSHIP. Must be > 0.
     * @param  keyDelay_      Timelock (seconds) for KEY_REPLACEMENT and UNFREEZE. Must be > 0.
     * @param  recoveryDelay_ Timelock (seconds) for RECOVERY. Must be > 0.
     */
    constructor(
        address[] memory admins_,
        address[] memory guardians_,
        uint32 dnsDelay_,
        uint32 transferDelay_,
        uint32 keyDelay_,
        uint32 recoveryDelay_
    ) {
        // ---- delay validation ----
        if (
            dnsDelay_ == 0 ||
            transferDelay_ == 0 ||
            keyDelay_ == 0 ||
            recoveryDelay_ == 0
        ) revert InvalidConstructorArgs();

        // ---- admin validation ----
        if (admins_.length == 0) revert InvalidConstructorArgs();
        for (uint256 i = 0; i < admins_.length; i++) {
            if (admins_[i] == address(0)) revert ZeroAddress();
            if (isAdmin[admins_[i]]) revert InvalidConstructorArgs(); // duplicate
            isAdmin[admins_[i]] = true;
        }

        // ---- guardian validation ----
        if (guardians_.length != 5) revert InvalidConstructorArgs();
        for (uint256 i = 0; i < guardians_.length; i++) {
            if (guardians_[i] == address(0)) revert ZeroAddress();
            if (isAdmin[guardians_[i]]) revert InvalidConstructorArgs(); // admin also guardian
            if (isGuardian[guardians_[i]]) revert InvalidConstructorArgs(); // duplicate guardian
            isGuardian[guardians_[i]] = true;
            _guardianList.push(guardians_[i]);
        }

        dnsDelay      = dnsDelay_;
        transferDelay = transferDelay_;
        keyDelay      = keyDelay_;
        recoveryDelay = recoveryDelay_;
    }

    // =========================================================================
    //  Internal policy helper
    // =========================================================================

    /**
     * @dev Returns the policy for a given operation type.
     *      Pure function — no state reads. Compiled as an internal helper.
     * @return ownerRequired       Whether the domain owner must countersign.
     * @return guardianThreshold   Minimum guardian approvals required.
     * @return delay               Timelock in seconds once Approved.
     */
    function _policy(Op op)
        internal
        view
        returns (
            bool ownerRequired,
            uint8 guardianThreshold,
            uint32 delay
        )
    {
        if (op == Op.TRANSFER_OWNERSHIP) return (true,  3, transferDelay);
        if (op == Op.DNS_UPDATE)         return (true,  2, dnsDelay);
        if (op == Op.KEY_REPLACEMENT)    return (false, 3, keyDelay);
        if (op == Op.RECOVERY)           return (false, 3, recoveryDelay);
        if (op == Op.UNFREEZE)           return (false, 3, keyDelay);
        revert InvalidRequest();
    }

    // =========================================================================
    //  Public policy view (spec requirement: expose via view function)
    // =========================================================================

    /**
     * @notice Returns the policy parameters for a given operation type.
     * @param  op The operation type to query.
     * @return ownerRequired     Whether the domain owner must countersign.
     * @return guardianThreshold Minimum guardian approvals required.
     * @return delay             Timelock in seconds once quorum is reached.
     */
    function policy(Op op)
        external
        view
        returns (
            bool ownerRequired,
            uint8 guardianThreshold,
            uint32 delay
        )
    {
        return _policy(op);
    }

    // =========================================================================
    //  1. registerDomain
    // =========================================================================

    /**
     * @notice Register a new domain under DomainGuard governance.
     * @dev    Admin-only. Reverts if the domain already exists, or any input is zero.
     *         The domain name string is NEVER stored; only its keccak256 hash is used as the key.
     * @param  domainId      keccak256 hash of the fully-qualified domain name (DEMO DATA).
     * @param  owner_        Current registrant address.
     * @param  dnsRecordHash keccak256 hash of the current zone-file content (DEMO DATA).
     */
    function registerDomain(
        bytes32 domainId,
        address owner_,
        bytes32 dnsRecordHash
    ) external {
        if (!isAdmin[msg.sender]) revert NotAdmin();
        if (domainId == bytes32(0)) revert ZeroHash();
        if (owner_ == address(0)) revert ZeroAddress();
        if (dnsRecordHash == bytes32(0)) revert ZeroHash();
        if (_domains[domainId].exists) revert DomainExists();

        _domains[domainId] = Domain({
            owner:         owner_,
            dnsRecordHash: dnsRecordHash,
            frozen:        false,
            nonce:         0,
            exists:        true
        });

        emit DomainRegistered(domainId, owner_);
    }

    // =========================================================================
    //  2. propose
    // =========================================================================

    /**
     * @notice Propose a new operation request. Callable by any admin or guardian.
     * @dev    Validates inputs against the operation type. Records domainNonce at proposal
     *         time for staleness detection. Emits RequestProposed.
     * @param  domainId    keccak256 domain hash (bytes32(0) for KEY_REPLACEMENT).
     * @param  op          The operation type.
     * @param  target      New owner (TRANSFER/RECOVERY) or new guardian key (KEY_REPLACEMENT).
     * @param  oldKey      Old guardian key (KEY_REPLACEMENT only; ignored otherwise).
     * @param  newDnsHash  New DNS record hash (DNS_UPDATE only; ignored otherwise).
     * @return id          The new request ID.
     */
    function propose(
        bytes32 domainId,
        Op      op,
        address target,
        address oldKey,
        bytes32 newDnsHash
    ) external returns (uint256 id) {
        if (!isAdmin[msg.sender] && !isGuardian[msg.sender]) revert NotAuthorized();

        Domain storage d = _domains[domainId]; // safe: bytes32(0) for global ops

        // ---- per-op validation ----
        if (op == Op.TRANSFER_OWNERSHIP) {
            if (!d.exists) revert DomainNotFound();
            if (target == address(0)) revert ZeroAddress();
            if (target == d.owner) revert InvalidRequest();
            if (d.frozen) revert DomainFrozenError();
        } else if (op == Op.DNS_UPDATE) {
            if (!d.exists) revert DomainNotFound();
            if (newDnsHash == bytes32(0)) revert ZeroHash();
            if (newDnsHash == d.dnsRecordHash) revert InvalidRequest();
            if (d.frozen) revert DomainFrozenError();
        } else if (op == Op.KEY_REPLACEMENT) {
            // KEY_REPLACEMENT is a global operation; domainId MUST be bytes32(0)
            if (domainId != bytes32(0)) revert InvalidRequest();
            if (!isGuardian[oldKey]) revert InvalidRequest();
            if (target == address(0)) revert ZeroAddress();
            if (isGuardian[target]) revert InvalidRequest();
            if (isAdmin[target]) revert InvalidRequest();
        } else if (op == Op.RECOVERY) {
            if (!d.exists) revert DomainNotFound();
            if (target == address(0)) revert ZeroAddress();
            if (target == d.owner) revert InvalidRequest();
            // RECOVERY allowed on frozen domain (see spec §3.6)
        } else if (op == Op.UNFREEZE) {
            if (!d.exists) revert DomainNotFound();
            if (!d.frozen) revert InvalidRequest(); // can only unfreeze a frozen domain
        }

        // While a domain is frozen, only UNFREEZE and RECOVERY may be proposed for it.
        if (domainId != bytes32(0) && d.exists && d.frozen) {
            if (op != Op.UNFREEZE && op != Op.RECOVERY) revert DomainFrozenError();
        }

        // Capture snapshot nonce (0 for global KEY_REPLACEMENT)
        uint64 snapNonce = (op == Op.KEY_REPLACEMENT) ? 0 : d.nonce;

        id = ++requestCount;
        uint64 expiry = uint64(block.timestamp) + REQUEST_TTL;

        _requests[id] = Request({
            id:                id,
            domainId:          domainId,
            op:                op,
            proposer:          msg.sender,
            target:            target,
            oldKey:            oldKey,
            newDnsHash:        newDnsHash,
            domainNonce:       snapNonce,
            createdAt:         uint64(block.timestamp),
            eta:               0,
            status:            Status.Pending,
            ownerApproved:     false,
            guardianApprovals: 0,
            guardianRejections: 0
        });

        emit RequestProposed(id, domainId, uint8(op), msg.sender, expiry);
    }

    // =========================================================================
    //  Internal: compute eligible guardian count for rejection threshold
    // =========================================================================

    /**
     * @dev Computes how many guardians are eligible to vote on a request.
     *      For KEY_REPLACEMENT: all 5 minus the proposer (if guardian) minus the oldKey
     *      (if distinct from proposer). For all other ops: 5 minus the proposer if guardian.
     */
    function _eligibleGuardians(Request storage req)
        internal
        view
        returns (uint8)
    {
        uint8 eligible = 5;
        // If the proposer is a guardian, they cannot vote on their own request
        if (isGuardian[req.proposer]) {
            eligible -= 1;
        }
        // For KEY_REPLACEMENT the oldKey cannot vote on its own replacement
        if (req.op == Op.KEY_REPLACEMENT && req.oldKey != req.proposer) {
            // Only subtract if oldKey is still a guardian
            if (isGuardian[req.oldKey]) {
                eligible -= 1;
            }
        }
        return eligible;
    }

    // =========================================================================
    //  Internal: check quorum and transition to Approved
    // =========================================================================

    function _checkAndApprove(uint256 id) internal {
        Request storage req = _requests[id];
        (bool ownerRequired, uint8 threshold, uint32 delay) = _policy(req.op);

        bool ownerOk = !ownerRequired || req.ownerApproved;
        bool guardiansOk = req.guardianApprovals >= threshold;

        if (ownerOk && guardiansOk) {
            req.status = Status.Approved;
            req.eta    = uint64(block.timestamp) + uint64(delay);
            emit RequestQueued(id, req.eta);
        }
    }

    // =========================================================================
    //  3. approve
    // =========================================================================

    /**
     * @notice Approve a pending request. Caller must be an eligible guardian or the
     *         domain owner (if the operation requires owner approval).
     * @dev    Proposer may NEVER approve their own request. One vote per address.
     *         When quorum is reached, status transitions to Approved and timelock starts.
     * @param  id  The request ID to approve.
     */
    function approve(uint256 id) external {
        Request storage req = _requests[id];

        // ---- basic validity ----
        if (req.status == Status.None) revert InvalidRequest();
        if (req.status != Status.Pending) revert InvalidStatus();
        if (uint64(block.timestamp) > req.createdAt + REQUEST_TTL) revert RequestExpiredError();

        // ---- self-approval ban (applies to ALL callers including guardians who proposed) ----
        if (msg.sender == req.proposer) revert SelfApprovalForbidden();

        // ---- double vote check ----
        if (_hasVoted[id][msg.sender]) revert AlreadyVoted();

        // ---- KEY_REPLACEMENT: the oldKey cannot vote on its own replacement ----
        if (req.op == Op.KEY_REPLACEMENT && msg.sender == req.oldKey) revert NotAuthorized();

        // ---- determine if caller is eligible ----
        (bool ownerRequired,,) = _policy(req.op);

        bool callerIsGuardian = isGuardian[msg.sender];
        bool callerIsOwner    = false;

        if (req.op != Op.KEY_REPLACEMENT && _domains[req.domainId].exists) {
            callerIsOwner = (_domains[req.domainId].owner == msg.sender);
        }

        if (!callerIsGuardian && !callerIsOwner) revert NotAuthorized();

        // If caller is the owner but owner approval is not required for this op, reject
        if (callerIsOwner && !callerIsGuardian && !ownerRequired) revert NotAuthorized();

        // ---- record vote ----
        _hasVoted[id][msg.sender] = true;

        if (callerIsOwner && ownerRequired && !req.ownerApproved) {
            req.ownerApproved = true;
        } else if (callerIsGuardian) {
            req.guardianApprovals += 1;
        }

        emit RequestApproved(id, msg.sender);

        // ---- check if quorum is now reached ----
        _checkAndApprove(id);
    }

    // =========================================================================
    //  4. reject
    // =========================================================================

    /**
     * @notice Reject a pending request. Same eligibility rules as approve().
     * @dev    If owner rejects an owner-required op, the request is immediately Rejected.
     *         Otherwise, if rejections exceed (eligible - threshold), the request is Rejected.
     * @param  id  The request ID to reject.
     */
    function reject(uint256 id) external {
        Request storage req = _requests[id];

        if (req.status == Status.None) revert InvalidRequest();
        if (req.status != Status.Pending) revert InvalidStatus();

        // ---- self-rejection ban (same as self-approval) ----
        if (msg.sender == req.proposer) revert SelfApprovalForbidden();

        // ---- KEY_REPLACEMENT: the oldKey cannot vote ----
        if (req.op == Op.KEY_REPLACEMENT && msg.sender == req.oldKey) revert NotAuthorized();

        // ---- double vote check ----
        if (_hasVoted[id][msg.sender]) revert AlreadyVoted();

        // ---- determine if caller is eligible ----
        (bool ownerRequired,,) = _policy(req.op);

        bool callerIsGuardian = isGuardian[msg.sender];
        bool callerIsOwner    = false;

        if (req.op != Op.KEY_REPLACEMENT && _domains[req.domainId].exists) {
            callerIsOwner = (_domains[req.domainId].owner == msg.sender);
        }

        if (!callerIsGuardian && !callerIsOwner) revert NotAuthorized();
        if (callerIsOwner && !callerIsGuardian && !ownerRequired) revert NotAuthorized();

        // ---- record vote ----
        _hasVoted[id][msg.sender] = true;
        emit RequestRejected(id, msg.sender);

        // ---- owner rejection short-circuit ----
        if (callerIsOwner && ownerRequired) {
            req.status = Status.Rejected;
            return;
        }

        // ---- guardian rejection threshold check ----
        req.guardianRejections += 1;
        uint8 eligible  = _eligibleGuardians(req);
        (,uint8 threshold,) = _policy(req.op);

        // Reject if enough guardians have rejected that quorum is now mathematically impossible
        if (req.guardianRejections > eligible - threshold) {
            req.status = Status.Rejected;
        }
    }

    // =========================================================================
    //  5. veto
    // =========================================================================

    /**
     * @notice Veto an Approved request during its timelock window. Cancels the request.
     * @dev    Only the domain owner or any current guardian may veto.
     *         For KEY_REPLACEMENT (global op): guardians only, oldKey excluded.
     *         May only be called while status == Approved.
     * @param  id  The request ID to veto.
     */
    function veto(uint256 id) external {
        Request storage req = _requests[id];

        if (req.status == Status.None) revert InvalidRequest();
        if (req.status != Status.Approved) revert InvalidStatus();

        bool callerIsGuardian = isGuardian[msg.sender];
        bool callerIsOwner    = false;

        if (req.op != Op.KEY_REPLACEMENT && _domains[req.domainId].exists) {
            callerIsOwner = (_domains[req.domainId].owner == msg.sender);
        }

        // For KEY_REPLACEMENT: guardians only (oldKey excluded)
        if (req.op == Op.KEY_REPLACEMENT) {
            if (!callerIsGuardian) revert NotAuthorized();
            if (msg.sender == req.oldKey) revert NotAuthorized();
        } else {
            if (!callerIsGuardian && !callerIsOwner) revert NotAuthorized();
        }

        req.status = Status.Vetoed;
        emit RequestVetoed(id, msg.sender);
    }

    // =========================================================================
    //  6. execute
    // =========================================================================

    /**
     * @notice Execute an Approved request after its timelock has elapsed.
     * @dev    Callable by anyone. Validates: status Approved, timelock elapsed,
     *         execution window not exceeded, domain nonce unchanged (staleness check),
     *         and domain not frozen (unless UNFREEZE or RECOVERY).
     *         CHECKS-EFFECTS-INTERACTIONS: status is set to Executed BEFORE state changes.
     * @param  id  The request ID to execute.
     */
    function execute(uint256 id) external {
        Request storage req = _requests[id];

        // ---- status check ----
        if (req.status == Status.None) revert InvalidRequest();
        if (req.status != Status.Approved) revert QuorumNotReached();

        // ---- timelock check ----
        if (block.timestamp < req.eta) revert TimelockActive();

        // ---- execution window check ----
        if (block.timestamp > req.eta + EXEC_WINDOW) revert RequestExpiredError();

        // ---- staleness check (KEY_REPLACEMENT has domainNonce = 0; no domain nonce to check) ----
        if (req.op != Op.KEY_REPLACEMENT) {
            Domain storage d = _domains[req.domainId];
            if (!d.exists) revert DomainNotFound();
            if (d.nonce != req.domainNonce) revert StaleRequest();
            // ---- frozen check: only UNFREEZE and RECOVERY may proceed on frozen domains ----
            if (d.frozen && req.op != Op.UNFREEZE && req.op != Op.RECOVERY) revert DomainFrozenError();
        }

        // ---- CHECKS-EFFECTS: set Executed BEFORE any state change ----
        req.status = Status.Executed;

        // ---- apply state changes ----
        if (req.op == Op.TRANSFER_OWNERSHIP) {
            Domain storage d = _domains[req.domainId];
            d.owner = req.target;
            d.nonce += 1;
        } else if (req.op == Op.DNS_UPDATE) {
            Domain storage d = _domains[req.domainId];
            d.dnsRecordHash = req.newDnsHash;
            d.nonce += 1;
        } else if (req.op == Op.KEY_REPLACEMENT) {
            // Remove old guardian
            isGuardian[req.oldKey] = false;
            // Add new guardian
            isGuardian[req.target] = true;
            // Update guardianList array
            for (uint256 i = 0; i < _guardianList.length; i++) {
                if (_guardianList[i] == req.oldKey) {
                    _guardianList[i] = req.target;
                    break;
                }
            }
            emit GuardianReplaced(req.oldKey, req.target);
        } else if (req.op == Op.RECOVERY) {
            Domain storage d = _domains[req.domainId];
            address oldOwner = d.owner;
            d.owner  = req.target;
            d.nonce += 1;
            emit OwnerRecovered(req.domainId, oldOwner, req.target);
        } else if (req.op == Op.UNFREEZE) {
            Domain storage d = _domains[req.domainId];
            d.frozen = false;
            d.nonce += 1;
            emit DomainUnfrozen(req.domainId);
        }

        emit RequestExecuted(id, req.domainId, uint8(req.op));
    }

    // =========================================================================
    //  7. markExpired
    // =========================================================================

    /**
     * @notice Mark a request as Expired. Callable by anyone.
     * @dev    A Pending request past REQUEST_TTL from creation, or an Approved request
     *         past eta + EXEC_WINDOW, may be expired. Otherwise reverts NotExpired.
     * @param  id  The request ID to expire.
     */
    function markExpired(uint256 id) external {
        Request storage req = _requests[id];

        if (req.status == Status.None) revert InvalidRequest();

        bool canExpire = false;

        if (req.status == Status.Pending) {
            canExpire = (block.timestamp > req.createdAt + REQUEST_TTL);
        } else if (req.status == Status.Approved) {
            canExpire = (block.timestamp > req.eta + EXEC_WINDOW);
        }

        if (!canExpire) revert NotExpired();

        req.status = Status.Expired;
        emit RequestExpired(id);
    }

    // =========================================================================
    //  8. freezeDomain
    // =========================================================================

    /**
     * @notice Instantly freeze a domain. Any single guardian may call this.
     * @dev    Bypasses the normal request lifecycle (safe direction). Reverts if the
     *         domain does not exist or is already frozen. Increments nonce to invalidate
     *         any outstanding approved requests for this domain.
     * @param  domainId  keccak256 hash of the domain to freeze.
     */
    function freezeDomain(bytes32 domainId) external {
        if (!isGuardian[msg.sender]) revert NotGuardian();

        Domain storage d = _domains[domainId];
        if (!d.exists) revert DomainNotFound();
        if (d.frozen) revert DomainFrozenError();

        d.frozen = true;
        d.nonce += 1;

        emit DomainFrozen(domainId, msg.sender);
    }

    // =========================================================================
    //  View functions
    // =========================================================================

    /**
     * @notice Returns the full state of a registered domain.
     * @param  domainId  keccak256 hash of the domain name.
     */
    function getDomain(bytes32 domainId)
        external
        view
        returns (Domain memory)
    {
        return _domains[domainId];
    }

    /**
     * @notice Returns the full state of a request.
     * @param  id  The request ID.
     */
    function getRequest(uint256 id)
        external
        view
        returns (Request memory)
    {
        return _requests[id];
    }

    /**
     * @notice Returns the current list of guardian addresses (in index order).
     */
    function getGuardians() external view returns (address[] memory) {
        return _guardianList;
    }

    /**
     * @notice Returns whether a given address has voted on a given request.
     * @param  id     The request ID.
     * @param  voter  The address to check.
     */
    function hasVoted(uint256 id, address voter) external view returns (bool) {
        return _hasVoted[id][voter];
    }
}
