// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title SWRToken
 * @notice Utility and governance token for the SWR platform.
 *         Fixed supply: 200,000,000 SWR.
 *         NOT a security — utility for gas, staking, governance, and fee discounts.
 *
 * Allocation (set at deployment, distributed via vesting contracts):
 *   35% Community & Ecosystem
 *   20% Team & Advisors (4-year vesting)
 *   18% Investors (SAFT)
 *   15% Protocol Treasury
 *    7% Staking Rewards
 *    5% Public Sale
 */
contract SWRToken is ERC20, ERC20Burnable, AccessControl, ERC20Votes {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 200_000_000 * 1e18;

    // Protocol fee discount for paying in SWR (basis points — 5000 = 50%)
    uint16 public constant SWR_FEE_DISCOUNT_BPS = 5000;

    // Minimum SWR staked to run a validator node
    uint256 public constant VALIDATOR_MIN_STAKE = 10_000 * 1e18;

    // Buyback treasury — receives 30% of protocol revenue for burns
    address public buybackTreasury;

    event BuybackTreasuryUpdated(address indexed newTreasury);

    constructor(
        address admin,
        address treasury,
        address communityMultisig,
        address teamVesting,
        address investorVesting,
        address stakingRewards,
        address publicSale
    )
        ERC20("SWR Token", "SWR")
        EIP712("SWR Token", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        buybackTreasury = treasury;

        // Mint full supply at deployment; distributed to allocation contracts
        _mint(communityMultisig, MAX_SUPPLY * 35 / 100);   // 35%
        _mint(teamVesting,       MAX_SUPPLY * 20 / 100);   // 20%
        _mint(investorVesting,   MAX_SUPPLY * 18 / 100);   // 18%
        _mint(treasury,          MAX_SUPPLY * 15 / 100);   // 15%
        _mint(stakingRewards,    MAX_SUPPLY *  7 / 100);   //  7%
        _mint(publicSale,        MAX_SUPPLY *  5 / 100);   //  5%
    }

    // ─── GOVERNANCE ─────────────────────────────────────────

    // ERC20Votes: snapshot voting weight at proposal time
    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public view override(ERC20Permit, Nonces) returns (uint256)
    {
        return super.nonces(owner);
    }

    // ─── ADMIN ──────────────────────────────────────────────

    function setBuybackTreasury(address newTreasury)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newTreasury != address(0), "SWR: zero address");
        buybackTreasury = newTreasury;
        emit BuybackTreasuryUpdated(newTreasury);
    }

    // Protocol calls this quarterly: buys SWR from market, sends here, then burns
    function burnFromTreasury(uint256 amount)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _burn(buybackTreasury, amount);
    }
}
