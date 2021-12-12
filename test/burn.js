const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('burn tokens', () => {
  it('owner can burn their token', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 100,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 10,
    })
    // Mint 3 tokens as the deployer
    tx = await util.token.mint({
      key: util.all,
      proof: []
    }, 3)
    await tx.wait()
    // Check the owner of the token => The deployer
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.deployer.address)
    // Burn the token as the deployer
    tx = await util.token.burn(1);
    await tx.wait()
    // The token should not exist
    owner = util.token.ownerOf(1)
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
  })
  it('cannot burn token if you are not the owner', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 100,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 10,
    })
    // Mint 3 tokens as the deployer
    tx = await util.token.mint({
      key: util.all,
      proof: []
    }, 3)
    await tx.wait()

    // Try to burn the token as alice => should fail
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.burn(1);
    await expect(tx).to.be.revertedWith("14")

  })
})
