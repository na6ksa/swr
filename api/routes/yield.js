/**
 * Yield Routes — /api/v1/yield
 *
 * GET  /api/v1/yield/pending/:address      Pending yield across all assets
 * POST /api/v1/yield/deposit               [MANAGER] Deposit yield for an asset
 */
const express    = require("express");
const Joi        = require("joi");
const { ethers } = require("ethers");
const router     = express.Router();

const YIELD_ABI = require("../../artifacts/contracts/YieldDistributor.sol/YieldDistributor.json").abi;

// Map of asset symbol → YieldDistributor contract address
const DISTRIBUTORS = {
  xROSHN1: process.env.YIELD_ROSHN1_ADDRESS,
};

function getDistributor(address) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  return new ethers.Contract(address, YIELD_ABI, provider);
}
function getDistributorSigned(address) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer   = new ethers.Wallet(process.env.MANAGER_PRIVATE_KEY, provider);
  return new ethers.Contract(address, YIELD_ABI, signer);
}

// ── GET /pending/:address ──────────────────────────────────
router.get("/pending/:address", async (req, res) => {
  const { address } = req.params;
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }

  const results = [];
  for (const [symbol, distAddr] of Object.entries(DISTRIBUTORS)) {
    if (!distAddr) continue;
    try {
      const dist    = getDistributor(distAddr);
      const pending = await dist.pendingYield(address);
      if (pending > 0n) {
        results.push({ symbol, distributorAddress: distAddr, pendingSARX: pending.toString() });
      }
    } catch (err) {
      console.error(`Yield check failed for ${symbol}:`, err.message);
    }
  }

  const totalPending = results.reduce((sum, r) => sum + BigInt(r.pendingSARX), 0n);

  res.json({ address, assets: results, totalPendingSARX: totalPending.toString() });
});

// ── POST /deposit ──────────────────────────────────────────
const depositSchema = Joi.object({
  assetSymbol:  Joi.string().valid(...Object.keys(DISTRIBUTORS)).required(),
  amountSARX:   Joi.string().pattern(/^\d+$/).required(),  // raw 6-decimal SARX amount
  description:  Joi.string().min(5).max(200).required(),   // e.g. "Q2 2027 Rental Income"
  apiSecret:    Joi.string().required(),
});

router.post("/deposit", async (req, res) => {
  const { error, value } = depositSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  if (value.apiSecret !== process.env.COMPLIANCE_API_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const distAddr = DISTRIBUTORS[value.assetSymbol];
  if (!distAddr) return res.status(404).json({ error: "Distributor not deployed yet" });

  try {
    const dist = getDistributorSigned(distAddr);
    const tx   = await dist.depositYield(BigInt(value.amountSARX), value.description);
    await tx.wait();

    res.json({
      success:     true,
      txHash:      tx.hash,
      assetSymbol: value.assetSymbol,
      amountSARX:  value.amountSARX,
      description: value.description,
      epochCount:  (await dist.epochCount()).toString(),
    });
  } catch (err) {
    res.status(500).json({ error: "On-chain transaction failed", detail: err.message });
  }
});

module.exports = router;
