/**
 * SWR SAFT — Deployment Script
 *
 * Deploys SWRSaft contract, registers investors, and funds with SWR tokens.
 *
 * Usage:
 *   1. Fill in INVESTORS array below with real wallet addresses
 *   2. npx hardhat run scripts/deploy-saft.js --network sepolia
 *   3. After mainnet launch: call startVesting() on the deployed contract
 */

const { ethers } = require("hardhat");
require("dotenv").config();

// ── INVESTORS — fill in before deploying ─────────────────────
// ethContributed: how much ETH they paid (for on-chain record)
// swrAllocation: how many SWR they receive (ethPaid / 0.000005 ETH per SWR at $0.015)
// Example: $25,000 at $3,000/ETH = 8.33 ETH → $25,000 / $0.005 = 5,000,000 SWR

const INVESTORS = [
  // { address: "0xINVESTOR_1", ethContributed: ethers.parseEther("16.67"), swrAllocation: ethers.parseEther("3333400") },
  // { address: "0xINVESTOR_2", ethContributed: ethers.parseEther("33.33"), swrAllocation: ethers.parseEther("6666600") },
  // Add more investors here
];
// ─────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses  = require("../deployments.json").addresses;

  console.log("\n🤝 SWR SAFT — Deploying");
  console.log("   Network  :", (await ethers.provider.getNetwork()).name);
  console.log("   Deployer :", deployer.address);
  console.log("   Investors:", INVESTORS.length);

  if (INVESTORS.length === 0) {
    console.log("\n⚠️  No investors defined. Add addresses to INVESTORS array first.");
    console.log("   (Running in demo mode — deploying empty contract)");
  }

  // Deploy SAFT contract
  const Saft = await ethers.getContractFactory("SWRSaft");
  const saft = await Saft.deploy(addresses.SWRToken);
  await saft.waitForDeployment();
  const saftAddr = await saft.getAddress();
  console.log("\n✅ SWRSaft deployed:", saftAddr);

  // Register investors
  if (INVESTORS.length > 0) {
    const addrs         = INVESTORS.map(i => i.address);
    const allocations   = INVESTORS.map(i => i.swrAllocation);
    const contributions = INVESTORS.map(i => i.ethContributed);

    console.log("\n📋 Registering", INVESTORS.length, "investors...");
    const tx = await saft.addInvestorsBatch(addrs, allocations, contributions);
    await tx.wait();

    const totalAlloc = allocations.reduce((a, b) => a + b, 0n);
    console.log("✅ Investors registered");
    console.log("   Total SWR allocated:", ethers.formatEther(totalAlloc));

    // Fund SAFT contract with SWR
    const swrToken = await ethers.getContractAt("SWRToken", addresses.SWRToken);
    console.log("\n📤 Funding SAFT contract...");
    const fundTx = await swrToken.transfer(saftAddr, totalAlloc);
    await fundTx.wait();
    console.log("✅ SAFT funded with", ethers.formatEther(totalAlloc), "SWR");
  }

  // Save address
  const fs = require("fs");
  const existing = JSON.parse(fs.readFileSync("deployments.json", "utf8"));
  existing.addresses.SWRSaft = saftAddr;
  fs.writeFileSync("deployments.json", JSON.stringify(existing, null, 2));

  console.log(`
📋 SAFT Summary
────────────────────────────────────────
   Contract   : ${saftAddr}
   Cliff      : 6 months after startVesting()
   Vesting    : 12 months linear after cliff
   Price      : $0.015/SWR (~50% discount to public)

Next steps:
   1. Have each investor send ETH to: ${deployer.address}
   2. Verify each payment then run: addInvestor(wallet, swrAmount, ethPaid)
   3. At mainnet launch: call startVesting() on the contract
      → npx hardhat run scripts/start-vesting.js --network mainnet
`);
}

main().catch(err => { console.error(err); process.exit(1); });
