/**
 * Asset Routes — /api/v1/assets
 *
 * GET  /api/v1/assets              List all tokenized assets
 * GET  /api/v1/assets/:symbol      Get asset detail
 * GET  /api/v1/assets/:symbol/holders  Token holder list
 * POST /api/v1/assets/:symbol/value    [ISSUER] Update asset valuation
 */
const express    = require("express");
const { ethers } = require("ethers");
const router     = express.Router();

const ASSET_ABI = require("../../artifacts/contracts/AssetToken.sol/AssetToken.json").abi;

// In production this list comes from a database seeded at issuance time
const ASSETS = [
  {
    symbol:   "xROSHN1",
    name:     "SWR Asset: ROSHN Riyadh Block 1",
    address:  process.env.ASSET_ROSHN1_ADDRESS,
    type:     "REAL_ESTATE",
    location: "Riyadh, Saudi Arabia",
    shariah:  true,
    spvCR:    "1010123456",
    targetYield: 7.2,
  },
];

function getAssetContract(address) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  return new ethers.Contract(address, ASSET_ABI, provider);
}

// ── GET / ─────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const withData = await Promise.all(
      ASSETS.filter(a => a.address).map(async (a) => {
        const contract = getAssetContract(a.address);
        const [totalSupply, assetValueSAR, shariahCertified] = await Promise.all([
          contract.totalSupply(),
          contract.assetValueSAR(),
          contract.shariahCertified(),
        ]);
        return {
          ...a,
          totalSupply:     totalSupply.toString(),
          assetValueSAR:   assetValueSAR.toString(),
          tokenPriceSAR:   (Number(assetValueSAR) / Number(totalSupply)).toFixed(2),
          shariahCertified,
        };
      })
    );
    res.json({ assets: withData, count: withData.length });
  } catch (err) {
    console.error("Asset list failed:", err.message);
    res.status(500).json({ error: "Failed to fetch assets", detail: err.message });
  }
});

// ── GET /:symbol ───────────────────────────────────────────
router.get("/:symbol", async (req, res) => {
  const asset = ASSETS.find(a => a.symbol === req.params.symbol.toUpperCase());
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (!asset.address) return res.status(503).json({ error: "Asset not yet deployed" });

  try {
    const contract = getAssetContract(asset.address);
    const [totalSupply, assetValueSAR, yieldDistributor, totalYield] = await Promise.all([
      contract.totalSupply(),
      contract.assetValueSAR(),
      contract.yieldDistributor(),
      contract.totalYieldDistributed(),
    ]);

    res.json({
      ...asset,
      onChain: {
        totalSupply:            totalSupply.toString(),
        assetValueSAR:          assetValueSAR.toString(),
        tokenPriceSAR:          (Number(assetValueSAR) / Number(totalSupply)).toFixed(6),
        yieldDistributor,
        totalYieldDistributed:  totalYield.toString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to read on-chain data", detail: err.message });
  }
});

// ── GET /:symbol/holders ───────────────────────────────────
router.get("/:symbol/holders", async (req, res) => {
  const asset = ASSETS.find(a => a.symbol === req.params.symbol.toUpperCase());
  if (!asset || !asset.address) return res.status(404).json({ error: "Asset not found" });

  // In production: index Transfer events to build holder list
  // Here we return a stub
  res.json({
    symbol:  asset.symbol,
    holders: [],
    note:    "Holder indexing is built from Transfer event logs in production",
  });
});

module.exports = router;
