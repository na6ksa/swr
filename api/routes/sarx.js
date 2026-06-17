/**
 * SARX Routes — /api/v1/sarx
 *
 * GET  /api/v1/sarx/balance/:address   SARX balance for a wallet
 * POST /api/v1/sarx/mint               [ADMIN] Mint SARX against SAR deposit confirmation
 * POST /api/v1/sarx/redeem             Request SAR redemption (burns SARX on-chain)
 */
const express    = require("express");
const Joi        = require("joi");
const { ethers } = require("ethers");
const router     = express.Router();

// SARX is an ERC20 — we use the standard ABI subset
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

function getSARX(signed = false) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  if (!signed) return new ethers.Contract(process.env.SARX_CONTRACT_ADDRESS, ERC20_ABI, provider);
  const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.SARX_CONTRACT_ADDRESS, ERC20_ABI, signer);
}

// ── GET /balance/:address ──────────────────────────────────
router.get("/balance/:address", async (req, res) => {
  if (!ethers.isAddress(req.params.address)) {
    return res.status(400).json({ error: "Invalid address" });
  }
  try {
    const sarx    = getSARX();
    const balance = await sarx.balanceOf(req.params.address);
    res.json({
      address: req.params.address,
      sarxBalance: balance.toString(),
      sarBalance:  (Number(balance) / 1_000_000).toFixed(2),  // 6 decimals → SAR
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to read balance", detail: err.message });
  }
});

// ── POST /mint ─────────────────────────────────────────────
// Called by compliance after confirming SAR bank transfer
const mintSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  sarAmount:     Joi.number().positive().max(10_000_000).required(), // SAR (whole units)
  bankRefNo:     Joi.string().min(5).max(50).required(),
  apiSecret:     Joi.string().required(),
});

router.post("/mint", async (req, res) => {
  const { error, value } = mintSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  if (value.apiSecret !== process.env.COMPLIANCE_API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const sarx       = getSARX(true);
    const sarxAmount = BigInt(Math.floor(value.sarAmount * 1_000_000));
    const tx         = await sarx.mint(value.walletAddress, sarxAmount);
    await tx.wait();

    res.json({
      success:       true,
      txHash:        tx.hash,
      walletAddress: value.walletAddress,
      sarAmount:     value.sarAmount,
      sarxMinted:    sarxAmount.toString(),
      bankRefNo:     value.bankRefNo,
    });
  } catch (err) {
    res.status(500).json({ error: "Mint failed", detail: err.message });
  }
});

// ── POST /redeem ───────────────────────────────────────────
// User requests SAR redemption — SARX is burned, SAR sent via bank transfer
const redeemSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  sarAmount:     Joi.number().positive().max(5_000_000).required(),
  ibanNumber:    Joi.string().min(15).max(34).required(),  // Saudi IBAN
  walletSig:     Joi.string().required(), // Wallet signature proving ownership
});

router.post("/redeem", async (_req, res) => {
  // In production:
  // 1. Verify walletSig against walletAddress
  // 2. Verify IBAN belongs to a Saudi bank
  // 3. Check SARX balance >= sarAmount
  // 4. Burn SARX on-chain
  // 5. Initiate SWIFT/SARIE transfer to IBAN
  res.status(202).json({
    status:  "PENDING",
    message: "Redemption request received. SAR will be transferred within 1 business day.",
    note:    "Full redemption flow integrated with Saudi banking partner in production.",
  });
});

module.exports = router;
