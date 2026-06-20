// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AssetToken.sol";
import "./IYieldNotify.sol";

/**
 * @title YieldDistributor
 * @notice Distributes SARX yield to asset token holders on a pro-rata basis.
 *
 * Security fixes applied (v2):
 *
 *   CRITICAL — Balance-at-time bug:
 *     Old: _pendingYield used current balanceOf(holder), so yield could be stolen
 *     by buying tokens after a deposit or lost by selling before claiming.
 *     Fix: O(1) cumulative-per-token accumulator pattern (Synthetix/Compound model).
 *     AssetToken calls notifyTransfer() BEFORE changing balances, which settles
 *     each holder's yield at their correct (pre-transfer) balance.
 *
 *   CRITICAL — Unsafe ERC20:
 *     Old: sarx.transfer / sarx.transferFrom with unchecked return values.
 *     Fix: SafeERC20.safeTransfer / safeTransferFrom.
 *
 *   HIGH — Unbounded loop:
 *     Old: _pendingYield iterated over all unclaimed epochs — gas limit risk.
 *     Fix: Removed per-epoch loop entirely; claim is now O(1).
 *
 * Epoch history is still stored (for frontend/audit trail) but yield math
 * uses the accumulator, not per-epoch iteration.
 */
contract YieldDistributor is AccessControl, ReentrancyGuard, IYieldNotify {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    AssetToken public immutable assetToken;
    IERC20     public immutable sarx;

    // ── O(1) ACCUMULATOR STATE ───────────────────────────────
    // Scaled by PRECISION to retain sub-token precision
    uint256 public constant PRECISION = 1e18;

    // Running sum of (yieldDeposited * PRECISION / totalSupply) across all deposits
    uint256 public accYieldPerToken;

    // Per-holder: the value of accYieldPerToken when they last settled
    mapping(address => uint256) public userAccYieldPerToken;

    // Per-holder: settled but not yet claimed SARX
    mapping(address => uint256) public settledYield;

    // ── EPOCH HISTORY (for audit trail / frontend display) ───
    struct Epoch {
        uint256 totalYield;
        uint256 totalSupplySnap;
        uint256 timestamp;
        string  description;
    }
    Epoch[] public epochs;

    uint256 public totalDistributed;
    uint256 public totalClaimed;

    event YieldDeposited(uint256 indexed epochId, uint256 amount, string description);
    event YieldClaimed(address indexed holder, uint256 amount);

    constructor(address assetToken_, address sarx_, address admin_, address manager_) {
        require(assetToken_ != address(0), "YD: zero asset");
        require(sarx_       != address(0), "YD: zero sarx");
        assetToken = AssetToken(assetToken_);
        sarx       = IERC20(sarx_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MANAGER_ROLE, manager_);
    }

    // ── DEPOSIT ──────────────────────────────────────────────

    /**
     * @notice Asset manager deposits SARX yield for distribution.
     *         Manager must approve this contract to spend SARX first.
     */
    function depositYield(uint256 amount, string calldata description)
        external onlyRole(MANAGER_ROLE) nonReentrant
    {
        require(amount > 0, "YD: zero amount");
        uint256 supply = assetToken.totalSupply();
        require(supply > 0, "YD: no tokens issued");

        // FIX [CRITICAL]: SafeERC20 — reverts if transfer fails
        sarx.safeTransferFrom(msg.sender, address(this), amount);

        // Update O(1) accumulator
        accYieldPerToken += (amount * PRECISION) / supply;

        // Store epoch for history / frontend display
        uint256 epochId = epochs.length;
        epochs.push(Epoch({
            totalYield:      amount,
            totalSupplySnap: supply,
            timestamp:       block.timestamp,
            description:     description
        }));

        totalDistributed += amount;
        assetToken.recordYieldDistribution(amount);

        emit YieldDeposited(epochId, amount, description);
    }

    // ── CLAIM ────────────────────────────────────────────────

    /**
     * @notice Holder claims all settled yield. O(1) gas regardless of epoch count.
     */
    function claim() external nonReentrant {
        // Settle any unsettled accumulator gains first
        _settle(msg.sender);

        uint256 amount = settledYield[msg.sender];
        require(amount > 0, "YD: nothing to claim");

        settledYield[msg.sender] = 0;
        totalClaimed += amount;

        // FIX [CRITICAL]: SafeERC20
        sarx.safeTransfer(msg.sender, amount);

        emit YieldClaimed(msg.sender, amount);
    }

    // ── NOTIFY (called by AssetToken BEFORE balance changes) ─

    /**
     * @notice Settles pending yield for both parties in a transfer BEFORE
     *         their balances change. This is the key fix for the balance-at-time bug:
     *         yield is always calculated at the balance the holder actually held
     *         during each deposit, not at claim time.
     *
     *         Only callable by the linked AssetToken.
     */
    function notifyTransfer(address from, address to) external override {
        require(msg.sender == address(assetToken), "YD: not asset token");
        if (from != address(0)) _settle(from);
        if (to   != address(0)) _settle(to);
    }

    // ── INTERNAL ─────────────────────────────────────────────

    /**
     * @dev Moves any unsettled accumulator gains into settledYield[holder].
     *      Must be called with the holder's current (pre-transfer) balance.
     */
    function _settle(address holder) internal {
        uint256 delta = accYieldPerToken - userAccYieldPerToken[holder];
        if (delta > 0) {
            uint256 balance = assetToken.balanceOf(holder);
            settledYield[holder] += (balance * delta) / PRECISION;
            userAccYieldPerToken[holder] = accYieldPerToken;
        }
    }

    // ── VIEW ─────────────────────────────────────────────────

    /**
     * @notice Returns total claimable SARX for a holder (settled + unsettled).
     *         O(1) — safe to call from frontend without gas concern.
     */
    function pendingYield(address holder) external view returns (uint256) {
        uint256 delta   = accYieldPerToken - userAccYieldPerToken[holder];
        uint256 balance = assetToken.balanceOf(holder);
        return settledYield[holder] + (balance * delta) / PRECISION;
    }

    function epochCount() external view returns (uint256) {
        return epochs.length;
    }
}
