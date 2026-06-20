/**
 * SWR Platform — Full Deployment Script
 *
 * Deploys in order:
 *   1. KYCWhitelist
 *   2. SWRToken
 *   3. MockERC20 (SARX — test/staging only; production uses real SARX contract)
 *   4. AssetToken (example: ROSHN Riyadh Block 1)
 *   5. YieldDistributor (linked to asset above)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 SWR Platform — Deploying contracts");
  console.log("   Network  :", (await ethers.provider.getNetwork()).name);
  console.log("   Deployer :", deployer.address);
  console.log("   Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── CONFIG ──────────────────────────────────────────────────
  // In production, replace these with real multisig addresses
  const ADMIN               = deployer.address;
  const COMPLIANCE_OFFICER  = deployer.address;
  const BUYBACK_TREASURY    = deployer.address;
  const COMMUNITY_MULTISIG  = deployer.address;
  const TEAM_VESTING        = deployer.address;
  const INVESTOR_VESTING    = deployer.address;
  const STAKING_REWARDS     = deployer.address;
  const PUBLIC_SALE         = deployer.address;
  const ASSET_ISSUER        = deployer.address;
  const ASSET_MANAGER       = deployer.address;

  // ── 1. KYCWhitelist ─────────────────────────────────────────
  console.log("1️⃣  Deploying KYCWhitelist...");
  const KYCWhitelist = await ethers.getContractFactory("KYCWhitelist");
  const kyc = await KYCWhitelist.deploy(ADMIN, COMPLIANCE_OFFICER);
  await kyc.waitForDeployment();
  console.log("   ✅ KYCWhitelist:", await kyc.getAddress());

  // ── 2. SWRToken ──────────────────────────────────────────────
  console.log("2️⃣  Deploying SWRToken...");
  const SWRToken = await ethers.getContractFactory("SWRToken");
  const swr = await SWRToken.deploy(
    ADMIN,
    BUYBACK_TREASURY,
    COMMUNITY_MULTISIG,
    TEAM_VESTING,
    INVESTOR_VESTING,
    STAKING_REWARDS,
    PUBLIC_SALE
  );
  await swr.waitForDeployment();
  console.log("   ✅ SWRToken   :", await swr.getAddress());
  console.log("   Total supply :", ethers.formatEther(await swr.totalSupply()), "SWR");

  // ── 3. SARX (MockERC20 for testnet) ─────────────────────────
  console.log("3️⃣  Deploying MockERC20 (SARX)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const sarx = await MockERC20.deploy("SAR Stablecoin", "SARX");
  await sarx.waitForDeployment();
  const sarxAddr = await sarx.getAddress();
  console.log("   ✅ SARX       :", sarxAddr);
  // Mint 10M SARX to deployer for testing
  await sarx.mint(deployer.address, 10_000_000n * 1_000_000n);
  console.log("   Minted 10M SARX to deployer");

  // ── 4. AssetToken (example asset) ───────────────────────────
  console.log("4️⃣  Deploying AssetToken (xROSHN1)...");
  const ASSET_VALUE_SAR = 10_000_000n * 1_000_000n; // SAR 10M
  const TOTAL_TOKENS    = 1_000_000n;                 // 1M tokens = SAR 10 each

  const AssetToken = await ethers.getContractFactory("AssetToken");
  const asset = await AssetToken.deploy(
    "SWR Asset: ROSHN Riyadh Block 1",
    "xROSHN1",
    await kyc.getAddress(),
    ADMIN,
    ASSET_ISSUER,
    COMPLIANCE_OFFICER,   // new param: dedicated compliance officer
    "ROSHN-RUH-B1-2026",
    "REAL_ESTATE",
    "1010123456",
    ASSET_VALUE_SAR,
    true,
    TOTAL_TOKENS
  );
  await asset.waitForDeployment();
  const assetAddr = await asset.getAddress();
  console.log("   ✅ xROSHN1   :", assetAddr);
  console.log("   Token price  : SAR", (ASSET_VALUE_SAR / TOTAL_TOKENS / 1_000_000n).toString(), "(6-dec units)");

  // ── 5. YieldDistributor ──────────────────────────────────────
  console.log("5️⃣  Deploying YieldDistributor...");
  const YieldDistributor = await ethers.getContractFactory("YieldDistributor");
  const distributor = await YieldDistributor.deploy(
    assetAddr,
    sarxAddr,
    ADMIN,
    ASSET_MANAGER
  );
  await distributor.waitForDeployment();
  console.log("   ✅ Distributor:", await distributor.getAddress());

  // Link distributor to asset
  await asset.setYieldDistributor(await distributor.getAddress());
  console.log("   Linked YieldDistributor → xROSHN1");

  // ── SUMMARY ──────────────────────────────────────────────────
  const addresses = {
    KYCWhitelist:      await kyc.getAddress(),
    SWRToken:          await swr.getAddress(),
    SARX:              sarxAddr,
    "xROSHN1 (asset)": assetAddr,
    YieldDistributor:  await distributor.getAddress(),
  };

  console.log("\n📋 Deployment Summary");
  console.log("─".repeat(52));
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`   ${name.padEnd(22)}: ${addr}`);
  }
  console.log("─".repeat(52));
  console.log("\n✅ All contracts deployed successfully!\n");

  // Output JSON for frontend config
  const fs = require("fs");
  const out = { network: (await ethers.provider.getNetwork()).name, addresses };
  fs.writeFileSync("deployments.json", JSON.stringify(out, null, 2));
  console.log("💾 Addresses saved to deployments.json\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
