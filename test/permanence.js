const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('permanence', () => {
  it("even when frozen, you can still send invites", async () => {
    await util.deploy();
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: true
    })

    // At first, cannot mint because there's no invite
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.mint({
      key: util.all,
      proof: [],
    }, 1)
    await expect(tx).to.be.revertedWith("mint limit")

    // Even though "permanent" is true, should be able to create an invite
    // Now create an invite for "all" => can mint 1 for free
    tx = await util.token.setInvite(util.all, util._cid, {
      price: 0,
      limit: 1,
      start: 0,
    })

    // Now alice can mint 1
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 1)
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.alice.address)

  })
  it('if made permanent during deployment, can not make it NOT permanent', async () => {
    await util.deploy();
    // Deploy with permanence
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: true
    })

    // Try to revert "permanent" to false. Should fail because it's permanent.
    tx = util.token.setConfig({
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: false 
    })
    await expect(tx).to.be.revertedWith("permanent")
  })
  it('if made permanent during deployment, cannot change the configuration anymore', async () => {
    await util.deploy();
    // Deploy with permanence
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: true
    })

    // Try to create a config. Should fail because it's permanent.
    tx = util.token.setConfig({
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: true,
    })
    await expect(tx).to.be.revertedWith("permanent")

  })
  it('can update the configuration if not made permanent', async () => {
    await util.deploy();

    // initial supply is 10
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/"
    })

    let c = await util.token.config()
    expect(c.supply).to.equal(10)

    // Now increase the supply to 10000
    tx = await util.token.setConfig({
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: false
    })

    // should go through and the total supply should be changed
    c = await util.token.config()
    expect(c.supply).to.equal(10000)
    
  })
  it('making permanent later should work', async () => {
    await util.deploy();
    // initial supply is 10
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    // check: Initial total supply is 10
    let c = await util.token.config()
    expect(c.supply).to.equal(10)

    // update to a new config, AND make it permanent
    tx = await util.token.setConfig({
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://5678/",
      permanent: true
    })

    // once again, try to change the config to a new version. Should fail because now it's perament.
    tx = util.token.setConfig({
      placeholder: "ipfs://placeholder",
      supply: 1,
      base: "ipfs://5678/",
      permanent: true
    })
    await expect(tx).to.be.revertedWith('permanent')

  })
  it('setWithdrawer permanence', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setWithdrawer({
      account: util.alice.address,
      permanent: false
    })
    await tx.wait()

    // The withdrawer is now Alice
    let withdrawer = await util.token.withdrawer()
    expect(withdrawer.account).to.equal(util.alice.address)
    expect(withdrawer.permanent).to.equal(false)

    // Set the withdrawer to bob, but this time make it permanent
    tx = await util.token.setWithdrawer({
      account: util.bob.address,
      permanent: true
    })
    await tx.wait()

    // The withdrawer is now Bob
    withdrawer = await util.token.withdrawer()
    expect(withdrawer.account).to.equal(util.bob.address)
    expect(withdrawer.permanent).to.equal(true)

    // try to set withdrawer back to alice => should fail
    tx = util.token.setWithdrawer({
      account: util.alice.address,
      permanent: false 
    })
    await expect(tx).to.be.revertedWith("permanent");

    tx = util.token.setWithdrawer({
      account: util.alice.address,
      permanent: true
    })
    await expect(tx).to.be.revertedWith("permanent");
    
  })
})
