/**
 * SWR Public Sale — Deployment Script
 *
 * Deploys SWRPublicSale and funds it with 10M SWR from the deployer wallet.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-sale.js --network sepolia
 *   npx hardhat run scripts/deploy-sale.js --network mainnet
 *
 * Set sale dates in the CONFIG section before running.
 */

const { ethers } = require("hardhat");
require("dotenv").config();

// ── CONFIG — edit before deploying ───────────────────────────
const CONFIG = {
  // Sale opens: set to a future timestamp (Unix seconds)
  // Example: new Date("2026-08-01T10:00:00Z").getTime() / 1000
  startTime: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now (testnet)

  // Sale closes: 7 days after start
  endTime:   Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,

  // SWR Token address (from deployments.json)
  swrToken: require("../deployments.json").addresses.SWRToken,
};
// ─────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("\n🚀 SWR Public Sale — Deploying");
  console.log("   Network  :", network);
  console.log("   Deployer :", deployer.address);
  console.log("   SWR Token:", CONFIG.swrToken);
  console.log("   Start    :", new Date(CONFIG.startTime * 1000).toISOString());
  console.log("   End      :", new Date(CONFIG.endTime   * 1000).toISOString());

  // Deploy sale contract
  const Sale = await ethers.getContractFactory("SWRPublicSale");
  const sale = await Sale.deploy(CONFIG.swrToken, CONFIG.startTime, CONFIG.endTime);
  await sale.waitForDeployment();
  const saleAddr = await sale.getAddress();
  console.log("\n✅ SWRPublicSale deployed:", saleAddr);

  // Fund the sale contract with 10M SWR
  const swrToken = await ethers.getContractAt("SWRToken", CONFIG.swrToken);
  const SALE_SUPPLY = ethers.parseEther("10000000"); // 10M SWR

  console.log("\n📤 Funding sale contract with 10,000,000 SWR...");
  const tx = await swrToken.transfer(saleAddr, SALE_SUPPLY);
  await tx.wait();
  console.log("✅ Sale contract funded");

  // Verify
  const balance = await swrToken.balanceOf(saleAddr);
  console.log("   SWR in contract:", ethers.formatEther(balance));

  // Sale info
  const info = await sale.saleInfo();
  console.log("\n📋 Sale Info");
  console.log("   Price per SWR  : 0.00001 ETH (~$0.03)");
  console.log("   Hard cap       : 100 ETH");
  console.log("   Sale supply    : 10,000,000 SWR");
  console.log("   Min buy        : 0.01 ETH (~333 SWR)");
  console.log("   Max per wallet : 2 ETH (~66,666 SWR)");
  console.log("   Contract       :", saleAddr);

  // Save to file
  const fs = require("fs");
  const existing = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  existing.addresses.PublicSale = saleAddr;
  fs.writeFileSync("deployments.json", JSON.stringify(existing, null, 2));
  console.log("\n💾 Sale address saved to deployments.json");
}

main().catch(err => { console.error(err); process.exit(1); });
