const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('gift', () => {
  it('should be able to gift multiple times', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // The deployer gifts 3 tokens to bob
    let tx = await util.token.gift(util.bob.address, 1)
    await tx.wait()

    tx = await util.token.gift(util.bob.address, 1)
    await tx.wait()

  })
  it('if gift attempt fails, the nextId should be the same', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })

    // alice tries to gift => should fail because alice doesn't have the permission
    let aliceToken = util.getToken(util.alice)
    let tx = aliceToken.gift(util.bob.address, 1)
    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner")

    // nextId should still be 0
    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("0")

  })
  it('gift one token and check nextId', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // The deployer gifts 3 tokens to bob
    let tx = await util.token.gift(util.bob.address, 1)
    await tx.wait()


    // nextId should be 2 because 1 has been minted
    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("2")
    let owner = await util.token.ownerOf(1) 
    expect(owner).to.equal(util.bob.address)

    owner = util.token.ownerOf(2) 
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

  })
  it('gift two tokens and check nextId', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // The deployer gifts 3 tokens to bob
    let tx = await util.token.gift(util.bob.address, 2)
    await tx.wait()

    // nextId should be 3 because 1 and 2 have been minted
    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("3")
    for(let i=1; i<=2; i++) {
      let owner = await util.token.ownerOf(i) 
      expect(owner).to.equal(util.bob.address)
    }
    let owner = util.token.ownerOf(3)
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
  })
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
