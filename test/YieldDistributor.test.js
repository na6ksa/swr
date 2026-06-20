const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldDistributor", function () {
  let kyc, asset, sarx, distributor;
  let admin, compliance, issuer, manager, investor1, investor2, stranger;

  const kycHash     = ethers.keccak256(ethers.toUtf8Bytes("KYC_HASH"));
  const TIER_INSTITUTIONAL = 3n;
  const ASSET_VALUE = 10_000_000n * 1_000_000n; // SAR 10M
  const TOTAL_SUPPLY = 1_000_000n;              // 1M asset tokens

  beforeEach(async () => {
    [admin, compliance, issuer, manager, investor1, investor2, stranger] =
      await ethers.getSigners();

    // Deploy a minimal ERC20 as SARX mock
    const ERC20Mock = await ethers.getContractFactory("SWRToken"); // reuse for mock
    // Actually deploy a simple mock — use a basic ERC20 token for SARX
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    sarx = await MockERC20.deploy("SAR Stablecoin", "SARX");
    await sarx.mint(manager.address, 10_000_000n * 1_000_000n); // 10M SARX to manager

    // Deploy KYC
    const KYCWhitelist = await ethers.getContractFactory("KYCWhitelist");
    kyc = await KYCWhitelist.deploy(admin.address, compliance.address);
    await kyc.connect(compliance).approveInvestor(investor1.address, TIER_INSTITUTIONAL, kycHash, "SA", true);
    await kyc.connect(compliance).approveInvestor(investor2.address, TIER_INSTITUTIONAL, kycHash, "SA", true);

    // Deploy AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    asset = await AssetToken.deploy(
      "SWR Asset: Test Building",
      "xTEST",
      await kyc.getAddress(),
      admin.address,
      issuer.address,
      compliance.address,  // dedicated compliance officer (new param)
      "TEST-001",
      "REAL_ESTATE",
      "0000000000",
      ASSET_VALUE,
      true,
      TOTAL_SUPPLY
    );

    // Distribute asset tokens: 60% to investor1, 40% to investor2
    await asset.connect(issuer).transfer(investor1.address, 600_000n);
    await asset.connect(issuer).transfer(investor2.address, 400_000n);

    // Deploy YieldDistributor
    const YieldDistributor = await ethers.getContractFactory("YieldDistributor");
    distributor = await YieldDistributor.deploy(
      await asset.getAddress(),
      await sarx.getAddress(),
      admin.address,
      manager.address
    );

    // Link distributor to asset
    await asset.connect(admin).setYieldDistributor(await distributor.getAddress());

    // Manager approves distributor to pull SARX
    await sarx.connect(manager).approve(await distributor.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", () => {
    it("links to correct asset and sarx", async () => {
      expect(await distributor.assetToken()).to.equal(await asset.getAddress());
      expect(await distributor.sarx()).to.equal(await sarx.getAddress());
    });

    it("starts with zero epochs", async () => {
      expect(await distributor.epochCount()).to.equal(0);
    });
  });

  describe("depositYield", () => {
    it("manager can deposit yield and creates an epoch", async () => {
      const yieldAmount = 100_000n * 1_000_000n; // 100K SARX
      await distributor.connect(manager).depositYield(yieldAmount, "Q1 2027 Rental Income");
      expect(await distributor.epochCount()).to.equal(1);
      expect(await distributor.totalDistributed()).to.equal(yieldAmount);
    });

    it("reverts on zero amount", async () => {
      await expect(
        distributor.connect(manager).depositYield(0n, "test")
      ).to.be.revertedWith("YD: zero amount");
    });

    it("stranger cannot deposit", async () => {
      await expect(
        distributor.connect(stranger).depositYield(1000n, "test")
      ).to.be.reverted;
    });
  });

  describe("pendingYield & claim", () => {
    const yieldAmount = 1_000_000n * 1_000_000n; // 1M SARX per epoch

    beforeEach(async () => {
      await distributor.connect(manager).depositYield(yieldAmount, "Epoch 1");
    });

    it("investor1 (60%) has correct pending yield", async () => {
      const pending = await distributor.pendingYield(investor1.address);
      expect(pending).to.equal(yieldAmount * 600_000n / 1_000_000n);
    });

    it("investor2 (40%) has correct pending yield", async () => {
      const pending = await distributor.pendingYield(investor2.address);
      expect(pending).to.equal(yieldAmount * 400_000n / 1_000_000n);
    });

    it("investor1 can claim and receives correct SARX", async () => {
      const before = await sarx.balanceOf(investor1.address);
      await distributor.connect(investor1).claim();
      const after = await sarx.balanceOf(investor1.address);
      expect(after - before).to.equal(yieldAmount * 600_000n / 1_000_000n);
    });

    it("pending drops to zero after claim", async () => {
      await distributor.connect(investor1).claim();
      expect(await distributor.pendingYield(investor1.address)).to.equal(0n);
    });

    it("cannot claim twice for same epoch", async () => {
      await distributor.connect(investor1).claim();
      await expect(distributor.connect(investor1).claim())
        .to.be.revertedWith("YD: nothing to claim");
    });

    it("yields accumulate across multiple epochs", async () => {
      await distributor.connect(manager).depositYield(yieldAmount, "Epoch 2");
      const pending = await distributor.pendingYield(investor1.address);
      expect(pending).to.equal(yieldAmount * 2n * 600_000n / 1_000_000n);
    });

    it("non-holder has zero pending yield", async () => {
      expect(await distributor.pendingYield(stranger.address)).to.equal(0n);
    });
  });
});
