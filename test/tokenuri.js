const { ethers } = require('hardhat');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('tokenURI', () => {
  it('tokenURI should return placeholder until baseURI is set', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "",
      permanent: false
    })
    let tokenURI = await util.token.tokenURI(1)
    expect(tokenURI).to.equal("ipfs://placeholder")
  })
  it('tokenURI should return the hardcoded placeholder even when placeholder isnt set', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "",
      supply: 10000,
      base: "",
      permanent: false
    })
    const defaultPlaceholder = "ipfs://bafkreieqcdphcfojcd2vslsxrhzrjqr6cxjlyuekpghzehfexi5c3w55eq";
    let tokenURI = await util.token.tokenURI(1)
    expect(tokenURI).to.equal(defaultPlaceholder)
  })
  it('tokenURI should return correctly when the baseURI is set', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: true
    })
    let tokenURI = await util.token.tokenURI(1)
    expect(tokenURI).to.equal("ipfs://bafy/1.json")
  })
  it('tokenURI should error if trying to get a tokenId above total supply', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: true
    })
    // Trying to get tokenURI above supply should fail
    let tokenURI = util.token.tokenURI(10001)
    await expect(tokenURI).to.be.revertedWith("15")

    // trying to get the exact total supply should work
    tokenURI = await util.token.tokenURI(10000)
    expect(tokenURI).to.equal("ipfs://bafy/10000.json")
  })
  it('tokenURI does not exist for tokenId 0', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://bafy/",
      permanent: true
    })
    let tokenURI = util.token.tokenURI(0)
    await expect(tokenURI).to.be.revertedWith("15")
  })
})
