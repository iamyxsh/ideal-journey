import { ethers } from "hardhat";

describe("Test", () => {
  it("should", async () => {
    const [owner] = await ethers.getSigners();
    const AssetFactory = await ethers.getContractFactory("Asset");
    const asset = await AssetFactory.deploy("", "", "");
    await asset.deployed();

    const ProposalFactory = await ethers.getContractFactory("Proposal");
    const proposal = await ProposalFactory.deploy(asset.address);
    await proposal.deployed();

    await asset.mint(owner.address, 10);
    let balance = await asset.balanceOf(owner.address, 0);
    console.log(balance);

    await proposal.list(0, 10);
    const totalList = await proposal.totalLists();
    console.log(totalList);

    const balance1 = await asset.balanceOf(proposal.address, 0);
    console.log(balance1);

    balance = await asset.balanceOf(owner.address, 0);
    console.log(balance);
  });
});
