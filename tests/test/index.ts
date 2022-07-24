import { ethers } from "hardhat";
import { expect } from "chai";
import {
  Asset,
  Asset__factory,
  AuctionSale,
  AuctionSale__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

let AssetFactory: Asset__factory,
  AuctionSaleFactory: AuctionSale__factory,
  asset: Asset,
  auctionSale: AuctionSale;

let owner: SignerWithAddress,
  from: SignerWithAddress,
  to: SignerWithAddress,
  other: SignerWithAddress;

const day = 60 * 60 * 24;

describe("AuctionSale", function () {
  beforeEach(async function () {
    [owner, from, to, other] = await ethers.getSigners();
    AssetFactory = await ethers.getContractFactory("Asset");
    AuctionSaleFactory = await ethers.getContractFactory("AuctionSale");
    asset = await AssetFactory.deploy("", "", "");
    await asset.deployed();

    auctionSale = await AuctionSaleFactory.deploy(asset.address);
    await auctionSale.deployed();
  });

  describe.skip("list", async () => {
    this.beforeEach(async () => {
      await asset.mint(owner.address, 10);
      await asset.mint(from.address, 10);
      await asset.mint(to.address, 10);
      await asset.mint(other.address, 10);
    });
    it.skip("should list the asset", async () => {
      const tx = auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await expect(tx)
        .to.be.emit(auctionSale, "List")
        .withArgs(
          1,
          owner.address,
          0,
          10,
          1 * day,
          15 * 60,
          ethers.utils.parseEther("0.5")
        );

      const auctionEndTime = auctionSale.getEndTimeForReserveAuction(1);
      expect(auctionEndTime).to.equal(0);

      const balanceOfAuctionSale = await asset.balanceOf(
        auctionSale.address,
        0
      );
      expect(balanceOfAuctionSale).to.equal(10);
    });
    it.skip("should list the asset with amount more than 0", async () => {
      const tx = auctionSale
        .connect(owner)
        .list(0, 0, ethers.utils.parseEther("0.5"), 1 * day);

      await expect(tx).to.be.revertedWith("Invalid amount");
    });
    it.skip("should list the asset with reserve price more than 100 wei", async () => {
      const tx = auctionSale.connect(owner).list(0, 10, 99, 1 * day);

      await expect(tx).to.be.revertedWith(
        "Reserve price must be at least 100 wei"
      );
    });
  });

  describe.skip("cancel", async () => {
    this.beforeEach(async () => {
      await asset.mint(owner.address, 10);
      await asset.mint(from.address, 10);
      await asset.mint(to.address, 10);
      await asset.mint(other.address, 10);
    });
    it.skip("should cancel the auction", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);
      const tx = auctionSale.connect(owner).cancel(1);
      await expect(tx).to.be.emit(auctionSale, "Cancel").withArgs(1);

      const balanceOfOwner = await asset.balanceOf(owner.address, 0);
      expect(balanceOfOwner).to.equal(10);

      const tx1 = auctionSale.getEndTimeForReserveAuction(1);
      await expect(tx1).to.be.revertedWith("Auction not found");
    });
    it.skip("should cancel the auction which only belongs to you", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);
      const tx = auctionSale.connect(from).cancel(1);
      await expect(tx).to.be.revertedWith("Not your auction");
    });
    it.skip("should cancel the auction when it is not in progress", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);
      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });
      const tx = auctionSale.connect(owner).cancel(1);
      await expect(tx).to.be.revertedWith("Auction in progress");
    });
  });

  describe.skip("bid", async () => {
    this.beforeEach(async () => {
      await asset.mint(owner.address, 10);
      await asset.mint(from.address, 10);
      await asset.mint(to.address, 10);
      await asset.mint(other.address, 10);
    });
    it.skip("should bid on the auction", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      const tx = auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("0.5") });

      await expect(tx)
        .to.be.emit(auctionSale, "Bid")
        .withArgs(
          1,
          0,
          from.address,
          ethers.utils.parseEther("0.5"),
          ethers.constants.AddressZero,
          0,
          owner.address,
          (await ethers.provider.getBlock("latest")).timestamp + 1 * day
        );
    });

    it.skip("should bid on the auction with a bid already", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("0.5") });

      const tx = auctionSale
        .connect(to)
        .bid(1, { value: ethers.utils.parseEther("1") });

      const endTime =
        (await ethers.provider.getBlock("latest")).timestamp + 1 * day;

      await expect(() => tx).to.changeEtherBalance(
        from,
        ethers.utils.parseEther("0.5")
      );

      await expect(tx)
        .to.be.emit(auctionSale, "Bid")
        .withArgs(
          1,
          0,
          to.address,
          ethers.utils.parseEther("1"),
          from.address,
          ethers.utils.parseEther("0.5"),
          owner.address,
          endTime
        );
    });
    it.skip("should bid on the auction with a valid id", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      const tx = auctionSale
        .connect(from)
        .bid(10, { value: ethers.utils.parseEther("0.5") });

      await expect(tx).to.be.revertedWith("Auction not found");
    });
    it.skip("should bid on the auction with a value at least the reserve price", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      const tx = auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("0.1") });

      await expect(tx).to.be.revertedWith(
        "Bid must be at least the reserve price"
      );
    });

    it.skip("should bid on the auction which is not over", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      ethers.provider.send("evm_increaseTime", [1 * day + 1]);

      const tx = auctionSale
        .connect(to)
        .bid(1, { value: ethers.utils.parseEther("1") });

      await expect(tx).to.be.revertedWith("Auction is over");
    });

    it.skip("should bid on the auction which you already made a bid before", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      const tx = auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      await expect(tx).to.be.revertedWith(
        "You already have an outstanding bid"
      );
    });
    it.skip("should bid on the auction with value bigger than previous bid", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      const tx = auctionSale
        .connect(to)
        .bid(1, { value: ethers.utils.parseEther("0.5") });

      await expect(tx).to.be.revertedWith("Bid currentBid too low");
    });
  });

  describe("settle", async () => {
    this.beforeEach(async () => {
      await asset.mint(owner.address, 10);
      await asset.mint(from.address, 10);
      await asset.mint(to.address, 10);
      await asset.mint(other.address, 10);
    });
    it("should settle the auction", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("0.5") });

      await ethers.provider.send("evm_increaseTime", [1 * day + 1]);

      const tx = auctionSale.connect(owner).settle(1);

      await expect(tx)
        .to.be.emit(auctionSale, "Settle")
        .withArgs(
          1,
          0,
          owner.address,
          from.address,
          ethers.utils.parseEther("0.5"),
          owner.address
        );
    });

    it.skip("should bid on the auction with a bid already", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("0.5") });

      const tx = auctionSale
        .connect(to)
        .bid(1, { value: ethers.utils.parseEther("1") });

      const endTime =
        (await ethers.provider.getBlock("latest")).timestamp + 1 * day;

      await expect(() => tx).to.changeEtherBalance(
        from,
        ethers.utils.parseEther("0.5")
      );

      await expect(tx)
        .to.be.emit(auctionSale, "Bid")
        .withArgs(
          1,
          0,
          to.address,
          ethers.utils.parseEther("1"),
          from.address,
          ethers.utils.parseEther("0.5"),
          owner.address,
          endTime
        );
    });
    it.skip("should bid on the auction with a valid id", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      const tx = auctionSale
        .connect(from)
        .bid(10, { value: ethers.utils.parseEther("0.5") });

      await expect(tx).to.be.revertedWith("Auction not found");
    });
    it.skip("should bid on the auction with a value at least the reserve price", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      const tx = auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("0.1") });

      await expect(tx).to.be.revertedWith(
        "Bid must be at least the reserve price"
      );
    });

    it.skip("should bid on the auction which is not over", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      ethers.provider.send("evm_increaseTime", [1 * day + 1]);

      const tx = auctionSale
        .connect(to)
        .bid(1, { value: ethers.utils.parseEther("1") });

      await expect(tx).to.be.revertedWith("Auction is over");
    });

    it.skip("should bid on the auction which you already made a bid before", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      const tx = auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      await expect(tx).to.be.revertedWith(
        "You already have an outstanding bid"
      );
    });
    it.skip("should bid on the auction with value bigger than previous bid", async () => {
      await auctionSale
        .connect(owner)
        .list(0, 10, ethers.utils.parseEther("0.5"), 1 * day);

      await auctionSale
        .connect(from)
        .bid(1, { value: ethers.utils.parseEther("1") });

      const tx = auctionSale
        .connect(to)
        .bid(1, { value: ethers.utils.parseEther("0.5") });

      await expect(tx).to.be.revertedWith("Bid currentBid too low");
    });
  });
});
