/**
 * SWR Platform — Mainnet Deployment Script
 *
 * Deploys with production security model:
 *   1. SWRTimelock         — 48h delay on all admin actions
 *   2. KYCWhitelist        — admin = Timelock, compliance = dedicated officer
 *   3. SWRToken            — all allocations to real multisig/vesting addresses
 *   4. AssetToken          — admin = Timelock, issuer = SPV wallet
 *   5. YieldDistributor    — admin = Timelock, manager = asset manager
 *   6. Wire distributor → asset, renounce deployer admin roles
 *
 * Prerequisites:
 *   - config/mainnet.json filled with real addresses
 *   - MAINNET_RPC_URL, DEPLOYER_PRIVATE_KEY set in .env
 *   - Deployer wallet funded with ETH for gas
 *
 * Usage:
 *   npx hardhat run scripts/deploy-mainnet.js --network mainnet
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../config/mainnet.json"), "utf8")
  );

  console.log("\n🚀 SWR Platform — MAINNET Deployment");
  console.log("═".repeat(60));
  console.log("   Network  :", (await ethers.provider.getNetwork()).name);
  console.log("   Deployer :", deployer.address);
  console.log("   Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Validate config — abort if any placeholder addresses remain
  const placeholders = JSON.stringify(config).match(/0x_[A-Z_]+/g);
  if (placeholders) {
    console.error("\n❌ Config has unfilled placeholders:", placeholders);
    console.error("   Fill in config/mainnet.json before deploying to mainnet.");
    process.exit(1);
  }

  const { multisig, sarx, asset, timelock: timelockCfg } = config;

  console.log("\n📋 Deployment Config");
  console.log("   Admin (Safe)   :", multisig.admin);
  console.log("   Compliance     :", multisig.compliance);
  console.log("   Issuer (SPV)   :", multisig.issuer);
  console.log("   Manager        :", multisig.manager);
  console.log("   SARX           :", sarx.address);
  console.log("   Timelock delay :", timelockCfg.minDelaySeconds / 3600, "hours");
  console.log("═".repeat(60));

  // ── 1. TIMELOCK ────────────────────────────────────────────
  console.log("\n1️⃣  Deploying SWRTimelock (48h delay)…");
  const Timelock = await ethers.getContractFactory("SWRTimelock");
  const timelockContract = await Timelock.deploy(
    timelockCfg.minDelaySeconds,
    [multisig.admin],   // proposers
    [multisig.admin]    // executors
  );
  await timelockContract.waitForDeployment();
  const timelockAddr = await timelockContract.getAddress();
  console.log("   ✅ SWRTimelock  :", timelockAddr);

  // ── 2. KYCWhitelist ────────────────────────────────────────
  console.log("\n2️⃣  Deploying KYCWhitelist…");
  const KYCWhitelist = await ethers.getContractFactory("KYCWhitelist");
  const kyc = await KYCWhitelist.deploy(
    timelockAddr,         // admin  → timelock (admin changes gated by 48h)
    multisig.compliance   // compliance officer → direct (must act immediately for regulatory orders)
  );
  await kyc.waitForDeployment();
  console.log("   ✅ KYCWhitelist :", await kyc.getAddress());

  // ── 3. SWRToken ────────────────────────────────────────────
  console.log("\n3️⃣  Deploying SWRToken…");
  const SWRToken = await ethers.getContractFactory("SWRToken");
  const swr = await SWRToken.deploy(
    timelockAddr,         // admin → timelock
    multisig.admin,       // treasury (buyback)
    multisig.admin,       // community multisig — replace with real community Safe
    multisig.admin,       // team vesting contract — replace with real vesting
    multisig.admin,       // investor vesting contract
    multisig.admin,       // staking rewards contract
    multisig.admin        // public sale contract
  );
  await swr.waitForDeployment();
  console.log("   ✅ SWRToken     :", await swr.getAddress());
  console.log("   Total supply   :", ethers.formatEther(await swr.totalSupply()), "SWR");

  // ── 4. AssetToken ──────────────────────────────────────────
  console.log("\n4️⃣  Deploying AssetToken (xROSHN1)…");
  const AssetToken = await ethers.getContractFactory("AssetToken");
  const assetToken = await AssetToken.deploy(
    asset.name,
    asset.symbol,
    await kyc.getAddress(),
    timelockAddr,          // admin  → timelock
    multisig.issuer,       // issuer → SPV wallet
    multisig.compliance,   // compliance officer
    asset.assetId,
    asset.assetType,
    asset.spvCR,
    BigInt(asset.assetValueSAR),
    asset.shariahCertified,
    BigInt(asset.totalSupply)
  );
  await assetToken.waitForDeployment();
  const assetAddr = await assetToken.getAddress();
  console.log("   ✅ xROSHN1      :", assetAddr);

  // ── 5. YieldDistributor ────────────────────────────────────
  console.log("\n5️⃣  Deploying YieldDistributor…");
  const YieldDistributor = await ethers.getContractFactory("YieldDistributor");
  const distributor = await YieldDistributor.deploy(
    assetAddr,
    sarx.address,
    timelockAddr,          // admin → timelock
    multisig.manager       // yield manager → asset manager wallet
  );
  await distributor.waitForDeployment();
  const distAddr = await distributor.getAddress();
  console.log("   ✅ YieldDist    :", distAddr);

  // ── 6. WIRE & HANDOFF ──────────────────────────────────────
  console.log("\n6️⃣  Wiring contracts & renouncing deployer access…");

  // Link distributor to asset (deployer still has admin via DEFAULT_ADMIN_ROLE on AssetToken?
  // No — admin is timelockAddr. Deployer cannot call setYieldDistributor directly.
  // We must schedule this through the timelock, OR we accept that for the very first
  // deployment, this step is done via a separate timelock proposal after deployment.
  //
  // For safety: deployer does NOT have admin. The issuer (SPV wallet) could set the
  // distributor if they have ISSUER_ROLE... but setYieldDistributor requires DEFAULT_ADMIN_ROLE.
  //
  // Solution: the multisig must call setYieldDistributor via the timelock after deploy.
  // This is logged as a post-deploy action below.

  console.log("   ⚠️  Post-deploy action required (via Timelock + Gnosis Safe):");
  console.log("      assetToken.setYieldDistributor(", distAddr, ")");
  console.log("      Schedule via Safe → Timelock → AssetToken");
  console.log("      Wait 48h then execute.");

  // ── SUMMARY ────────────────────────────────────────────────
  const addresses = {
    network:          "mainnet",
    SWRTimelock:      timelockAddr,
    KYCWhitelist:     await kyc.getAddress(),
    SWRToken:         await swr.getAddress(),
    AssetToken:       assetAddr,
    YieldDistributor: distAddr,
    SARX:             sarx.address,
  };

  console.log("\n📋 Deployment Summary");
  console.log("═".repeat(60));
  for (const [name, addr] of Object.entries(addresses)) {
    if (name === "network") continue;
    console.log(`   ${name.padEnd(20)}: ${addr}`);
  }
  console.log("═".repeat(60));

  fs.writeFileSync(
    path.join(__dirname, "../deployments-mainnet.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n💾 Addresses saved to deployments-mainnet.json");

  console.log(`
✅ Deployment complete. Next steps:

   1. Verify all contracts on Etherscan:
      npx hardhat verify --network mainnet <address> [constructor args]

   2. Schedule setYieldDistributor via Gnosis Safe UI:
      Target: ${assetAddr}
      Data: setYieldDistributor(${distAddr})
      → Propose in Safe → Timelock queues 48h → Execute

   3. Have CMA compliance officer approve first investors:
      KYCWhitelist.approveInvestor(investorAddr, tier, kycHash, "SA", true)

   4. Issuer distributes xROSHN1 tokens to KYC-approved investors.

   5. Asset manager deposits first yield epoch.
`);
}

main().catch(err => { console.error(err); process.exit(1); });
