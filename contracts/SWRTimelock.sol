// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title SWRTimelock
 * @notice Wraps OpenZeppelin TimelockController for the SWR platform.
 *
 *         All critical admin actions (role changes, asset value updates,
 *         investment limit changes, distributor updates) must pass through
 *         this timelock — giving investors and regulators a window to react
 *         before changes take effect.
 *
 *         Deployment parameters:
 *           minDelay   = 172800 (48 hours) for mainnet
 *           proposers  = [Gnosis Safe multisig]
 *           executors  = [Gnosis Safe multisig]
 *           admin      = address(0) — timelock self-administers after deployment
 *
 *         Role model:
 *           PROPOSER_ROLE  → Gnosis Safe (3-of-5 signers propose tx)
 *           EXECUTOR_ROLE  → Gnosis Safe (same multisig executes after delay)
 *           CANCELLER_ROLE → Gnosis Safe (can cancel during delay window)
 *           TIMELOCK_ADMIN → address(0) — no one can bypass the timelock
 *
 *         The AssetToken, KYCWhitelist, and YieldDistributor should have
 *         DEFAULT_ADMIN_ROLE granted to this Timelock address, NOT directly
 *         to the multisig, so every admin action is subject to the 48h delay.
 */
contract SWRTimelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    )
        TimelockController(
            minDelay,
            proposers,
            executors,
            address(0)  // admin = 0 → timelock is self-sovereign after deployment
        )
    {}
}
