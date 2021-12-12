const { ethers } = require('hardhat');
const { expect } = require('chai')
const InviteList = require('invitelist');
const path = require('path')
const Util = require('./util.js')
const util = new Util()
const ro = async () => {
  const [deployer] = await ethers.getSigners();
  let Royalty = await ethers.getContractFactory('Royalty');
  let royalty = await Royalty.deploy()
  await royalty.deployed();
  return royalty
}
describe('royalty', () => {
  it('default royaltyInfo is sending 0 ETH to 0x0 address', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let r = await util.token.royaltyInfo(1, "" + Math.pow(10, 18));

    // If setRoyalty is not called, the default option is 
    // - royaltyAmount: 0
    // - receiver: 0 address
    expect(r.receiver).to.equal("0x0000000000000000000000000000000000000000")
    expect(r.royaltyAmount.toString()).to.equal("0")
  })
  it('when royalty address is set, it should work', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let royalty = await ro()
    let tx = await util.token.setRoyalty(royalty.address)
    await tx.wait()
    let g = await util.token.royalty()
    let r = await util.token.royaltyInfo(1, "1000000000000000000")
    expect(r.royaltyAmount.toString()).to.equal("300000000000000000")
    //expect(r.receiver).to.equal(royalty.address)
    expect(r.receiver).to.equal(util.token.address)
    /*
    expect(r.receiver).to.equal(deployer.address)
    expect(r.royaltyAmount.toString()).to.equal("" + Math.pow(10, 18))
    */
  })
  it('cannot set royalty once made permanent', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://",
      permanent: true
    })
    let royalty = await ro()
    let tx = util.token.setRoyalty(royalty.address)
    await expect(tx).to.be.revertedWith("16")
  })
})
