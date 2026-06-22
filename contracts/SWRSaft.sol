// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SWRSaft
 * @notice Simple Agreement for Future Tokens — private investor round.
 *
 *         Each investor is assigned a SWR allocation at deployment.
 *         Tokens are held in escrow until the owner triggers the vesting
 *         start (e.g. mainnet launch). After the cliff, tokens unlock
 *         linearly over the vesting duration.
 *
 *         Parameters:
 *           Price       : $0.015 per SWR (~50% discount to public sale)
 *           Cliff       : 6 months after vestingStart
 *           Vesting     : 12 months linear after cliff (18 months total)
 *           Allocation  : from the 18% Investor (SAFT) tranche
 *           Min ticket  : $25,000
 *           Max ticket  : $100,000
 */
contract SWRSaft is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable swrToken;

    // ── VESTING PARAMETERS ────────────────────────────────────
    uint256 public constant CLIFF_DURATION   = 180 days;  // 6 months
    uint256 public constant VESTING_DURATION = 360 days;  // 12 months linear after cliff

    uint256 public vestingStart;   // set by owner at mainnet launch
    bool    public vestingActive;

    // ── INVESTOR REGISTRY ────────────────────────────────────
    struct Investor {
        uint256 totalAllocation;  // total SWR allocated
        uint256 claimed;          // SWR already claimed
        uint256 ethContributed;   // ETH paid (for records)
        bool    registered;
    }

    mapping(address => Investor) public investors;
    address[] public investorList;

    uint256 public totalAllocated;
    uint256 public totalClaimed;

    // ── EVENTS ────────────────────────────────────────────────
    event InvestorAdded(address indexed investor, uint256 swrAllocation, uint256 ethContributed);
    event VestingStarted(uint256 startTime);
    event TokensClaimed(address indexed investor, uint256 amount);

    constructor(address swrToken_) Ownable(msg.sender) {
        require(swrToken_ != address(0), "zero token");
        swrToken = IERC20(swrToken_);
    }

    // ── ADMIN: Register investors ─────────────────────────────

    /**
     * @notice Register a SAFT investor. Call once per investor before
     *         depositing tokens. ethContributed is recorded for reference only.
     */
    function addInvestor(
        address investor,
        uint256 swrAllocation,
        uint256 ethContributed
    ) external onlyOwner {
        require(investor != address(0), "zero address");
        require(!investors[investor].registered, "already registered");
        require(swrAllocation > 0, "zero allocation");

        investors[investor] = Investor({
            totalAllocation: swrAllocation,
            claimed:         0,
            ethContributed:  ethContributed,
            registered:      true
        });
        investorList.push(investor);
        totalAllocated += swrAllocation;

        emit InvestorAdded(investor, swrAllocation, ethContributed);
    }

    /**
     * @notice Batch register multiple investors in one transaction.
     */
    function addInvestorsBatch(
        address[] calldata addrs,
        uint256[] calldata allocations,
        uint256[] calldata contributions
    ) external onlyOwner {
        require(addrs.length == allocations.length && addrs.length == contributions.length, "length mismatch");
        for (uint256 i = 0; i < addrs.length; i++) {
            require(!investors[addrs[i]].registered, "already registered");
            investors[addrs[i]] = Investor({
                totalAllocation: allocations[i],
                claimed:         0,
                ethContributed:  contributions[i],
                registered:      true
            });
            investorList.push(addrs[i]);
            totalAllocated += allocations[i];
            emit InvestorAdded(addrs[i], allocations[i], contributions[i]);
        }
    }

    // ── ADMIN: Start vesting ──────────────────────────────────

    /**
     * @notice Trigger vesting start — call at mainnet launch.
     *         Contract must hold enough SWR to cover all allocations.
     */
    function startVesting() external onlyOwner {
        require(!vestingActive, "already started");
        require(swrToken.balanceOf(address(this)) >= totalAllocated, "insufficient SWR");
        vestingStart  = block.timestamp;
        vestingActive = true;
        emit VestingStarted(vestingStart);
    }

    // ── CLAIM ─────────────────────────────────────────────────

    function claim() external nonReentrant {
        Investor storage inv = investors[msg.sender];
        require(inv.registered, "not an investor");
        require(vestingActive, "vesting not started");

        uint256 claimable = _claimable(msg.sender);
        require(claimable > 0, "nothing to claim");

        inv.claimed  += claimable;
        totalClaimed += claimable;

        swrToken.safeTransfer(msg.sender, claimable);
        emit TokensClaimed(msg.sender, claimable);
    }

    // ── VIEW ──────────────────────────────────────────────────

    function claimable(address investor) external view returns (uint256) {
        return _claimable(investor);
    }

    function _claimable(address investor) internal view returns (uint256) {
        if (!vestingActive) return 0;
        Investor storage inv = investors[investor];
        if (!inv.registered) return 0;

        uint256 elapsed = block.timestamp - vestingStart;

        // Before cliff
        if (elapsed < CLIFF_DURATION) return 0;

        // After cliff — linear unlock
        uint256 afterCliff = elapsed - CLIFF_DURATION;
        uint256 vested;
        if (afterCliff >= VESTING_DURATION) {
            vested = inv.totalAllocation; // fully vested
        } else {
            vested = (inv.totalAllocation * afterCliff) / VESTING_DURATION;
        }

        return vested > inv.claimed ? vested - inv.claimed : 0;
    }

    function vestingStatus(address investor) external view returns (
        uint256 total,
        uint256 vested,
        uint256 claimed_,
        uint256 claimableNow,
        uint256 cliffEnds,
        uint256 fullyVestedAt
    ) {
        Investor storage inv = investors[investor];
        uint256 elapsed = vestingActive ? block.timestamp - vestingStart : 0;
        uint256 afterCliff = elapsed > CLIFF_DURATION ? elapsed - CLIFF_DURATION : 0;
        uint256 v = vestingActive && elapsed >= CLIFF_DURATION
            ? (afterCliff >= VESTING_DURATION ? inv.totalAllocation : (inv.totalAllocation * afterCliff) / VESTING_DURATION)
            : 0;

        return (
            inv.totalAllocation,
            v,
            inv.claimed,
            _claimable(investor),
            vestingActive ? vestingStart + CLIFF_DURATION : 0,
            vestingActive ? vestingStart + CLIFF_DURATION + VESTING_DURATION : 0
        );
    }

    function investorCount() external view returns (uint256) {
        return investorList.length;
    }

    // ── EMERGENCY ─────────────────────────────────────────────

    /// @notice Recover tokens accidentally sent to this contract (not SWR).
    function recoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(swrToken), "cannot recover SWR");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
