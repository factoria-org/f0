const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('admin', () => {
  // set name and symbol
  it('setNS', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setNS("New name", "SYM")
    await tx.wait()

    let name = await util.token.name()
    let symbol = await util.token.symbol()
    expect(name).to.equal("New name")
    expect(symbol).to.equal("SYM")
  })
  it('transfer collection', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // At first, the owner is the deployer
    let owner = await util.token.owner()
    expect(owner).to.equal(util.deployer.address)

    // TRANSFER
    // 1. call addCollection to transfer
    let tx = await util.factory.addCollection(util.alice.address, util.token.address)
    let r = await tx.wait()
    expect(r.events[0].args.sender).to.equal(owner)
    expect(r.events[0].args.receiver).to.equal(util.alice.address)
    expect(r.events[0].args.collection).to.equal(util.token.address)
    // 2. call token.transferOwnership() to Alice
    await util.token.transferOwnership(util.alice.address)
    // The owner is now Alice
    owner = await util.token.owner()
    expect(owner).to.equal(util.alice.address)
  })
  it('only the collection owner can transfer ownership', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    // At first the owner is the deployer
    let owner = await util.token.owner()
    expect(owner).to.equal(util.deployer.address)

    // Alice tries to addCollection to herself when she doesn't own it
    let aliceFactory = util.getFactory(util.alice)
    let tx = aliceFactory.addCollection(util.alice.address, util.token.address)
    await expect(tx).to.be.revertedWith('unauthorized');

    // Alice tries to transferOwnership when she doesn't own it
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.transferOwnership(util.bob.address)
    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner')

    // The owner is still the deployer
    owner = await util.token.owner()
    expect(owner).to.equal(util.deployer.address)

  })
  it("only the collection owner can call factory.addCollection()", async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let owner = await util.token.owner()
    expect(owner).to.equal(util.deployer.address)

    // first, call token.transferOwnership()
    let tx = await util.token.transferOwnership(util.alice.address)
    await tx.wait()
    // now Alice owns the collection, so the deployer shouldn't be able to call factory.addCollection()
    tx = util.factory.addCollection(util.alice.address, util.token.address)
    await expect(tx).to.be.revertedWith('unauthorized');
  })
  it('pinning to the dashboard and transferring ownership are separate, so calling transferOwnership before factory.addColleciton should work', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let owner = await util.token.owner()
    expect(owner).to.equal(util.deployer.address)

    // first, transfer ownership to Alice
    let tx = await util.token.transferOwnership(util.alice.address)
    await tx.wait()

    // the owner is now alice
    owner = await util.token.owner()
    expect(owner).to.equal(util.alice.address)

    // Now only Alice can call factory.addCollection()
    let aliceFactory = util.getFactory(util.alice)
    tx = await aliceFactory.addCollection(util.alice.address, util.token.address)
    let r = await tx.wait()
    // alice sending to herself
    expect(r.events[0].args.sender).to.equal(util.alice.address)
    expect(r.events[0].args.receiver).to.equal(util.alice.address)
    expect(r.events[0].args.collection).to.equal(util.token.address)

  })
  it('uri', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let uri = await util.token.URI()
    console.log("uri", uri)
    await util.token.setURI("ipfs://")
    uri = await util.token.URI()
    console.log("uri", uri)
  })
})
