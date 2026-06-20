// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface AssetToken uses to notify YieldDistributor of transfers.
///         Keeps import direction one-way: YieldDistributor → AssetToken only.
interface IYieldNotify {
    function notifyTransfer(address from, address to) external;
}
