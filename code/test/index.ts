import { ethers } from "hardhat";
import { expect } from "chai";

describe("ProposalSale", function () {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const uri = "https://asset.com";
  const symbol = "ASSET";
  const name = "asset";
  let deployer: any;
  let other: any;
  let other2: any;

  beforeEach(async function () {
    [deployer, other, other2] = await ethers.getSigners();

    const Asset = await ethers.getContractFactory("Asset");
    this.asset = await Asset.deploy(uri, symbol, name);
    await this.asset.deployed();

    const ProposalSale = await ethers.getContractFactory("ProposalSale");
    this.proposalSale = await ProposalSale.deploy(this.asset.address);
    await this.proposalSale.deployed();

    const amount = 1;

    await this.asset.mint(deployer.address, amount);
    await this.asset.mint(other.address, amount);
    await this.asset.mint(deployer.address, 2);
    await this.asset.mint(deployer.address, 4);
    await this.asset.mint(other.address, 4);
  });

  describe("list", function () {
    it("can list an item for sale that you have", async function () {
      const receipt = this.proposalSale.list(0, 1);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          deployer.address,
          this.proposalSale.address,
          0,
          1
        );

      await expect(receipt)
        .to.be.emit(this.proposalSale, "List")
        .withArgs(0, deployer.address, 0, 1);

      const listing = await this.proposalSale.lists(0);

      expect(listing.seller).to.be.equal(deployer.address);
      expect(listing.assetId).to.be.equal(0);
      expect(listing.amount).to.be.equal(1);
    });

    it("can list item with multiple quantity for sale that you have", async function () {
      const receipt = this.proposalSale.list(3, 4);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          deployer.address,
          this.proposalSale.address,
          3,
          4
        );

      await expect(receipt)
        .to.be.emit(this.proposalSale, "List")
        .withArgs(0, deployer.address, 3, 4);

      const listing = await this.proposalSale.lists(0);

      expect(listing.seller).to.be.equal(deployer.address);
      expect(listing.assetId).to.be.equal(3);
      expect(listing.amount).to.be.equal(4);
    });

    it("can't list an item for sale that you don't have", async function () {
      const receipt = this.proposalSale.list(1, 1);

      await expect(receipt).to.be.revertedWith(
        "ERC1155: insufficient balance for transfer"
      );
    });

    it("can't list an item for 0 amount", async function () {
      const receipt = this.proposalSale.list(1, 0);

      await expect(receipt).to.be.revertedWith("Invalid amount");
    });
  });

  describe("propose", function () {
    it("can propose item", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      const receipt = this.proposalSale.propose(0, 1, { value: 100 });

      await expect(receipt)
        .to.be.emit(this.proposalSale, "Propose")
        .withArgs(0, 0, other.address, deployer.address, 1, 1, 100);

      await expect(() => receipt).to.changeEtherBalance(deployer, -100);

      const propose = await this.proposalSale.proposals(0, 0);

      expect(propose.amount).to.be.equal(1);
      expect(propose.price).to.be.equal(100);
      expect(propose.buyer).to.be.equal(deployer.address);
    });

    it("can propose item with multiple quantities", async function () {
      await this.proposalSale.connect(other).list(4, 2);

      const receipt = this.proposalSale.propose(0, 2, { value: 200 });

      await expect(receipt)
        .to.be.emit(this.proposalSale, "Propose")
        // .withArgs(0, 0, other.address, deployer.address, 4, 2, 100);
        .withArgs(0, 0, other.address, deployer.address, 4, 2, 200);

      await expect(() => receipt).to.changeEtherBalance(deployer, -200);

      const propose = await this.proposalSale.proposals(0, 0);

      expect(propose.amount).to.be.equal(2);
      // expect(propose.price).to.be.equal(100);
      expect(propose.price).to.be.equal(200);
      expect(propose.buyer).to.be.equal(deployer.address);
    });

    it("proposing the same item return the previous offer and replaces it", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      let receipt = this.proposalSale.propose(0, 1, { value: 100 });

      await expect(() => receipt).to.changeEtherBalance(deployer, -100);
      await expect(() => receipt).to.changeEtherBalance(this.proposalSale, 100);

      receipt = this.proposalSale.connect(other2).propose(0, 1, { value: 500 });
      await expect(() => receipt).to.changeEtherBalance(other2, -500);
      await expect(() => receipt).to.changeEtherBalance(this.proposalSale, 500);

      receipt = this.proposalSale.connect(other2).propose(0, 1, { value: 600 });
      await expect(() => receipt).to.changeEtherBalance(other2, -100);
      await expect(() => receipt).to.changeEtherBalance(this.proposalSale, 100);

      receipt = this.proposalSale.propose(0, 1, { value: 200 });
      await expect(() => receipt).to.changeEtherBalance(deployer, -100);
      await expect(() => receipt).to.changeEtherBalance(this.proposalSale, 100);

      receipt = this.proposalSale.propose(0, 1, { value: 300 });
      await expect(() => receipt).to.changeEtherBalance(deployer, -100);
      await expect(() => receipt).to.changeEtherBalance(this.proposalSale, 100);

      await expect(receipt)
        .to.be.emit(this.proposalSale, "Propose")
        .withArgs(0, 0, other.address, deployer.address, 1, 1, 300);

      const proposal = await this.proposalSale.proposals(0, 0);

      expect(proposal.amount).to.be.equal(1);
      expect(proposal.price).to.be.equal(300);
      expect(proposal.buyer).to.be.equal(deployer.address);

      const proposalId = await this.proposalSale.proposalsIdCounter(0);
      expect(proposalId).to.be.equal(2);

      let activeProposal = await this.proposalSale.activeProposals(
        0,
        deployer.address
      );

      expect(activeProposal).to.be.equal(0);

      activeProposal = await this.proposalSale.activeProposals(
        0,
        other2.address
      );
      expect(activeProposal).to.be.equal(1);
    });

    it("can't propose items for 0 amount", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      const receipt = this.proposalSale.propose(0, 0, { value: 100 });

      await expect(receipt).to.be.revertedWith("Invalid amount");
    });

    it("can't propose items with indivisible amount", async function () {
      await this.proposalSale.connect(other).list(4, 2);

      const receipt = this.proposalSale.propose(0, 2, { value: 157 });

      await expect(receipt).to.be.revertedWith(
        "Total price not divisible by amount"
      );
    });

    it("can't propose items that are not listed", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      const receipt = this.proposalSale.propose(1, 1, { value: 100 });

      await expect(receipt).to.be.revertedWith("Invalid asset");
    });

    it("can't propose items for more amount then what's listed", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      const receipt = this.proposalSale.propose(0, 2, { value: 100 });
      await expect(receipt).to.be.revertedWith("Invalid amount");
    });

    it("can't propose items that are listed by yourself", async function () {
      await this.proposalSale.list(0, 1);

      const receipt = this.proposalSale.propose(0, 1, { value: 100 });
      await expect(receipt).to.be.revertedWith("Invalid proposal");
    });
  });

  describe("accept", function () {
    it("can accept item", async function () {
      await this.proposalSale.list(0, 1);

      await this.proposalSale.connect(other).propose(0, 1, { value: 100 });
      const receipt = this.proposalSale.accept(0, 0);

      await expect(() => receipt).to.changeEtherBalance(deployer, 100);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          this.proposalSale.address,
          other.address,
          0,
          1
        );

      await expect(receipt)
        .to.be.emit(this.proposalSale, "ListingEnded")
        .withArgs(0);

      await expect(receipt)
        .to.be.emit(this.proposalSale, "Accept")
        .withArgs(0, 0, deployer.address, other.address, 0, 1, 100);

      const proposal = await this.proposalSale.proposals(0, 0);
      expect(proposal.amount).to.be.equal(0);
      expect(proposal.buyer).to.be.equal(ZERO_ADDRESS);
      expect(proposal.price).to.be.equal(0);

      const list = await this.proposalSale.lists(0);
      expect(list.amount).to.be.equal(0);
    });

    it("can accept item with multiple quantity", async function () {
      await this.proposalSale.connect(other).list(4, 2);

      await this.proposalSale.propose(0, 2, { value: 200 });

      const receipt = this.proposalSale.connect(other).accept(0, 0);

      await expect(() => receipt).to.changeEtherBalance(other, 200);

      await expect(receipt)
        .to.be.emit(this.proposalSale, "Accept")
        // .withArgs(0, 0, other.address, deployer.address, 4, 2, 100);
        .withArgs(0, 0, other.address, deployer.address, 4, 2, 200);

      await expect(receipt)
        .to.be.emit(this.proposalSale, "ListingEnded")
        .withArgs(0);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          this.proposalSale.address,
          deployer.address,
          4,
          2
        );

      const propose = await this.proposalSale.proposals(0, 0);

      expect(propose.amount).to.be.equal(0);
      expect(propose.price).to.be.equal(0);
      expect(propose.buyer).to.be.equal(ZERO_ADDRESS);

      const activeProposal = await this.proposalSale.activeProposals(
        0,
        deployer.address
      );
      expect(activeProposal).to.be.equal(0);
    });

    it("can't accept items that are not listed", async function () {
      await this.proposalSale.list(0, 1);

      await this.proposalSale.connect(other).propose(0, 1, { value: 100 });
      const receipt = this.proposalSale.accept(1, 0);

      await expect(receipt).to.be.revertedWith("Invalid asset");
    });

    it("can't accept propose that doesn't exist", async function () {
      await this.proposalSale.list(0, 1);

      await this.proposalSale.connect(other).propose(0, 1, { value: 100 });
      const receipt = this.proposalSale.accept(0, 1);
      await expect(receipt).to.be.revertedWith("Invalid proposal amount");
    });

    it("can't accept propose after listing ended", async function () {
      await this.proposalSale.list(0, 1);

      await this.proposalSale.connect(other).propose(0, 1, { value: 100 });
      this.proposalSale.accept(0, 0);

      const receipt = this.proposalSale.accept(0, 0);

      await expect(receipt).to.be.revertedWith("Invalid asset");
    });
  });

  describe("cancelListing", function () {
    it("can cancel a listing", async function () {
      await this.proposalSale.list(0, 1);

      const receipt = this.proposalSale.cancelListing(0);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          this.proposalSale.address,
          deployer.address,
          0,
          1
        );

      await expect(receipt)
        .to.be.emit(this.proposalSale, "Cancel")
        .withArgs(0, deployer.address, 0, 1);

      const listing = await this.proposalSale.lists(0);

      expect(listing.amount).to.be.equal(0);
    });

    it("can't cancel a listing that is not yours", async function () {
      await this.proposalSale.list(0, 1);

      const receipt = this.proposalSale.connect(other).cancelListing(0);

      await expect(receipt).to.be.revertedWith("Invalid listing");
    });

    it("can't cancel a listing that doesn't exist", async function () {
      await this.proposalSale.list(0, 1);

      const receipt = this.proposalSale.connect(other).cancelListing(1);

      await expect(receipt).to.be.revertedWith("Invalid listing");
    });

    it("can't cancel a listing that finished", async function () {
      await this.proposalSale.list(0, 1);

      await this.proposalSale.connect(other).propose(0, 1, { value: 100 });
      await this.proposalSale.accept(0, 0);
      const receipt = this.proposalSale.cancelListing(0);

      await expect(receipt).to.be.revertedWith("Invalid listing");
    });

    it("can't cancel a listing that is already canceled", async function () {
      await this.proposalSale.list(0, 1);

      await this.proposalSale.cancelListing(0);
      const receipt = this.proposalSale.cancelListing(0);

      await expect(receipt).to.be.revertedWith("Invalid listing");
    });
  });

  describe("cancelPropose", function () {
    it("can cancel a propose", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.propose(0, 1, { value: 100 });
      const receipt = this.proposalSale.cancelPropose(0, 0);

      await expect(() => receipt).to.changeEtherBalance(deployer, 100);
      await expect(receipt)
        .to.be.emit(this.proposalSale, "CancelProposal")
        .withArgs(0, 0, other.address, deployer.address, 1);

      const proposal = await this.proposalSale.proposals(0, 0);

      expect(proposal.buyer).to.be.equal(ZERO_ADDRESS);
      expect(proposal.amount).to.be.equal(0);
      expect(proposal.price).to.be.equal(0);
    });

    it("can cancel a multi quantity propose", async function () {
      await this.proposalSale.connect(other).list(4, 2);

      await this.proposalSale.propose(0, 2, { value: 200 });

      const receipt = this.proposalSale.cancelPropose(0, 0);

      await expect(() => receipt).to.changeEtherBalance(deployer, 200);
      await expect(receipt)
        .to.be.emit(this.proposalSale, "CancelProposal")
        .withArgs(0, 0, other.address, deployer.address, 4);

      const proposal = await this.proposalSale.proposals(0, 0);

      expect(proposal.buyer).to.be.equal(ZERO_ADDRESS);
      expect(proposal.amount).to.be.equal(0);
      expect(proposal.price).to.be.equal(0);
    });

    it("can cancel after a listing ended", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.connect(other2).propose(0, 1, { value: 100 });
      await this.proposalSale.propose(0, 1, { value: 100 });
      await this.proposalSale.connect(other).accept(0, 0);

      const receipt = this.proposalSale.cancelPropose(0, 1);

      await expect(() => receipt).to.changeEtherBalance(deployer, 100);
      await expect(receipt)
        .to.be.emit(this.proposalSale, "CancelProposal")
        .withArgs(0, 1, other.address, deployer.address, 1);

      const proposal = await this.proposalSale.proposals(0, 1);

      expect(proposal.buyer).to.be.equal(ZERO_ADDRESS);
      expect(proposal.amount).to.be.equal(0);
      expect(proposal.price).to.be.equal(0);
    });

    it("can cancel after a listing cancelled", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.propose(0, 1, { value: 100 });
      await this.proposalSale.connect(other).cancelListing(0);

      const receipt = this.proposalSale.cancelPropose(0, 0);

      await expect(() => receipt).to.changeEtherBalance(deployer, 100);
      await expect(receipt)
        .to.be.emit(this.proposalSale, "CancelProposal")
        .withArgs(0, 0, other.address, deployer.address, 1);

      const proposal = await this.proposalSale.proposals(0, 0);

      expect(proposal.buyer).to.be.equal(ZERO_ADDRESS);
      expect(proposal.amount).to.be.equal(0);
      expect(proposal.price).to.be.equal(0);
    });

    it("can't cancel a propose that is not yours", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.propose(0, 1, { value: 100 });
      const receipt = this.proposalSale.connect(other).cancelPropose(0, 0);
      await expect(receipt).to.be.revertedWith("Not your proposal");
    });

    it("can't cancel a propose that doesn't exist", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.propose(0, 1, { value: 100 });
      const receipt = this.proposalSale.cancelPropose(0, 2);
      await expect(receipt).to.be.revertedWith("Not your proposal");
    });

    it("can't cancel a propose that's finished", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.propose(0, 1, { value: 100 });
      await this.proposalSale.connect(other).accept(0, 0);
      const receipt = this.proposalSale.cancelPropose(0, 0);
      await expect(receipt).to.be.revertedWith("Not your proposal");
    });

    it("can't cancel a propose that is already canceled", async function () {
      await this.proposalSale.connect(other).list(1, 1);

      await this.proposalSale.propose(0, 1, { value: 100 });
      await this.proposalSale.cancelPropose(0, 0);
      const receipt = this.proposalSale.cancelPropose(0, 0);
      await expect(receipt).to.be.revertedWith("Not your proposal");
    });
  });

  describe("onERC1155Recceived", function () {
    it("can receive token if the contract makes the transfer", async function () {
      const receipt = this.proposalSale.list(0, 1);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          deployer.address,
          this.proposalSale.address,
          0,
          1
        );
    });
  });

  describe("onERC1155Recceived", function () {
    it("can receive token if the contract makes the transfer", async function () {
      const receipt = this.proposalSale.list(0, 1);

      await expect(receipt)
        .to.be.emit(this.asset, "TransferSingle")
        .withArgs(
          this.proposalSale.address,
          deployer.address,
          this.proposalSale.address,
          0,
          1
        );
    });

    it("can't receive token if another addres makes the transfer", async function () {
      const receive = this.asset.safeTransferFrom(
        deployer.address,
        this.proposalSale.address,
        0,
        1,
        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(""))
      );

      expect(receive).to.be.revertedWith(
        "ERC1155: ERC1155Receiver rejected tokens"
      );
    });
  });
});
