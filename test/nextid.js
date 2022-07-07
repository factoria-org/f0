const { ethers } = require('hardhat');
const InviteList = require('invitelist')
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
const deploy = async () => {
  await util.deploy();
  await util.clone(util.deployer.address, "test", "T", {
    placeholder: "ipfs://placeholder",
    supply: 10,
    base: "ipfs://"
  })
}
const privInvite = async (account) => {
  const list = new InviteList(util.signers.map((s) => { return s.address }))
  // get merkle root
  let key = list.root()
  // get proof for alice
  let proof = list.proof(account)
  let tx = await util.token.setInvite(key, util._cid, {
    start: 0,
    price: 0,
    limit: 300,
  })
  await tx.wait()
  return { key, proof }
}
const pubInvite = async () => {
  let tx = await util.token.setInvite(util.all, util._cid, {
    start: 0,
    price: 0,
    limit: 300,
  })
  await tx.wait()
  return { key: util.all, proof: [] }
}
describe('nextId edge case testing', () => {
  describe('gift', () => {
    it('public invite => gift 0 => nextId should be 1', async () => {
      await deploy()
      let auth = await pubInvite()
      let r = util.token.gift(util.alice.address, 0)
      await expect(r).to.be.reverted
    })
    it('gift 0 and then mint 1 => should mint tokenId 1 and nextId should be 2', async () => {
      await deploy()

      let r = util.token.gift(util.alice.address, 0)
      await expect(r).to.be.reverted

      let auth = await pubInvite()
      await util.token.mint(auth, 1)

      // tokenId 1 owned by deployer
      let owner = await util.token.ownerOf(1)
      expect(owner).to.equal(util.deployer.address)

      // tokenId 2 doesn't exist
      owner = util.token.ownerOf(2)
      await expect(owner).to.be.revertedWith("ERC721: invalid token ID")

      // nextId should be 2
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(2)
    })
    it('public invite => gift 1 => nextId should be 2', async () => {
      await deploy()
      let auth = await pubInvite()
      await util.token.gift(util.alice.address, 1)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(2)
    })
    it('public invite => gift 2 => nextId should be 3', async () => {
      await deploy()
      let auth = await pubInvite()
      await util.token.gift(util.alice.address, 2)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(3)
    })
    it('private invite => gift 0 => nextId should be 1', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      //await util.token.gift(util.alice.address, 0)

      let r = util.token.gift(util.alice.address, 0)
      await expect(r).to.be.reverted

      let nextId = await util.token.nextId()
      expect(nextId).to.equal(1)
    })
    it('private invite => gift 1 => nextId should be 2', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      await util.token.gift(util.alice.address, 1)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(2)
    })
    it('private invite => gift 2 => nextId should be 3', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      await util.token.gift(util.alice.address, 2)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(3)
    })
    it('gift multiple times shouldnt affect nextId', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      for(let i=1; i<=10; i++) {
        await util.token.gift(util.alice.address, 1)
        let nextId = await util.token.nextId()
        expect(nextId).to.equal(i+1)
      }
    })
  })
  describe('mint', () => {
    it('mint 0 without invite should revert', async () => {
      await deploy()
      let r = util.token.mint({ key: util.all, proof: [] }, 0)
      await expect(r).to.be.reverted
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(0)
    })
    it('public mint 1 without invite should revert with mint limit', async () => {
      await deploy()
      let r = util.token.mint({ key: util.all, proof: [] }, 1)
      await expect(r).to.be.revertedWith("10")
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(0)
    })
    it('private mint 1 without invite should revert with mint limit', async () => {
      await deploy()
      const list = new InviteList(util.signers.map((s) => { return s.address }))
      let key = list.root()
      let proof = list.proof(util.alice.address)
      let aliceToken = util.getToken(util.alice)
      let r = aliceToken.mint({ key, proof }, 1)
      await expect(r).to.be.revertedWith("10")
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(0)
    })
    it('public invite => nextId should be 1', async () => {
      await deploy()
      let auth = await pubInvite()
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(1)
    })
    it('public invite => mint 0 => nextId should be 1', async () => {
      // This scenario should not happen (no point), but if it does happen, it will set the nextId to 1
      await deploy()
      let auth = await pubInvite()
      await util.token.mint(auth, 0)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(1)
    })
    it('mint 0 and then gift 1 => should gift tokenId 1 and nextId should be 2', async () => {
      await deploy()
      let auth = await pubInvite()
      await util.token.mint(auth, 0)

      await util.token.gift(util.alice.address, 1)

      // tokenId 1 owned by alice
      let owner = await util.token.ownerOf(1)
      expect(owner).to.equal(util.alice.address)

      // tokenId 2 doesn't exist
      owner = util.token.ownerOf(2)
      await expect(owner).to.be.revertedWith("ERC721: invalid token ID")

      // nextId should be 2
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(2)
    })
    it('public invite => mint 1 => nextId should be 2', async () => {
      await deploy()
      let auth = await pubInvite()
      await util.token.mint(auth, 1)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(2)
    })
    it('public invite => mint 2 => nextId should be 3', async () => {
      await deploy()
      let auth = await pubInvite()
      await util.token.mint(auth, 2)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(3)
    })
    it('private invite => mint 0 => nextId should be 1', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      //console.log("auth", auth)
      let aliceToken = util.getToken(util.alice)
      await aliceToken.mint(auth, 0)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(1)
    })
    it('private invite => mint 1 => nextId should be 2', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      let aliceToken = util.getToken(util.alice)
      await aliceToken.mint(auth, 1)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(2)
    })
    it('private invite => mint 2 => nextId should be 3', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      let aliceToken = util.getToken(util.alice)
      await aliceToken.mint(auth, 2)
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(3)
    })
    it('mint multiple times shouldnt affect nextId', async () => {
      await deploy()
      let auth = await privInvite(util.alice.address)
      let aliceToken = util.getToken(util.alice)
      for(let i=1; i<=10; i++) {
        await aliceToken.mint(auth, 1)
        let nextId = await util.token.nextId()
        expect(nextId).to.equal(i+1)
      }
    })
  })
  describe("invite", () => {
    it('setInvite should set the nextId to 1 if not initialized', async () => {
      await deploy()
      // before : 0
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(0)
      await util.token.setInvite(util.all, util._cid, {
        start: 0,
        price: 0,
        limit: 0,
      })
      // after : 1
      nextId = await util.token.nextId()
      expect(nextId).to.equal(1)
    })
    it('setInvite should set the nextId to 1 if not initialized', async () => {
      await deploy()
      // before : 0
      let nextId = await util.token.nextId()
      expect(nextId).to.equal(0)
      await util.token.setInvite(util.all, util._cid, {
        start: 0,
        price: 0,
        limit: 1,
      })
      // after : 1
      nextId = await util.token.nextId()
      expect(nextId).to.equal(1)
    })
  })
})
