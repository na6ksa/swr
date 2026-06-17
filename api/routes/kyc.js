/**
 * KYC Routes — /api/v1/kyc
 *
 * POST /api/v1/kyc/apply       Submit KYC application
 * GET  /api/v1/kyc/status/:addr  Check on-chain whitelist status
 * POST /api/v1/kyc/approve     [COMPLIANCE] Approve investor on-chain
 * POST /api/v1/kyc/revoke      [COMPLIANCE] Revoke investor
 */
const express    = require("express");
const Joi        = require("joi");
const { ethers } = require("ethers");
const router     = express.Router();

const KYC_ABI = require("../../artifacts/contracts/KYCWhitelist.sol/KYCWhitelist.json").abi;

function getKYCContract() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  return new ethers.Contract(process.env.KYC_CONTRACT_ADDRESS, KYC_ABI, provider);
}

function getKYCContractSigned() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer   = new ethers.Wallet(process.env.COMPLIANCE_PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.KYC_CONTRACT_ADDRESS, KYC_ABI, signer);
}

// ── POST /kyc/apply ────────────────────────────────────────
// Submit KYC application (documents stored off-chain, hash on-chain)
const applySchema = Joi.object({
  walletAddress:   Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  fullName:        Joi.string().min(2).max(100).required(),
  nationalId:      Joi.string().min(10).max(20).required(),
  dateOfBirth:     Joi.string().isoDate().required(),
  nationality:     Joi.string().length(2).required(),  // ISO 3166-1 alpha-2 e.g. "SA"
  investorType:    Joi.string().valid("RETAIL", "PROFESSIONAL", "INSTITUTIONAL").required(),
  shariahConsent:  Joi.boolean().required(),
  email:           Joi.string().email().required(),
  phone:           Joi.string().min(10).max(20).required(),
});

router.post("/apply", async (req, res) => {
  const { error, value } = applySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  // In production: upload documents to encrypted IPFS, run AML check,
  // generate kycHash, queue for compliance officer review.
  // Here we simulate acceptance and return application ID.
  const applicationId = `KYC-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

  res.status(202).json({
    applicationId,
    status:     "PENDING_REVIEW",
    message:    "KYC application received. Compliance review typically takes 1-2 business days.",
    walletAddress: value.walletAddress,
    submittedAt:   new Date().toISOString(),
  });
});

// ── GET /kyc/status/:address ───────────────────────────────
// Check on-chain whitelist status for a wallet address
router.get("/status/:address", async (req, res) => {
  const { address } = req.params;

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }

  try {
    const kyc = getKYCContract();
    const [whitelisted, tier] = await Promise.all([
      kyc.isWhitelisted(address),
      kyc.getTier(address),
    ]);

    const TIER_NAMES = { 0: "NONE", 1: "RETAIL", 2: "PROFESSIONAL", 3: "INSTITUTIONAL" };

    res.json({
      address,
      whitelisted,
      tier: TIER_NAMES[Number(tier)] || "NONE",
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("KYC status check failed:", err.message);
    res.status(500).json({ error: "Failed to check on-chain status" });
  }
});

// ── POST /kyc/approve ──────────────────────────────────────
// [COMPLIANCE ONLY] Approve investor on-chain after manual KYC review
const approveSchema = Joi.object({
  walletAddress:  Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  tier:           Joi.number().integer().min(1).max(3).required(),
  kycDocHash:     Joi.string().required(),   // IPFS hash of KYC document bundle
  jurisdiction:   Joi.string().length(2).required(),
  shariahConsent: Joi.boolean().required(),
  apiSecret:      Joi.string().required(),    // simple secret for demo; use auth middleware in prod
});

router.post("/approve", async (req, res) => {
  const { error, value } = approveSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  if (value.apiSecret !== process.env.COMPLIANCE_API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const kyc      = getKYCContractSigned();
    const kycHash  = ethers.keccak256(ethers.toUtf8Bytes(value.kycDocHash));
    const tx = await kyc.approveInvestor(
      value.walletAddress,
      value.tier,
      kycHash,
      value.jurisdiction,
      value.shariahConsent
    );
    await tx.wait();

    res.json({
      success: true,
      txHash:  tx.hash,
      message: `Investor ${value.walletAddress} approved on-chain`,
    });
  } catch (err) {
    console.error("KYC approve failed:", err.message);
    res.status(500).json({ error: "On-chain transaction failed", detail: err.message });
  }
});

// ── POST /kyc/revoke ───────────────────────────────────────
router.post("/revoke", async (req, res) => {
  const schema = Joi.object({
    walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    reason:        Joi.string().min(5).max(200).required(),
    apiSecret:     Joi.string().required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  if (value.apiSecret !== process.env.COMPLIANCE_API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const kyc = getKYCContractSigned();
    const tx  = await kyc.revokeInvestor(value.walletAddress, value.reason);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: "On-chain transaction failed", detail: err.message });
  }
});

module.exports = router;
