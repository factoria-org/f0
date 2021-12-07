const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('gift', () => {
  it('gift tokens to alice', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // The deployer gifts 3 tokens to bob
    let tx = await util.token.gift(util.bob.address, 3)
    await tx.wait()
    // the 3 tokens are now owned by bob
    for(let i=1; i<=3; i++) {
      let owner = await util.token.ownerOf(i) 
      expect(owner).to.equal(util.bob.address)
    }
  })
  it('only the collection owner can gift', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // Alice is not the owner, but tries to gift 3 tokens to Bob => fail
    let aliceToken = util.getToken(util.alice)
    let tx = aliceToken.gift(util.bob.address, 3)
    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
  })
})
