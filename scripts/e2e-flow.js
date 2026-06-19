/**
 * SWR Platform — End-to-End Flow Test (Sepolia)
 *
 * Runs the full investor lifecycle:
 *   1. KYC-whitelist the deployer wallet (as INSTITUTIONAL investor)
 *   2. Optionally whitelist a second wallet (set INVESTOR_ADDRESS in .env)
 *   3. Transfer 10,000 xROSHN1 tokens to the investor
 *   4. Approve SARX spend + deposit SAR 1,000 yield into YieldDistributor
 *   5. Read and display final state for every participant
 *
 * Usage:
 *   npx hardhat run scripts/e2e-flow.js --network sepolia
 *
 * Optional: set INVESTOR_ADDRESS=0x... in .env to whitelist a second wallet
 */

const { ethers } = require("hardhat");
require("dotenv").config();

// ── CONFIG ────────────────────────────────────────────────────────────────────
const ADDRESSES = require("../deployments.json").addresses;

const KYC_HASH        = ethers.keccak256(ethers.toUtf8Bytes("SWR-KYC-DEPLOYER-2026"));
const TIER_INSTITUTIONAL = 3n;

const YIELD_DEPOSIT   = 1_000n  * 1_000_000n;  // SAR 1,000 (6 decimals)
const TOKEN_TRANSFER  = 10_000n;                 // 10,000 xROSHN1 tokens

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt6  = (v) => (Number(v) / 1e6).toLocaleString("en-SA", { maximumFractionDigits: 6 });
const fmt18 = (v) => Number(ethers.formatEther(v)).toLocaleString("en-SA", { maximumFractionDigits: 2 });
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const sep   = () => console.log("─".repeat(60));

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🔁 SWR — End-to-End Flow");
  console.log("   Network  :", (await ethers.provider.getNetwork()).name);
  console.log("   Deployer :", deployer.address);
  sep();

  // ── Attach contracts ──────────────────────────────────────────────────────
  const kyc   = await ethers.getContractAt("KYCWhitelist",     ADDRESSES.KYCWhitelist);
  const swr   = await ethers.getContractAt("SWRToken",         ADDRESSES.SWRToken);
  const sarx  = await ethers.getContractAt("MockERC20",        ADDRESSES.SARX);
  const asset = await ethers.getContractAt("AssetToken",       ADDRESSES["xROSHN1 (asset)"]);
  const ydist = await ethers.getContractAt("YieldDistributor", ADDRESSES.YieldDistributor);

  // ── STEP 1: KYC-whitelist the deployer ───────────────────────────────────
  console.log("\n1️⃣  KYC — Whitelisting deployer as INSTITUTIONAL investor…");
  const alreadyKyc = await kyc.isWhitelisted(deployer.address);
  if (alreadyKyc) {
    console.log("   ✅ Already whitelisted — skipping");
  } else {
    const tx = await kyc.approveInvestor(
      deployer.address,
      TIER_INSTITUTIONAL,
      KYC_HASH,
      "SA",
      true   // shariahConsent
    );
    await tx.wait();
    const tier = await kyc.getTier(deployer.address);
    console.log("   ✅ Approved — tier:", ["None","Retail","Professional","Institutional"][tier]);
  }

  // ── STEP 2: Optional second investor ─────────────────────────────────────
  const INVESTOR_ADDRESS = process.env.INVESTOR_ADDRESS;
  if (INVESTOR_ADDRESS && ethers.isAddress(INVESTOR_ADDRESS)) {
    console.log("\n2️⃣  KYC — Whitelisting extra investor:", short(INVESTOR_ADDRESS));
    const already = await kyc.isWhitelisted(INVESTOR_ADDRESS);
    if (already) {
      console.log("   ✅ Already whitelisted");
    } else {
      const tx = await kyc.approveInvestor(
        INVESTOR_ADDRESS,
        TIER_INSTITUTIONAL,
        KYC_HASH,
        "SA",
        true
      );
      await tx.wait();
      console.log("   ✅ Approved as INSTITUTIONAL");
    }

    // Transfer xROSHN1 tokens to the investor
    const bal = await asset.balanceOf(INVESTOR_ADDRESS);
    if (bal >= TOKEN_TRANSFER) {
      console.log("   ✅ Already holds tokens — skipping transfer");
    } else {
      console.log(`   📤 Transferring ${TOKEN_TRANSFER.toLocaleString()} xROSHN1 tokens…`);
      const tx2 = await asset.transfer(INVESTOR_ADDRESS, TOKEN_TRANSFER);
      await tx2.wait();
      console.log("   ✅ Transferred");
    }
  } else {
    console.log("\n2️⃣  (No INVESTOR_ADDRESS set — using deployer as sole holder)");
    console.log("   Tip: set INVESTOR_ADDRESS=0x... in .env to test a second wallet");
  }

  // ── STEP 3: Deposit yield ─────────────────────────────────────────────────
  console.log("\n3️⃣  Yield — Approving SARX + depositing SAR 1,000 yield…");

  const sarxBal = await sarx.balanceOf(deployer.address);
  console.log("   SARX balance  :", fmt6(sarxBal), "SAR");

  if (sarxBal < YIELD_DEPOSIT) {
    console.log("   ❌ Insufficient SARX. Minting 1,000 SARX to deployer…");
    const mintTx = await sarx.mint(deployer.address, YIELD_DEPOSIT);
    await mintTx.wait();
  }

  // Approve YieldDistributor to spend SARX
  const approveTx = await sarx.approve(ADDRESSES.YieldDistributor, YIELD_DEPOSIT);
  await approveTx.wait();
  console.log("   ✅ SARX approved");

  // Deposit yield
  const depositTx = await ydist.depositYield(YIELD_DEPOSIT, "Q2 2026 Rental Income — ROSHN Riyadh Block 1");
  await depositTx.wait();
  console.log("   ✅ Deposited SAR", fmt6(YIELD_DEPOSIT), "SARX as yield");

  // ── STEP 4: Read final state ──────────────────────────────────────────────
  console.log("\n4️⃣  Final State\n");
  sep();

  async function printHolder(label, address) {
    const [isKyc, tier, swrBal, sarxBal, assetBal, pending] = await Promise.all([
      kyc.isWhitelisted(address),
      kyc.getTier(address),
      swr.balanceOf(address),
      sarx.balanceOf(address),
      asset.balanceOf(address),
      ydist.pendingYield(address),
    ]);
    const tierName = ["None","Retail","Professional","Institutional"][Number(tier)];
    const price = await asset.tokenPriceSAR();
    const portfolioSAR = (Number(assetBal) * Number(price)) / 1e6;

    console.log(`   ${label}`);
    console.log(`   Address   : ${address}`);
    console.log(`   KYC       : ${isKyc ? "✅ Verified · " + tierName : "❌ Not verified"}`);
    console.log(`   SWR       : ${fmt18(swrBal)} SWR`);
    console.log(`   SARX      : SAR ${fmt6(sarxBal)}`);
    console.log(`   xROSHN1   : ${Number(assetBal).toLocaleString()} tokens  (≈ SAR ${portfolioSAR.toLocaleString("en-SA")})`);
    console.log(`   Claimable : SAR ${fmt6(pending)} SARX`);
    console.log();
  }

  await printHolder("Deployer", deployer.address);

  if (INVESTOR_ADDRESS && ethers.isAddress(INVESTOR_ADDRESS)) {
    await printHolder("Investor wallet", INVESTOR_ADDRESS);
  }

  const totalDistributed = await ydist.epochCount();
  console.log("   YieldDistributor epochs :", Number(totalDistributed));
  sep();

  console.log(`
✅ Flow complete! Next steps:

   • Open web/dashboard.html in a browser
   • Connect MetaMask with the deployer key (${short(deployer.address)})
     or import key: ${process.env.DEPLOYER_PRIVATE_KEY?.slice(0, 10)}...
   • You should see:
       - xROSHN1 balance in My Holdings
       - Claimable yield in the Yield card
       - "Claim Yield" button enabled
   • Click "Claim Yield" to pull SARX to your wallet

`);
}

main().catch((err) => { console.error(err); process.exit(1); });
