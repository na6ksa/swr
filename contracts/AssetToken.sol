// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./KYCWhitelist.sol";
import "./IYieldNotify.sol";

/**
 * @title AssetToken
 * @notice Regulated security token representing fractional ownership of a real-world asset.
 *
 *         Compliance rules enforced on every transfer:
 *         1. Both sender and receiver must be KYC-whitelisted
 *            (ISSUER_ROLE holders are exempt as verified counterparties)
 *         2. Receiver's portfolio value must not exceed their tier investment limit
 *         3. Transfers are pausable by compliance officer
 *         4. Forced transfer bypasses pause + KYC (court order / regulatory seizure)
 *
 * Security fixes applied (v2):
 *   - MEDIUM: issuer_ no longer receives COMPLIANCE_ROLE (role separation)
 *   - MEDIUM: setYieldDistributor has zero-address guard
 *   - HIGH:   investment limit uses Math.mulDiv to avoid precision-loss bypass
 *   - FIX:    _update notifies YieldDistributor before balance changes so yield
 *             is correctly settled per holder (fixes CRITICAL balance-at-time bug)
 */
contract AssetToken is ERC20, AccessControl, Pausable {

    bytes32 public constant ISSUER_ROLE     = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    KYCWhitelist public immutable kyc;

    // Asset metadata
    string  public assetId;
    string  public assetType;
    string  public spvCR;
    uint256 public assetValueSAR;
    bool    public shariahCertified;

    // Yield tracking
    address public yieldDistributor;
    uint256 public totalYieldDistributed;

    // Per-holder balance mirror for investment-limit checks at transfer time
    mapping(address => uint256) public holderBalance;

    // Bypass flag for court-ordered forced transfers
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
        address complianceOfficer_,   // FIX [MEDIUM]: separate compliance officer
        string memory assetId_,
        string memory assetType_,
        string memory spvCR_,
        uint256 assetValueSAR_,
        bool shariahCertified_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        require(kycWhitelist_ != address(0), "AT: zero kyc");
        require(admin_ != address(0), "AT: zero admin");
        require(issuer_ != address(0), "AT: zero issuer");

        kyc              = KYCWhitelist(kycWhitelist_);
        assetId          = assetId_;
        assetType        = assetType_;
        spvCR            = spvCR_;
        assetValueSAR    = assetValueSAR_;
        shariahCertified = shariahCertified_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ISSUER_ROLE,        issuer_);
        // FIX [MEDIUM]: compliance role goes to dedicated officer, not issuer
        _grantRole(COMPLIANCE_ROLE,    complianceOfficer_);

        _mint(issuer_, totalSupply_);
    }

    // ── COMPLIANCE TRANSFER OVERRIDE ─────────────────────────

    function _update(address from, address to, uint256 value) internal override {
        if (!_forcedMode) {
            require(!paused(), "Pausable: paused");

            if (from != address(0) && to != address(0)) {
                if (!hasRole(ISSUER_ROLE, from)) {
                    require(kyc.isWhitelisted(from), "SWR: sender not KYC verified");
                }
                require(kyc.isWhitelisted(to), "SWR: receiver not KYC verified");

                // FIX [HIGH]: use Math.mulDiv to avoid precision loss from integer division.
                // Old code: tokenPrice = assetValueSAR / supply (truncates to 0 when SAR < supply)
                // New code: cross-multiply — avoids the bypass where tokenPrice == 0.
                uint256 supply = totalSupply();
                if (supply > 0) {
                    uint256 limit = kyc.getInvestmentLimit(to);
                    if (limit != type(uint256).max) {
                        // (holderBalance[to] + value) * assetValueSAR / supply <= limit
                        uint256 newValueSAR = Math.mulDiv(
                            holderBalance[to] + value,
                            assetValueSAR,
                            supply
                        );
                        require(newValueSAR <= limit, "SWR: exceeds investment tier limit");
                    }
                }
            }
        }

        // FIX [CRITICAL]: Notify YieldDistributor BEFORE balances change so it can
        // settle each holder's pending yield at their current balance.
        if (yieldDistributor != address(0)) {
            IYieldNotify(yieldDistributor).notifyTransfer(from, to);
        }

        // Sync holderBalance mirror
        if (from != address(0)) holderBalance[from] -= value;
        if (to   != address(0)) holderBalance[to]   += value;

        super._update(from, to, value);
    }

    // ── COMPLIANCE ACTIONS ───────────────────────────────────

    function pause()   external onlyRole(COMPLIANCE_ROLE) { _pause(); }
    function unpause() external onlyRole(COMPLIANCE_ROLE) { _unpause(); }

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
        // FIX [MEDIUM]: zero-address guard prevents bricking recordYieldDistribution
        require(distributor != address(0), "AT: zero distributor");
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
