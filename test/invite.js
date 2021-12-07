const { ethers } = require('hardhat');
const { expect } = require('chai')
const InviteList = require('invitelist');
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('invite', () => {
  it('deployment does not create any invites', async () => {
    await util.deploy();
    await util.clone(
      util.deployer.address,
      "test",
      "T",
      {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
    )
    let c = await util.token.config()
    expect(c.placeholder).to.equal("ipfs://placeholder")
    expect(c.supply).to.equal(10000)
    expect(c.base).to.equal("ipfs://")

    // get "Invited" logs => should be empty
    let logs = await util.globalLogs()
    let invitedLogs = logs.filter((log) => {
      return log.name == "Invited"
    })
    expect(invitedLogs.length).to.equal(0)
  })
  it('calling invite() should create an invite object', async () => {
    await util.deploy();
    await util.clone(
      util.deployer.address,
      "test",
      "T",
      {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
    )
    let tx = await util.token.setInvite(
      util.all,
      util._cid,
      {
        start: 0,
        price: 42,
        limit: 3,
      }
    )
    await tx.wait()

    // 1. Check logs => Only one item
    let logs = await util.globalLogs()
    let invitedLogs = logs.filter((log) => {
      return log.name == "Invited"
    })
    expect(invitedLogs.length).to.equal(1)
    expect(invitedLogs[0].args.key).to.equal(util.all)

    // 2. Check "all" invite
    let i = await util.token.invite(util.all)
    expect(i.price).to.equal(42)
    expect(i.start).to.equal(0)
    expect(i.limit).to.equal(3)
  })
  it('calling invite multiple times should overwrite the invite object but keep appending to the log', async () => {
    await util.deploy();
    await util.clone(
      util.deployer.address,
      "test",
      "T",
      {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
    )
    // Invite #1
    let tx = await util.token.setInvite(
      util.all,
      util._cid,
      {
        start: 0,
        price: 0,
        limit: 0,
      }
    )
    await tx.wait()

    // 0. Check "all" invite => Must be overwritten by the second invite
    let i1 = await util.token.invite(util.all)
    expect(i1.price).to.equal(0)
    expect(i1.start).to.equal(0)
    expect(i1.limit).to.equal(0)

    // Invite #2
    const SecondInviteTime = Date.now()
    tx = await util.token.setInvite(
      util.all,
      util._cid,
      {
        start: SecondInviteTime,
        price: 1,
        limit: 2,
      }
    )
    await tx.wait()

    // 1. Check logs => Two items
    let logs = await util.globalLogs()
    let invitedLogs = logs.filter((log) => {
      return log.name == "Invited"
    })
    expect(invitedLogs.length).to.equal(2)
    expect(invitedLogs[0].args.key).to.equal(util.all)

    // 2. Check "all" invite => Must be overwritten by the second invite
    let i2 = await util.token.invite(util.all)
    expect(i2.price).to.equal(1)
    expect(i2.start).to.equal(SecondInviteTime)
    expect(i2.limit).to.equal(2)
  })

  it('test Invitelist library: client-side list verification', async () => {
    await util.deploy();
    // Create a list made up of signers addresses
    const list = new InviteList(util.signers.map((s) => {
      return s.address
    }))
    // get merkle root
    let key = list.root()
    // get proof
    let proof = list.proof(util.alice.address)
    // verify that alice belongs to the list using proof
    let isvalid = list.verify(util.alice.address, proof)
    expect(isvalid).to.equal(true)
    let randoAccount = util.account()
    let randoAddress = randoAccount.address
    isvalid = list.verify(randoAddress, proof)
    expect(isvalid).to.equal(false)
  })
  it('airdrop', async () => {
    await util.deploy();
    // initial supply is 10
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    // Create a list made up of signers addresses
    const list = new InviteList(util.signers.map((s) => {
      return s.address
    }))
    // get merkle root
    let key = list.root()

    // AIRDROP: invite the list to mint at most 1 for FREE
    tx = await util.token.setInvite(key, util._cid, {
      price: 0,
      limit: 1,
      start: 0,
    })
    await tx.wait()

    // Check that the invite condition has been created for the merkle root
    let i = await util.token.invite(key)
    expect(i.price).to.equal(0)
    expect(i.start).to.equal(0)
    expect(i.limit).to.equal(1)

    // get proof for alice
    let proof = list.proof(util.alice.address)

    // try minting with alice address. should work because alice is part of the list
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key,
      proof
    }, 1)
    await tx.wait()

    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.alice.address)
  })
  it('merkle drop try with wrong proof shouldnt work', async () => {
    await util.deploy();


    // initial supply is 10
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    const list = new InviteList(util.signers.map((s) => {
      return s.address
    }))
    let key = list.root()

    // Create an invite for the list with 2 limit
    tx = await util.token.setInvite(key, util._cid, {
      start: 0,
      price: 0,
      limit: 2,
    })
    await tx.wait()

    // Get alice's merkle proof
    let aliceProof = list.proof(util.alice.address)
    // Bob trying to mint using Alice's merkle proof should fail
    let bobToken = util.getToken(util.bob)
    tx = bobToken.mint({
      key,
      proof: aliceProof
    }, 2)
    await expect(tx).to.be.revertedWith('wrong proof');

    // Get bob's merkle proof
    let bobProof = list.proof(util.bob.address)
    // Bob trying to mint with bob's merkle proof should work
    tx = await bobToken.mint({
      key: key,
      proof: bobProof,
    }, 2)
    await tx.wait()

    owner = await util.token.ownerOf(2)
    expect(owner).to.equal(util.bob.address)

  })
  it("trying to mint with another list shouldnt work", async () => {
    await util.deploy();
    // deploy with invite "key"
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    // invite signers to mint up to 3 at 0.01ETH
    const list = new InviteList(util.signers.map((s) => {
      return s.address
    }))
    let key = list.root()
    tx = await util.token.setInvite(key, util._cid, {
      start: 0,
      price: "" + Math.pow(10, 16),
      limit: 3,
    })
    await tx.wait()

    // try to mint with "all" condition shouldn't work because it doesn't exist
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.mint({
      key: util.all,
      proof: [],
    }, 1)
    // should revert with "mint limit" because by default it's all zero
    await expect(tx).to.be.revertedWith("mint limit")
  })
  it("empty merkle proof array should fail if not 'all' condition", async () => {
    await util.deploy();
    let tx = await util.clone(util.deployer.address, "test", "T",  {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    // invite signers to mint up to 3 at 0.01ETH
    const list = new InviteList(util.signers.map((s) => {
      return s.address
    }))
    tx = await util.token.setInvite(list.root(), util._cid, {
      start: 0,
      price: "" + Math.pow(10, 16),
      limit: 3,
    })
    await tx.wait()

    // the proof is empty and the list is not for "all", so should fail.
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.mint({
      key: list.root(),
      proof: [],
    }, 1)
    await expect(tx).to.be.revertedWith("wrong proof")
  })
  it("submit merkle root with empty proof should work if 'all' condition", async () => {
    await util.deploy();
    // deploy with invite "key"
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    // invite ALL to mint up to 3 for free
    tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 3,
    })
    await tx.wait()

    // mint with ALL, passing an empty proof array should work because "all" doesn't need proof
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: []
    }, 1)
    // should revert with "mint limit" because by default it's all zero
    let o = await util.token.ownerOf(1)
    expect(o).to.equal(util.alice.address)

  })
  it("presale with non zero amount payment", async () => {
    await util.deploy();

    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    // invite signers to mint up to 3 at 0.01ETH
    const list = new InviteList(util.signers.map((s) => {
      return s.address
    }))
    tx = await util.token.setInvite(list.root(), util._cid, {
      start: 0,
      price: "" + Math.pow(10, 16),
      limit: 3,
    })
    await tx.wait()

    // try to mint with the right key and right proof, but incorrect amouht should fail
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.mint({
      key: list.root(),
      proof: list.proof(util.alice.address)
    }, 1)
    await expect(tx).to.be.revertedWith("wrong amount")

    // correct amount should work
    tx = await aliceToken.mint({
      key: list.root(),
      proof: list.proof(util.alice.address)
    }, 1, {
      value: "" + Math.pow(10, 16)
    })

    let o = await util.token.ownerOf(1)
    expect(o).to.equal(util.alice.address)

  })
  it('multiple list batches', async () => {
    await util.deploy();
    let tx = await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://bafy/",
      permanent: false
    })

    let giveaway = util.signers.slice(0, 3);
    let presale = util.signers.slice(3);
    let giveawayAddresses = util.addresses.slice(0, 3);
    let presaleAddresses = util.addresses.slice(3);

    let giveawayInviteList = new InviteList(giveawayAddresses);
    let presaleInviteList = new InviteList(presaleAddresses)

    /***************************************************************
    *
    * Phase 1. Giveaway
    *
    ***************************************************************/
    // 1.1. Set a Giveaway whitelist : up to 3 for free
    tx = await util.token.setInvite(giveawayInviteList.root(), util._cid, {
      start: 0,
      price: 0,
      limit: 3,
    })
    await tx.wait()
    // 1.2. try to mint with an account not on the list => should fail
    let randoAccount = util.account()
    let randoAddress = randoAccount.address
    let proof = await giveawayInviteList.proof(randoAddress)
    let randoToken = util.getToken(randoAccount)
    tx = randoToken.mint({
      key: giveawayInviteList.root(),
      proof
    }, 1)
    await expect(tx).to.be.revertedWith("wrong proof")
    // 1.3. try to mint with an account on the giveaway list => should work
    proof = await giveawayInviteList.proof(giveawayAddresses[1])
    let giveawayToken = util.getToken(giveaway[1])
    tx = await giveawayToken.mint({
      key: giveawayInviteList.root(),
      proof
    }, 1)
    await tx.wait()
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(giveawayAddresses[1])

    /***************************************************************
    *
    * Phase 2. Presale
    *
    ***************************************************************/
    // 2.1. Set a Presale whitelist and update the price
    tx = await util.token.setInvite(presaleInviteList.root(), util._cid, {
      start: 0,
      price: "" + Math.pow(10, 18),
      limit: 3,
    })
    await tx.wait()
    let giveawayInvite = await util.token.invite(giveawayInviteList.root())
    expect(giveawayInvite.price).to.equal(0)
    let presaleInvite = await util.token.invite(presaleInviteList.root())
    expect(presaleInvite.price.toString()).to.equal(Math.pow(10, 18).toString())
    // 2.2. Try to mint with an account not on the presale list => should fail
    randoAccount = util.account()
    randoAddress = randoAccount.address
    proof = await giveawayInviteList.proof(randoAddress)
    tx = randoToken.mint({
      key: presaleInviteList.root(),
      proof
    }, 2, {
      value: "" + Math.pow(10, 18) * 2,
    })
    await expect(tx).to.be.revertedWith("wrong proof")
    // 2.3. Try to mint with an account on the presale but incorrect amount => should fail
    proof = await presaleInviteList.proof(presaleAddresses[1])
    let presaleToken = util.getToken(presale[1])
    tx = presaleToken.mint({
      key: presaleInviteList.root(),
      proof
    }, 2, {
      value: "" + Math.pow(10, 18),
    })
    await expect(tx).to.be.revertedWith("wrong amount")
    // 2.4. Try to mint with an account on the presale, but referencing a wrong merkle root (givawayInviteList instead of presaleInviteList)
    // => should fail
    tx = presaleToken.mint({
      key: giveawayInviteList.root(),
      proof
    }, 2, {
      value: 0
    })
    await expect(tx).to.be.revertedWith("wrong proof")
    // 2.5. Try to mint with an account on the presale with correct amount
    // => should work
    tx = await presaleToken.mint({
      key: presaleInviteList.root(),
      proof
    }, 2, {
      value: "" + Math.pow(10, 18) * 2,
    })
    await tx.wait()
    owner = await util.token.ownerOf(2)
    expect(owner).to.equal(presaleAddresses[1])
    // 2.6. Giveaway users should still be able to mint
    proof = await giveawayInviteList.proof(giveawayAddresses[2])
    let giveawayToken2 = util.getToken(giveaway[2])
    tx = await giveawayToken2.mint({
      key: giveawayInviteList.root(),
      proof
    }, 3)
    await tx.wait()
    owner = await util.token.ownerOf(4)
    expect(owner).to.equal(giveawayAddresses[2])

  })
})
