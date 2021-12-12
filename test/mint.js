const { ethers } = require('hardhat');
const { expect } = require('chai')
const InviteList = require('invitelist');
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('mint', () => {
  it('should not allow minting with public invite when there is no public invite', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = util.token.mint({
      key: util.all,
      proof: [],
    }, 1)
    await expect(tx).to.be.revertedWith("10") 

    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("0")
  })
  it('should not allow minting with private invite when there is no such private invite', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    // Create a list made up of signers addresses
    const list = new InviteList(util.signers.map((s) => { return s.address }))
    // get merkle root
    let key = list.root()

    // get proof for alice
    let proof = list.proof(util.alice.address)

    // try minting with alice address. should work because alice is part of the list
    let aliceToken = util.getToken(util.alice)
    let tx = aliceToken.mint({
      key,
      proof
    }, 1)
    await expect(tx).to.be.revertedWith("10")

    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("0")

  })
  it('single mint', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 3,
    })
    await tx.wait()

    // Check invite for limit => 3
    let invite = await util.token.invite(util.all)
    expect(invite.limit).to.equal(3)

    // Alice tries to mint 1 => should be able to mint one
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 1)
    await tx.wait()
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.alice.address)
  })
  it('nextId is 0 at first', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("0")
  })
  it('inviting turns nextId to 1', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })

    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 100,
    })
    await tx.wait()

    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("1")
  })
  it('minting one turns nextId to 2', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })

    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 100,
    })
    await tx.wait()

    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 1)
    await tx.wait()

    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("2")
  })
  it('minting increments nextId', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 100,
    })
    await tx.wait()

    // Alice tries to mint 1 => should be able to mint one
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 10)
    await tx.wait()

    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("11")
  })
  it('multi mint', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 3,
    })
    await tx.wait()

    // Alice tries to mint 3 tokens => Should work
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: []
    }, 3)
    await tx.wait()
    // token 1, 2, 3 should be owned by alice
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.alice.address)
    owner = await util.token.ownerOf(2)
    expect(owner).to.equal(util.alice.address)
    owner = await util.token.ownerOf(3)
    expect(owner).to.equal(util.alice.address)

    // token 4 doesn't exist
    tx = util.token.ownerOf(4)
    await expect(tx).to.be.revertedWith("ERC721: owner query for nonexistent token")
  })
  it('after reaching the total supply, the nextId is the total supply + 1', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 100,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 100,
    })
    await tx.wait()

    // Alice tries to mint 3 tokens => Should work
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: []
    }, 100)
    await tx.wait()

    let nextId = await util.token.nextId()
    expect(nextId.toString()).to.equal("101")
  })
  it('cannot mint more than total supply', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 10000,
    })
    await tx.wait()

    // try to mint 11 when the total supply is 10
    tx = util.token.mint({
      key: util.all,
      proof: [],
    }, 11)
    await expect(tx).to.be.revertedWith("11")

    // try to mint 10 => should work
    tx = await util.token.mint({
      key: util.all,
      proof: [],
    }, 10)
    let o = await util.token.ownerOf(10)
    expect(o).to.equal(util.deployer.address)

  })
  it('minting transaction must send the right amount', async () => {
    await util.deploy();
    // not sending money should fail
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: "" + Math.pow(10, 18),
      limit: 3,
    })
    await tx.wait()

    // try to mint for free => should fail
    tx = util.token.mint({
      key: util.all,
      proof: [],
    }, 1)
    await expect(tx).to.be.revertedWith("8")

    // try to mint 1 while paying too much => fail
    tx = util.token.mint({
      account: util.alice.address, 
      key: util.all,
      proof: [],
    }, 1, {
      value: "" + Math.pow(10, 19)
    })
    await expect(tx).to.be.revertedWith("8")

    // try to mint 1 while paying too little => fail
    tx = util.token.mint({
      key: util.all,
      proof: [],
    }, 1, {
      value: "" + Math.pow(10, 17)
    })
    await expect(tx).to.be.revertedWith("8")

    // try to mint 1 while paying for 1 => should succeed
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 1, {
      value: "" + Math.pow(10, 18)
    })
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.alice.address)
  })
})
