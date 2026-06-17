// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./KYCWhitelist.sol";

/**
 * @title AssetToken
 * @notice Regulated security token representing fractional ownership of a real-world asset.
 *
 *         Compliance rules enforced on every transfer:
 *         1. Both sender and receiver must be KYC-whitelisted
 *            (ISSUER_ROLE holders are exempt as verified counterparties)
 *         2. Receiver's balance × token price must not exceed their tier limit
 *         3. Transfers are pausable by compliance officer
 *         4. Forced transfer bypasses pause + KYC (court order / regulatory seizure)
 */
contract AssetToken is ERC20, AccessControl, Pausable {

    bytes32 public constant ISSUER_ROLE     = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    KYCWhitelist public immutable kyc;

    // Asset metadata (immutable after deployment)
    string  public assetId;
    string  public assetType;       // "REAL_ESTATE" | "SUKUK" | "COMMODITY" | "INFRASTRUCTURE"
    string  public spvCR;           // Saudi CR number of the SPV
    uint256 public assetValueSAR;   // Total asset value in SAR (6 decimals)
    bool    public shariahCertified;

    // Yield tracking
    address public yieldDistributor;
    uint256 public totalYieldDistributed;

    // Per-holder balance mirror (needed for limit checks at transfer time)
    mapping(address => uint256) public holderBalance;

    // Flag that lets forcedTransfer bypass pause and compliance checks
    bool private _forcedMode;

    event YieldDistributorSet(address indexed distributor);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, string reason);
    event AssetValueUpdated(uint256 newValueSAR);

    constructor(
        string memory name_,
        string memory symbol_,
        address kycWhitelist_,
        address admin_,
        address issuer_,
        string memory assetId_,
        string memory assetType_,
        string memory spvCR_,
        uint256 assetValueSAR_,
        bool shariahCertified_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        kyc              = KYCWhitelist(kycWhitelist_);
        assetId          = assetId_;
        assetType        = assetType_;
        spvCR            = spvCR_;
        assetValueSAR    = assetValueSAR_;
        shariahCertified = shariahCertified_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE,        issuer_);
        _grantRole(COMPLIANCE_ROLE,    issuer_);

        _mint(issuer_, totalSupply_);
    }

    // ── COMPLIANCE TRANSFER OVERRIDE ─────────────────────────

    function _update(address from, address to, uint256 value) internal override {
        // Forced transfers (court orders) bypass all checks
        if (!_forcedMode) {
            // Normal transfers must not be paused
            require(!paused(), "Pausable: paused");

            // Minting (from=0) and burning (to=0) skip investor checks
            if (from != address(0) && to != address(0)) {

                // ISSUER_ROLE holders are verified counterparties — exempt from KYC check
                if (!hasRole(ISSUER_ROLE, from)) {
                    require(kyc.isWhitelisted(from), "SWR: sender not KYC verified");
                }
                require(kyc.isWhitelisted(to), "SWR: receiver not KYC verified");

                // Investment limit always enforced — even on issuer distributions
                uint256 supply = totalSupply();
                if (supply > 0) {
                    uint256 tokenPrice = assetValueSAR / supply;
                    uint256 newValue   = (holderBalance[to] + value) * tokenPrice;
                    uint256 limit      = kyc.getInvestmentLimit(to);
                    require(newValue <= limit, "SWR: exceeds investment tier limit");
                }
            }
        }

        // Keep holderBalance in sync
        if (from != address(0)) holderBalance[from] -= value;
        if (to   != address(0)) holderBalance[to]   += value;

        super._update(from, to, value);
    }

    // ── ISSUER / COMPLIANCE ACTIONS ──────────────────────────

    function pause()   external onlyRole(COMPLIANCE_ROLE) { _pause(); }
    function unpause() external onlyRole(COMPLIANCE_ROLE) { _unpause(); }

    // Court order or regulatory seizure — bypasses pause and KYC
    function forcedTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(COMPLIANCE_ROLE) {
        _forcedMode = true;
        _update(from, to, amount);
        _forcedMode = false;
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
        emit AssetValueUpdated(newValueSAR);
    }

    function recordYieldDistribution(uint256 amount) external {
        require(msg.sender == yieldDistributor, "SWR: not yield distributor");
        totalYieldDistributed += amount;
    }

    // ── VIEW ─────────────────────────────────────────────────

    function tokenPriceSAR() external view returns (uint256) {
        uint256 supply = totalSupply();
        return supply > 0 ? assetValueSAR / supply : 0;
    }

    function decimals() public pure override returns (uint8) { return 6; }
}
