// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./KYCWhitelist.sol";

/**
 * @title AssetToken
 * @notice Regulated security token representing fractional ownership of a real-world asset.
 *         Deployed once per tokenized asset (e.g. a Riyadh apartment building).
 *
 *         Key compliance rules enforced on every transfer:
 *         1. Both sender and receiver must be KYC-whitelisted
 *         2. Transfer cannot exceed receiver's investment tier limit
 *         3. Transfers can be paused by compliance officer (regulatory freeze)
 *         4. Forced transfer available to compliance (court order support)
 */
contract AssetToken is ERC20, AccessControl, Pausable {

    bytes32 public constant ISSUER_ROLE     = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    KYCWhitelist public immutable kyc;

    // Asset metadata (immutable after deployment)
    string  public assetId;         // e.g. "ROSHN-RIYADH-B1-2026"
    string  public assetType;       // "REAL_ESTATE" | "SUKUK" | "COMMODITY" | "INFRASTRUCTURE"
    string  public spvAddress;      // Saudi company registration number of the SPV
    uint256 public assetValueSAR;   // Total asset value in SAR (6 decimals)
    bool    public shariahCertified;

    // Yield tracking
    address public yieldDistributor;
    uint256 public totalYieldDistributed; // SARX distributed lifetime

    // Per-holder tracking for investment limits
    mapping(address => uint256) public holderBalance; // mirrors balanceOf, for limit checks

    event YieldDistributorSet(address indexed distributor);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, string reason);
    event AssetMetadataUpdated(uint256 newValueSAR);

    constructor(
        string memory name_,        // e.g. "SWR Asset: ROSHN Riyadh Block 1"
        string memory symbol_,      // e.g. "xROSHN1"
        address kycWhitelist_,
        address admin_,
        address issuer_,
        string memory assetId_,
        string memory assetType_,
        string memory spvAddress_,
        uint256 assetValueSAR_,
        bool shariahCertified_,
        uint256 totalSupply_        // number of fractional tokens (e.g. 1,000,000)
    ) ERC20(name_, symbol_) {
        kyc             = KYCWhitelist(kycWhitelist_);
        assetId         = assetId_;
        assetType       = assetType_;
        spvAddress      = spvAddress_;
        assetValueSAR   = assetValueSAR_;
        shariahCertified = shariahCertified_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE,        issuer_);
        _grantRole(COMPLIANCE_ROLE,    issuer_);

        _mint(issuer_, totalSupply_);
    }

    // ─── COMPLIANCE TRANSFER OVERRIDE ────────────────────────

    function _update(address from, address to, uint256 value)
        internal override whenNotPaused
    {
        // Minting (from == 0) and burning (to == 0) bypass whitelist
        if (from != address(0) && to != address(0)) {
            require(kyc.isWhitelisted(from), "SWR: sender not KYC verified");
            require(kyc.isWhitelisted(to),   "SWR: receiver not KYC verified");

            // Check investment limit for receiver
            uint256 limit = kyc.getInvestmentLimit(to);
            uint256 tokenPrice = assetValueSAR / totalSupply(); // SAR per token (6 dec)
            uint256 addedValue = value * tokenPrice;
            require(
                holderBalance[to] * tokenPrice + addedValue <= limit,
                "SWR: exceeds investment tier limit"
            );
        }

        if (from != address(0)) holderBalance[from] -= value;
        if (to   != address(0)) holderBalance[to]   += value;

        super._update(from, to, value);
    }

    // ─── ISSUER ACTIONS ─────────────────────────────────────

    // Compliance officers can freeze the token (regulatory requirement)
    function pause() external onlyRole(COMPLIANCE_ROLE) { _pause(); }
    function unpause() external onlyRole(COMPLIANCE_ROLE) { _unpause(); }

    // Forced transfer — court order or regulatory seizure
    function forcedTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(COMPLIANCE_ROLE) {
        _update(from, to, amount); // bypasses pause check intentionally
        emit ForcedTransfer(from, to, amount, reason);
    }

    function setYieldDistributor(address distributor)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        yieldDistributor = distributor;
        emit YieldDistributorSet(distributor);
    }

    function updateAssetValue(uint256 newValueSAR)
        external onlyRole(ISSUER_ROLE)
    {
        assetValueSAR = newValueSAR;
        emit AssetMetadataUpdated(newValueSAR);
    }

    function recordYieldDistribution(uint256 amount) external {
        require(msg.sender == yieldDistributor, "SWR: not yield distributor");
        totalYieldDistributed += amount;
    }

    // ─── VIEW ────────────────────────────────────────────────

    function tokenPriceSAR() external view returns (uint256) {
        return assetValueSAR / totalSupply();
    }

    function decimals() public pure override returns (uint8) { return 6; }
}
