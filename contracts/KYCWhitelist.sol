// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title KYCWhitelist
 * @notice On-chain identity registry for SWR platform.
 *         Only whitelisted addresses can hold regulated asset tokens.
 *         Managed by CMA-approved compliance officers.
 */
contract KYCWhitelist is AccessControl {

    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant REGULATOR_ROLE  = keccak256("REGULATOR_ROLE");

    enum InvestorTier { NONE, RETAIL, PROFESSIONAL, INSTITUTIONAL }

    struct Investor {
        bool      approved;
        InvestorTier tier;
        uint256   approvedAt;
        uint256   expiresAt;     // KYC must be renewed (365 days)
        bytes32   kycHash;       // hash of KYC document bundle (stored off-chain)
        string    jurisdiction;  // "SA", "UAE", etc.
        bool      shariahConsent;
    }

    mapping(address => Investor) private _investors;

    // Maximum investment per tier per asset (SAR equivalent in 6-decimal stablecoin)
    mapping(InvestorTier => uint256) public investmentLimit;

    event InvestorApproved(address indexed investor, InvestorTier tier, uint256 expiresAt);
    event InvestorRevoked(address indexed investor, string reason);
    event InvestorUpdated(address indexed investor, InvestorTier newTier);

    constructor(address admin, address complianceOfficer) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);

        // Default limits in SARX (6 decimals) — adjustable by admin
        investmentLimit[InvestorTier.RETAIL]        = 200_000  * 1e6;  // SAR 200K
        investmentLimit[InvestorTier.PROFESSIONAL]  = 2_000_000 * 1e6; // SAR 2M
        investmentLimit[InvestorTier.INSTITUTIONAL] = type(uint256).max; // unlimited
    }

    // ─── WRITE ───────────────────────────────────────────────

    function approveInvestor(
        address investor,
        InvestorTier tier,
        bytes32 kycHash,
        string calldata jurisdiction,
        bool shariahConsent
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(investor != address(0), "KYC: zero address");
        require(tier != InvestorTier.NONE, "KYC: invalid tier");

        uint256 expiry = block.timestamp + 365 days;
        _investors[investor] = Investor({
            approved:       true,
            tier:           tier,
            approvedAt:     block.timestamp,
            expiresAt:      expiry,
            kycHash:        kycHash,
            jurisdiction:   jurisdiction,
            shariahConsent: shariahConsent
        });

        emit InvestorApproved(investor, tier, expiry);
    }

    function revokeInvestor(address investor, string calldata reason)
        external onlyRole(COMPLIANCE_ROLE)
    {
        _investors[investor].approved = false;
        emit InvestorRevoked(investor, reason);
    }

    function updateTier(address investor, InvestorTier newTier)
        external onlyRole(COMPLIANCE_ROLE)
    {
        require(_investors[investor].approved, "KYC: not approved");
        _investors[investor].tier = newTier;
        emit InvestorUpdated(investor, newTier);
    }

    function renewKYC(address investor, bytes32 newKycHash)
        external onlyRole(COMPLIANCE_ROLE)
    {
        require(_investors[investor].approved, "KYC: not approved");
        _investors[investor].kycHash  = newKycHash;
        _investors[investor].expiresAt = block.timestamp + 365 days;
    }

    function setInvestmentLimit(InvestorTier tier, uint256 limit)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        investmentLimit[tier] = limit;
    }

    // ─── READ ────────────────────────────────────────────────

    function isWhitelisted(address investor) external view returns (bool) {
        Investor storage inv = _investors[investor];
        return inv.approved && block.timestamp < inv.expiresAt;
    }

    function getTier(address investor) external view returns (InvestorTier) {
        return _investors[investor].tier;
    }

    function getInvestor(address investor) external view returns (Investor memory) {
        return _investors[investor];
    }

    function getInvestmentLimit(address investor) external view returns (uint256) {
        return investmentLimit[_investors[investor].tier];
    }

    // Regulator read-only access to full investor record
    function regulatorView(address investor)
        external view onlyRole(REGULATOR_ROLE) returns (Investor memory)
    {
        return _investors[investor];
    }
}
