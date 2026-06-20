// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SWRToken
 * @notice Utility token for the SWR platform.
 *         Fixed supply: 200,000,000 SWR minted at deployment.
 *         NOT a security — utility for gas, staking, governance, and fee discounts.
 *
 * Allocation (distributed via vesting contracts):
 *   35% Community & Ecosystem
 *   20% Team & Advisors (4-year vesting)
 *   18% Investors (SAFT)
 *   15% Protocol Treasury
 *    7% Staking Rewards
 *    5% Public Sale
 */
contract SWRToken is ERC20, ERC20Burnable, AccessControl {

    uint256 public constant MAX_SUPPLY = 200_000_000 * 1e18;

    // 50% fee discount when platform fees are paid in SWR
    uint16  public constant FEE_DISCOUNT_BPS = 5000;

    // Minimum SWR staked to run a validator node
    uint256 public constant VALIDATOR_MIN_STAKE = 10_000 * 1e18;

    // Buyback treasury — receives 30% of protocol revenue for quarterly burns
    address public buybackTreasury;

    event BuybackTreasuryUpdated(address indexed newTreasury);
    event TreasuryBurn(uint256 amount);

    constructor(
        address admin,
        address treasury,
        address communityMultisig,
        address teamVesting,
        address investorVesting,
        address stakingRewards,
        address publicSale
    ) ERC20("SWR Token", "SWR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        buybackTreasury = treasury;

        // FIX [LOW]: use absolute amounts to prevent integer-division dust
        // 200M total: 70M + 40M + 36M + 30M + 14M + 10M = 200M exactly
        _mint(communityMultisig,  70_000_000 * 1e18);  // 35%
        _mint(teamVesting,        40_000_000 * 1e18);  // 20%
        _mint(investorVesting,    36_000_000 * 1e18);  // 18%
        _mint(treasury,           30_000_000 * 1e18);  // 15%
        _mint(stakingRewards,     14_000_000 * 1e18);  //  7%
        _mint(publicSale,         10_000_000 * 1e18);  //  5%
    }

    // ── ADMIN ──────────────────────────────────────────

    function setBuybackTreasury(address newTreasury)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newTreasury != address(0), "SWR: zero address");
        buybackTreasury = newTreasury;
        emit BuybackTreasuryUpdated(newTreasury);
    }

    // Called quarterly: 30% of protocol revenue buys SWR from market, then burns here
    function burnFromTreasury(uint256 amount)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _burn(buybackTreasury, amount);
        emit TreasuryBurn(amount);
    }
}
