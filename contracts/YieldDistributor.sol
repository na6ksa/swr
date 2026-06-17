// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AssetToken.sol";

/**
 * @title YieldDistributor
 * @notice Distributes SARX yield (rent, sukuk coupons, dividends) to asset token holders
 *         on a pro-rata basis. One distributor per AssetToken.
 *
 *         Flow:
 *         1. Asset manager deposits SARX (rent collected from tenants)
 *         2. distribute() is called — creates a new yield epoch
 *         3. Token holders claim their share anytime
 *
 *         Unclaimed yield rolls over. No expiry.
 */
contract YieldDistributor is AccessControl, ReentrancyGuard {

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    AssetToken  public immutable assetToken;
    IERC20      public immutable sarx;         // SAR stablecoin

    struct Epoch {
        uint256 totalYield;        // SARX deposited for this epoch
        uint256 totalSupplySnap;   // assetToken.totalSupply() at snapshot
        uint256 timestamp;
        string  description;       // e.g. "Q1 2027 Rental Income"
    }

    Epoch[]  public epochs;
    mapping(address => uint256) public lastClaimedEpoch; // per holder

    uint256 public totalDistributed;
    uint256 public totalClaimed;

    event YieldDeposited(uint256 indexed epochId, uint256 amount, string description);
    event YieldClaimed(address indexed holder, uint256 amount, uint256 fromEpoch, uint256 toEpoch);

    constructor(address assetToken_, address sarx_, address admin_, address manager_) {
        assetToken = AssetToken(assetToken_);
        sarx       = IERC20(sarx_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MANAGER_ROLE, manager_);
    }

    // ─── DEPOSIT ────────────────────────────────────────────

    /**
     * @notice Asset manager deposits SARX yield for distribution.
     *         Manager must approve this contract to spend SARX first.
     */
    function depositYield(uint256 amount, string calldata description)
        external onlyRole(MANAGER_ROLE) nonReentrant
    {
        require(amount > 0, "YD: zero amount");
        require(assetToken.totalSupply() > 0, "YD: no tokens issued");

        sarx.transferFrom(msg.sender, address(this), amount);

        uint256 epochId = epochs.length;
        epochs.push(Epoch({
            totalYield:       amount,
            totalSupplySnap:  assetToken.totalSupply(),
            timestamp:        block.timestamp,
            description:      description
        }));

        totalDistributed += amount;
        assetToken.recordYieldDistribution(amount);

        emit YieldDeposited(epochId, amount, description);
    }

    // ─── CLAIM ──────────────────────────────────────────────

    /**
     * @notice Holder claims all unclaimed yield across all epochs.
     */
    function claim() external nonReentrant {
        uint256 startEpoch = lastClaimedEpoch[msg.sender];
        uint256 endEpoch   = epochs.length;
        require(startEpoch < endEpoch, "YD: nothing to claim");

        uint256 claimable = _pendingYield(msg.sender, startEpoch, endEpoch);
        require(claimable > 0, "YD: zero yield");

        lastClaimedEpoch[msg.sender] = endEpoch;
        totalClaimed += claimable;

        sarx.transfer(msg.sender, claimable);

        emit YieldClaimed(msg.sender, claimable, startEpoch, endEpoch);
    }

    // ─── VIEW ────────────────────────────────────────────────

    function pendingYield(address holder) external view returns (uint256) {
        return _pendingYield(holder, lastClaimedEpoch[holder], epochs.length);
    }

    function epochCount() external view returns (uint256) {
        return epochs.length;
    }

    function _pendingYield(address holder, uint256 from, uint256 to)
        internal view returns (uint256 total)
    {
        uint256 balance = assetToken.balanceOf(holder);
        if (balance == 0) return 0;

        for (uint256 i = from; i < to; i++) {
            Epoch storage e = epochs[i];
            total += (balance * e.totalYield) / e.totalSupplySnap;
        }
    }
}
