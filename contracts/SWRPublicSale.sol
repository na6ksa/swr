// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SWRPublicSale
 * @notice Public token sale for SWR utility token.
 *
 *         Sale parameters:
 *           - 10,000,000 SWR (5% of total supply)
 *           - Price: 0.0000033 ETH per SWR (~$0.01 at $3000/ETH)
 *           - Hard cap: 100 ETH raised
 *           - Min per wallet: 0.01 ETH (~333 SWR)
 *           - Max per wallet: 2 ETH (~66,666 SWR)
 *
 *         Flow:
 *           1. Owner deposits 10,000,000 SWR into this contract
 *           2. Sale opens (startTime)
 *           3. Buyers send ETH → receive SWR instantly
 *           4. Sale ends when hardCap reached or endTime passes
 *           5. Owner withdraws raised ETH
 *           6. Unsold SWR returned to owner
 */
contract SWRPublicSale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable swrToken;

    // ── SALE PARAMETERS ──────────────────────────────────────
    uint256 public constant PRICE_PER_TOKEN = 0.0000033 ether; // ETH per 1 SWR (~$0.01 at $3000/ETH)
    uint256 public constant HARD_CAP        = 100 ether;       // max ETH raised
    uint256 public constant SALE_SUPPLY     = 10_000_000 * 1e18; // 10M SWR
    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;
    uint256 public constant MAX_CONTRIBUTION = 2 ether;

    uint256 public startTime;
    uint256 public endTime;

    // ── STATE ─────────────────────────────────────────────────
    uint256 public totalRaised;
    uint256 public totalSold;
    mapping(address => uint256) public contributed; // ETH contributed per wallet
    mapping(address => uint256) public purchased;   // SWR received per wallet

    bool public finalized;

    // ── EVENTS ────────────────────────────────────────────────
    event TokensPurchased(address indexed buyer, uint256 ethPaid, uint256 swrReceived);
    event SaleFinalized(uint256 totalRaised, uint256 totalSold);
    event UnsoldReturned(uint256 amount);

    constructor(
        address swrToken_,
        uint256 startTime_,
        uint256 endTime_
    ) Ownable(msg.sender) {
        require(swrToken_ != address(0), "zero token");
        require(startTime_ > block.timestamp, "start must be future");
        require(endTime_ > startTime_, "end must be after start");

        swrToken  = IERC20(swrToken_);
        startTime = startTime_;
        endTime   = endTime_;
    }

    // ── BUY ──────────────────────────────────────────────────

    receive() external payable {
        buy();
    }

    function buy() public payable nonReentrant {
        require(isActive(), "sale not active");
        require(msg.value >= MIN_CONTRIBUTION, "below minimum");
        require(contributed[msg.sender] + msg.value <= MAX_CONTRIBUTION, "exceeds wallet cap");
        require(totalRaised + msg.value <= HARD_CAP, "hard cap reached");

        uint256 swrAmount = (msg.value * 1e18) / PRICE_PER_TOKEN;
        require(swrToken.balanceOf(address(this)) >= swrAmount, "insufficient SWR in contract");

        contributed[msg.sender] += msg.value;
        purchased[msg.sender]   += swrAmount;
        totalRaised             += msg.value;
        totalSold               += swrAmount;

        swrToken.safeTransfer(msg.sender, swrAmount);
        emit TokensPurchased(msg.sender, msg.value, swrAmount);
    }

    // ── ADMIN ─────────────────────────────────────────────────

    function finalize() external onlyOwner {
        require(!isActive(), "sale still active");
        require(!finalized, "already finalized");
        finalized = true;

        // Return unsold SWR to owner
        uint256 unsold = swrToken.balanceOf(address(this));
        if (unsold > 0) {
            swrToken.safeTransfer(owner(), unsold);
            emit UnsoldReturned(unsold);
        }

        // Send raised ETH to owner
        uint256 raised = address(this).balance;
        if (raised > 0) {
            (bool ok,) = owner().call{value: raised}("");
            require(ok, "ETH transfer failed");
        }

        emit SaleFinalized(totalRaised, totalSold);
    }

    function updateTimes(uint256 newStart, uint256 newEnd) external onlyOwner {
        require(!isActive(), "sale is live");
        require(newEnd > newStart, "invalid range");
        startTime = newStart;
        endTime   = newEnd;
    }

    // ── VIEW ──────────────────────────────────────────────────

    function isActive() public view returns (bool) {
        return block.timestamp >= startTime
            && block.timestamp <= endTime
            && totalRaised < HARD_CAP
            && !finalized;
    }

    function swrRemaining() external view returns (uint256) {
        return swrToken.balanceOf(address(this));
    }

    function ethToSwr(uint256 ethAmount) external pure returns (uint256) {
        return (ethAmount * 1e18) / PRICE_PER_TOKEN;
    }

    function saleInfo() external view returns (
        bool active,
        uint256 raised,
        uint256 sold,
        uint256 remaining,
        uint256 start,
        uint256 end
    ) {
        return (
            isActive(),
            totalRaised,
            totalSold,
            HARD_CAP - totalRaised,
            startTime,
            endTime
        );
    }
}
