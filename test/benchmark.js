const { ethers } = require('hardhat');
const { CID } = require('multiformats/cid');
const { expect } = require('chai')
const path = require('path')
const Util = require('./util.js')
const util = new Util()
describe('benchmark', () => {
  it('compare single mint vs multiple mint', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 100000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 10000,
    })
    await tx.wait()

    let logs = await util.globalLogs()
    let lastLog = logs[logs.length-1];
    let hex = "1220" + lastLog.args.cid.slice(2)

    const hexes = hex.match(/../g)
    let bytes = new Uint8Array(hexes.map(b => parseInt(b, 16)))
    const actual_cid = CID.decode(bytes).toV1().toString()

    let expected_cid = 'bafybeifpcgydc47j67wv7chqzbi56sbnee72kenmn5si66wpkqnghxsbx4'
    expect(actual_cid).to.equal(expected_cid)

    tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: 0,
      limit: 10000,
    })
    await tx.wait()

    let aliceToken = util.getToken(util.alice)

    for(let i=1; i<=30; i++) {
      tx = await aliceToken.mint({
        key: util.all,
        proof: [],
      }, i)
      let receipt = await tx.wait()
      let gasUsed = receipt.gasUsed
      console.log("gas", gasUsed.toString(), i)
    }
  })
  it.skip('try gifting a lot of tokens at once', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    await util.token.gift(util.bob.address,5000)
  })
})
