const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KYCWhitelist", function () {
  let kyc, admin, compliance, regulator, investor1, investor2, stranger;
  const COMPLIANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ROLE"));
  const REGULATOR_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("REGULATOR_ROLE"));

  const TIER_RETAIL        = 1n;
  const TIER_PROFESSIONAL  = 2n;
  const TIER_INSTITUTIONAL = 3n;

  const kycHash = ethers.keccak256(ethers.toUtf8Bytes("KYC_DOC_BUNDLE_HASH_1"));

  beforeEach(async () => {
    [admin, compliance, regulator, investor1, investor2, stranger] = await ethers.getSigners();
    const KYCWhitelist = await ethers.getContractFactory("KYCWhitelist");
    kyc = await KYCWhitelist.deploy(admin.address, compliance.address);

    await kyc.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);
  });

  describe("Deployment", () => {
    it("grants COMPLIANCE_ROLE to compliance officer", async () => {
      expect(await kyc.hasRole(COMPLIANCE_ROLE, compliance.address)).to.be.true;
    });
    it("sets default investment limits", async () => {
      expect(await kyc.investmentLimit(TIER_RETAIL)).to.equal(200_000n * 1_000_000n);
      expect(await kyc.investmentLimit(TIER_PROFESSIONAL)).to.equal(2_000_000n * 1_000_000n);
    });
  });

  describe("approveInvestor", () => {
    it("compliance officer can approve an investor", async () => {
      await kyc.connect(compliance).approveInvestor(
        investor1.address, TIER_RETAIL, kycHash, "SA", true
      );
      expect(await kyc.isWhitelisted(investor1.address)).to.be.true;
    });

    it("sets correct tier and metadata", async () => {
      await kyc.connect(compliance).approveInvestor(
        investor1.address, TIER_PROFESSIONAL, kycHash, "SA", true
      );
      const inv = await kyc.getInvestor(investor1.address);
      expect(inv.tier).to.equal(TIER_PROFESSIONAL);
      expect(inv.jurisdiction).to.equal("SA");
      expect(inv.shariahConsent).to.be.true;
      expect(inv.kycHash).to.equal(kycHash);
    });

    it("reverts if called by non-compliance", async () => {
      await expect(
        kyc.connect(stranger).approveInvestor(
          investor1.address, TIER_RETAIL, kycHash, "SA", true
        )
      ).to.be.reverted;
    });

    it("reverts on zero address", async () => {
      await expect(
        kyc.connect(compliance).approveInvestor(
          ethers.ZeroAddress, TIER_RETAIL, kycHash, "SA", true
        )
      ).to.be.revertedWith("KYC: zero address");
    });
  });

  describe("revokeInvestor", () => {
    beforeEach(async () => {
      await kyc.connect(compliance).approveInvestor(
        investor1.address, TIER_RETAIL, kycHash, "SA", true
      );
    });

    it("revokes an approved investor", async () => {
      await kyc.connect(compliance).revokeInvestor(investor1.address, "Sanctions match");
      expect(await kyc.isWhitelisted(investor1.address)).to.be.false;
    });

    it("reverts if called by stranger", async () => {
      await expect(
        kyc.connect(stranger).revokeInvestor(investor1.address, "test")
      ).to.be.reverted;
    });
  });

  describe("updateTier", () => {
    it("upgrades investor tier", async () => {
      await kyc.connect(compliance).approveInvestor(
        investor1.address, TIER_RETAIL, kycHash, "SA", true
      );
      await kyc.connect(compliance).updateTier(investor1.address, TIER_INSTITUTIONAL);
      expect(await kyc.getTier(investor1.address)).to.equal(TIER_INSTITUTIONAL);
    });

    it("reverts on non-approved investor", async () => {
      await expect(
        kyc.connect(compliance).updateTier(stranger.address, TIER_PROFESSIONAL)
      ).to.be.revertedWith("KYC: not approved");
    });
  });

  describe("investment limits", () => {
    it("returns correct limit per tier", async () => {
      await kyc.connect(compliance).approveInvestor(
        investor1.address, TIER_RETAIL, kycHash, "SA", true
      );
      expect(await kyc.getInvestmentLimit(investor1.address))
        .to.equal(200_000n * 1_000_000n);
    });

    it("admin can update limits", async () => {
      const newLimit = 500_000n * 1_000_000n;
      await kyc.connect(admin).setInvestmentLimit(TIER_RETAIL, newLimit);
      expect(await kyc.investmentLimit(TIER_RETAIL)).to.equal(newLimit);
    });
  });

  describe("regulator access", () => {
    it("regulator can read investor record", async () => {
      await kyc.connect(compliance).approveInvestor(
        investor1.address, TIER_RETAIL, kycHash, "SA", true
      );
      const inv = await kyc.connect(regulator).regulatorView(investor1.address);
      expect(inv.approved).to.be.true;
    });

    it("stranger cannot access regulatorView", async () => {
      await expect(
        kyc.connect(stranger).regulatorView(investor1.address)
      ).to.be.reverted;
    });
  });
});
