const { ethers } = require('hardhat');
const { expect } = require('chai')
const InviteList = require('invitelist');
const path = require('path')
const Util = require('./util.js')
const util = new Util()
const FACTORIA = "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41"
const makeMoney = async (cost, count, retain) => {
  if (!retain) {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
  }
  let tx = await util.token.setInvite(util.all, util._cid, {
    start: 0,
    price: "" + cost,
    limit: 10000000,
  })
  await tx.wait()
  let c = await util.token.invite(util.all)
  let aliceToken = util.getToken(util.alice)
  // alice mints to contract
  tx = await aliceToken.mint({
    key: util.all,
    proof: [],
  }, count, {
    value: ethers.BigNumber.from("" + cost).mul(count).toString()
  })

  // contract balance
  let contractBalance = await ethers.provider.getBalance(util.token.address);

  // deployer withdraws from contract
  let oldBalance = await ethers.provider.getBalance(util.deployer.address);
  tx = await util.token.withdraw()
  let r = await tx.wait()
  let spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
  let newBalance = await ethers.provider.getBalance(util.deployer.address);
  return {
    spent: spentEth,
    before: oldBalance,
    after: newBalance
  }
}
const setup = async () => {
  await util.deploy();
  await util.clone(util.deployer.address, "test", "T", {
    placeholder: "ipfs://placeholder",
    supply: 10000,
    base: "ipfs://"
  })
}
const invite = async (cost) => {
  let tx = await util.token.setInvite(util.all, util._cid, {
    start: 0,
    price: "" + cost,
    limit: 10000000,
  })
  await tx.wait()
}
describe('withdraw', () => {
  it('default: owner can withdraw', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    // Make some money
    // 1. invite people
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: "" + Math.pow(10, 15),
      limit: 3,
    })
    await tx.wait()
    // 2. Let alice mint => now the contract has some revenue
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 3, {
      value: "" + Math.pow(10, 15) * 3
    })
    await tx.wait()
    let owner = await util.token.ownerOf(1)
    expect(owner).to.equal(util.alice.address)
    // Check the contract balance
    let contractBalance = await ethers.provider.getBalance(util.token.address);
    expect(contractBalance).to.equal(Math.pow(10, 15) * 3)

    // Save the deployer balance before withdrawing
    let oldBalance = await ethers.provider.getBalance(util.deployer.address);
    // Save the factoria balance before withdrawing
    let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);

    // WITHDRAW!
    // Factoria takes 1%
    // The rest 99% goes to the deployer
    tx = await util.token.withdraw()
    let r = await tx.wait()

    // The "after" deployer balance should equal:
    // The "before" deployer balance - eth spent for withdraw() + revenue (0.003 ETH) - factoria fee (0.0003 ETH)
    let spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
    let expectedBalance = oldBalance
      .sub(spentEth)
      .add(ethers.BigNumber.from(Math.pow(10, 15)).mul(3))
      .sub(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).div(100))


    // The deployer's "after" balance should be as expected
    let deployerAfterBalance = await ethers.provider.getBalance(util.deployer.address);
    expect(deployerAfterBalance).to.equal(expectedBalance)

    // The contract's "after" balance should be 0 because it's all withdrawn
    let contractAfterBalance = await ethers.provider.getBalance(util.token.address);
    expect(contractAfterBalance).to.equal(0)

    // Factoria's "before" balance should be 0
    expect(factoriaBalanceBefore).to.equal(0)
    // Factoria's "after" balance should be 0.0003 ETH
    let factoriaAfterBalance = await ethers.provider.getBalance(FACTORIA);
    expect(factoriaAfterBalance).to.equal(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).div(100))


  })
  it('FACTORIA takes fee ONLY UP TO 1 ETH cap', async () => {

    // A. 0.1ETH * 2000 => 200 ETH revenue => 1% of 200ETH should be 2ETH but because of the cap, the fee is 1 ETH
    let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    let r = await makeMoney(Math.pow(10, 17), 2000)
    let factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);
    // Final result is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before.sub(r.spent)
      // plus revenue (200ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 20)).mul(2))
      // minus fee (1ETH capped)
      .sub(ethers.BigNumber.from("" + Math.pow(10, 18)))
    )
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 18)))
    )

    // B. 0.1ETH * 100 => 10 ETH revenue => 1% FEE == 0.1 ETH
    factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    r = await makeMoney(Math.pow(10, 17), 100)
    factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);
    // Final result is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before
      // minus the eth spent for withdraw
      .sub(r.spent)
      // plus revenue (200ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 19)))
      // minus fee (0.1ETH)
      .sub(ethers.BigNumber.from("" + Math.pow(10, 17)))
    )
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)))
    )

  })
  it('multiple withdrawals', async () => {


    // Withdraw multiple times
    await setup()
    await invite(Math.pow(10, 17))

    // Step 1. 0.1ETH * 100 => 10 ETH revenue => 0.1 ETH fee
    let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    r = await makeMoney(Math.pow(10, 17), 100, true) // make money without redeploying

    // Final result for the withdrawer's balance is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before
      // minus the eth spent for withdraw
      .sub(r.spent)
      // plus revenue (10ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 19)))
      // minus fee (0.1ETH)
      .sub(ethers.BigNumber.from("" + Math.pow(10, 17)))
    )

    // Factoria balance has increased by 0.1 ETH
    let factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)))
    )


    // Step 2. 0.2ETH * 100 => 20 ETH revenue => 0.2 ETH fee
    await invite(Math.pow(10, 17)*2)

    factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    r = await makeMoney(Math.pow(10, 17)*2, 100, true)  // make money without redeploying
    factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

    // Final result is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before
      // minus the eth spent for withdraw()
      .sub(r.spent)
      // plus revenue (20ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(2))
      // minus fee (0.2ETH)
      .sub(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(2))
    )

    // Factoria balance should be 0.2ETH richer than before
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(2))
    )


    // Step 3. 0.6ETH * 100 => 60 ETH revenue => 0.6 ETH fee
    await invite(Math.pow(10, 17)*6)
    factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    r = await makeMoney(Math.pow(10, 17)*6, 100, true) // make money without redeploying
    factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

    // Final result is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before
      // minus the eth spent for withdraw()
      .sub(r.spent)
      // plus revenue (20ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(6))
      // minus fee (0.2ETH)
      .sub(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(6))
    )

    // Factoria balance should have increased by 0.6ETH
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(6))
    )

    // Step 4. 0.3ETH * 100 => 30 ETH revenue => (1 - 0.2 - 0.1 - 0.6) = 0.1 ETH fee
    await invite(Math.pow(10, 17)*3)
    factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    r = await makeMoney(Math.pow(10, 17)*3, 100, true) // make money without redeploying
    factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

    // Final result is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before
      // minus the eth spent for calling withdraw()
      .sub(r.spent)
      // plus revenue (30ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(3))
      // minus fee (0.2ETH)
      .sub(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(1))
    )
    // Factoria balance should have increased by 0.1ETH
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(1))
    )


    // Step 5. 10ETH * 100 => 1000 ETH revenue => The 1ETH fee cap has been reached so no more fee going forward:  0 fee
    await invite(Math.pow(10, 19))
    factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
    r = await makeMoney(Math.pow(10, 18)*10, 100, true)   // make money without redeploying  
    factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

    // Final result is equal to
    expect(r.after).to.equal(
      // the Previous balance
      r.before
      // minus the eth spent for withdraw()
      .sub(r.spent)
      // plus revenue (20ETH)
      .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(100))
      // no fee (0)
    )

    // Factoria didn't make any money
    expect(factoriaBalanceAfter).to.equal(
      factoriaBalanceBefore
    )


  })
  it('default: can not withdraw if youre not the owner', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    // make some money
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: "" + Math.pow(10, 15),
      limit: 3,
    })
    await tx.wait()
    let c = await util.token.invite(util.all)
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 3, {
      value: "" + Math.pow(10, 15) * 3
    })
    await tx.wait()

    // Alice tries to withdraw when she doesn't own the contract
    tx = aliceToken.withdraw()
    await expect(tx).to.be.revertedWith("unauthorized")

  })
  it('setWithdrawer can be only called by owner', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let aliceToken = util.getToken(util.alice)
    tx = aliceToken.setWithdrawer({
      account: util.alice.address,
    })
    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner")
  })
  it('set withdrawer to alice => withdraw sends money to alice', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: "" + Math.pow(10, 15),
      limit: 3,
    })
    await tx.wait()
    let c = await util.token.invite(util.all)
    let aliceToken = util.getToken(util.alice)
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 3, {
      value: "" + Math.pow(10, 15) * 3
    })
    await tx.wait()

    tx = await util.token.setWithdrawer({
      account: util.alice.address,
      permanent: false
    })
    await tx.wait()

    let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);

    let aliceBeforeBalance = await ethers.provider.getBalance(util.alice.address);

    // withdraw with deployer account
    tx = await util.token.withdraw()
    let contractBalance = await ethers.provider.getBalance(util.token.address);
    // the contract balance should be 0
    expect(contractBalance).to.equal(0)

    let aliceAfterBalance = await ethers.provider.getBalance(util.alice.address);
    // alice balance should have increased
    expect(aliceAfterBalance).to.equal(
      aliceBeforeBalance.add(
        ethers.BigNumber.from(Math.pow(10, 15)).mul(3).mul(99).div(100)
      )
    )

    // factoria blance should have increased
    let factoriaBalance = await ethers.provider.getBalance(FACTORIA);
    expect(factoriaBalance).to.equal(
      factoriaBalanceBefore.add(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).div(100))
    )

  })
  it('owner or withdrawer can withdraw', async () => {
    await util.deploy();
    await util.clone(util.deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await util.token.setInvite(util.all, util._cid, {
      start: 0,
      price: "" + Math.pow(10, 15),
      limit: 1000,
    })
    await tx.wait()
    let c = await util.token.invite(util.all)
    let aliceToken = util.getToken(util.alice)

    tx = await util.token.setWithdrawer({
      account: util.alice.address,
      permanent: false
    })
    await tx.wait()

    // mint, and withdraw with deployer account
    tx = await aliceToken.mint({
      key: util.all,
      proof: [],
    }, 3, {
      value: "" + Math.pow(10, 15) * 3
    })
    await tx.wait()

    let beforeBalance = await ethers.provider.getBalance(util.alice.address);

    // withdrawn by DEPLOYER (not alice)
    // which means alice didn't pay any gas.
    tx = await util.token.withdraw()
    let r = await tx.wait()
    let afterBalance = await ethers.provider.getBalance(util.alice.address);
    let spentEth = 0 // no gas spent because alice didn't trigger withdraw
    expect(afterBalance).to.equal(
      beforeBalance
      .sub(spentEth)
      .add(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).mul(99).div(100))
    )
    // The contract balance is now 0
    let contractBalance = await ethers.provider.getBalance(util.token.address);
    expect(contractBalance).to.equal(0)

    // mint, and withdraw with alice account => should work
    tx = await util.token.mint({
      key: util.all,
      proof: [],
    }, 5, {
      value: "" + Math.pow(10, 15) * 5
    })
    await tx.wait()

    // Withdran by Alice (the withdrawer)
    beforeBalance = await ethers.provider.getBalance(util.alice.address);
    tx = await aliceToken.withdraw()
    r = await tx.wait()
    spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
    afterBalance = await ethers.provider.getBalance(util.alice.address);

    // Withdrawn by Alice account, so alice spent some gas.
    expect(afterBalance).to.equal(
      beforeBalance
      .sub(spentEth)
      .add(ethers.BigNumber.from(Math.pow(10, 15)).mul(5).mul(99).div(100))
    )

    // the contract balance is 0
    contractBalance = await ethers.provider.getBalance(util.token.address);
    expect(contractBalance).to.equal(0)


  })
})
