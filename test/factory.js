const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('factory', () => {
  it('invite only factory', async () => {
    // 1. Deploy Factory
    await util.deploy()
    let deployerFactory = util.getFactory(util.deployer)
    let deployerAddress = util.deployer.address
    await util.clone(
      deployerAddress,
      "test",
      "T",
      { placeholder: "ipfs://placeholder", supply: 10000, base: "ipfs://", permanent: false },
      { value: 0 }                                                            // payment
    )
    let addr = await util.collections(deployerAddress);
    let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
    let name = await util.token.name()
    let symbol = await util.token.symbol()
    expect(name).to.equal("test")
    expect(symbol).to.equal("T")

    // owner is the deployer
    let owner = await util.token.owner()
    expect(owner).to.equal(util.deployer.address)
  })
  it('create a collection for alice', async () => {
    await util.deploy();
    await util.clone(util.alice.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    // The collection owner is Alice
    let owner = await util.token.owner()
    expect(owner).to.equal(util.alice.address)
  })
  it("create a collection for a random account, and also include 1ETH so the receiver can start using the kit", async () => {
    await util.deploy();
    // random address
    let receiverAccount = util.account()
    let receiverBalanceBefore = await ethers.provider.getBalance(receiverAccount.address);
    // create a collection for receiverAccount, and include 1ETH "battteries"
    await util.clone(receiverAccount.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    }, {
      value: "" + Math.pow(10, 18)  // infuse 1 ETH
    })
    // check the collection owner => must match the receiver
    let owner = await util.token.owner()
    expect(owner).to.equal(receiverAccount.address)

    // check the balance of the receiver => 1ETH
    let receiverBalanceAfter = await ethers.provider.getBalance(receiverAccount.address);
    // before: 0ETH
    expect(receiverBalanceBefore).to.equal(0)
    // after: 1ETH
    expect(receiverBalanceAfter).to.equal( ethers.BigNumber.from("" + Math.pow(10, 18)))

  })
})
