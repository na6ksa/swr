const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SWRToken", function () {
  let swr, admin, treasury, community, team, investors, staking, publicSale, stranger;
  const MAX_SUPPLY = 200_000_000n * 10n ** 18n;

  beforeEach(async () => {
    [admin, treasury, community, team, investors, staking, publicSale, stranger] =
      await ethers.getSigners();
    const SWRToken = await ethers.getContractFactory("SWRToken");
    swr = await SWRToken.deploy(
      admin.address,
      treasury.address,
      community.address,
      team.address,
      investors.address,
      staking.address,
      publicSale.address
    );
  });

  describe("Deployment", () => {
    it("mints exactly MAX_SUPPLY tokens", async () => {
      expect(await swr.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("allocates 35% to community", async () => {
      expect(await swr.balanceOf(community.address)).to.equal(MAX_SUPPLY * 35n / 100n);
    });

    it("allocates 20% to team vesting", async () => {
      expect(await swr.balanceOf(team.address)).to.equal(MAX_SUPPLY * 20n / 100n);
    });

    it("allocates 18% to investors", async () => {
      expect(await swr.balanceOf(investors.address)).to.equal(MAX_SUPPLY * 18n / 100n);
    });

    it("allocates 15% to treasury", async () => {
      expect(await swr.balanceOf(treasury.address)).to.equal(MAX_SUPPLY * 15n / 100n);
    });

    it("allocates 7% to staking rewards", async () => {
      expect(await swr.balanceOf(staking.address)).to.equal(MAX_SUPPLY * 7n / 100n);
    });

    it("allocates 5% to public sale", async () => {
      expect(await swr.balanceOf(publicSale.address)).to.equal(MAX_SUPPLY * 5n / 100n);
    });

    it("sets correct constants", async () => {
      expect(await swr.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(await swr.FEE_DISCOUNT_BPS()).to.equal(5000);
      expect(await swr.VALIDATOR_MIN_STAKE()).to.equal(10_000n * 10n ** 18n);
    });
  });

  describe("burnFromTreasury", () => {
    it("admin can burn from treasury", async () => {
      const burnAmount = 1_000_000n * 10n ** 18n;
      const before = await swr.totalSupply();
      // Treasury must approve first (standard ERC20 burn from another address)
      await swr.connect(treasury).approve(await swr.getAddress(), burnAmount);
      await swr.connect(admin).burnFromTreasury(burnAmount);
      expect(await swr.totalSupply()).to.equal(before - burnAmount);
    });

    it("non-admin cannot burn from treasury", async () => {
      await expect(
        swr.connect(stranger).burnFromTreasury(1000n)
      ).to.be.reverted;
    });
  });

  describe("setBuybackTreasury", () => {
    it("admin can update treasury address", async () => {
      await swr.connect(admin).setBuybackTreasury(stranger.address);
      expect(await swr.buybackTreasury()).to.equal(stranger.address);
    });

    it("reverts on zero address", async () => {
      await expect(
        swr.connect(admin).setBuybackTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("SWR: zero address");
    });

    it("stranger cannot update treasury", async () => {
      await expect(
        swr.connect(stranger).setBuybackTreasury(stranger.address)
      ).to.be.reverted;
    });
  });

  describe("ERC20 behaviour", () => {
    it("transfers between holders", async () => {
      const amount = 1000n * 10n ** 18n;
      await swr.connect(community).transfer(stranger.address, amount);
      expect(await swr.balanceOf(stranger.address)).to.equal(amount);
    });

    it("holder can burn own tokens", async () => {
      const amount = 500n * 10n ** 18n;
      const before = await swr.balanceOf(community.address);
      await swr.connect(community).burn(amount);
      expect(await swr.balanceOf(community.address)).to.equal(before - amount);
    });
  });
});
