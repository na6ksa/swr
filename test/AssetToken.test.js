const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetToken", function () {
  let kyc, asset;
  let admin, compliance, issuer, investor1, investor2, stranger;

  const kycHash = ethers.keccak256(ethers.toUtf8Bytes("KYC_HASH"));
  const TIER_RETAIL = 1n;
  const TIER_PROFESSIONAL = 2n;

  // Asset params
  const ASSET_VALUE_SAR  = 10_000_000n * 1_000_000n; // SAR 10M (6 decimals)
  const TOTAL_SUPPLY     = 1_000_000n;                // 1M tokens, each = SAR 10

  beforeEach(async () => {
    [admin, compliance, issuer, investor1, investor2, stranger] = await ethers.getSigners();

    // Deploy KYCWhitelist
    const KYCWhitelist = await ethers.getContractFactory("KYCWhitelist");
    kyc = await KYCWhitelist.deploy(admin.address, compliance.address);

    // Approve both investors
    await kyc.connect(compliance).approveInvestor(
      investor1.address, TIER_RETAIL, kycHash, "SA", true
    );
    await kyc.connect(compliance).approveInvestor(
      investor2.address, TIER_PROFESSIONAL, kycHash, "SA", true
    );

    // Deploy AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    asset = await AssetToken.deploy(
      "SWR Asset: ROSHN Riyadh Block 1",
      "xROSHN1",
      await kyc.getAddress(),
      admin.address,
      issuer.address,
      compliance.address,    // dedicated compliance officer (new param)
      "ROSHN-RUH-B1-2026",
      "REAL_ESTATE",
      "1010123456",          // Saudi CR number
      ASSET_VALUE_SAR,
      true,                  // shariahCertified
      TOTAL_SUPPLY
    );
  });

  describe("Deployment", () => {
    it("mints total supply to issuer", async () => {
      expect(await asset.balanceOf(issuer.address)).to.equal(TOTAL_SUPPLY);
    });

    it("stores asset metadata correctly", async () => {
      expect(await asset.assetId()).to.equal("ROSHN-RUH-B1-2026");
      expect(await asset.assetType()).to.equal("REAL_ESTATE");
      expect(await asset.assetValueSAR()).to.equal(ASSET_VALUE_SAR);
      expect(await asset.shariahCertified()).to.be.true;
    });

    it("returns correct token price", async () => {
      // SAR 10M / 1M tokens = SAR 10 per token
      expect(await asset.tokenPriceSAR()).to.equal(10_000_000n);
    });

    it("uses 6 decimals", async () => {
      expect(await asset.decimals()).to.equal(6);
    });
  });

  describe("Compliance transfers", () => {
    const TRANSFER_AMOUNT = 1000n; // 1000 tokens = SAR 10,000

    beforeEach(async () => {
      // Issuer distributes tokens to investor1
      await asset.connect(issuer).transfer(investor1.address, TRANSFER_AMOUNT);
    });

    it("whitelisted investor can transfer to another whitelisted investor", async () => {
      await asset.connect(investor1).transfer(investor2.address, 500n);
      expect(await asset.balanceOf(investor2.address)).to.equal(500n);
    });

    it("reverts transfer to non-whitelisted address", async () => {
      await expect(
        asset.connect(investor1).transfer(stranger.address, 100n)
      ).to.be.revertedWith("SWR: receiver not KYC verified");
    });

    it("reverts transfer from non-whitelisted address", async () => {
      // Give stranger some tokens by bypassing: not possible normally
      // Test that a revoked investor can't transfer
      await kyc.connect(compliance).revokeInvestor(investor1.address, "test revoke");
      await expect(
        asset.connect(investor1).transfer(investor2.address, 100n)
      ).to.be.revertedWith("SWR: sender not KYC verified");
    });

    it("respects retail investment limit (SAR 200K)", async () => {
      // retail limit = 200,000 SARX (6 dec) = 200,000,000,000
      // token price = 10,000,000 (SAR 10)
      // max tokens for retail = 200,000 * 1e6 / 10,000,000 = 20,000 tokens
      // Try to transfer 21,000 tokens to investor1 (already has 1,000) → total 21,000 value = SAR 210,000 > limit
      await expect(
        asset.connect(issuer).transfer(investor1.address, 20_001n)
      ).to.be.revertedWith("SWR: exceeds investment tier limit");
    });

    it("professional tier has higher limit", async () => {
      // professional limit = SAR 2M, price = SAR 10 → max 200,000 tokens
      await asset.connect(issuer).transfer(investor2.address, 100_000n);
      expect(await asset.balanceOf(investor2.address)).to.equal(100_000n);
    });
  });

  describe("Pause / Unpause", () => {
    const COMPLIANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ROLE"));

    it("compliance officer can pause transfers", async () => {
      await asset.connect(compliance).pause();
      await expect(
        asset.connect(issuer).transfer(investor1.address, 100n)
      ).to.be.reverted;
    });

    it("compliance officer can unpause", async () => {
      await asset.connect(compliance).pause();
      await asset.connect(compliance).unpause();
      await asset.connect(issuer).transfer(investor1.address, 100n);
      expect(await asset.balanceOf(investor1.address)).to.equal(100n);
    });

    it("stranger cannot pause", async () => {
      await expect(asset.connect(stranger).pause()).to.be.reverted;
    });
  });

  describe("forcedTransfer", () => {
    it("compliance can force transfer (court order)", async () => {
      await asset.connect(issuer).transfer(investor1.address, 1000n);
      await asset.connect(compliance).pause(); // even while paused
      await asset.connect(compliance).forcedTransfer(
        investor1.address, investor2.address, 500n, "Court order #SA-2026-001"
      );
      expect(await asset.balanceOf(investor2.address)).to.equal(500n);
    });
  });

  describe("updateAssetValue", () => {
    it("issuer can update valuation", async () => {
      const newValue = 12_000_000n * 1_000_000n; // SAR 12M
      await asset.connect(issuer).updateAssetValue(newValue);
      expect(await asset.assetValueSAR()).to.equal(newValue);
    });
  });
});
